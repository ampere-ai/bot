import type { Bot, Interaction } from "@discordeno/bot";
import type { InteractionHandler } from "../types/interaction.js";

import { cooldownNotice, getCooldown, hasCooldown, setCooldown } from "../utils/cooldown.js";
import { handleError } from "../moderation/error.js";

import Settings from "./settings.js";
import Campaign from "./campaign.js";
import Premium from "./premium.js";
import Imagine from "./imagine.js";

export const HANDLERS: InteractionHandler[] = [
	Settings, Premium, Campaign, Imagine
];

export async function handleInteraction(bot: Bot, interaction: Interaction) {
	if (!interaction.data || !interaction.data.customId) return;

	const args = interaction.data.customId.split(":");
	const name = args.shift()!;

	const handler = HANDLERS.find(c => c.name === name) ?? null;
	if (!handler) return;

	const env = await bot.db.env(interaction.user.id, interaction.guildId);
	const type = bot.db.type(env);

	if (handler.cooldown) {
		if (hasCooldown(interaction)) {
			const { remaining } = getCooldown(interaction)!;
			await interaction.reply(await cooldownNotice(interaction, env));

			return void setTimeout(() => {
				interaction.deleteReply().catch(() => {});
			}, remaining);
		} else {
			if (handler.cooldown[type]) setCooldown(bot, env, interaction, handler.cooldown[type]!);
		}
	}

	try {
		const response = await handler.handler({
			bot, interaction, args, env
		});

		if (response) await interaction.reply(response);

	} catch (error) {
		await interaction.reply(
			await handleError(bot, { error, guild: interaction.guildId })
		).catch(() => {});
	}
}