import type { createLogger } from "@discordeno/bot";
import type { createClient } from "redis";

import type { MessageResponse } from "../utils/response.js";
import type { createAPI } from "../api.js";
import type { createDB } from "../db.js";

declare module "@discordeno/bot" {
    interface Bot {
        /** Bot logger */
        logger: ReturnType<typeof createLogger>;

        /** Redis connection */
        redis: ReturnType<typeof createClient>;

        /** Database manager */
        db: Awaited<ReturnType<typeof createDB>>;

        /** Turing API */
        api: ReturnType<typeof createAPI>;
    }

	interface Interaction {
		/** Defer the interaction, to be edited at a future point. */
		deferReply: () => Promise<void>;
	
		/** Defer an update, meaning that the interaction is silently acknowledged. */
		deferUpdate: () => Promise<void>;
	
		/** Send a reply to an interaction. */
		reply: (response: MessageResponse) => Promise<void>;
	
		/** Edit the original reply to an interaction. */
		editReply: (response: MessageResponse) => Promise<Message | undefined>;
	
		/** Update the original reply to an interaction. */
		update: (response: MessageResponse) => Promise<void>;
	
		/** Delete the original reply to the interaction. */
		deleteReply: () => Promise<void>;
	}

	interface Message {
		/** Reply to a message. */
		reply: (response: Omit<MessageResponse, "reference">) => Promise<Message>;
	
		/** Edit the message. */
		edit: (response: Omit<MessageResponse, "reference">) => Promise<Message>;
	
		/** Delete the message. */
		delete: () => Promise<void>;
	}

	interface ComponentEmoji {
		/** Emoji ID */
		id?: bigint;
	
		/** Emoji name */
		name: string;
	
		/** Whether this emoji is animated */
		animated?: boolean;
	}
}