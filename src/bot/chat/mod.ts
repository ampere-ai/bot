import type { ActionRow, Bot, ComponentEmoji, Message } from "@discordeno/bot";

import { type ButtonComponent, MessageComponentTypes, ButtonStyles, Embed } from "@discordeno/bot";
import { setTimeout as delay } from "timers/promises";
import { randomUUID } from "crypto";

import type { Conversation, ConversationResult, ConversationUserMessage } from "../types/conversation.js";
import { MarketplaceIndicator, type MarketplacePersonality } from "../../db/types/marketplace.js";
import type { DBEnvironment } from "../../db/types/mod.js";

import { infractionNotice, isBanned, moderate, moderationNotice } from "../moderation/mod.js";
import { cooldownNotice, getCooldown, hasCooldown, setCooldown } from "../utils/cooldown.js";
import { transformResponse, type MessageResponse, EmbedColor } from "../utils/response.js";
import { type ModerationResult, ModerationSource } from "../moderation/types/mod.js";
import { CHAT_MODELS, type ChatModel, type ChatModelResult } from "./models/mod.js";
import { getMarketplaceSetting } from "../marketplace.js";
import { SettingsLocation } from "../types/settings.js";
import { ResponseError } from "../errors/response.js";
import { handleError } from "../moderation/error.js";
import { emojiToString } from "../utils/helpers.js";
import { pickAdvertisement } from "../campaign.js";
import { getSettingsValue } from "../settings.js";
import { buildHistory } from "./history.js";
import { Emitter } from "../utils/event.js";
import { charge } from "../premium.js";

interface ExecuteOptions {
	bot: Bot;
	conversation: Conversation;
	input: ConversationUserMessage;
	model: ChatModel;
	personality: MarketplacePersonality;
	env: DBEnvironment;
	emitter: Emitter<ConversationResult>;
}

/** Set of currently running generations */
export const runningGenerations = new Set<bigint>();

/** How often to update the partial message, if that setting is enabled */
const MESSAGE_EDIT_INTERVAL = 5 * 1000;

export async function handleMessage(bot: Bot, message: Message) {
	if (message.author.bot || message.author.id === bot.id || message.content.length === 0) return;
	if (!mentions(bot, message)) return;

	if (runningGenerations.has(message.author.id)) throw new ResponseError({
		message: "You already have a request running; *wait for it to finish*", emoji: "😔"
	});

	/* Input, to pass to the AI model */
	const input: ConversationUserMessage = {
		role: "user", content: clean(message)
	};

	if (input.content.length === 0) {
		await bot.helpers.addReaction(message.channelId, message.id, "👋");
		return;
	}

	const conversation: Conversation = await bot.db.fetch("conversations", message.author.id);

	const env = await bot.db.env(message.author.id, message.guildId);
	const type = bot.db.type(env);

	if (hasCooldown(conversation)) {
		const { remaining } = getCooldown(conversation)!;

		await bot.helpers.addReaction(message.channelId, message.id, "🐢").catch(() => {});
		const reply = await message.reply(cooldownNotice(bot, env, conversation));

		return void setTimeout(() => {
			reply.delete().catch(() => {});
		}, remaining);
	}

	if (isBanned(env.user)) return void await message.reply(
		infractionNotice(env.user, isBanned(env.user)!)
	);

	/* User's loading indicator */
	const indicator = (
		await getMarketplaceSetting<MarketplaceIndicator>(bot, env, "indicator")
	).data;

	const personality = await getMarketplaceSetting<MarketplacePersonality>(bot, env, "personality");
	const model = getModel(bot, env);

	/* Event emitter, to receive partial results */
	const emitter = new Emitter<ConversationResult>();

	/* ID of the message to edit, if applicable */
	let messageID: bigint | null = null;
	let queued = false;

	/* Handler for partial messages */
	const handler = async (result: ConversationResult) => {
		try {
			if (messageID === null && queued) return;

			if (messageID === null) {
				queued = true;

				const reply = await message.reply(await format({
					env, model, personality, indicator, result, moderation
				}));

				messageID = reply.id;
				queued = false;
			} else {
				await bot.helpers.editMessage(
					message.channelId, messageID,
					
					transformResponse(await format({
						env, model, personality, indicator, result, moderation
					}))
				);
			}
		} catch {
			queued = false;
		}
	};

	/* Whether partial messages should be enabled */
	const partial = getSettingsValue<boolean>(bot, env, "user", "chat:partial_messages");
	if (partial) emitter.on(handler);

	const moderation = await moderate({
		bot, env, user: message.author, content: input.content, source: ModerationSource.ChatFromUser
	});

	if (moderation.blocked) return void await message.reply(
		moderationNotice({ result: moderation })
	);

	/* Start the generation process. */
	try {
		runningGenerations.add(message.author.id);

		await Promise.all([
			bot.helpers.triggerTypingIndicator(message.channelId),

			bot.helpers.addReaction(
				message.channelId, message.id, emojiToString(indicator)
			)
		]);

		const result = await execute({
			bot, conversation, emitter, env, input, model, personality
		});

		/* Wait for the queued message to send. */
		while (queued) {
			await delay(500);
		}

		if (messageID !== null) {
			await bot.helpers.editMessage(
				message.channelId, messageID,
				
				transformResponse(await format({
					env, model, personality, indicator, result, moderation
				}))
			);
		} else {
			await message.reply(await format({
				env, model, personality, indicator, result, moderation
			}));
		} 

	} catch (error) {
		await message.reply(
			await handleError(bot, {
				error, guild: message.guildId
			})
		).catch(() => {});
		
	} finally {
		await bot.helpers.deleteOwnReaction(
			message.channelId, message.id, emojiToString(indicator)
		).catch(() => {});

		runningGenerations.delete(message.author.id);
	}

	/* Apply the model's specific cool-down to the user. */ 
	if (model.cooldown && model.cooldown[type]) {
		setCooldown(
			bot, env, conversation, model.cooldown[type]!
		);
	}
}

