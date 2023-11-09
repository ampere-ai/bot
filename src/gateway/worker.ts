import dotenv from "dotenv";
dotenv.config();

import { DiscordGatewayPayload, DiscordGuild, DiscordMessage, DiscordReady, DiscordUnavailableGuild } from "@discordeno/types";
import { Collection, createLogger, snakelize } from "@discordeno/utils";
import { parentPort, workerData } from "worker_threads";
import { DiscordenoShard } from "@discordeno/gateway";
import RabbitMQ from "rabbitmq-client";

import type { WorkerCreateData, WorkerInfo, WorkerMessage, WorkerShardInfo } from "./types/worker.js";
import { RABBITMQ_URI } from "../config.js";

if (!parentPort) throw new Error("Parent port is null");

const parent = parentPort!;
const data: WorkerCreateData = workerData;

const logger = createLogger({ name: `[WORKER #${data.id}]` });

const connection = new RabbitMQ.Connection(RABBITMQ_URI);
const publisher = connection.createPublisher();

const shards = new Collection<number, DiscordenoShard>();

const loadingGuilds = new Set<bigint>();
const guilds = new Set<bigint>();

async function handleMessage(shard: DiscordenoShard, payload: DiscordGatewayPayload) {
	if (payload.t === "GUILD_CREATE") {
		const guild = (payload.d as DiscordGuild);
		const id = BigInt(guild.id);

		const existing = guilds.has(id);
		if (existing) return;

		guilds.add(id);

		if (loadingGuilds.has(id)) {
			loadingGuilds.delete(id);
			return;
		}
	}

	switch (payload.t) {
		case "READY": {
			/* Marks which guilds the bot is in, when doing initial loading in cache. */
			(payload.d as DiscordReady).guilds.forEach((g) => loadingGuilds.add(BigInt(g.id)));
			
			parent.postMessage({
				type: "READY", shardId: shard.id
			});

			break;
		}

		case "GUILD_DELETE": {
			const guild = payload.d as DiscordUnavailableGuild;
			if (guild.unavailable) return;

			guilds.delete(BigInt(guild.id));
			break;
		}

		case "GUILD_CREATE":
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
}

function buildShardInfo(shard: DiscordenoShard): WorkerShardInfo {
	return {
		rtt: shard.heart.rtt ?? 0,
		state: shard.state
	};
}

function buildInfo(): WorkerInfo {
	return {
		shards: shards.map(buildShardInfo),
		guildCount: guilds.size
	};
}

parent.on("message", async (message: WorkerMessage) => {
	switch (message.type) {
		case "IDENTIFY_SHARD": {
			logger.info(`Identifying ${shards.has(message.shardId) ? "existing" : "new"} shard #${message.shardId}`);

			const shard =
				shards.get(message.shardId) ??

				new DiscordenoShard({
					id: message.shardId,

					connection: {
						compress: false,
						intents: data.intents,
						properties: {
							os: "linux",
							device: "Discordeno",
							browser: "Discordeno"
						},
						token: data.token,
						totalShards: data.totalShards,
						url: "wss://gateway.discord.gg",
						version: 10
					},

					events: {
						message: async (shard, payload) => {
							await handleMessage(shard, snakelize(payload));
						}
					}
				});

			shard.makePresence = async () => ({
				status: "dnd",
				since: null,
				activities: []
			});

			shards.set(shard.id, shard);
			await shard.identify();

			break;
		}

		case "INFO": {
			parent.postMessage({
				type: "NONCE_REPLY", nonce: message.nonce, data: buildInfo()
			});
		}
	}
});