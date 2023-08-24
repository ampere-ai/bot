import type { Bot, Message } from "@discordeno/bot";

import { type ButtonComponent, MessageComponentTypes, ButtonStyles, Embed } from "@discordeno/bot";
import { setTimeout as delay } from "timers/promises";
import { randomUUID } from "crypto";

import type { Conversation, ConversationResult, ConversationUserMessage } from "../types/conversation.js";
import type { DBEnvironment } from "../../db/types/mod.js";

import { getLoadingIndicatorFromUser, loadingIndicatorToString } from "../../db/types/user.js";
import { cooldownNotice, getCooldown, hasCooldown, setCooldown } from "../utils/cooldown.js";
import { transformResponse, type MessageResponse, EmbedColor } from "../utils/response.js";
import { banNotice, isBanned, moderate, moderationNotice } from "../moderation/mod.js";
import { CHAT_MODELS, type ChatModel, type ChatModelResult } from "./models/mod.js";
import { ModerationSource } from "../moderation/types/mod.js";
import { SettingsLocation } from "../types/settings.js";
import { TONES, type ChatTone } from "./tones/mod.js";
import { ResponseError } from "../error/response.js";
import { handleError } from "../moderation/error.js";
import { getSettingsValue } from "../settings.js";
import { CHAT_PLUGINS } from "./plugins.js";
import { buildHistory } from "./history.js";
import { Emitter } from "../utils/event.js";
import { charge } from "../premium.js";

interface ExecuteOptions {
	bot: Bot;
	conversation: Conversation;
	input: ConversationUserMessage;
	model: ChatModel;
	tone: ChatTone;
	env: DBEnvironment;
	emitter: Emitter<ConversationResult>;
}

/** Set of currently running generations */
export const runningGenerations = new Set<bigint>();

export async function handleMessage(bot: Bot, message: Message) {
	if (message.author.id === bot.id || message.content.length === 0) return;
	if (!mentions(bot, message)) return;

	if (runningGenerations.has(message.author.id)) throw new ResponseError({
		message: "You already have a request running; *wait for it to finish*", emoji: "😔"
	});

	const conversation: Conversation = await bot.db.fetch("conversations", message.author.id);

	const env = await bot.db.env(message.author.id, message.guildId);
	const type = bot.db.type(env);

	if (hasCooldown(conversation)) {
		const { remaining } = getCooldown(conversation)!;
		const reply = await message.reply(cooldownNotice(conversation, env));

		return void setTimeout(() => {
			reply.delete().catch(() => {});
		}, remaining);
	}

	if (isBanned(env.user)) return void await message.reply(
		banNotice(env.user, isBanned(env.user)!)
	);

	/* User's loading indicator */
	const indicator = getLoadingIndicatorFromUser(env.user);

	const model = getModel(env);
	const tone = getTone(env);

	/* Event emitter, to receive partial results */
	const emitter = new Emitter<ConversationResult>();

	/* Input, to pass to the AI model */
	const input: ConversationUserMessage = {
		role: "user", content: clean(message)
	};

	/* ID of the message to edit, if applicable */
	let messageID: bigint | null = null;
	let queued = false;

	/* Handler for partial messages */
	const handler = async (result: ConversationResult) => {
		try {
			if (messageID === null && queued) return;

			if (messageID === null) {
				queued = true;

				const reply = await message.reply(
					format({ bot, message, env, model, tone, result })
				);

				messageID = reply.id;
				queued = false;
			} else {
				await bot.helpers.editMessage(
					message.channelId, messageID,
					
					transformResponse(format({
						bot, message, env, model, tone, result
					}))
				);
			}
		} catch {
			queued = false;
		}
	};

	/* Whether partial messages should be enabled */
	const partial = getSettingsValue<boolean>(env.user, "chat:partial_messages");
	if (partial) emitter.on(handler);

	const moderation = await moderate({
		bot, env, content: input.content, source: ModerationSource.ChatFromUser
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
				message.channelId, message.id, `${indicator.emoji.name}:${indicator.emoji.id}`
			)
		]);

		const result = await execute({
			bot, conversation, emitter, env, input, model, tone
		});

		/* Wait for the queued message to send. */
		while (queued) {
			await delay(500);
		}

		if (messageID !== null) {
			await bot.helpers.editMessage(
				message.channelId, messageID,
				
				transformResponse(format({
					bot, message, env, model, tone, result
				}))
			);
		} else {
			await message.reply(
				format({ bot, message, env, model, tone, result })
			);
		} 

	} catch (error) {
		await message.reply(
			await handleError(bot, {
				error: error as Error, guild: message.guildId
			})
		);
	} finally {
		await bot.helpers.deleteOwnReaction(
			message.channelId, message.id, `${indicator.emoji.name}:${indicator.emoji.id}`
		);

		runningGenerations.delete(message.author.id);
	}

	/* Apply the model's specific cool-down to the user. */ 
	if (model.cooldown && model.cooldown[type]) {
		setCooldown(conversation, model.cooldown[type]!);
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

		if (!data.done && Date.now() - lastEvent > 5 * 1000) {
			options.emitter.emit(formatResult(data, id));
			lastEvent = Date.now();
		}
	});

	/* Execute the model generation handler. */
	options.model.handler({
		bot, env, input, history, emitter
	});

	/* Wait for the generation to finish, or throw an error when it times out. */
	const result = formatResult(
		await emitter.wait(), id
	);

	/* Add the generated response to the user's history. */
	options.conversation.history.push({
		id, input, output: result.message
	});

	/** Apply all updates to the conversation's history. */
	await bot.db.update("conversations", options.conversation.id, options.conversation);

	/* Charge the user accordingly, if they're using the pay-as-you-go plan. */
	await charge(bot, env, {
		type: "chat", used: result.cost ?? 0, data: {
			model: options.model.id,
			tone: options.tone.id
		}
	});

	return result;
}

