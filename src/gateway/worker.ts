import dotenv from "dotenv";
dotenv.config();

import type { WorkerCreateData, WorkerMessage } from "./types/worker.js";


import { ActivityTypes, DiscordGatewayPayload, DiscordGuild, DiscordMessage, DiscordReady, DiscordUnavailableGuild } from "@discordeno/types";
import { Collection, createLogger, snakelize } from "@discordeno/utils";
import { parentPort, workerData } from "worker_threads";
import { DiscordenoShard } from "@discordeno/gateway";
import RabbitMQ from "rabbitmq-client";

import { BOT_TOKEN, INTENTS, RABBITMQ_URI } from "../config.js";

if (!parentPort) throw new Error("Parent port is null");

const parent = parentPort!;
const data: WorkerCreateData = workerData;

const logger = createLogger({ name: `[WORKER #${data.workerId}]` });
const identifyPromises = new Map<number, () => void>();

const connection = new RabbitMQ.Connection(RABBITMQ_URI);
const publisher = connection.createPublisher();

const shards = new Collection<number, DiscordenoShard>();

/* Store loading guild & guild IDs to change GUILD_CREATE to GUILD_LOADED_DD, if needed. */
const loadingGuilds: Set<bigint> = new Set();
const guilds: Set<bigint> = new Set();

const manage = async (shard: DiscordenoShard, payload: DiscordGatewayPayload) => {
	switch (payload.t) {
		case "READY": {
			/* Marks which guilds the bot is in, when doing initial loading in cache. */
			(payload.d as DiscordReady).guilds.forEach((g) => loadingGuilds.add(BigInt(g.id)));
			
			parent.postMessage({
				type: "READY", shardId: shard.id
			});

			break;
		}

		case "GUILD_CREATE": {
			const guild = (payload.d as DiscordGuild);
			const id = BigInt(guild.id);

			const existing = guilds.has(id);
			if (existing) return;

			if (loadingGuilds.has(id)) {
				payload.t = "GUILD_CREATE";
				loadingGuilds.delete(id);
			}

			guilds.add(id);

			break;
		}

		case "GUILD_DELETE": {
			const guild = payload.d as DiscordUnavailableGuild;
			if (guild.unavailable) return;

			guilds.delete(BigInt(guild.id));

			break;
		}

		case "MESSAGE_CREATE":
		case "INTERACTION_CREATE": {
			if (payload.t === "MESSAGE_CREATE" && (payload.d as DiscordMessage).content?.length === 0) return;

			await publisher.send("gateway", {
				shard: shard.id, payload
			});

			break;
		}

		default:
			break;
	}
};

parent.on("message", async (data: WorkerMessage) => {
	switch (data.type) {
		case "IDENTIFY_SHARD": {
			logger.info(`Identifying ${shards.has(data.shardId) ? "existing" : "new"} shard #${data.shardId}`);

			const shard =
				shards.get(data.shardId) ??

				new DiscordenoShard({
					id: data.shardId,

					connection: {
						compress: false,
						intents: INTENTS,
						properties: {
							os: "linux",
							device: "Discordeno",
							browser: "Discordeno"
						},
						token: BOT_TOKEN,
						totalShards: 1,
						url: "wss://gateway.discord.gg",
						version: 10,
					},

					events: {
						message: async (shard, payload) => {
							await manage(shard, snakelize(payload));
						}
					}
				});

			shard.makePresence = async () => ({
				status: "online",
				since: null,
	
				activities: [
					{
						type: ActivityTypes.Game,
						name: ".gg/turing » @ChatGPT"
					}
				]
			});

			shards.set(shard.id, shard);
			await shard.identify();

			break;
		}

		case "ALLOW_IDENTIFY": {
			identifyPromises.get(data.shardId)?.();
			identifyPromises.delete(data.shardId);

			break;
		}
	}
});