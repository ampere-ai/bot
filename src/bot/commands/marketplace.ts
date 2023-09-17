import { createCommand } from "../helpers/command.js";
import { buildMarketplaceOverview } from "../marketplace.js";

export default createCommand({
	name: "marketplace",

	sub: {
		browse: {
			description: "Browse the extensive marketplace"
		},

		create: {
			description: "Create your own marketplace prompts"
		}
	},

	handler: async ({ bot, env, sub }) => {
		return buildMarketplaceOverview(bot, env, {
			type: sub, page: 0, creator: env.user.id
		});
	}
});