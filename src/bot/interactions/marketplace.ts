import { createInteractionHandler } from "../helpers/interaction.js";
import { handleMarketplaceInteraction } from "../marketplace.js";

export default createInteractionHandler({
	name: "market",

	handler: options => {
		return handleMarketplaceInteraction(options);
	}
});