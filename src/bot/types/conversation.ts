import type { ChatModelResult, ChatToolResult } from "../chat/models/mod.js";

export interface Conversation {
	/** ID of the conversation */
	id: string;

	/** Interactions in the history */
	history: ConversationInteraction[];
}

export interface ConversationInteraction {
	/** The ID of the interaction */
	id: string;

	input: ConversationMessage;
	output: ConversationMessage;
}

export type ConversationResult = Pick<ChatModelResult, "done" | "cost" | "finishReason"> & {
	/** The ID of the message */
	id: string;
	
	/** The resulting message */
	message: ConversationMessage;

	/** Which tools were used */
	tools?: ChatToolResult[];
}

export interface APIChatContent {
	type: string;
	text?: string;
	image_url?: {
		url: string;
		detail?: string;
	};
}

export interface APIChatMessage {
	/** Author of the message */
	role: "assistant" | "user" | "system";

	/** Content of the message */
	content: string | APIChatContent[];
}

export interface ConversationMessage {
	/** Content of the message */
	content: string;

	/** Attached images in the message, Base64 data */
	images?: string[];
}

export type ConversationUserMessage = ConversationMessage & {
	/* Additional images to pass to the model */
	images?: string[];
}