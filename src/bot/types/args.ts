import type { Bot } from "@discordeno/bot";

/* Complicated stuff to add a DiscordBot argument to a function */
export type Args<T> = T extends (...args: infer U) => unknown ? U : never;
export type ReplaceBot<T extends any[], U = Promise<void> | void> = (bot: Bot, ...args: T) => U;