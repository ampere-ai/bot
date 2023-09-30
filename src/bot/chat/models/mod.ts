import type { Bot, ComponentEmoji } from "@discordeno/bot";

import type { ConversationMessage, ConversationUserMessage } from "../../types/conversation.js";
import type { RestrictionName } from "../../utils/restriction.js";
import type { CommandCooldown } from "../../types/command.js";
import type { DBEnvironment } from "../../../db/types/mod.js";
import type { Emitter } from "../../utils/event.js";
import type { HistoryData } from "../history.js";

import chatgpt from "./chatgpt.js";
import mistral from "./mistral.js";
import llama from "./llama.js";
import gpt4 from "./gpt-4.js";
import bard from "./bard.js";

export interface ChatModel {
	/** Name of the chat model */
	name: string;

	/** Identifier of the chat model */
	id: string;

	/** Description of the chat model */
	description: string;

	/** Emoji of the chat model */
	emoji: ComponentEmoji | string;

	/** Which users this chat model is restricted to */
	restrictions?: RestrictionName[];

	/** Cool-down for this model */
	cooldown?: CommandCooldown;

	/* Initial instructions to pass to the model */
	initialPrompt?: ConversationMessage | ConversationMessage[];

	/** Limits of the model, in terms of tokens */
	maxTokens: number;

	/** Handler for the chat model */
	handler: (options: ChatModelHandlerOptions) => Promise<ChatModelResult> | ChatModelResult;
}

interface ChatModelHandlerOptions {
	bot: Bot;
	env: DBEnvironment;
	history: HistoryData;
	input: ConversationUserMessage;
	emitter: Emitter<ChatModelResult>;
}

type ChatModelFinishReason = "stop" | "length";

export interface ChatModelResult {
	/** Result message */
	content: string;

	/** Cost of the generation */
	cost?: number;

	/** Why the generation stopped */
	finishReason?: ChatModelFinishReason;
	
	/** Whether the generation is done */
	done: boolean;
}

export const CHAT_MODELS: ChatModel[] = [
	chatgpt, gpt4, llama, mistral, bard
];