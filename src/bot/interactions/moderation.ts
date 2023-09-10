import { handleModerationInteraction } from "../moderation/tools.js";
import { createInteractionHandler } from "../helpers/interaction.js";
import { RestrictionName } from "../utils/restriction.js";

export default createInteractionHandler({
	name: "mod",
	restrictions: [ RestrictionName.Moderator ],

	handler: options => {
		return handleModerationInteraction(options);
	}
});