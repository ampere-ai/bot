import { ApplicationCommandOptionTypes } from "@discordeno/types";

import { buildModerationOverview } from "../../moderation/tools.js";
import { RestrictionName } from "../../utils/restriction.js";
import { createCommand } from "../../helpers/command.js";
import { ResponseError } from "../../errors/response.js";

export default createCommand({
	name: "info",
	description: "...",

	restrictions: [ RestrictionName.Moderator ],

	sub: {
		user: {
			description: "View information about a user"
		},

		guild: {
			description: "View information about a server"
		}
	},

	options: {
		id: {
			type: ApplicationCommandOptionTypes.String,
			description: "...", required: true
		}
	},

	handler: async ({ bot, options, sub }) => {
		try {
			const id = BigInt(options.id);

			const target = sub === "guild"
				? await bot.helpers.getGuild(id).catch(() => null)
				: await bot.helpers.getUser(id).catch(() => null);

			if (target === null) throw new ResponseError({
				message: `You must specify a valid ${sub}`
			});
	
			return buildModerationOverview(bot, sub, target);

		} catch (error) {
			if (error instanceof SyntaxError) throw new ResponseError({
				message: "You must specify a valid identifier"
			});
			
			throw error;
		}
	}
});