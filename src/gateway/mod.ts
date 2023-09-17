import dotenv from "dotenv";
dotenv.config();

import { Collection, createBot, createGatewayManager } from "@discordeno/bot";
import { createLogger } from "@discordeno/utils";
import { setTimeout } from "timers/promises";
import { Worker } from "worker_threads";
import { randomUUID } from "crypto";
import express from "express";

import { type WorkerCreateData, type WorkerMessage, type WorkerInfo, WorkerShardInfo } from "./types/worker.js";
import type { ManagerHTTPRequest, ManagerMessage } from "./types/manager.js";

import { BOT_TOKEN, INTENTS, HTTP_AUTH, SHARDS_PER_WORKER, TOTAL_WORKERS, GATEWAY_PORT, REST_URL } from "../config.js";

const logger = createLogger({ name: "[MANAGER]" });

const nonces = new Collection<string, (data: any) => void>();
const identifies = new Map<number, () => void>();

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
	events: {},

	rest: {
		proxy: {
			authorization: HTTP_AUTH,
			baseUrl: REST_URL
		}
	}
});

const gateway = createGatewayManager({
	token: BOT_TOKEN, intents: INTENTS,

	shardsPerWorker: SHARDS_PER_WORKER,
	totalWorkers: TOTAL_WORKERS,

	preferSnakeCase: true,

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

	await new Promise<void>(resolve => {
		identifies.set(shardId, resolve);
	});

	await setTimeout(gateway.spawnShardDelay);
};

function createWorker(id: number) {
	if (id === 0) logger.info(`Identifying with ${gateway.totalShards} total shards`);
	logger.info(`Created worker #${id}`);

	const workerData: WorkerCreateData = {
		token: BOT_TOKEN, intents: gateway.intents,
		totalShards: gateway.totalShards,
		id
	};

	const worker = new Worker("./build/gateway/worker.js", {
		workerData
	});

	worker.on("message", async (data: ManagerMessage) => {
		switch (data.type) {
			case "READY": {
				identifies.get(data.shardId)?.();
				logger.info(`Shard #${data.shardId} is ready`);

				break;
			}

			case "NONCE_REPLY": {
				nonces.get(data.nonce)?.(data.data);
				break;
			}
		}
	});

	return worker;
}

function sendWorkerMessage<T>(worker: Worker, data: Omit<WorkerMessage, "nonce">): Promise<T> {
	const nonce = randomUUID();

	return new Promise<T>(resolve => {
		worker.postMessage({ ...data, nonce });
		nonces.set(nonce, resolve);
	});
}

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

			case "WORKER_INFO": {
				const infos = await Promise.all(
					workers.map(worker => {
						return sendWorkerMessage<WorkerInfo>(worker, {
							type: "INFO"
						});
					})
				);

				return res.status(200).json({
					workers: infos,

					shards: infos.reduce<WorkerShardInfo[]>((acc, curr) => {
						acc.push(...curr.shards);
						return acc;
					}, [])
				});
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

gateway.spawnShards();