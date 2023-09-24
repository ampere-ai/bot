import type { Bot, Interaction } from "@discordeno/bot";
import type { InteractionHandler } from "../types/interaction.js";

import { cooldownNotice, getCooldown, hasCooldown, setCooldown } from "../utils/cooldown.js";
import { canUse, restrictionTypes } from "../utils/restriction.js";
import { infractionNotice, isBanned } from "../moderation/mod.js";
import { ResponseError } from "../errors/response.js";
import { handleError } from "../moderation/error.js";
import { EmbedColor } from "../utils/response.js";

import marketplace from "./marketplace.js";
import moderation from "./moderation.js";
import settings from "./settings.js";
import campaign from "./campaign.js";
import premium from "./premium.js";
import imagine from "./imagine.js";

export const HANDLERS: InteractionHandler[] = [
	settings, premium, campaign, imagine, moderation, marketplace
];

export const INTERACTION_ID_SEP = ":";

export async function handleInteraction(bot: Bot, interaction: Interaction) {
	if (!interaction.data || !interaction.data.customId) return;

	const args = interaction.data.customId.split(INTERACTION_ID_SEP);
	const name = args.shift()!;

	const handler = HANDLERS.find(c => c.name === name) ?? null;
	if (!handler) return;

	const env = await bot.db.env(interaction.user.id, interaction.guildId);
	const type = bot.db.type(env);

	if (isBanned(env.user)) return void await interaction.reply(
		infractionNotice(env.user, isBanned(env.user)!)
	);

	if (handler.cooldown) {
		if (hasCooldown(interaction)) {
			const { remaining } = getCooldown(interaction)!;
			await interaction.reply(cooldownNotice(bot, env, interaction));

			return void setTimeout(() => {
				interaction.deleteReply().catch(() => {});
			}, remaining);
		} else {
			if (handler.cooldown[type]) setCooldown(bot, env, interaction, handler.cooldown[type]!);
		}
	}

	/* Whether the user can access this interaction */
	const access = handler.restrictions
		? canUse(bot, env, handler.restrictions)
		: true;

	if (handler.restrictions && !access) {
		const allowed = restrictionTypes(handler.restrictions);

		return void await interaction.reply({
			embeds: {
				description: `This action is ${allowed.map(a => `**${a.description}** ${a.emoji}`).join(", ")}.`,
				color: EmbedColor.Yellow
			},

			ephemeral: true
		});
	}

	try {
		const response = await handler.handler({
			bot, interaction, args, env
		});

		if (response) await interaction.reply(response);

	} catch (error) {
		if (error instanceof ResponseError) {
			try {
				return void await interaction.reply(error.display());
			} catch {
				return void await interaction.editReply(error.display())
					.catch(() => {});
			}
		}

		try {
			await interaction.reply(
				await handleError(bot, { error, guild: interaction.guildId })
			);
		} catch {
			await interaction.editReply(
				await handleError(bot, { error, guild: interaction.guildId })
			).catch(() => {});
		}
	}
}