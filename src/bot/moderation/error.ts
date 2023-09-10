import { Bot } from "@discordeno/bot";
import { bold } from "colorette";

import { EmbedColor, MessageResponse, transformResponse } from "../utils/response.js";
import { MOD_CHANNELS, SUPPORT_INVITE } from "../../config.js";

interface JSONError {
	name: string;
	message: string;
	stack: string | null;
}

interface HandleErrorOptions {
    error: Error | unknown;
    guild: bigint | undefined;
}

export async function handleError(bot: Bot, { error }: HandleErrorOptions): Promise<MessageResponse> {
	const data = errorToJSON(error as Error);
	bot.logger.error(bold("An error occurred"), "->", data);

	try {
		await bot.helpers.sendMessage(MOD_CHANNELS.ERRORS, transformResponse(
			buildErrorLogs(data)
		));
	} catch { /* Stub */ }

	return {
		embeds: {
			title: "Uh-oh... 😬",
			description: "It seems like an error has occurred. *The developers have been notified.*",
			footer: { text: SUPPORT_INVITE },
			color: EmbedColor.Red
		},

		ephemeral: true
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