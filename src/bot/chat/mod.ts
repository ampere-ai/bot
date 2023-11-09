import type { ActionRow, Bot, ComponentEmoji, Message } from "@discordeno/bot";

import { type ButtonComponent, MessageComponentTypes, ButtonStyles, Embed } from "@discordeno/bot";
import { setTimeout as delay } from "timers/promises";
import { randomUUID } from "crypto";

import type { Conversation, ConversationResult, ConversationUserMessage } from "../types/conversation.js";
import { MarketplaceIndicator, type MarketplacePersonality } from "../../db/types/marketplace.js";
import type { DBEnvironment } from "../../db/types/mod.js";

import { cooldownNotice, getCooldown, hasCooldown, setCooldown } from "../utils/cooldown.js";
import { transformResponse, type MessageResponse, EmbedColor } from "../utils/response.js";
import { CHAT_MODELS, type ChatModel, type ChatModelResult } from "./models/mod.js";
import { getMarketplaceSetting, localizeMarketplaceEntry } from "../marketplace.js";
import { SettingsLocation } from "../types/settings.js";
import { ResponseError } from "../errors/response.js";
import { handleError } from "../utils/error.js";
import { emojiToString } from "../utils/helpers.js";
import { getSettingsValue } from "../settings.js";
import { ToLocaleStrings } from "../i18n.js";
import { buildHistory } from "./history.js";
import { Emitter } from "../utils/event.js";
import { bot } from "../mod.js";

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
		message: "chat.errors.pending_request", emoji: "😔"
	});

	/* Input, to pass to the AI model */
	const input = toInputMessage(message);

	if (input.content.length === 0) {
		return bot.helpers.addReaction(message.channelId, message.id, "👋");
	}

	const conversation: Conversation = await bot.db.fetch("conversations", message.author.id);
	const env = await bot.db.env(message.author.id, message.guildId);

	if (hasCooldown(conversation)) {
		const { remaining } = getCooldown(conversation)!;

		await bot.helpers.addReaction(message.channelId, message.id, "🐢").catch(() => {});
		const reply = await message.reply(cooldownNotice(bot, env, conversation));

		return void setTimeout(() => {
			reply.delete().catch(() => {});
		}, remaining);
	}

	const indicator = (await getMarketplaceSetting<MarketplaceIndicator>(bot, env, "indicator")).data;
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
					env, model, personality, indicator, result
				}));

				messageID = reply.id;
				queued = false;
			} else {
				await bot.helpers.editMessage(
					message.channelId, messageID,
					
					transformResponse(await format({
						env, model, personality, indicator, result
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
					env, model, personality, indicator, result
				}))
			);
		} else {
			await message.reply(await format({
				env, model, personality, indicator, result
			}));
		} 

	} catch (error) {
		await message.reply(
			await handleError(bot, { env, error })
		).catch(() => {});
		
	} finally {
		await bot.helpers.deleteOwnReaction(
			message.channelId, message.id, emojiToString(indicator)
		).catch(() => {});

		runningGenerations.delete(message.author.id);
	}

	/* Apply the model's specific cool-down to the user. */
	setCooldown(env, conversation, model.cooldown ?? 15 * 1000);
}

/** Execute the chat request, with the user's selected model. */
async function execute(options: ExecuteOptions): Promise<ConversationResult> {
	const { bot, env, input } = options;
	const id = randomUUID();

	/* Build the chat history for the model. */
	const history = buildHistory(options);

	/* The event emitter for the chat model, to send partial results */
	const emitter = new Emitter<ChatModelResult>();

	/* When the last event was sent */
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
	await bot.db.update("conversations", options.conversation.id, options.conversation);

	return result;
}

function formatResult(result: ChatModelResult, id: string): ConversationResult {
	return {
		id, done: result.done,
		message: {
			content: result.content.trim(),

			/* Add all images generated by the plugins. */
			images: result.tools && result.tools.length > 0
				? result.tools.reduce<string[]>((arr, result) => [ ...arr, ...result.images ?? [] ], []) : undefined
		},
		cost: result.cost, finishReason: result.finishReason,
		tools: result.tools && result.tools.length > 0 ? result.tools : undefined
	};
}

/** Format the chat model's response to be displayed nicely on Discord. */
async function format(
	{ env, result, model, personality, indicator }: Pick<ExecuteOptions, "env" | "model" | "personality"> & {
		result: ConversationResult;
		indicator: ComponentEmoji;
	}
) {
	const response: MessageResponse = {
		/* Disable @everyone and @here pings. */
		mentions: { parse: [], repliedUser: true },
		env
	};

	let content = result.message.content.trim();

	const components: ToLocaleStrings<ActionRow>[] = [];
	const files: MessageResponse["files"] = [];
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

		const { name } = localizeMarketplaceEntry(personality, env);

		buttons.push({
			type: MessageComponentTypes.Button,
			label: name,
			emoji: typeof personality.emoji === "string" ? { name: personality.emoji } : personality.emoji,
			customId: "market:category:personality",
			style: ButtonStyles.Secondary
		});

		if (result.tools) {
			components.push({
				type: MessageComponentTypes.ActionRow,

				components: [
					{
						type: MessageComponentTypes.Button,
						label: { key: "chat.messages.plugins", data: { count: result.tools.length } },
						emoji: { name: "⚙️" },
						customId: `settings:view:${SettingsLocation.User}:chat:plugin`,
						style: ButtonStyles.Secondary
					},

					...result.tools.map(t => ({
						type: MessageComponentTypes.Button,
						label: `chat.plugins.${t.id}.name`,
						emoji: { name: bot.dynamic.plugins.find(p => p.id === t.id)!.emoji },
						customId: randomUUID(), disabled: true,
						style: t.failed ? ButtonStyles.Danger : ButtonStyles.Secondary
					}))
				] as any
			});
		}

		if (result.message.images) {
			result.message.images.forEach(image => {
				const name = `${randomUUID()}.png`;

				files.push({
					name, blob: image
				});

				embeds.push({
					image: { url: `attachment://${name}` },
					color: EmbedColor.Purple
				});
			});
		}
	}

	if (result.finishReason === "length") {
		embeds.push({
			description: "chat.messages.length",
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
		files.push({
			name: `${model.id}-${Date.now()}.txt`,
			blob: Buffer.from(content).toString("base64")
		});

		response.content = !result.done ? emojiToString(indicator) : "";
	} else {
		response.content = !result.done ? formatted : content;
	}

	response.files = files;
	return response;
}

/** Reset the user's conversation. */
export async function resetConversation(bot: Bot, conversation: Conversation) {
	await bot.db.update("conversations", conversation.id, {
		history: []
	});
}

function getModel(bot: Bot, env: DBEnvironment) {
	const id: string = getSettingsValue(bot, env, "user", "chat:model");
	return CHAT_MODELS.find(m => m.id === id) ?? CHAT_MODELS[0];
}

/** Check whether the specified message pinged the bot. */
function mentions(bot: Bot, message: Message) {
	return message.mentionedUserIds.includes(bot.id) || !message.guildId;
}

/** Convert a Discord message to a usable input message. */
function toInputMessage(message: Message): ConversationUserMessage {
	return {
		content: clean(message),

		images: message.attachments && message.attachments.length > 0
			? message.attachments.map(a => a.url) : undefined
	};
}

/** Remove all bot & user mentions from the specified message. */
function clean(message: Message) {
	for (const id of message.mentionedUserIds) {
		message.content = message.content.replaceAll(`<@${id}>`, "").trim();
	}

	return message.content.trim();
}