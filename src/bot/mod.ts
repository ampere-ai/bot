import { type Bot, createBot, createRestManager } from "@discordeno/bot";
import { createLogger } from "@discordeno/utils";
import RabbitMQ from "rabbitmq-client";

import { INTENTS, REST_URL, BOT_TOKEN, HTTP_AUTH, RABBITMQ_URI } from "../config.js";
import { GatewayMessage } from "../gateway/types/worker.js";

import { setupTransformers } from "./transformers/mod.js";
import { registerCommands } from "./commands/mod.js";
import { setupPaymentHandler } from "./premium.js";
import { fetchCampaigns } from "./campaign.js";
import { setupEvents } from "./events/mod.js";
import { createAPI } from "./api.js";
import { createDB } from "./db.js";
import { setupVoteHandler } from "./vote.js";

async function customizeBot(bot: Bot) {
	bot.logger = createLogger({ name: "[BOT]" });
	bot.db = await createDB();
	bot.api = createAPI();
	bot.rabbitmq = new RabbitMQ.Connection(RABBITMQ_URI);

	return bot;
}

export const bot = await customizeBot(
	createBot({
		token: BOT_TOKEN,
		intents: INTENTS,
		events: {}
	})
);

bot.rest = createRestManager({
	token: BOT_TOKEN,

	proxy: {
		authorization: HTTP_AUTH,
		baseUrl: REST_URL
	}
});

async function handleGatewayMessage({ payload, shard }: GatewayMessage) {
	if (payload.t && payload.t !== "RESUMED") {
		bot.handlers[payload.t]?.(bot, payload, shard);
	}
}

await registerCommands(bot);
await fetchCampaigns();

setupPaymentHandler(bot);
setupVoteHandler(bot);

setupTransformers();
setupEvents();

bot.rabbitmq.createConsumer({
	queue: "gateway", concurrency: 16
}, async message => {
	await handleGatewayMessage(message.body);
});

bot.logger.info("Started.");