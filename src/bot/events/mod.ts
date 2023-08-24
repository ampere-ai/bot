import type { EventHandlers } from "@discordeno/bot";

import type { Args, ReplaceBot } from "../types/args.js";
import { bot } from "../mod.js";

import InteractionCreate from "./interaction/mod.js";
import MessageCreate from "./message/create.js";

export interface Event<T extends keyof EventHandlers> {
    name: T;
    handler: ReplaceBot<Args<EventHandlers[T]>>;
}

const EVENTS = [
	InteractionCreate, MessageCreate
];

export function setupEvents() {
	for (const event of EVENTS) {
		bot.events[event.name] = async (...data: any[]) => {
			await (event.handler as any)(bot, ...data);
		};
	}
}