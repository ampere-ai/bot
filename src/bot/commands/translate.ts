import { ApplicationCommandOptionTypes } from "@discordeno/bot";

import { moderate, moderationNotice } from "../moderation/mod.js";
import { ModerationSource } from "../moderation/types/mod.js";
import { USER_LANGUAGES } from "../../db/types/language.js";
import { createCommand } from "../helpers/command.js";
import { ResponseError } from "../errors/response.js";
import { BRANDING_COLOR } from "../../config.js";
import { APIError } from "../errors/api.js";

export default createCommand({
	name: "translate",
	description: "Translate text using AI",

	cooldown: {
		user: 2.5 * 60 * 1000,
		voter: 2.25 * 60 * 1000,
		subscription: 30 * 1000
	},

	options: {
		content: {
			type: ApplicationCommandOptionTypes.String,
			description: "Which text to translate",
			required: true
		},

		to: {
			type: ApplicationCommandOptionTypes.String,
			description: "Which language to translate the given text into",

			choices: USER_LANGUAGES.map(l => ({
				name: `${l.emoji} ${l.name}`, value: l.id
			}))
		}
	},

	handler: async ({ bot, env, interaction, options: { content, to } }) => {
		/* Which language to translate the given text into */
		const language = USER_LANGUAGES.find(l => l.id === to) ?? USER_LANGUAGES[0];

		const moderation = await moderate({
			bot, env, user: interaction.user, content, source: ModerationSource.TranslationPrompt
		});
	
		if (moderation.blocked) return moderationNotice({ result: moderation });
		await interaction.deferReply();

		try {
			const result = await bot.api.text.translate({
				content, language: language.modelName ?? language.name
			});

			await interaction.editReply({
				embeds: {
					title: "Translated message 🌐",
					description: `\`\`\`\n${result.content}\n\`\`\``,
					color: BRANDING_COLOR,

					fields: [
						{
							name: "Detected language",
							value: result.language,
							inline: true
						},

						{
							name: "Translated into",
							value: language.name,
							inline: true
						}
					]
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				throw new ResponseError({
					message: error.message
				});
			} else {
				throw error;
			}
		}
	}
});