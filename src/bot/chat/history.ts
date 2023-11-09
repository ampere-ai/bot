import type { Bot } from "@discordeno/bot";

import { get_encoding } from "@dqbd/tiktoken";
const encoder = get_encoding("cl100k_base");

import type { APIChatMessage, Conversation, ConversationMessage, ConversationUserMessage } from "../types/conversation.js";
import type { MarketplacePersonality } from "../../db/types/marketplace.js";
import type { DBEnvironment } from "../../db/types/mod.js";
import type { ChatModel } from "./models/mod.js";

import { ChatError, ChatErrorType } from "../errors/chat.js";
import { getSettingsValue } from "../settings.js";
import { USER_LOCALES } from "../types/locale.js";

interface BuildHistoryOptions {
	bot: Bot;
	conversation: Conversation;
	input: ConversationUserMessage;
	model: ChatModel;
	personality: MarketplacePersonality;
	env: DBEnvironment;
}

export interface HistoryData {
	/** Maximum amount of tokens to generate */
	maxTokens: number;

	/** Amount of tokens used for the history */
	usedTokens: number;

	/** Which temperature to use; how creative the AI is */
	temperature: number;

	/** Messages in the history */
	messages: APIChatMessage[];
}

const MAX_LENGTH = {
	input: 800,
	output: 600
};

export function buildHistory({ bot, env, model, personality, conversation, input }: BuildHistoryOptions): HistoryData {
	let messages: APIChatMessage[] = [];
	let tokens = 0;
	
	let maxGenerationLength = MAX_LENGTH.output;
	const maxContextLength = MAX_LENGTH.input;

	if (getChatMessageLength(input) > maxContextLength) {
		throw new ChatError(ChatErrorType.Length);
	}

	do {
		if (messages.length > 0) messages = [];

		/* Add the model's and tone's initial prompts to the history. */
		if (model.initialPrompt) {
			if (Array.isArray(model.initialPrompt)) messages.push(...model.initialPrompt);
			else messages.push(model.initialPrompt);
		}

		if (personality.data.prompt) {
			if (Array.isArray(personality.data.prompt)) messages.push(...personality.data.prompt.map<APIChatMessage>(prompt => (
				{ role: "system", content: prompt }
			)));
			
			else messages.push({
				role: "system", content: personality.data.prompt
			});
		}

		/* The user's configured language */
		const localeID = getSettingsValue<string>(bot, env, "user", "general:language");
		const locale = USER_LOCALES.find(l => l.id === localeID)!;

		if (locale.id !== "en") messages.push({
			role: "system", content: `The user's configured language is ${locale.localName ? `${locale.localName}/${locale.name}` : locale.name}. If not told otherwise, you must prefer to speak that language.`
		});

		/* Map all of the system messages into a single one, to save tokens. */
		if (messages.length > 0) messages = [ {
			role: "system", content: messages.map(m => m.content).join("\n\n")
		} ];

		/** Add the conversation's history, if the personality doesn't disable it intentionally. */
		if (!personality.data.disableHistory) for (const entry of conversation.history) {
			messages.push(
				{ role: "user", content: entry.input.content },
				{ role: "assistant", content: entry.output.content }
			);
		}

		/* Add the user's request. */
		if (input.images && model.id === "gpt-4") {
			messages.push({ role: "user", content: [
				{ type: "text", text: input.content },
				...input.images.map(url => ({ type: "image_url", image_url: { url, detail: "low" } }))
			] });
		} else {
			messages.push({ content: input.content, role: "user" });
		}

		/* Tokens used for the entire history & prompt */
		tokens = getChatMessageLength(...messages);

		/* If the prompt itself exceeds the user-specific limit. */
		if (maxContextLength - tokens <= 0 && conversation.history.length === 0) {
			throw new ChatError(ChatErrorType.Length);
		}

		if (maxContextLength - tokens <= 0) conversation.history.shift();
		else break;
		
		/* Get the initial prompt. */
	} while (maxContextLength - tokens <= 0);

	maxGenerationLength = Math.min(
		model.maxTokens - tokens, maxGenerationLength
	);

	return {
		maxTokens: maxGenerationLength, usedTokens: tokens, temperature: 0.5, messages
	};
}

/** Count together all tokens contained in a list of conversation messages. */
function getChatMessageLength(...messages: (APIChatMessage | ConversationMessage)[]) {
	/* Total tokens used for the messages */
	let total = 0;

	for (const message of messages) {
		/* Map each property of the message to the number of tokens it contains. */
		const propertyTokenCounts = Object.values(message).filter(value => typeof value === "string").map(value => {
			/* Count the number of tokens in the property value. */
			return getMessageTokens(value);
		});

		/* Sum the number of tokens in all properties and add 4 for metadata. */
		total += propertyTokenCounts.reduce((a, b) => a + b, 4);
	}

	return total + 2;
}

/** Count together all the tokens in a string. */
function getMessageTokens(content: string) {
	return encoder.encode(content).length;
}