import { createInteractionHandler } from "../helpers/interaction.js";
import { handleImagineInteraction } from "../commands/imagine.js";

export default createInteractionHandler({
	name: "i",
	cooldown: 5 * 60 * 1000,

	handler: options => {
		return handleImagineInteraction(options);
	}
});