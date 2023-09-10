import { RestrictionName } from "../../utils/restriction.js";
import { createCommand } from "../../helpers/command.js";
import { EmbedColor } from "../../utils/response.js";
import { fetchCampaigns } from "../../campaign.js";

export default createCommand({
	name: "dev",
	restrictions: [ RestrictionName.Developer ],

	sub: {
		refresh_cache: {
			description: "Clear all cache entries in Redis & refresh loaded campaigns"
		}
	},

	handler: async ({ bot, sub }) => {
		if (sub === "refresh_cache") {
			await bot.db.clearCache();
			await fetchCampaigns();
		}

		return { embeds: {
			description: "👍", color: EmbedColor.Yellow
		} };
	}
});