import { ApplicationCommandOptionTypes } from "@discordeno/types";

import type { DBGuild } from "../../../db/types/guild.js";
import type { DBUser } from "../../../db/types/user.js";

import { buildInfractionInfo, toModerationTarget } from "../../moderation/tools.js";
import { banEntry, isBanned } from "../../moderation/mod.js";
import { RestrictionName } from "../../utils/restriction.js";
import { createCommand } from "../../helpers/command.js";
import { ResponseError } from "../../errors/response.js";
import { EmbedColor } from "../../utils/response.js";

export default createCommand({
	name: "pardon",
	restrictions: [ RestrictionName.Moderator ],

	sub: {
		user: {
			description: "Revoke a user's ban from the bot",

		},

		guild: {
			description: "Revoke a server's ban from the bot"
		}
	},

	options: {
		id: {
			type: ApplicationCommandOptionTypes.String,
			required: true
		},
	
		reason: {
			type: ApplicationCommandOptionTypes.String,
			description: "Why the ban was revoked", required: true
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

			if (!isBanned(db)) throw new ResponseError({
				message: { key: "mod.errors.not_banned", data: { type: sub } }
			});

			db = await banEntry(bot, db, {
				by: interaction.user.id.toString(),
				reason: options.reason, status: false
			});

			const infraction = db.infractions[db.infractions.length - 1];

			return {
				embeds: {
					title: "mod.messages.pardon 🙌",
					author: { name: target.name, iconUrl: target.icon },
					fields: buildInfractionInfo(infraction).fields,
					color: EmbedColor.Yellow
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