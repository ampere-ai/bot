import type { EventHandlers } from "@discordeno/bot";

import type { Args, AddBotArg } from "../types/args.js";
import { bot } from "../mod.js";

import interactionCreate from "./interaction/mod.js";
import messageCreate from "./message/create.js";

export interface Event<T extends keyof EventHandlers> {
    name: T;
    handler: AddBotArg<Args<EventHandlers[T]>>;
}

const EVENTS = [
	interactionCreate, messageCreate
];

export function setupEvents() {
	for (const event of EVENTS) {
		bot.events[event.name] = async (...data) => {
			await (event.handler as any)(bot, ...data);
		};
	}
}