function formatResult(result: ChatModelResult, id: string): ConversationResult {
	return {
		id, done: result.done,
		message: { role: "assistant", content: result.content },
		tool: result.tool, cost: result.cost, finishReason: result.finishReason
	};
}

/** Format the chat model's response to be displayed on Discord. */
function format(
	{ bot, message, env, result, model, tone }: Pick<ExecuteOptions, "bot" | "env" | "model" | "tone"> & {
		message: Message, result: ConversationResult
	}
): MessageResponse {
	const indicator = getLoadingIndicatorFromUser(env.user);
	const emoji = loadingIndicatorToString(indicator);

	const response: MessageResponse = {};
	let content = result.message.content.trim();

	const components: ButtonComponent[] = [];
	const embeds: Embed[] = [];

	/** Which plugin was used, if applicable */
	const plugin = result.tool && result.tool.name !== null
		? CHAT_PLUGINS.find(p => p.id === result.tool!.name) ?? null : null;

	console.log(plugin);

	if (result.message.content.length === 0 && plugin) {
		embeds.push({
			description: `Executing plugin <:${plugin.emoji.name}:${plugin.emoji.id}> **...** ${emoji}`,
			color: EmbedColor.Orange
		});
	} else if (result.message.content.length > 0 && plugin && result.done) {
		components.push({
			label: plugin.name, emoji: plugin.emoji,
			type: MessageComponentTypes.Button,
			style: ButtonStyles.Secondary,
			customId: "settings:view:plugins"
		});
	} 

	if (result.done) {
		components.push({
			type: MessageComponentTypes.Button,
			label: model.name,
			emoji: typeof model.emoji === "string" ? { name: model.emoji } : model.emoji,
			customId: `settings:view:${SettingsLocation.User}:chat:model`,
			style: ButtonStyles.Secondary
		});

		if (tone.id !== TONES[0].id) components.push({
			type: MessageComponentTypes.Button,
			label: tone.name,
			emoji: typeof tone.emoji === "string" ? { name: tone.emoji } : tone.emoji,
			customId: `settings:view:${SettingsLocation.User}:chat:tone`,
			style: ButtonStyles.Secondary
		});

		if (components.length < 2) components.push({
			type: MessageComponentTypes.Button,
			label: `@${message.author.username}`,
			emoji: { name: bot.db.icon(env) },
			style: ButtonStyles.Secondary, disabled: true,
			customId: randomUUID()
		});
	}

	if (result.finishReason === "length") {
		embeds.push({
			description: "This message reached the length limit, and was not fully generated.",
			color: EmbedColor.Yellow
		});

		content += " **...**";
	}

	if (components.length > 0) response.components = [ {
		type: MessageComponentTypes.ActionRow,
		components: components as [ ButtonComponent ]
	} ];

	if (embeds.length > 0) response.embeds = embeds;

	/* Generated response, with the pending indicator */
	const formatted: string = `${content} **...** ${emoji}`;

	if (formatted.length > 2000) {
		response.file = {
			name: `${model.id}-${tone.id}-${Date.now()}.txt`, blob: Buffer.from(content).toString("base64")
		};

		response.content = !result.done ? emoji : "";
	} else {
		response.content = !result.done ? formatted : content;
	}

	return response;
}

/** Reset the user's conversation. */
export async function resetConversation(bot: Bot, env: DBEnvironment) {
	const conversation = await bot.db.fetch<Conversation>("conversations", env.user.id);
	if (conversation.history.length === 0) return;

	await bot.db.update("conversations", conversation, {
		history: []
	});
}

function getModel(env: DBEnvironment) {
	const id: string = getSettingsValue(env.user, "chat:model");
	return CHAT_MODELS.find(m => m.id === id) ?? CHAT_MODELS[0];
}

function getTone(env: DBEnvironment) {
	const id: string = getSettingsValue(env.user, "chat:tone");
	return TONES.find(t => t.id === id) ?? TONES[0];
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