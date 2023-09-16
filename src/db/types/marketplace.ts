import type { ComponentEmoji } from "@discordeno/bot";

export type DBMarketplaceType = "personality" | "style" | "indicator";

interface MarketplaceCategory {
	/** Which type this category corresponds to */
	type: DBMarketplaceType;

	/** Display name of the category */
	name?: string;

	/** Which settings key this category corresponds to */
	key: string;
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[]  = [
	{
		type: "personality", key: "chat:personality"
	},

	{
		type: "style", key: "image:style"
	},

	{
		type: "indicator", name: "loading indicator", key: "general:indicator"
	}
];

export interface DBMarketplaceStatus {
	type: "approved" | "pending" | "rejected";
}

export interface DBMarketplaceEntry<T = object> {
	/** Uniuqe ID of the entry */
	id: string;

	/** When the marketplace entry was created */
	created: string;

	/** Which Discord user created the entry */
	creator: string;

	/** Which type of marketplace entry this is */
	type: DBMarketplaceType;

	/** Name of the entry */
	name: string;

	/** Fitting emoji for the entry */
	emoji: ComponentEmoji;

	/** Description of the entry */
	description: string | null;

	/** Current moderation status of the entry */
	status: DBMarketplaceStatus;

	/** Various data about the entry */
	data: T;
}

export type MarketplacePersonality = DBMarketplaceEntry<{
	prompt: string[] | string | null;
}>;

export type MarketplaceStyle = DBMarketplaceEntry<{
	tags: string[] | null;
}>;

export type MarketplaceIndicator = DBMarketplaceEntry<ComponentEmoji>;