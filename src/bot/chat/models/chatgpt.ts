import { createChatModel } from "../../helpers/chat.js";
import { getSettingsValue } from "../../settings.js";

export default createChatModel({
	name: "ChatGPT", id: "chatgpt",
	emoji: { name: "chatgpt", id: 1087127347792191519n },

	maxTokens: 8191,

	initialPrompt: {
		role: "system",
		content: "You are ChatGPT, an AI language model created by OpenAI."
	},

	handler: async ({ bot, env, emitter, history }) => {
		return bot.api.text.gpt({
			messages: history.messages,
			maxTokens: history.maxTokens,
			plugins: getSettingsValue(bot, env, "user", "chat:plugins"),
			temperature: history.temperature
		}, emitter);
	}
});