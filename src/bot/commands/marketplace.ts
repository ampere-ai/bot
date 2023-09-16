import { createCommand } from "../helpers/command.js";
import { buildMarketplaceOverview } from "../marketplace.js";

export default createCommand({
	name: "marketplace",
	description: "Browse the extensive marketplace",

	handler: async ({ bot }) => {
		return buildMarketplaceOverview(bot, {
			page: 0
		});
	}
});