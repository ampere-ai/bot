import { buildMarketplaceOverview } from "../marketplace.js";
import { createCommand } from "../helpers/command.js";

export default createCommand({
	name: "marketplace",

	handler: async ({ bot, env }) => {
		return buildMarketplaceOverview(bot, env, {
			page: 0
		});
	}
});