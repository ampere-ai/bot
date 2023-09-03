import type { Transformers } from "@discordeno/bot";
import type { Bot } from "@discordeno/bot";

import { bot } from "../mod.js";

import Interaction from "./interaction.js";
import Channel from "./channel.js";
import Message from "./message.js";
import User from "./user.js";

export type TransformerName = keyof Transformers & keyof Transformers["desiredProperties"]

export interface Transformer<T extends TransformerName, Transformed, Raw> {
    name: T;
	properties: (keyof Transformers["desiredProperties"][T])[] | null;
    handler?: (bot: Bot, transformedPayload: Transformed, raw: Raw) => unknown;
}

const TRANSFORMERS = [
	Interaction, Message, User, Channel
];

export function setupTransformers() {
	for (const transformer of TRANSFORMERS) {
		/* All properties should be enabled */
		if (transformer.properties === null) {
			for (const key of Object.keys(bot.transformers.desiredProperties[transformer.name])) {
				Object.defineProperty(
					bot.transformers.desiredProperties[transformer.name],
					key, { value: true }
				);
			}

		/* Only some properties should be enabled */
		} else if (transformer.properties.length > 0) {
			for (const key of transformer.properties) {
				Object.defineProperty(
					bot.transformers.desiredProperties[transformer.name],
					key, { value: true }
				);
			}
		}

		/* Add custom properties & functions */
		if (transformer.handler) {
			const oldTransformer = bot.transformers[transformer.name];

			bot.transformers[transformer.name] = ((bot: Bot, payload: unknown) => {
				const transformed = (oldTransformer as any)(bot, payload);
				return transformer.handler!(bot, transformed, payload as any);
			}) as any;
		}
	}
}