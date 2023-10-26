import { type Bot, type ApplicationCommandOption, ApplicationCommandOptionTypes } from "@discordeno/bot";
import type { Command } from "../types/command.js";

import { MOD_GUILD_ID } from "../../config.js";

import marketplace from "./marketplace.js";
import campaign from "./mod/campaigns.js";
import translate from "./translate.js";
import settings from "./settings.js";
import pardon from "./mod/pardon.js";
import imagine from "./imagine.js";
import premium from "./premium.js";
import roles from "./dev/roles.js";
import info from "./mod/info.js";
import warn from "./mod/warn.js";
import reset from "./reset.js";
import ban from "./mod/ban.js";
import dev from "./dev/dev.js";
import vote from "./vote.js";
import bot from "./bot.js";

/* The order is important; don't try to fix it */
import { RestrictionName } from "../utils/restriction.js";

export const COMMANDS: Command<any, any>[] = [
	settings, reset, imagine, premium, info, bot, ban, pardon, warn, dev, roles, translate, vote, marketplace, campaign
];

function transformCommand(command: Command) {
	const options: ApplicationCommandOption[] = [];
	const sub: ApplicationCommandOption[] = [];

	for (const [ name, data ] of Object.entries(command.options ?? {})) {
		const { type, description, choices, required } = data;

		if (data.type === ApplicationCommandOptionTypes.Number || data.type === ApplicationCommandOptionTypes.Integer) {
			options.push({
				name, type, description, choices, required,
				maxValue: data.max, minValue: data.min
			});
		} else if (data.type === ApplicationCommandOptionTypes.String) {
			options.push({
				name, type, description, choices, required,
				maxLength: data.maxLength, minLength: data.minLength
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
		description: command.description ?? "...",
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