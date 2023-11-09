import { type Bot, createBot } from "@discordeno/bot";
import { createLogger } from "@discordeno/utils";
import RabbitMQ from "rabbitmq-client";

import { INTENTS, BOT_TOKEN, RABBITMQ_URI, HTTP_AUTH, REST_URL } from "../config.js";
import { GatewayMessage } from "../gateway/types/worker.js";

import { setupTransformers } from "./transformers/mod.js";
import { registerCommands } from "./commands/mod.js";
import { fetchSettings } from "./settings.js";
import { setupEvents } from "./events/mod.js";
import { setupI18N } from "./i18n.js";
import { createAPI } from "./api.js";
import { createDB } from "./db.js";

async function customizeBot(bot: Bot) {
	bot.logger = createLogger({ name: "[BOT]" });
	bot.db = await createDB();
	bot.api = createAPI();
	bot.rabbitmq = new RabbitMQ.Connection(RABBITMQ_URI);

	bot.dynamic = {
		plugins: await bot.api.other.plugins()
	};

	return bot;
}

export const bot = await customizeBot(
	createBot({
		token: BOT_TOKEN,
		intents: INTENTS,
		events: {},

		rest: {
			proxy: {
				authorization: HTTP_AUTH,
				baseUrl: REST_URL
			}
		}
	})
);

async function handleGatewayMessage({ payload, shard }: GatewayMessage) {
	if (payload.t && payload.t !== "RESUMED") {
		bot.handlers[payload.t]?.(bot, payload, shard);
	}
}

await setupI18N();
await registerCommands(bot);
await fetchSettings(bot);

setupTransformers();
setupEvents();

bot.rabbitmq.createConsumer({
	queue: "gateway", concurrency: 16
}, async message => {
	await handleGatewayMessage(message.body);
});

bot.logger.info("Started.");