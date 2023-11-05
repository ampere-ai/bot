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
		add: {},
		remove: {}
	},

	options: {
		id: {
			type: ApplicationCommandOptionTypes.String,
			required: true
		},

		which: {
			type: ApplicationCommandOptionTypes.String,
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
			message: { key: "mod.errors.invalid_target", data: { type: sub } }
		});

		const target = toModerationTarget(discordEntry);

		if (sub === "add" && db.roles.includes(role)) throw new ResponseError({
			message: { key: "mod.errors.already_has_role", data: { role: titleCase(role) } }
		});

		if (sub === "remove" && !db.roles.includes(role)) throw new ResponseError({
			message: { key: "mod.errors.missing_role", data: { role: titleCase(role) } }
		});

		await bot.db.update<DBUser>("users", db, {
			roles: sub === "add"
				? [ ...db.roles, role ]
				: db.roles.filter(r => r !== role)
		});

		return {
			embeds: {
				description: { key: `mod.messages.role.${sub}`, data: { name: titleCase(role) } },
				author: { name: target.name, iconUrl: target.icon },
				color: EmbedColor.Yellow
			},

			ephemeral: true
		};
	}
});