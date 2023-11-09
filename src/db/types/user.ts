import type { DBSettings } from "../../bot/types/settings.js";
import type { DBInfraction } from "./moderation.js";

export interface DBUser {
	/** ID of the user */
	id: string;

	/** When the user first interacted with the bot */
	created: string;

	/** Moderation history of the user */
	infractions: DBInfraction[];

	/** The user's configured settings */
	settings: DBSettings;

    /** The user's metadata */
    metadata: Record<string, any>;

    /** The user's roles */
    roles: DBRole[];
}

export enum DBRole {
	Owner = "owner",
	Moderator = "moderator",
	Tester = "tester"
}

export const USER_ROLES = [
	DBRole.Owner, DBRole.Moderator, DBRole.Tester 
];