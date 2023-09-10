import { ApplicationCommandOptionTypes } from "@discordeno/types";

import type { DBGuild } from "../../../db/types/guild.js";
import type { DBUser } from "../../../db/types/user.js";

import { buildInfractionInfo, toModerationTarget } from "../../moderation/tools.js";
import { RestrictionName } from "../../utils/restriction.js";
import { createCommand } from "../../helpers/command.js";
import { ResponseError } from "../../errors/response.js";
import { EmbedColor } from "../../utils/response.js";
import { warnEntry } from "../../moderation/mod.js";

export default createCommand({
	name: "warn",
	description: "...",

	restrictions: [ RestrictionName.Moderator ],

	sub: {
		user: {
			description: "Give a warning to a user",

		},

		guild: {
			description: "Give a warning to a server"
		}
	},

	options: {
		id: {
			type: ApplicationCommandOptionTypes.String,
			description: "...", required: true
		},
	
		reason: {
			type: ApplicationCommandOptionTypes.String,
			description: "Why this warning was isused", required: true
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
				message: `You must specify a valid ${sub}`
			});

			const target = toModerationTarget(discordEntry);

			db = await warnEntry(bot, db, {
				by: interaction.user.id.toString(),
				reason: options.reason
			});

			const infraction = db.infractions[db.infractions.length - 1];

			return {
				embeds: {
					title: "Warning given ✉️",
					author: { name: target.name, iconUrl: target.icon },
					fields: buildInfractionInfo(infraction).fields,
					color: EmbedColor.Yellow
				}
			};

		} catch (error) {
			if (error instanceof SyntaxError) throw new ResponseError({
				message: "You must specify a valid identifier"
			});
			
			throw error;
		}
	}
});