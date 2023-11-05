import type { Embed, Bot } from "@discordeno/bot";
import { randomUUID } from "crypto";
import { bold } from "colorette";

import type { ModerationNoticeOptions, ModerationOptions, ModerationResult } from "./types/mod.js";
import type { DBInfraction, GiveInfractionOptions } from "../../db/types/moderation.js";
import type { DBGuild } from "../../db/types/guild.js";
import type { DBUser } from "../../db/types/user.js";

import { EmbedColor, transformResponse, type MessageResponse } from "../utils/response.js";
import { buildInfractionInfo, buildModerationLogs } from "./tools.js";
import { MOD_CHANNELS, SUPPORT_INVITE } from "../../config.js";
import { applyFilters, executeFilters } from "./filters.js";
import { t } from "../i18n.js";

/** Moderate the given prompt. */
export async function moderate(options: ModerationOptions) {
	const { bot, env, user, source, content } = options;

	/* Run the moderation filters on the message. */
	const auto = await executeFilters({
		bot, env, user, source, content
	});

	/* Whether the message should be completely blocked */
	const blocked: boolean = auto !== null && auto.type !== "flag";

	/* Whether the message has been flagged as inappropriate */
	const flagged: boolean = blocked || (auto !== null && auto.type === "flag");

	/* Final moderation result */
	const data: ModerationResult = {
		source, auto, flagged, blocked
	};

	if (flagged) {
		env.user = await giveInfraction(bot, env.user, {
			type: "moderation", moderation: data, reason: data.auto?.reason,
			reference: { type: "infraction", data: content }
		});

		try {
			const response = await buildModerationLogs(options, data);
			await bot.helpers.sendMessage(MOD_CHANNELS.LOGS, transformResponse(response));
		} catch (error) { console.trace(error); /* Stub */ }
	}

	/* Which infraction to give to the user, if applicable */
	const infraction = auto !== null && auto.type !== "flag"
		? applyFilters({ auto }) : null;

	if (infraction) env.user = await giveInfraction(bot, env.user, infraction);
	return data;
}

export function moderationNotice({ result, env, small }: ModerationNoticeOptions): MessageResponse {
	const embed: Embed = {
		title: small ? undefined : "mod.flags.block 🤨",
		footer: small ? undefined : { text: SUPPORT_INVITE },
		color: result.blocked ? EmbedColor.Red : EmbedColor.Orange 
	};

	if (result.auto && result.auto.type !== "block" && result.auto.type !== "flag") {
		if (result.auto.type === "warn") embed.description = `mod.prompt.warn *${t({ key: "mod.violation.continue", env })}*`;
		else if (result.auto.type === "ban") embed.description = `mod.prompt.ban _${t({ key: "mod.violation.appeal", env })}_.`;
	} else if (result.blocked) embed.description = `mod.prompt.block *${t({ key: "mod.violation.continue", env })}*.`;
	else if (result.flagged) embed.description = `mod.prompt.flag *${t({ key: "mod.violation.maybe", env })}*.`;

	return {
		embeds: embed, ephemeral: true
	};
}

export async function giveInfraction<T extends DBGuild | DBUser>(bot: Bot, entry: T, {
	by, reason, type, moderation, reference, until
}: GiveInfractionOptions): Promise<T> {
	const data: DBInfraction = {
		by, reason, type, moderation,

		id: randomUUID().slice(undefined, 8),
		when: Date.now()
	};

	if (reference) data.reference = reference;
	if (until) data.until = until;

	if ([ "warn", "ban", "unban" ].includes(data.type)) {
		await sendInfractionDM(bot, entry, data);
	}

	return bot.db.update<T>((entry as DBUser).voted !== undefined ? "users" : "guilds", entry, {
		infractions: [
			...entry.infractions, data
		]
	} as T);
}

export function banEntry<T extends DBGuild | DBUser>(bot: Bot, entry: T, {
	by, reason, duration, status
}: Pick<GiveInfractionOptions, "by" | "reason"> & { duration?: number; status: boolean; }) {
	return giveInfraction(bot, entry, {
		type: status ? "ban" : "unban",
		
		until: duration ? Date.now() + duration : undefined,
		by, reason
	});
}

export function warnEntry<T extends DBGuild | DBUser>(bot: Bot, entry: T, {
	by, reason
}: Pick<GiveInfractionOptions, "by" | "reason">) {
	return giveInfraction(bot, entry, {
		type: "warn", by, reason
	});
}

/** Check whether a user or guild is banned. */
export function isBanned(entry: DBGuild | DBUser) {
	/* List of all ban-related infractions */
	const infractions = entry.infractions.filter(
		i => (i.type === "ban" || i.type === "unban") && (i.until ? Date.now() < i.until : true)
	);

	if (infractions.length === 0) return null;

	/* Whether the entry is banned; really dumb way of checking it */
	const odd: boolean = infractions.length % 2 > 0;
	if (!odd) return null;

	/* The entry's `ban` infraction */
	const infraction = infractions[infractions.length - 1];
	if (infraction.until && Date.now() >= infraction.until) return null;

	return infraction;
}

export async function sendInfractionDM(bot: Bot, entry: DBGuild | DBUser, infraction: DBInfraction) {
	/* TODO: DM the guild owner about the infraction */
	if ((entry as DBUser).voted === undefined) return;

	/* ID of the user to DM */
	const id = entry.id;

	try {
		const channel = await bot.helpers.getDmChannel(id);
		await channel.send(infractionNotice(entry, infraction));

	} catch (error) {
		bot.logger.warn(`Couldn't DM user ${bold(id)} about infraction ->`, error);
	}
}

/** Display an infraction nicely to the user. */
export function infractionNotice(entry: DBGuild | DBUser, infraction: DBInfraction): MessageResponse {
	const location = (entry as DBUser).voted !== undefined ? "user" : "guild";

	if (infraction.type === "ban") {
		return {
			embeds: {
				title: `${location === "guild" ? "This server was" : "You were"} **${infraction.until ? "temporarily" : "permanently"}** banned from using the bot 😔`,
				description: `_If you want to appeal or have questions about this ban, join our **[support server](https://${SUPPORT_INVITE})**_.`,
				fields: buildInfractionInfo(infraction).fields,
				footer: { text: SUPPORT_INVITE },
				color: EmbedColor.Red
			},

			ephemeral: true
		};

	} else if (infraction.type === "unban") {
		return {
			embeds: {
				title: `${location === "guild" ? "Your server's" : "Your"} ban was revoked & you can use the bot again 🙌`,
				description: `_If you have any further questions regarding this matter, join our **[support server](https://${SUPPORT_INVITE})**_.`,
				fields: buildInfractionInfo(infraction).fields,
				footer: { text: SUPPORT_INVITE },
				color: EmbedColor.Yellow
			},

			ephemeral: true
		};

	} else if (infraction.type === "warn") {
		return {
			embeds: {
				title: "mod.flags.warn",
				description: `${location === "guild" ? "This server" : "You"} received a warning, as a consequence of ${location === "guild" ? "the" : "your"} interactions with our bot. *This is only a warning, you can continue to use the bot. If ${location === "guild" ? "your server" : "you"} however ${location === "guild" ? "keeps" : "keep"} violating our **usage policies**, we may have to take further moderative actions*.`,
				fields: buildInfractionInfo(infraction).fields,
				footer: { text: SUPPORT_INVITE },
				color: EmbedColor.Orange
			},

			ephemeral: true
		};
	}

	return {
		embeds: buildInfractionInfo(infraction),
		ephemeral: true
	};
}