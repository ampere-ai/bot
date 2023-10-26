import { createInteractionHandler } from "../helpers/interaction.js";
import { handleCampaignInteraction } from "../campaign.js";

export default createInteractionHandler({
	name: "campaign",

	handler: options => {
		return handleCampaignInteraction(options);
	}
});