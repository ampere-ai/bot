import type { EventHandlers } from "@discordeno/bot";

import type { Args, AddBotArg } from "../types/args.js";
import type { Event } from "../events/mod.js";

export function createEvent<T extends keyof EventHandlers>(
	name: T, handler: AddBotArg<Args<EventHandlers[T]>>
): Event<T> {
	return {
		name, handler
	};
}