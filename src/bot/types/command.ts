import type { ApplicationCommandOptionChoice, ApplicationCommandOptionTypes, ApplicationCommandTypes, Bot, Interaction } from "@discordeno/bot";

import type { RestrictionName } from "../utils/restriction.js";
import type { MessageResponse } from "../utils/response.js";
import type { DBEnvironment } from "../../db/types/mod.js";

import { DBUserType } from "../../db/types/user.js";

export interface SubCommand {
	description: string;
}

interface BaseCommandOption<T extends ApplicationCommandOptionTypes> {
	type: T;
	description: string;
	required?: boolean;
	default?: MapCommandOptionTypeToValue<T>;
}

type BaseCommandOptionWithChoices<T extends ApplicationCommandOptionTypes> = BaseCommandOption<T> & {
	choices?: ApplicationCommandOptionChoice[];
};

type CommandStringOption = BaseCommandOptionWithChoices<ApplicationCommandOptionTypes.String> & {
	minLength?: number;
	maxLength?: number;
};

type CommandNumberOption = BaseCommandOptionWithChoices<ApplicationCommandOptionTypes.Number | ApplicationCommandOptionTypes.Integer> & {
	min?: number;
	max?: number;
};

type CommandBooleanOption = BaseCommandOptionWithChoices<ApplicationCommandOptionTypes.Boolean>;

export type CommandOption = CommandStringOption | CommandNumberOption | CommandBooleanOption;

type MapCommandOptionTypeToValue<T extends ApplicationCommandOptionTypes> =
    T extends ApplicationCommandOptionTypes.String ? string :
    T extends ApplicationCommandOptionTypes.Integer ? number :
    T extends ApplicationCommandOptionTypes.Number ? number :
	T extends ApplicationCommandOptionTypes.Boolean ? boolean :
    never;

type OptionsWithRequiredProperty<T extends Record<string, BaseCommandOption<any>>> = {
	[K in keyof T]: 
		(
			T[K]["required"] extends true ? true :
			T[K]["default"] extends MapCommandOptionTypeToValue<T[K]["type"]> ? true : false
		) extends true 
			? MapCommandOptionTypeToValue<T[K]["type"]>
			: MapCommandOptionTypeToValue<T[K]["type"]> | undefined;
};

/* Utility type to conditionally extract sub-command names */
type ExtractSubCommands<T extends Record<string, SubCommand>> = 
	T extends Record<string, never> ? undefined : keyof T;

export type CommandCooldown = Partial<Record<DBUserType, number>>;

interface CommandHandlerOptions<
	Options extends Record<string, CommandOption>,
	SubCommands extends Record<string, SubCommand>
> {
	bot: Bot;
	interaction: Interaction;
    options: OptionsWithRequiredProperty<Options>;
	sub: ExtractSubCommands<SubCommands>;
	env: DBEnvironment;
}

export interface Command<
	Options extends Record<string, CommandOption> = Record<string, CommandOption>,
	SubCommands extends Record<string, SubCommand> = Record<string, SubCommand>
> {
    /** Name of the command */
    name: string;

    /** Description of the command */
    description?: string;

	/** Restrictions of the command */
	restrictions?: RestrictionName[];

    /** Type of the command */
    type?: ApplicationCommandTypes;

    /** Cool-down of the command */
    cooldown?: CommandCooldown;

	/** Sub-commands of the command */
	sub?: SubCommands;

    /** Options of the command */
    options?: Options;

    /** Handler of the command */
    handler: (
        options: CommandHandlerOptions<Options, SubCommands>
    ) => Promise<MessageResponse | void> | MessageResponse | void;
}