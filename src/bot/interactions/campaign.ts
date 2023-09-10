import { ButtonStyles, MessageComponentTypes } from "@discordeno/bot";

import { createInteractionHandler } from "../helpers/interaction.js";
import { getCampaign } from "../campaign.js";

export default createInteractionHandler({
	name: "campaign",

	handler: ({ args }) => {
		const action = args[0];

		if (action === "link") {
			const campaign = getCampaign(args[1]);
			if (!campaign || !campaign.button || campaign.button.type !== "Link") return;

			const url = campaign.button.url;
			const domain = new URL(url).hostname;

			return {
				components: [ {
					type: MessageComponentTypes.ActionRow,

					components: [
						{
							type: MessageComponentTypes.Button,
							label: domain, url, style: ButtonStyles.Link
						}
					]
				} ],

				ephemeral: true
			};
		}
	}
});