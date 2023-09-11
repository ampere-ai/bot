import { ApplicationCommandOptionTypes } from "@discordeno/types";

import { DBRole, DBUser, USER_ROLES } from "../../../db/types/user.js";
import { toModerationTarget } from "../../moderation/tools.js";
import { RestrictionName } from "../../utils/restriction.js";
import { createCommand } from "../../helpers/command.js";
import { ResponseError } from "../../errors/response.js";
import { EmbedColor } from "../../utils/response.js";
import { titleCase } from "../../utils/helpers.js";

export default createCommand({
	name: "roles",
	restrictions: [ RestrictionName.Developer ],

	sub: {
		add: {
			description: "Give a role to a user"
		},

		remove: {
			description: "Revoke a role from a user"
		}
	},

	options: {
		id: {
			type: ApplicationCommandOptionTypes.String,
			description: "...", required: true
		},

		which: {
			type: ApplicationCommandOptionTypes.String,
			description: "Which role to assign or revoke",
			required: true,

			choices: USER_ROLES.map(r => ({
				name: titleCase(r), value: r
			}))
		}
	},

	handler: async ({ bot, sub, options }) => {
		const role = options.which as DBRole;
		const id = BigInt(options.id);

		const discordEntry = await bot.helpers.getUser(id).catch(() => null);
		const db: DBUser = await bot.db.fetch("users", id);

		if (db === null || discordEntry === null) throw new ResponseError({
			message: `You must specify a valid ${sub}`
		});

		const target = toModerationTarget(discordEntry);

		if (sub === "add" && db.roles.includes(role)) throw new ResponseError({
			message: `The user already has the **${titleCase(role)}** role`
		});

		if (sub === "remove" && !db.roles.includes(role)) throw new ResponseError({
			message: `The user doesn't have the **${titleCase(role)}** role`
		});

		await bot.db.update<DBUser>("users", db, {
			roles: sub === "add"
				? [ ...db.roles, role ]
				: db.roles.filter(r => r !== role)
		});

		return {
			embeds: {
				description: `Role **${titleCase(role)}** ${sub === "add" ? "added" : "removed"}`,
				author: { name: target.name, iconUrl: target.icon },
				color: EmbedColor.Yellow
			},

			ephemeral: true
		};
	}
});