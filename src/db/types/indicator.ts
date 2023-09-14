import type { Bot, ComponentEmoji } from "@discordeno/bot";

import { getSettingsValue } from "../../bot/settings.js";
import type { DBEnvironment } from "./mod.js";

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

export function getLoadingIndicatorFromUser(bot: Bot, env: DBEnvironment) {
	const id: string = getSettingsValue(bot, env, "user", "general:loading_indicator");
	return LOADING_INDICATORS.find(i => i.emoji.id.toString() === id)!;
}

export function loadingIndicatorToString(indicator: LoadingIndicator) {
	return `<${indicator.emoji.animated ? "a" : ""}:${indicator.emoji.name}:${indicator.emoji.id}>`;
}