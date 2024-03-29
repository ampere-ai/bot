import type { Bot, Interaction } from "@discordeno/bot";
import type { InteractionHandler } from "../types/interaction.js";

import { cooldownNotice, getCooldown, hasCooldown, setCooldown } from "../utils/cooldown.js";
import { canUse, restrictionTypes } from "../utils/restriction.js";
import { ResponseError } from "../errors/response.js";
import { handleError } from "../utils/error.js";
import { EmbedColor } from "../utils/response.js";

import marketplace from "./marketplace.js";
import settings from "./settings.js";
import imagine from "./imagine.js";

export const HANDLERS: InteractionHandler[] = [
	settings, imagine, marketplace
];

export const INTERACTION_ID_SEP = ":";

export async function handleInteraction(bot: Bot, interaction: Interaction) {
	if (!interaction.data || !interaction.data.customId) return;

	const args = interaction.data.customId.split(INTERACTION_ID_SEP);
	const name = args.shift()!;

	const handler = HANDLERS.find(c => c.name === name) ?? null;
	if (!handler) return;

	const env = await bot.db.env(interaction.user.id, interaction.guildId);

	if (handler.cooldown) {
		if (hasCooldown(interaction)) {
			const { remaining } = getCooldown(interaction)!;
			await interaction.reply(cooldownNotice(bot, env, interaction));

			return void setTimeout(() => {
				interaction.deleteReply().catch(() => {});
			}, remaining);
		} else {
			if (handler.cooldown) setCooldown(env, interaction, handler.cooldown);
		}
	}

	/* Whether the user can access this interaction */
	const access = handler.restrictions
		? canUse(bot, env, handler.restrictions)
		: true;

	if (handler.restrictions && !access) {
		const allowed = restrictionTypes(env, handler.restrictions);

		return void await interaction.reply({
			embeds: {
				description: { key: "restrictions.messages.action", data: { restrictions: allowed.map(a => `**${a.description}** ${a.emoji}`).join(", ") } },
				color: EmbedColor.Yellow
			},

			ephemeral: true, env
		});
	}

	try {
		const response = await handler.handler({
			bot, interaction, args, env
		});

		if (response) await interaction.reply({
			...response, env
		});

	} catch (error) {
		if (error instanceof ResponseError) {
			try {
				return void await interaction.reply(error.display(env));
			} catch {
				return void await interaction.editReply(error.display(env))
					.catch(() => {});
			}
		}

		try {
			await interaction.reply(
				await handleError(bot, { env, error })
			);
		} catch {
			await interaction.editReply(
				await handleError(bot, { env, error })
			).catch(() => {});
		}
	}
}