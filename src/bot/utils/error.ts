import { Bot } from "@discordeno/bot";
import { bold } from "colorette";

import type { DBEnvironment } from "../../db/types/mod.js";

import { EmbedColor, MessageResponse, transformResponse } from "./response.js";
import { MOD_CHANNELS } from "../../config.js";

interface JSONError {
	name: string;
	message: string;
	stack: string | null;
}

interface HandleErrorOptions {
	env: DBEnvironment;
    error: Error | unknown;
}

export async function handleError(bot: Bot, { env, error }: HandleErrorOptions): Promise<MessageResponse> {
	const data = errorToJSON(error as Error);
	bot.logger.error(bold("An error occurred"), "->", data);

	try {
		await bot.helpers.sendMessage(MOD_CHANNELS.ERRORS, transformResponse(
			buildErrorLogs(data)
		));
	} catch { /* Stub */ }

	return {
		embeds: {
			title: "error.title 😬",
			description: "error.desc",
			color: EmbedColor.Red
		},

		ephemeral: true, env
	};
}

function buildErrorLogs(error: JSONError): MessageResponse {
	return {
		embeds: {
			title: "An error occured ⚠️",
			description: `\`\`\`${error.name} -> ${error.message}\`\`\`\n\`\`\`${error.stack}\`\`\``,
			color: EmbedColor.Red
		}
	};
}

function errorToJSON(error: Error): JSONError {
	return {
		name: error.name,
		message: error.message,

		stack: error.stack
			? error.stack.split("\n").slice(1).map(l => l.trim()).join("\n")
			: null
	};
}