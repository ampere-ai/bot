import type { DiscordGatewayPayload, ShardState } from "@discordeno/bot";

export type WorkerMessage = WorkerIdentifyShard | WorkerGetInfo;

export interface WorkerIdentifyShard {
	type: "IDENTIFY_SHARD";
	shardId: number;
}

export interface WorkerGetInfo {
	type: "INFO";
	nonce: string;
}

export interface WorkerCreateData {
	intents: number;
	token: string;
	totalShards: number;
	id: number;
}

export interface GatewayMessage {
	payload: DiscordGatewayPayload;
	shard: number;
}

export interface WorkerShardInfo {
	rtt: number;
	state: ShardState;
}

export interface WorkerInfo {
	shards: WorkerShardInfo[];
	guildCount: number;
}