import { buildMarketplaceOverview } from "../marketplace.js";
import { createCommand } from "../helpers/command.js";

export default createCommand({
	name: "marketplace",
	description: "Browse the extensive marketplace",

	handler: async ({ bot, env }) => {
		return buildMarketplaceOverview(bot, env, {
			page: 0
		});
	}
});