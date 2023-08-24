import type EventEmitter from "events";

import { createChatModel } from "../../helpers/chat.js";
import { getSettingsValue } from "../../settings.js";

export default createChatModel({
	name: "ChatGPT", description: "The usual ChatGPT", id: "chatgpt",
	emoji: { name: "chatgpt", id: 1097849346164281475n },

	maxTokens: 8191,

	cooldown: {
		user: 70 * 1000,
		voter: 65 * 1000,
		subscription: 15 * 1000
	},

	initialPrompt: {
		role: "system",
		content: "You are ChatGPT, an AI language model created by OpenAI."
	},

	handler: async ({ bot, emitter, history, env: { user } }) => {
		/* Which plugins the user has enabled */
		const plugins: string[] = getSettingsValue(user, "plugins:plugins");

		const event: EventEmitter = await bot.api.text.gpt({
			messages: history.messages,
			max_tokens: history.maxTokens,
			model: "gpt-3.5-turbo",
			plugins
		}) as EventEmitter;

		event.on("data", data => {
			emitter.emit({
				content: data.result,
				finishReason: data.finishReason,
				tool: data.tool,
				cost: data.cost,
				done: data.done
			});
		});
	}
});