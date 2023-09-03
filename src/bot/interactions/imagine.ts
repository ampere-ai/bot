import { createInteractionHandler } from "../helpers/interaction.js";
import { handleImagineInteraction } from "../commands/imagine.js";

export default createInteractionHandler({
	name: "i",

	cooldown: {
		user: 5 * 60 * 1000,
		voter: 4 * 60 * 1000,
		subscription: 1.5 * 60 * 1000
	},

	handler: options => {
		return handleImagineInteraction(options);
	}
});