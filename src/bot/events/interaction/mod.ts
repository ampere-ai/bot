import { InteractionTypes, snowflakeToTimestamp } from "@discordeno/bot";

import { handleInteraction } from "../../interactions/mod.js";
import { createEvent } from "../../helpers/event.js";
import { executeCommand } from "./command.js";

export default createEvent("interactionCreate", async (bot, interaction) => {
	/* Make sure that the interaction hasn't expired yet. */
	if (snowflakeToTimestamp(interaction.id) > Date.now() + 15 * 1000) return; 

	if (interaction.type === InteractionTypes.ApplicationCommand) {
		return await executeCommand(bot, interaction);
	}

	await handleInteraction(bot, interaction);
});