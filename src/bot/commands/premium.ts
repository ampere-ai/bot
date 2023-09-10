import { createCommand } from "../helpers/command.js";
import { buildPremiumOverview } from "../premium.js";

export default createCommand({
	name: "premium",
	description: "View information about Premium & your current subscription",

	handler: async ({ bot, env, interaction }) => {
		return buildPremiumOverview(bot, interaction, env);
	}
});