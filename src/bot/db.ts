import RabbitMQ from "rabbitmq-client";

import type { CollectionName, DBEnvironment, DBObject, DBQueueResult, DBRequestAll, DBRequestCount, DBRequestData, DBRequestFetch, DBRequestGet, DBRequestType, DBRequestUpdate, DBResponse, DBType } from "../db/types/mod.js";
import type { DBGuild } from "../db/types/guild.js";
import type { DBUser } from "../db/types/user.js";

import { RABBITMQ_URI } from "../config.js";

export async function createDB() {
	const connection = new RabbitMQ.Connection(RABBITMQ_URI);

	const rpc = connection.createRPCClient({
		confirm: true
	});

	await new Promise<void>(resolve =>
		connection.on("connection", () => resolve())
	);

	const execute = async <T>(type: DBRequestType, body: Omit<DBRequestData, "type"> = {}): Promise<T> => {
		const data = await rpc.send("db", {
			type, ...body
		});

		const response: DBResponse = data.body;

		if (!response.success && response.error) throw new Error(`DB error: ${response.error}`);
		return response.data;
	};

	const get = <T = DBType>(collection: CollectionName, id: string | bigint): Promise<T | null> => {
		return execute("get", {
			collection, id: id.toString()
		} as DBRequestGet);
	};

	const fetch = <T = DBType>(collection: CollectionName, id: string | bigint): Promise<T> => {
		return execute("fetch", {
			collection, id: id.toString()
		} as DBRequestFetch);
	};

	const update = <T = DBType>(collection: CollectionName, id: string | bigint | DBObject, updates: Partial<Omit<T, "id">>): Promise<T> => {
		return execute("update", {
			collection, id: typeof id === "bigint" ? id.toString() : id, updates
		} as DBRequestUpdate);
	};

	const remove = async (collection: CollectionName, id: string | bigint | DBObject): Promise<void> => {
		await execute("remove", {
			collection, id: typeof id === "bigint" ? id.toString() : id
		} as DBRequestUpdate);
	};

	const all = <T = DBType>(collection: CollectionName): Promise<T[]> => {
		return execute("all", {
			collection
		} as DBRequestAll);
	};

	const count = (collection: CollectionName): Promise<number> => {
		return execute("count", {
			collection
		} as DBRequestCount);
	};

	const clearCache = async (): Promise<void> => {
		await execute("clearCache");
	};

	const flush = (): Promise<DBQueueResult> => {
		return execute("flush");
	};

	return { 
		rpc, execute, get, fetch, update, remove,
		all, count, clearCache, flush,

		env: async (user: bigint, guild?: bigint): Promise<DBEnvironment> => {
			const data: Partial<DBEnvironment> = {};

			await Promise.all([
				new Promise<void>(resolve => {
					fetch<DBUser>("users", user).then(user => {
						data.user = user;
						resolve();
					});
				}),

				new Promise<void>(resolve => {
					if (guild) fetch<DBGuild>("guilds", guild).then(guild => {
						data.guild = guild;
						resolve();
					});
					else resolve();
				})
			]);

			return data as DBEnvironment;
		}
	};
}