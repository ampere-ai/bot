import { type Bot, type Interaction, ApplicationCommandOptionTypes, InteractionDataOption } from "@discordeno/bot";

import { handleError } from "../../moderation/error.js";
import { ResponseError } from "../../errors/response.js";
import { EmbedColor } from "../../utils/response.js";

import { cooldownNotice, getCooldown, hasCooldown, setCooldown } from "../../utils/cooldown.js";
import { canUse, restrictionTypes } from "../../utils/restriction.js";
import { infractionNotice, isBanned } from "../../moderation/mod.js";

import type { Command } from "../../types/command.js";
import { COMMANDS } from "../../commands/mod.js";

export async function executeCommand(bot: Bot, interaction: Interaction) {
	if (!interaction.data) return;

	const command = COMMANDS.find(c => c.name === interaction.data?.name) ?? null;
	if (!command) return;

	const env = await bot.db.env(interaction.user.id, interaction.guildId);
	const type = bot.db.type(env);

	if (isBanned(env.user)) return void await interaction.reply(
		infractionNotice(env.user, isBanned(env.user)!)
	);
	
	if (command.cooldown) {
		if (hasCooldown(interaction)) {
			const { remaining } = getCooldown(interaction)!;
			await interaction.reply(await cooldownNotice(interaction, env));

			return void setTimeout(() => {
				interaction.deleteReply().catch(() => {});
			}, remaining);
		} else {
			if (command.cooldown[type]) setCooldown(
				bot, env, interaction, command.cooldown[type]!
			);
		}
	}

	/* Whether the user can access this command */
	const access = command.restrictions
		? canUse(bot, env, command.restrictions)
		: true;

	if (command.restrictions && !access) {
		const allowed = restrictionTypes(command.restrictions);

		return void await interaction.reply({
			embeds: {
				description: `This command is ${allowed.map(a => `**${a.description}** ${a.emoji}`).join(", ")}.`,
				color: EmbedColor.Yellow
			},

			ephemeral: true
		});
	}

	const options = parseCommandOptions(command, interaction.data!.options);
	const sub = parseSubCommand(interaction.data!.options);

	try {
		const response = await command.handler({
			bot, interaction, options, sub, env
		});

		if (response) await interaction.reply(response);

	} catch (error) {
		if (error instanceof ResponseError) {
			return void await interaction.reply(
				error.display()
			);
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

function parseSubCommand(options?: InteractionDataOption[]) {
	return options && options[0].type === ApplicationCommandOptionTypes.SubCommand
		? options[0].name : undefined;
}

function parseCommandOptions(command: Command, options?: InteractionDataOption[]) {
	let args: Record<string, string | number | boolean | undefined> = {};

	if (command.options && options) for (const [ name, settings ] of Object.entries(command.options)) {
		const option = options.find(o => o.name === name) ?? null;
		args[name] = option?.value ?? settings.default;
	}

	if (command.sub && options && options.some(o => o.type === ApplicationCommandOptionTypes.SubCommand)) {
		const sub = options.find(o => o.type === ApplicationCommandOptionTypes.SubCommand)!;
		args = { ...args, ...parseCommandOptions(command, sub.options) };
	}

	return args;
}

