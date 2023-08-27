export type ManagerMessage = ManagerMessageReady | ManagerMessageShardPayload

export interface ManagerMessageReady {
	type: "READY";
	shardId: number;
}

export interface ManagerMessageShardPayload {
	type: "SHARD_PAYLOAD";
	payload: unknown;
}

export type ManagerHTTPRequest = ManagerHTTPShardPayload

export interface ManagerHTTPShardPayload {
	type: "SHARD_PAYLOAD";
	payload: unknown;
}