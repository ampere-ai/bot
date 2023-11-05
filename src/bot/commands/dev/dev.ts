import { RestrictionName } from "../../utils/restriction.js";
import { createCommand } from "../../helpers/command.js";
import { EmbedColor } from "../../utils/response.js";
import { fetchCampaigns } from "../../campaign.js";

export default createCommand({
	name: "dev",
	restrictions: [ RestrictionName.Developer ],

	sub: {
		refresh_cache: {},
		flush: {}
	},

	handler: async ({ bot, sub }) => {
		if (sub === "refresh_cache") {
			await bot.db.clearCache();
			await fetchCampaigns();
		} else if (sub === "flush") {
			const result = await bot.db.flush();

			if (result.errors.length > 0) {
				return {
					embeds: {
						title: "It seems like some errors occured whilst saving the database 😬",
						color: EmbedColor.Red,

						fields: result.errors.slice(undefined, 25).map(err => ({
							name: err.message,
							value: `*${err.details}*`
						}))
					},
		
					ephemeral: true
				};
			}

			return {
				embeds: {
					description: `Saved **${result.amount}** entries to the database 👍`, color: EmbedColor.Yellow
				},
	
				ephemeral: true
			};
		}

		return {
			embeds: {
				description: "👍", color: EmbedColor.Yellow
			},

			ephemeral: true
		};
	}
});