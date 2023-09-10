import { type Bot, type Camelize, type CreateApplicationCommand, type DiscordApplicationCommandOption, ApplicationCommandOptionTypes } from "@discordeno/bot";
import type { Command } from "../types/command.js";

import { MOD_GUILD_ID } from "../../config.js";

import settings from "./settings.js";
import pardon from "./mod/pardon.js";
import imagine from "./imagine.js";
import premium from "./premium.js";
import info from "./mod/info.js";
import warn from "./mod/warn.js";
import reset from "./reset.js";
import ban from "./mod/ban.js";
import bot from "./bot.js";

import { RestrictionName } from "../utils/restriction.js";

export const COMMANDS: Command<any, any>[] = [
	settings, reset, imagine, premium, info, bot, ban, pardon, warn
];

function transformCommand(command: Command): CreateApplicationCommand {
	const options: Camelize<DiscordApplicationCommandOption[]> = [];
	const sub: Camelize<DiscordApplicationCommandOption[]> = [];

	for (const [ name, data ] of Object.entries(command.options ?? {})) {
		const { type, description, choices, required } = data;

		if (data.type === ApplicationCommandOptionTypes.Number || data.type === ApplicationCommandOptionTypes.Integer) {
			options.push({
				name, type, description, choices, required,
				maxValue: data.max, minValue: data.min
			});
		} else {
			options.push({
				name, type, description, choices, required
			});
		}
	}

	for (const [ name, settings ] of Object.entries(command.sub ?? {})) {
		sub.push({
			type: ApplicationCommandOptionTypes.SubCommand,
			name, options, description: settings.description
		});
	}

	return {
		name: command.name,
		description: command.description,
		type: command.type,

		options: command.sub
			? sub : options
	};
}

/** Figure out whether a command counts as private. */
export function isPrivateCommand(command: Command) {
	if (!command.restrictions || command.restrictions.length === 0) return false;

	return command.restrictions.includes(RestrictionName.Moderator)
		|| command.restrictions.includes(RestrictionName.Developer);
}

export async function registerCommands(bot: Bot) {
	const commands = Object.values(COMMANDS);

	Promise.all([
		/* Global commands */
		bot.helpers.upsertGlobalApplicationCommands(
			commands.filter(c => !isPrivateCommand(c)).map(transformCommand)
		),

		/* Moderation & developer commands */
		bot.helpers.upsertGuildApplicationCommands(
			MOD_GUILD_ID, commands.filter(c => isPrivateCommand(c)).map(transformCommand)
		)
	]);
}