/** Execute the chat request, on the specified model. */
async function execute(options: ExecuteOptions): Promise<ConversationResult> {
	const { bot, env, input } = options;
	const id = randomUUID();

	/* Build the chat history for the model. */
	const history = buildHistory(options);

	/* The event emitter for the chat model, to send partial results */
	const emitter = new Emitter<ChatModelResult>();

	/* When the last event was sent, timestamp */
	let lastEvent = Date.now();

	emitter.on(data => {
		if (data.content.trim().length === 0) return;

		if (!data.done && Date.now() - lastEvent > MESSAGE_EDIT_INTERVAL) {
			options.emitter.emit(formatResult(data, id));
			lastEvent = Date.now();
		}
	});

	/* Execute the model generation handler. */
	const result = formatResult(
		await options.model.handler({
			bot, env, input, history, emitter
		}), id
	);

	/* Add the generated response to the user's history. */
	options.conversation.history.push({
		id, input, output: result.message
	});

	/** Apply all updates to the conversation's history. */
	await updateConversation(bot, options.conversation, options.conversation);
	await bot.db.update("conversations", options.conversation.id, options.conversation);

	/* Charge the user accordingly, if they're using the pay-as-you-go plan. */
	await charge(bot, env, {
		type: "chat", used: result.cost ?? 0, data: {
			model: options.model.id
		}
	});

	return result;
}

function formatResult(result: ChatModelResult, id: string): ConversationResult {
	return {
		id, done: result.done,
		message: { role: "assistant", content: result.content.trim() },
		cost: result.cost, finishReason: result.finishReason
	};
}

/** Format the chat model's response to be displayed nicely on Discord. */
async function format(
	{ env, result, model, personality, indicator, moderation }: Pick<ExecuteOptions, "env" | "model" | "personality"> & {
		result: ConversationResult;
		indicator: ComponentEmoji;
		moderation: ModerationResult;
	}
) {
	const response: MessageResponse = {
		/* Disable @everyone and @here pings. */
		mentions: { parse: [], repliedUser: true },
	};

	let content = result.message.content.trim();

	const components: ActionRow[] = [];
	const buttons: ButtonComponent[] = [];

	const embeds: Embed[] = [];

	if (result.done) {
		buttons.push({
			type: MessageComponentTypes.Button,
			label: model.name,
			emoji: typeof model.emoji === "string" ? { name: model.emoji } : model.emoji,
			customId: `settings:view:${SettingsLocation.User}:chat:model`,
			style: ButtonStyles.Secondary
		});

		buttons.push({
			type: MessageComponentTypes.Button,
			label: personality.name,
			emoji: typeof personality.emoji === "string" ? { name: personality.emoji } : personality.emoji,
			customId: "market:category:personality",
			style: ButtonStyles.Secondary
		});

		const ad = await pickAdvertisement(env);

		if (ad) {
			components.push(ad.response.row);
			embeds.push(ad.response.embed);
		}
	}

	if (result.done && moderation.flagged) embeds.push(
		moderationNotice({ result: moderation, small: true }).embeds as Embed
	);

	if (result.finishReason === "length") {
		embeds.push({
			description: "This message reached the length limit, and was not fully generated.",
			color: EmbedColor.Yellow
		});

		content += " **...**";
	}

	if (buttons.length > 0) components.push({
		type: MessageComponentTypes.ActionRow,
		components: buttons as [ ButtonComponent ]
	});

	if (components.length > 0) response.components = components;
	if (embeds.length > 0) response.embeds = embeds;

	/* Generated response, with the loading indicator */
	const formatted = `${content} **...** ${emojiToString(indicator)}`;

	if (formatted.length > 2000) {
		response.file = {
			name: `${model.id}-${Date.now()}.txt`, blob: Buffer.from(content).toString("base64")
		};

		response.content = !result.done ? emojiToString(indicator) : "";
	} else {
		response.content = !result.done ? formatted : content;
	}

	return response;
}

/** Reset the user's conversation. */
export async function resetConversation(bot: Bot, env: DBEnvironment, conversation: Conversation) {
	/* Save the previous conversation to a dataset entry, if it's worth it. */
	if (conversation.history.length > 1) {
		const personality = await getMarketplaceSetting<MarketplacePersonality>(bot, env, "personality");
		const model = getModel(bot, env);

		await bot.api.dataset.add("conversation", conversation.uuid, {
			model: model.id, personality: personality.id,
			history: conversation.history
		});
	}

	/* Clear the history & generate a new unique dataset identifier. */
	await bot.db.update("conversations", conversation.id, {
		uuid: randomUUID(), history: []
	});
}

/** Update a user's conversation. */
export async function updateConversation(bot: Bot, conversation: Conversation, updates: Partial<Conversation>) {
	await bot.db.update("conversations", conversation, updates);
}

function getModel(bot: Bot, env: DBEnvironment) {
	const id: string = getSettingsValue(bot, env, "user", "chat:model");
	return CHAT_MODELS.find(m => m.id === id) ?? CHAT_MODELS[0];
}

/** Check whether the specified message pinged the bot. */
function mentions(bot: Bot, message: Message) {
	return message.mentionedUserIds.includes(bot.id) || !message.guildId;
}

/** Remove all bot & user mentions from the specified message. */
function clean(message: Message) {
	for (const id of message.mentionedUserIds) {
		message.content = message.content.replaceAll(`<@${id}>`, "").trim();
	}

	return message.content.trim();
}