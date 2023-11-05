import type { Conversation } from "../types/conversation.js";

import { resetConversation, runningGenerations } from "../chat/mod.js";
import { createCommand } from "../helpers/command.js";
import { ResponseError } from "../errors/response.js";
import { EmbedColor } from "../utils/response.js";

export default createCommand({
	name: "reset",

	handler: async ({ bot, env, interaction }) => {
		const conversation = await bot.db.fetch<Conversation>("conversations", interaction.user.id);

		if (conversation.history.length === 0) throw new ResponseError({
			message: "reset.errors.inactive", emoji: "😔"
		});

		if (runningGenerations.has(BigInt(conversation.id))) throw new ResponseError({
			message: "reset.errors.pending", emoji: "😔"
		});

		await resetConversation(bot, env, conversation);

		return {
			embeds: {
				description: "reset.desc 😊",
				color: EmbedColor.Green
			},

			ephemeral: true
		};
	}
});