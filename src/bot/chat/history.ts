import type { Bot } from "@discordeno/bot";

import { get_encoding } from "@dqbd/tiktoken";
const encoder = get_encoding("cl100k_base");

import type { Conversation, ConversationMessage, ConversationUserMessage } from "../types/conversation.js";
import type { MarketplacePersonality } from "../../db/types/marketplace.js";
import type { DBEnvironment } from "../../db/types/mod.js";
import type { ChatModel } from "./models/mod.js";

import { ChatError, ChatErrorType } from "../errors/chat.js";

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

	/** Messages in the history */
	messages: ConversationMessage[];
}

const MAX_LENGTH = {
	input: {
		user: 600,
		voter: 650,
		subscription: 900,
		plan: 1000
	},

	output: {
		user: 300,
		voter: 350,
		subscription: 650,
		plan: 1000
	}
};

export function buildHistory({ bot, env, model, personality, conversation, input }: BuildHistoryOptions): HistoryData {
	let messages: ConversationMessage[] = [];
	let tokens = 0;

	const type = bot.db.type(env);
	
	/** TODO: Limits for pay-as-you-go members */
	let maxGenerationLength = Math.min(MAX_LENGTH.output[type], model.maxTokens);
	const maxContextLength = Math.min(MAX_LENGTH.input[type], model.maxTokens);

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
			if (Array.isArray(personality.data.prompt)) messages.push(...personality.data.prompt.map<ConversationMessage>(prompt => (
				{ role: "system", content: prompt }
			)));
			
			else messages.push({
				role: "system", content: personality.data.prompt
			});
		}

		/** Add the conversation's history, if the tone didn't disable it intentionally. */
		if (!personality.data.disableHistory) for (const entry of conversation.history) {
			messages.push(
				{ role: "user", content: entry.input.content },
				{ role: "assistant", content: entry.output.content }
			);
		}

		/* Add the user's request. */
		messages.push(input);

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

	console.log(messages);

	return {
		maxTokens: maxGenerationLength, usedTokens: tokens, messages
	};
}

/** Count together all tokens contained in a list of conversation messages. */
function getChatMessageLength(...messages: ConversationMessage[]) {
	/* Total tokens used for the messages */
	let total = 0;

	for (const message of messages) {
		/* Map each property of the message to the number of tokens it contains. */
		const propertyTokenCounts = Object.values(message).map(value => {
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