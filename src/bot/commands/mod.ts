import { type Bot, type ApplicationCommandOption, ApplicationCommandOptionTypes, CreateApplicationCommand } from "@discordeno/bot";
import type { Command } from "../types/command.js";

import { createLocalizationMap } from "../i18n.js";
import { MOD_GUILD_ID } from "../../config.js";

import imagine, { generateModelChoices } from "./imagine.js";
import marketplace from "./marketplace.js";
import translate from "./translate.js";
import settings from "./settings.js";
import roles from "./dev/roles.js";
import reset from "./reset.js";
import dev from "./dev/dev.js";
import bot from "./bot.js";

/* The order is important; don't try to fix it */
import { RestrictionName } from "../utils/restriction.js";

export const COMMANDS: Command<any, any>[] = [
	settings, reset, imagine, bot, translate, marketplace,
	dev, roles
];

function transformCommand(command: Command): CreateApplicationCommand {
	const options: ApplicationCommandOption[] = [];
	const sub: ApplicationCommandOption[] = [];

	for (const [ name, data ] of Object.entries(command.options ?? {})) {
		const { type, choices, required } = data;
		const { fallback, locales } = createLocalizationMap(`commands.${command.name}.options.${name}`, "...");

		if (data.type === ApplicationCommandOptionTypes.Number || data.type === ApplicationCommandOptionTypes.Integer) {
			options.push({
				name, type, choices, required,
				description: fallback, descriptionLocalizations: locales,
				maxValue: data.max, minValue: data.min
			});
		} else if (data.type === ApplicationCommandOptionTypes.String) {
			options.push({
				name, type, choices, required,
				description: fallback, descriptionLocalizations: locales,
				maxLength: data.maxLength, minLength: data.minLength
			});
		} else {
			options.push({
				description: fallback, descriptionLocalizations: locales,
				name, type, choices, required
			});
		}
	}

	for (const [ name ] of Object.entries(command.sub ?? {})) {
		const { fallback, locales } = createLocalizationMap(`commands.${command.name}.sub.${name}`);

		sub.push({
			type: ApplicationCommandOptionTypes.SubCommand,
			description: fallback,
			descriptionLocalizations: locales,
			name, options
		});
	}
	

	const { fallback, locales } = createLocalizationMap(`commands.${command.name}.desc`);

	return {
		name: command.name,
		description: fallback,
		descriptionLocalizations: locales,
		type: command.type,

		options: command.sub
			? sub : options
	};
}

/** Figure out whether a command counts as private. */
export function isPrivateCommand(command: Command) {
	if (!command.restrictions || command.restrictions.length === 0) return false;
	return command.restrictions.includes(RestrictionName.Developer);
}

export async function registerCommands(bot: Bot) {
	imagine.options!.model.choices = generateModelChoices();
	const commands = Object.values(COMMANDS);

	Promise.all([
		/* Global commands */
		bot.rest.upsertGlobalApplicationCommands(
			commands.filter(c => !isPrivateCommand(c)).map(transformCommand)
		),

		/* Developer commands */
		bot.rest.upsertGuildApplicationCommands(
			MOD_GUILD_ID, commands.filter(c => isPrivateCommand(c)).map(transformCommand)
		)
	]);
}