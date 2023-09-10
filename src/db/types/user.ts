import type { ComponentEmoji } from "@discordeno/bot";

import type { DBSettings } from "../../bot/types/settings.js";
import type { DBPlan, DBSubscription } from "./premium.js";
import type { DBInfraction } from "./moderation.js";

import { getSettingsValue } from "../../bot/settings.js";

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
	Investor = "investor",
	Advertiser = "advertiser",
	Tester = "tester"
}

export interface UserLanguage {
	/** Name ofthe language */
	name: string;

	/** Emoji of the language, e.g. the country's flag */
	emoji: string;

	/** ISO code of the language */
	id: string;
}

export const USER_LANGUAGES: UserLanguage[] = [
	{
		name: "English", id: "en-US", emoji: "🇬🇧"
	},

	{
		name: "Spanish", id: "es-ES", emoji: "🇪🇸"
	},

	{
		name: "Brazilian Portuguese", id: "pt-BR", emoji: "🇧🇷"
	},

	{
		name: "Portuguese", id: "pt-PT", emoji: "🇵🇹"
	},

	{
		name: "French", id: "fr-FR", emoji: "🇫🇷"
	},

	{
		name: "German", id: "de-DE", emoji: "🇩🇪"
	},

	{
		name: "Italian", id: "it-IT", emoji: "🇮🇹"
	},

	{
		name: "Polish", id: "pl", emoji: "🇵🇱"
	},

	{
		name: "Russian", id: "ru-RU", emoji: "🇷🇺"
	},

	{
		name: "Bulgarian", id: "bg", emoji: "🇧🇬"
	},

	{
		name: "Czech", id: "cs", emoji: "🇨🇿"
	},

	{
		name: "Japanese", id: "jp-JP", emoji: "🇯🇵"
	},

	{
		name: "Chinese", id: "zh-CN", emoji: "🇨🇳"
	},

	{
		name: "Vietnamese", id: "vn", emoji: "🇻🇳"
	},

	{
		name: "Persian", id: "ir", emoji: "🇮🇷",
	},

	{
		name: "Pirate", id: "pirate", emoji: "🏴‍☠️"
	}
];

export interface LoadingIndicator {
    /* Name of the loading indicator */
    name: string;

    /* Discord emoji */
    emoji: Required<ComponentEmoji>;
}


export const LOADING_INDICATORS: LoadingIndicator[] = [
	{
		name: "Orb",
		emoji: { name: "orb", id: 1088545392351793232n, animated: true }
	},

	{
		name: "Discord Loading",
		emoji: { name: "discord_loading", id: 1150469156202877138n, animated: true }
	},

	{
		name: "LEGO",
		emoji: { name: "lego", id: 1150469213304135750n, animated: true }
	},

	{
		name: "Skeleton",
		emoji: { name: "skeletn", id: 1150469252852240455n, animated: true }
	},

	{
		name: "Spinning Skull",
		emoji: { name: "spinning_skull", id: 1150469186007597158n, animated: true }
	},

	{
		name: "SpongeBob",
		emoji: { name: "spunchbob", id: 1150469172963324004n, animated: true }
	}
];

export function getLoadingIndicatorFromUser(user: DBUser) {
	const id: string = getSettingsValue(user, "general:loading_indicator");
	return LOADING_INDICATORS.find(i => i.emoji.id.toString() === id)!;
}

export function loadingIndicatorToString(indicator: LoadingIndicator) {
	return `<${indicator.emoji.animated ? "a" : ""}:${indicator.emoji.name}:${indicator.emoji.id}>`;
}