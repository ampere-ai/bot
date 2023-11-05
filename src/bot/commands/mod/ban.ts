import { ApplicationCommandOptionTypes } from "@discordeno/types";

import dayjsRelativeTime from "dayjs/plugin/relativeTime.js";
import dayjsDuration from "dayjs/plugin/duration.js";
import dayjs from "dayjs";

dayjs.extend(dayjsRelativeTime);
dayjs.extend(dayjsDuration);

import type { DBGuild } from "../../../db/types/guild.js";
import type { DBUser } from "../../../db/types/user.js";

import { buildInfractionInfo, toModerationTarget } from "../../moderation/tools.js";
import { banEntry, isBanned } from "../../moderation/mod.js";
import { RestrictionName } from "../../utils/restriction.js";
import { createCommand } from "../../helpers/command.js";
import { ResponseError } from "../../errors/response.js";
import { EmbedColor } from "../../utils/response.js";

const DURATION_CHOICES = [
	dayjs.duration({ minutes: 1 }),
	dayjs.duration({ hours: 1 }),
	dayjs.duration({ days: 1 }),
	dayjs.duration({ days: 3 }),
	dayjs.duration({ days: 7 }),
	dayjs.duration({ days: 14 }),
	dayjs.duration({ months: 1 }),
	dayjs.duration({ months: 3 }),
	dayjs.duration({ years: 1 })
];

export default createCommand({
	name: "ban",
	restrictions: [ RestrictionName.Moderator ],

	sub: {
		user: {
			description: "Ban a user from using the bot",
		},

		guild: {
			description: "Ban a server from using the bot"
		}
	},

	options: {
		id: {
			type: ApplicationCommandOptionTypes.String,
			description: "...", required: true
		},
	
		reason: {
			type: ApplicationCommandOptionTypes.String,
			description: "Why this ban was done", required: true
		},
	
		duration: {
			type: ApplicationCommandOptionTypes.Number,
			description: "For how long the ban should last",
	
			choices: DURATION_CHOICES.map(d => ({
				name: d.humanize(),
				value: d.asMilliseconds()
			}))
		}
	},

	handler: async ({ bot, interaction, options, sub }) => {
		try {
			const id = BigInt(options.id);
			let db: DBUser | DBGuild = await bot.db.fetch(`${sub}s`, id);

			const discordEntry = sub === "guild"
				? await bot.helpers.getGuild(id).catch(() => null)
				: await bot.helpers.getUser(id).catch(() => null);

			if (db === null || discordEntry === null) throw new ResponseError({
				message: { key: "mod.errors.invalid_target", data: { type: sub } }
			});

			const target = toModerationTarget(discordEntry);

			if (isBanned(db)) throw new ResponseError({
				message: { key: "mod.errors.already_banned", data: { type: sub } }
			});

			db = await banEntry(bot, db, {
				by: interaction.user.id.toString(),
				
				reason: options.reason, duration: options.duration,
				status: true
			});

			const infraction = db.infractions[db.infractions.length - 1];

			return {
				embeds: {
					title: "mod.messages.ban 🔨",
					author: { name: target.name, iconUrl: target.icon },
					fields: buildInfractionInfo(infraction).fields,
					color: EmbedColor.Red
				}
			};

		} catch (error) {
			if (error instanceof SyntaxError) throw new ResponseError({
				message: "mod.errors.invalid_id"
			});
			
			throw error;
		}
	}
});