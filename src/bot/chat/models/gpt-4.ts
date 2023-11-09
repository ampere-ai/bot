import { createChatModel } from "../../helpers/chat.js";
import { getSettingsValue } from "../../settings.js";

export default createChatModel({
	name: "GPT-4", id: "gpt-4",
	emoji: { name: "✨" },

	maxTokens: 8191,

	initialPrompt: {
		role: "system",
		content: "You are GPT-4, a new GPT model by OpenAI released on the 14th March 2023, an AI language model created by OpenAI."
	},

	handler: async ({ bot, env, emitter, history }) => {
		return bot.api.text.gpt({
			messages: history.messages,
			maxTokens: history.maxTokens,
			temperature: history.temperature,
			plugins: getSettingsValue(bot, env, "user", "chat:plugins"),
			model: "gpt-4-vision-preview"
		}, emitter);
	}
});