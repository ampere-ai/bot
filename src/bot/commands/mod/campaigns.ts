import { RestrictionName } from "../../utils/restriction.js";
import { createCommand } from "../../helpers/command.js";
import { buildCampaignFinder } from "../../campaign.js";

export default createCommand({
	name: "campaigns",
	restrictions: [ RestrictionName.Developer ],

	handler: async ({ env }) => {
		return buildCampaignFinder(env);
	}
});