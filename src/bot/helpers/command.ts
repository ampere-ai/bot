import { Command, CommandOption, SubCommand } from "../types/command.js";

export function createCommand<
	Options extends Record<string, CommandOption>,
	SubCommands extends Record<string, SubCommand> = Record<string, never>
>(
	command: Command<Options, SubCommands>
): Command<Options, SubCommands> {
	return command;
}