import type { Interaction, Message } from "discordeno";
import type { MessageResponse } from "../utils/response.js";

export interface CustomInteraction extends Interaction {
	/** Defer the interaction, to be edited at a future point. */
	defer: () => Promise<void>;

	/** Send a reply to an interaction. */
	reply: (response: MessageResponse) => Promise<Message>;

	/** Edit the original reply to an interaction. */
	editReply: (response: MessageResponse) => Promise<Message>;

	/** Update the original reply to an interaction. */
	update: (response: MessageResponse) => Promise<Message>;

	/** Delete the original reply to the interaction. */
	deleteReply: () => void;
}

export interface CustomMessage extends Message {
    /** Reply to a message. */
	reply: (response: Omit<MessageResponse, "reference"> | string) => Promise<Message>;
}