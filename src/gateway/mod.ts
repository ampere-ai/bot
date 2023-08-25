import dotenv from "dotenv";
dotenv.config();

import { Collection, createBot, createGatewayManager, createRestManager } from "@discordeno/bot";
import { createLogger } from "@discordeno/utils";
import { Worker } from "worker_threads";
import express from "express";

import { BOT_TOKEN, INTENTS, HTTP_AUTH, REST_URL, SHARDS_PER_WORKER, TOTAL_WORKERS, GATEWAY_PORT } from "../config.js";
import { ManagerHTTPRequest, ManagerMessage } from "./types/manager.js";
import type { WorkerCreateData } from "./types/worker.js";

const logger = createLogger({ name: "[MANAGER]" });
const workers = new Collection<number, Worker>();

const app = express();

app.use(
	express.urlencoded({
		extended: true
	})
);

app.use(express.json());

const bot = createBot({
	token: BOT_TOKEN,
	events: {}
});

bot.rest = createRestManager({
	token: BOT_TOKEN,

	proxy: {
		authorization: HTTP_AUTH,
		baseUrl: REST_URL
	}
});


const gateway = createGatewayManager({
	token: BOT_TOKEN, intents: INTENTS,

	shardsPerWorker: SHARDS_PER_WORKER,
	totalWorkers: TOTAL_WORKERS,

	connection: await bot.rest.getSessionInfo(),
	events: {}
});

gateway.tellWorkerToIdentify = async (workerId, shardId) => {
	let worker = workers.get(workerId);

	if (!worker) {
		worker = createWorker(workerId);
		workers.set(workerId, worker);
	}

	worker.postMessage({
		type: "IDENTIFY_SHARD",
		shardId
	});
};

function createWorker(id: number) {
	if (id === 0) logger.info(`Identifying with ${gateway.totalShards} total shards`);
	logger.info(`Tell to identify shard #${id}`);

	const workerData: WorkerCreateData = {
		token: BOT_TOKEN, intents: gateway.intents,
		totalShards: gateway.totalShards,
		workerId: id, path: "./worker.ts"
	};

	const worker = new Worker("./build/gateway/worker.js", {
		workerData
	});

	worker.on("message", async (data: ManagerMessage) => {
		switch (data.type) {
			case "REQUEST_IDENTIFY": {
				logger.info(`Requesting to identify shard #${data.shardId}`);
				await gateway.requestIdentify(data.shardId);

				worker.postMessage({
					type: "ALLOW_IDENTIFY",
					shardID: data.shardId
				});

				break;
			}

			case "READY": {
				logger.info(`Shard #${data.shardId} is ready`);
				break;
			}
		}
	});

	return worker;
}

gateway.spawnShards();

app.all("/*", async (req, res) => {
	if (HTTP_AUTH !== req.headers.authorization) {
		return res.status(401).json({ error: "Invalid authorization" });
	}

	try {
		const data = req.body as ManagerHTTPRequest;

		switch (data.type) {
			case "SHARD_PAYLOAD": {
				for (const worker of workers.values()) {
					worker.postMessage(data);
				}
				
				break;
			}
		}

		return res.status(200).json({ processing: true });
	} catch (error) {
		return res.status(500).json({
			processing: false, error: (error as Error).toString()
		});
	}
});

app.listen(GATEWAY_PORT, () => {
	logger.info("Started HTTP server.");
});