import type { DBSettings } from "../../bot/types/settings.js";
import type { DBPlan, DBSubscription } from "./premium.js";
import type { DBInfraction } from "./moderation.js";

export interface DBUser {
	/** ID of the user */
	id: string;

	/** When the user first interacted with the bot */
	created: string;

	/** Moderation history of the user */
	infractions: DBInfraction[];

	/** Data about the user's subscription */
	subscription: DBSubscription | null;

	/** Data about the user's pay-as-you-go plan */
	plan: DBPlan | null;

	/** When the user last voted for the bot */
	voted: string | null;

	/** The user's configured settings */
	settings: DBSettings;

    /** The user's metadata */
    metadata: Record<string, any>;

    /** The user's roles */
    roles: DBRole[];
}

export enum DBUserType {
	PremiumSubscription = "subscription",
	PremiumPlan = "plan",
	Voter = "voter",
	User = "user"
}

export enum DBRole {
	Owner = "owner",
	Moderator = "moderator",
	Tester = "tester"
}

export const USER_ROLES = [
	DBRole.Owner, DBRole.Moderator, DBRole.Tester 
];