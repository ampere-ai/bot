import { PostgrestError, createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createRedisClient } from "redis";
import { createLogger } from "@discordeno/utils";
import RabbitMQ from "rabbitmq-client";
import { randomUUID } from "crypto";
import { bold } from "colorette";

import type { Conversation } from "../bot/types/conversation.js";
import type { DBGuild } from "./types/guild.js";
import type { DBUser } from "./types/user.js";

import { DB_KEY, DB_QUEUE_INTERVAL, DB_URL, RABBITMQ_URI, REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_USER } from "../config.js";
import { CollectionNames, type CollectionName, type DBObject, type DBRequestData, DBQueueResult } from "./types/mod.js";

const logger = createLogger({ name: "[DB]" });

/** Separator between collection and key, in Redis */
const REDIS_KEY_SEP = ":";

/** Collection templates */
const CollectionTemplates: Partial<Record<CollectionName, (id: string) => DBObject>> = {
	guilds: id => (({
		id,
		created: new Date().toISOString(),
		infractions: [], settings: {}, metadata: {}
	}) as DBGuild),

	users: id => (({
		id,
		created: new Date().toISOString(),
		settings: {}, metadata: {},
		infractions: [], roles: []
	}) as DBUser),

	conversations: id => (({
		id, uuid: randomUUID(),
		history: []
	}) as Conversation)
};

/** Update queue */
const queue = {} as Record<CollectionName, Record<string, DBObject>>;

for (const type of CollectionNames) {
	queue[type] = {};
}

/** Redis client */
const redis = createRedisClient({
	socket: {
		host: REDIS_HOST,
		port: REDIS_PORT
	},

	username: REDIS_USER,
	password: REDIS_PASSWORD
});

/** Supabase client */
const db = createSupabaseClient(DB_URL, DB_KEY, {
	auth: {
		persistSession: false
	}
});

/** RabbitMQ connection */
const connection = new RabbitMQ.Connection(RABBITMQ_URI);

async function getCache<T>(key: string): Promise<T | null> {
	const existing: string | null = await redis.get(key) ?? null;

	if (existing !== null) return JSON.parse(existing);
	else return null;
}

async function setCache<T>(key: string, data: T) {
	await redis.set(key, JSON.stringify(data), {
		EX: 30 * 60
	});
}

async function removeFromCache(key: string) {
	await redis.keys(key);
}

function collectionKey(collection: CollectionName, id: string) {
	return `${collection}${REDIS_KEY_SEP}${id}`;
}

async function update<T extends DBObject = DBObject>(
	collection: CollectionName, obj: string | DBObject, updates: Partial<DBObject>
) {
	const id: string = typeof obj === "string" ? obj : obj.id;

	const queued: T | null = queue[collection][id] as T ?? null;
	let updated: T;

	if (typeof obj === "string") {
		const existing = await get<T>(collection, id);
		updated = { ...existing ?? {}, ...queued ?? {}, ...updates, id };
	} else {
		updated = { ...obj, ...queued ?? {}, ...updates, id };
	}

	queue[collection][id] = updated;
	await setCache(collectionKey(collection, id), updated);
	
	return updated;
}

async function get<T extends DBObject = DBObject>(collection: CollectionName, id: string): Promise<T | null> {
	const existing: T | null = await getCache(collectionKey(collection, id));
	if (existing !== null) return existing;

	const { data } = await db
		.from(collection).select("*")
		.eq("id", id);

	if (data === null || data.length === 0) return null;
	const entry = data[0];

	await setCache(collectionKey(collection, id), entry);
	return entry as T;
}

async function fetch<T extends DBObject = DBObject>(collection: CollectionName, id: string): Promise<T> {
	const existing = await get<T>(collection, id);
	if (existing) return existing;

	if (!CollectionTemplates[collection]) {
		throw new Error(`No template available for collection '${collection}'`);
	}

	const template = CollectionTemplates[collection]!(id) as T;
	await update(collection, id, template);

	return template;
}

async function remove(collection: CollectionName, id: string): Promise<void> {
	delete queue[collection][id];

	await Promise.all([
		db.from(collection).delete().eq("id", id),
		removeFromCache(collectionKey(collection, id))
	]);
}

async function all<T extends DBObject = DBObject>(collection: CollectionName): Promise<T[]> {
	const { data: raw } = await db.from(collection).select("*");
	if (!raw) throw new Error("Couldn't get entries");

	const data: { id: string; }[] = raw;

	return Promise.all(
		data.map(({ id }) => fetch<T>(collection, id))
	);
}

async function count(collection: CollectionName) {
	const { count } = await db.from(collection)
		.select("*", { count: "planned" });

	if (count === null) throw new Error("Couldn't get count");
	return count;
}

async function handleMessage(data: DBRequestData): Promise<any> {
	if (data.type === "get") {
		return await get(data.collection, data.id);
	} else if (data.type === "fetch") {
		return await fetch(data.collection, data.id);
	} else if (data.type === "update") {
		return await update(data.collection, data.id, data.updates);
	} else if (data.type === "remove") {
		return await remove(data.collection, data.id);
	} else if (data.type === "all") {
		return await all(data.collection);
	} else if (data.type === "count") {
		return await count(data.collection);
	} else if (data.type === "clearCache") {
		return await redis.flushAll();
	} else if (data.type === "flush") {
		return await workOnQueue();
	}

	throw new Error("Not implemented");
}


connection.createConsumer({
	queue: "db"
}, async (message, reply) => {
	try {
		const result = await handleMessage(message.body);
		await reply({ success: true, data: result ?? null });
	} catch (error) {
		logger.error(error);

		await reply({
			success: false, error: (error as Error).toString()
		});
	}
});

async function workOnQueue(): Promise<DBQueueResult> {
	const errors: PostgrestError[] = [];
	let amount = 0;

	for (const type of Object.keys(queue) as CollectionName[]) {
		const queued: Record<string, DBObject> = queue[type];
		const entries: [ string, DBObject ][] = Object.entries(queued);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const changes: DBObject[] = entries.map(([ _, updated ]) => updated);
		if (changes.length === 0) continue;

		for (const [ index, entry ] of changes.entries()) {
			const id: string = entries[index][0];

			const { error } = await db
				.from(type).upsert(entry, { onConflict: "id" });

			if (error !== null) {
				logger.error(`Failed to to save ${bold(id)} to collection ${bold(type)} ->`, error);
				errors.push(error);
			} else {
				delete queue[type][id];
				amount++;
			}
		}
	}

	return {
		amount, errors
	};
}

setInterval(async () => {
	await workOnQueue();
}, DB_QUEUE_INTERVAL * 1000);

await redis.connect();
logger.info("Started.");