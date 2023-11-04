import { type Interaction, type Embed, type Bot, Collection, MessageComponentTypes, ButtonStyles } from "@discordeno/bot";

import type { Conversation } from "../types/conversation.js";
import type { DBEnvironment } from "../../db/types/mod.js";

import { EmbedColor, type MessageResponse } from "./response.js";
import { DBRole } from "../../db/types/user.js";
import { ToLocaleStrings } from "../i18n.js";

type CooldownTarget = Conversation | Interaction;

/** Global command cool-downs */
const cooldowns: Collection<string, number> = new Collection();

export function cooldownNotice(bot: Bot, env: DBEnvironment, target: CooldownTarget) {
	const cooldown = getCooldown(target);
	const premium = bot.db.premium(env);

	const response: MessageResponse = {
		ephemeral: true
	};

	const embeds: ToLocaleStrings<Embed>[] = [
		{
			title: "cooldown.title",
			description: { key: "cooldown.desc", data: { time: Math.floor((cooldown!.when - 1000) / 1000) } },
			color: EmbedColor.Yellow
		}
	];

	if (!premium) {
		embeds.push({
			description: "premium.cooldown",
			color: EmbedColor.Orange
		});

		response.components = [ {
			type: MessageComponentTypes.ActionRow,

			components: [
				{
					type: MessageComponentTypes.Button,
					label: "premium.buttons.upgrade", emoji: { name: "💸" },
					customId: "premium:purchase",
					style: ButtonStyles.Success
				}
			]
		} ];
	}

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

export function setCooldown(bot: Bot, env: DBEnvironment, target: CooldownTarget, duration: number) {
	if (env.user.roles.includes(DBRole.Owner)) return;
	
	const premium = bot.db.premium(env);
	if (premium?.type === "plan") return;

	cooldowns.set(cooldownKey(target), Date.now() + duration);
}

function cooldownKey(target: CooldownTarget) {
	if (isConversationTarget(target)) return target.id;
	else return `${target.user.id}-${target.data?.name}`;
}

function isConversationTarget(target: CooldownTarget): target is Conversation {
	return !!(target as Conversation).history;
}