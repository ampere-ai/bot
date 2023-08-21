import type { ConversationMessage, ConversationUserMessage } from "../../types/conversation.js";
import type { DiscordComponentEmoji } from "../../types/discordeno.js";
import type { RestrictionName } from "../../utils/restriction.js";
import type { DBEnvironment } from "../../../db/types/mod.js";
import type { HistoryData } from "../history.js";
import type { DiscordBot } from "../../mod.js";

import { Emitter } from "../../utils/event.js";

import ChatGPT from "./chatgpt.js";
import Dummy from "./dummy.js";

export interface ChatModel {
	/** Name of the chat model */
	name: string;

	/** Identifier of the chat model */
	id: string;

	/** Description of the chat model */
	description: string;

	/** Emoji of the chat model */
	emoji: DiscordComponentEmoji | string;

	/** Which users this chat model is restricted to */
	restrictions?: RestrictionName[];

	/* Initial instructions to pass to the request */
	initialPrompt?: ConversationMessage;

	/** Limits of the model, in terms of tokens */
	maxTokens: number;

	/** Handler for the chat model */
	handler: (options: ChatModelHandlerOptions) => Promise<void> | void;
}

interface ChatModelHandlerOptions {
	bot: DiscordBot;
	env: DBEnvironment;
	history: HistoryData;
	input: ConversationUserMessage;
	emitter: Emitter<ChatModelResult>;
}

export interface ChatModelResult {
	/** Result message */
	content: string;
	
	/** Whether the generation is done */
	done: boolean;
}

export const CHAT_MODELS: ChatModel[] = [
	ChatGPT, Dummy
];