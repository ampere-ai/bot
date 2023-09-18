import type { PostgrestError } from "@supabase/supabase-js";

import type { Conversation } from "../../bot/types/conversation.js";
import type { DBDatasetEntry } from "./dataset.js";
import type { DBCampaign } from "./campaign.js";
import type { DBGuild } from "./guild.js";
import type { DBImage } from "./image.js";
import type { DBUser } from "./user.js";

export type CollectionName = "users" | "guilds" | "conversations" | "campaigns" | "datasets" | "marketplace";
export const CollectionNames: CollectionName[] = [ "users", "guilds", "conversations", "campaigns", "datasets", "marketplace" ];

export type DBType = DBUser | DBGuild | Conversation | DBImage | DBCampaign | DBDatasetEntry;

export type DBObject = {
	id: string;
} & Record<string, any>;

export interface DBEnvironment {
	user: DBUser;
	guild: DBGuild | null;
}

export type DBRequestType = "get" | "fetch" | "update" | "remove" | "all" | "clearCache" | "count" | "flush";

export type DBRequestData =
	DBRequestGet | DBRequestFetch | DBRequestUpdate |
	DBRequestRemove | DBRequestAll | DBRequestCount |
	DBRequestClearCache | DBRequestFlush;

export interface DBRequestGet {
	type: "get";

	collection: CollectionName;
	id: string;
}

export interface DBRequestFetch {
	type: "fetch";

	collection: CollectionName;
	id: string;
}

export interface DBRequestUpdate {
	type: "update";

	collection: CollectionName;
	id: string;
	updates: Record<string, any>;
}

export interface DBRequestRemove {
	type: "remove";

	collection: CollectionName;
	id: string;
}

export interface DBRequestAll {
	type: "all";
	collection: CollectionName;
}

export interface DBRequestCount {
	type: "count";
	collection: CollectionName;
}

export interface DBRequestClearCache {
	type: "clearCache";
}

export interface DBRequestFlush {
	type: "flush";
}

export type DBResponse = {
	success: boolean;
	error?: string;
	data: any;
}

export interface DBQueueResult {
	errors: PostgrestError[];
	amount: number;
}