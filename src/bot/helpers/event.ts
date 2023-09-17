import type { EventHandlers } from "@discordeno/bot";
import type { Args, AddBotArg } from "../types/args.js";

export function createEvent<T extends keyof EventHandlers>(
	name: T, handler: AddBotArg<Args<EventHandlers[T]>>
) {
	return {
		name, handler
	};
}