import type { ComponentEmoji } from "@discordeno/bot";

export type DBMarketplaceType = "personality" | "style" | "indicator";

export interface DBMarketplaceStatus {
	builtIn?: boolean;
	default?: boolean;
	type: "approved" | "pending" | "rejected";
	visibility: "public" | "private";
}

export interface DBMarketplaceStatistics {
	/** How many times this marketplace entry has been used */
	uses: number;

	/** How many times this marketplace entry has been viewed */
	views: number;
}

export interface DBMarketplaceEntry<T = Record<string, any>> {
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

	/** Statistics of this marketplace entry */
	stats: DBMarketplaceStatistics;

	/** Various data about the entry */
	data: T;
}

export type MarketplacePersonality = DBMarketplaceEntry<{
	prompt: string[] | string | null;
	disableHistory?: boolean;
}>;

export type MarketplaceStyle = DBMarketplaceEntry<{
	tags: string[] | null;
}>;

export type MarketplaceIndicator = DBMarketplaceEntry<ComponentEmoji>;