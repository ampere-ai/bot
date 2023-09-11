import { RestrictionName } from "../../utils/restriction.js";
import { createCommand } from "../../helpers/command.js";
import { EmbedColor } from "../../utils/response.js";

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

	handler: async ({ bot, sub }) => {
		return { embeds: {
			description: "👍", color: EmbedColor.Yellow
		} };
	}
});