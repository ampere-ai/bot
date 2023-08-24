import type { Bot, Interaction } from "@discordeno/bot";

import type { RestrictionName } from "../utils/restriction.js";
import type { MessageResponse } from "../utils/response.js";
import type { DBEnvironment } from "../../db/types/mod.js";
import type { CommandCooldown } from "./command.js";

enum InteractionHandlerType {
	Button
}

export interface InteractionHandlerOptions {
	bot: Bot;
	interaction: Interaction;
	args: string[];
	env: DBEnvironment;
}

export interface InteractionHandler {
    /** Name of the interaction */
    name: string;

	/** Restrictions of the interaction */
	restrictions?: RestrictionName[];

    /** Type of the interaction */
    type?: InteractionHandlerType;

    /** Cool-down of the interaction */
    cooldown?: CommandCooldown;

    /** Handler of the interaction */
    handler: (
        options: InteractionHandlerOptions
    ) => Promise<MessageResponse | void> | MessageResponse | void;
}