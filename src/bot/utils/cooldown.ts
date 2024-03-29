import { type Interaction, type Embed, type Bot, Collection } from "@discordeno/bot";

import type { Conversation } from "../types/conversation.js";
import type { DBEnvironment } from "../../db/types/mod.js";
import type { ToLocaleStrings } from "../i18n.js";

import { type MessageResponse, EmbedColor } from "./response.js";
import { DBRole } from "../../db/types/user.js";

type CooldownTarget = Conversation | Interaction;

/** Global command cool-downs */
const cooldowns: Collection<string, number> = new Collection();

export function cooldownNotice(bot: Bot, env: DBEnvironment, target: CooldownTarget) {
	const cooldown = getCooldown(target);

	const response: MessageResponse = {
		ephemeral: true, env
	};

	const embeds: ToLocaleStrings<Embed>[] = [
		{
			title: "cooldown.title ⌛",
			description: { key: "cooldown.desc", data: { time: Math.floor((cooldown!.when - 1000) / 1000) } },
			color: EmbedColor.Yellow
		}
	];

	response.embeds = embeds;
	return response;
}

export function getCooldown(target: CooldownTarget) {
	const existing = cooldowns.get(cooldownKey(target)) ?? null;
	if (!existing || existing < Date.now()) return null;

	return {
		remaining: existing - Date.now(), when: existing
	};
}

export function hasCooldown(target: CooldownTarget) {
	return getCooldown(target) !== null;
}

export function setCooldown(env: DBEnvironment, target: CooldownTarget, duration: number) {
	if (env.user.roles.includes(DBRole.Owner)) return;
	cooldowns.set(cooldownKey(target), Date.now() + duration);
}

function cooldownKey(target: CooldownTarget) {
	if (isConversationTarget(target)) return target.id;
	else return `${target.user.id}-${target.data?.name}`;
}

function isConversationTarget(target: CooldownTarget): target is Conversation {
	return !!(target as Conversation).history;
}