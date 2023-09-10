import { Collection, type Interaction, type Embed, type Bot } from "@discordeno/bot";

import type { Conversation } from "../types/conversation.js";
import type { DBEnvironment } from "../../db/types/mod.js";

import { EmbedColor, type MessageResponse } from "./response.js";
import { pickAdvertisement } from "../campaign.js";
import { DBRole } from "../../db/types/user.js";

type CooldownTarget = Conversation | Interaction;

/** Global command cool-downs */
const cooldowns: Collection<string, number> = new Collection();

export async function cooldownNotice(target: CooldownTarget, env: DBEnvironment): Promise<MessageResponse> {
	const cooldown = getCooldown(target);
	const ad = await pickAdvertisement(env);

	const response: MessageResponse = {
		ephemeral: true
	};

	const embeds: Embed[] = [
		{
			title: "Whoa-whoa... slow down ⌛",
			description: `This action is currently on cool-down; you can use it again <t:${Math.floor((cooldown!.when - 1000) / 1000)}:R>.`,
			color: EmbedColor.Yellow
		}
	];

	if (ad) {
		embeds.push(ad.response.embed);
		response.components = [ ad.response.row ];
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
	if (premium && premium.type === "plan") return;

	cooldowns.set(cooldownKey(target), Date.now() + duration);
}

function cooldownKey(target: CooldownTarget) {
	if (isConversationTarget(target)) return target.id;
	else return `${target.user.id}-${target.data?.name}`;
}

function isConversationTarget(target: CooldownTarget): target is Conversation {
	return !!(target as Conversation).history;
}