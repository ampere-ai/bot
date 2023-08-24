import { type Bot, createBot, createRestManager } from "@discordeno/bot";
import { createLogger } from "@discordeno/utils";
import RabbitMQ from "rabbitmq-client";
import { createClient } from "redis";

import { INTENTS, REST_URL, BOT_TOKEN, HTTP_AUTH, RABBITMQ_URI, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_USER } from "../config.js";
import { GatewayMessage } from "../gateway/types/worker.js";

import { setupTransformers } from "./transformers/mod.js";
import { registerCommands } from "./commands/mod.js";
import { fetchCampaigns } from "./campaign.js";
import { setupEvents } from "./events/mod.js";
import { createAPI } from "./api.js";
import { createDB } from "./db.js";

async function createRedis() {
	const client = createClient({
		socket: {
			host: REDIS_HOST,
			port: REDIS_PORT
		},

		username: REDIS_USER,
		password: REDIS_PASSWORD
	});

	await client.connect();
	return client;
}

async function customizeBot(bot: Bot) {
	const customized = bot;

	customized.logger = createLogger({ name: "[BOT]" });
	customized.redis = await createRedis();
	customized.db = await createDB();
	customized.api = createAPI();

	return customized;
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

// @ts-expect-error Missing property
bot.rest.convertRestError = (error, data) => {
	if (!data) return { message: error.message };
	return { ...data, error: error };
};

async function handleGatewayMessage({ payload, shard }: GatewayMessage) {
	if (payload.t && payload.t !== "RESUMED") {
		bot.handlers[payload.t]?.(bot, payload, shard);
	}
}

await registerCommands();
await fetchCampaigns();

setupTransformers();
setupEvents();

const connection = new RabbitMQ.Connection(RABBITMQ_URI);

connection.createConsumer({
	queue: "gateway", concurrency: 16
}, async message => {
	await handleGatewayMessage(message.body);
});

bot.logger.info("Started.");