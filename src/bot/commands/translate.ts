import { ApplicationCommandOptionTypes } from "@discordeno/bot";

import { moderate, moderationNotice } from "../moderation/mod.js";
import { ModerationSource } from "../moderation/types/mod.js";
import { createCommand } from "../helpers/command.js";
import { ResponseError } from "../errors/response.js";
import { USER_LOCALES } from "../types/locale.js";
import { BRANDING_COLOR } from "../../config.js";
import { translateObject } from "../i18n.js";
import { APIError } from "../errors/api.js";

export default createCommand({
	name: "translate",

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

			choices: USER_LOCALES.map(l => ({
				name: `${l.emoji} ${l.name}`, value: l.id
			}))
		}
	},

	handler: async ({ bot, env, interaction, options: { content, to } }) => {
		/* Which language to translate the given text into */
		const language = USER_LOCALES.find(l => l.id === to) ?? USER_LOCALES[0];

		const moderation = await moderate({
			bot, env, user: interaction.user, content, source: ModerationSource.TranslationPrompt
		});
	
		if (moderation.blocked) return moderationNotice({ result: moderation, env });
		await interaction.deferReply();

		try {
			const result = await bot.api.text.translate({
				content, language: language.modelName ?? language.name
			});

			await interaction.editReply(translateObject({
				embeds: {
					title: "translate.title",
					description: `\`\`\`\n${result.content}\n\`\`\``,
					color: BRANDING_COLOR,

					fields: [
						{
							name: "translate.fields.detected",
							value: result.language,
							inline: true
						},

						{
							name: "translate.fields.into",
							value: language.name,
							inline: true
						}
					]
				}
			}, env));
		} catch (error) {
			if (error instanceof APIError) {
				throw new ResponseError({
					message: error.options.data?.message ?? error.message
				});
			} else {
				throw error;
			}
		}
	}
});