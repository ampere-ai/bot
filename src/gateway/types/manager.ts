import type { WorkerInfo, WorkerShardInfo } from "./worker.js";

export type ManagerMessage = ManagerMessageReady | ManagerMessageNonceReply;

export interface ManagerMessageReady {
	type: "READY";
	shardId: number;
}

export interface ManagerMessageNonceReply<T = unknown> {
	type: "NONCE_REPLY";
	nonce: string;
	data: T;
}

export type ManagerHTTPRequest = ManagerHTTPShardPayload | ManagerHTTPWorkerInfo;

export interface ManagerHTTPShardPayload {
	type: "SHARD_PAYLOAD";
	payload: unknown;
}

export interface ManagerHTTPWorkerInfo {
	type: "WORKER_INFO";
	id: number;
}

export interface ManagerHTTPWorkerInfoResponse {
	workers: WorkerInfo[];
	shards: WorkerShardInfo[];
}