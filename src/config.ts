import { Intents } from "@discordeno/bot";

import dotenv from "dotenv";
dotenv.config();

/** Token of the bot */
export const BOT_TOKEN = process.env.BOT_TOKEN!;

/** ID of the moderation guild & channel */
export const MOD_GUILD_ID = BigInt(process.env.MOD_GUILD_ID!);

/** Various moderation log channels */
export const MOD_CHANNELS = {
	ERRORS: BigInt(process.env.MOD_CHANNEL_ERRORS_ID!),
	LOGS: BigInt(process.env.MOD_CHANNEL_LOGS_ID!)
};

/** Load distribution */
export const TOTAL_WORKERS = Number(process.env.TOTAL_WORKERS!);
export const SHARDS_PER_WORKER = Number(process.env.SHARDS_PER_WORKER!);

/** REST server */
export const REST_URL = `${process.env.REST_HOST}:${process.env.REST_PORT}`;
export const REST_PORT = process.env.REST_PORT!;

/** Gateway HTTP server */
export const GATEWAY_URL = `${process.env.GATEWAY_HOST}:${process.env.GATEWAY_PORT}`;
export const GATEWAY_PORT = process.env.GATEWAY_PORT!;

/** Authentication for the HTTP services */
export const HTTP_AUTH = process.env.HTTP_AUTH!;

/** RabbitMQ server URI */
export const RABBITMQ_URI = process.env.RABBITMQ_URI!;

/** Redis connection */
export const REDIS_HOST = process.env.REDIS_HOST!;
export const REDIS_USER = process.env.REDIS_USER;
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
export const REDIS_PORT = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;

/** Supabase authentication */
export const DB_URL = process.env.DB_URL!;
export const DB_KEY = process.env.DB_KEY!;

/** Ampere API keys */
export const API_KEY = process.env.API_KEY!;
export const API_HOST = process.env.API_HOST!;

/** How often to save database changes, in seconds */
export const DB_QUEUE_INTERVAL = Number(process.env.DB_QUEUE_INTERVAL!);

/** Support server invite code */
export const SUPPORT_INVITE = `discord.gg/${process.env.SUPPORT_INVITE_CODE!}`;

/* Color to use for most embeds */
export const BRANDING_COLOR = parseInt(process.env.BRANDING_COLOR!, 16);

/** Which gateway intents should be used */
export const INTENTS =
    Intents.DirectMessages |
    Intents.GuildMessages;