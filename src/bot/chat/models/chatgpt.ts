import { createChatModel } from "../../helpers/chat.js";

export default createChatModel({
	name: "ChatGPT", description: "The usual ChatGPT", id: "chatgpt",
	emoji: { name: "chatgpt", id: 1087127347792191519n },

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

	handler: async ({ bot, emitter, history }) => {
		return await bot.api.text.gpt({
			messages: history.messages,
			maxTokens: history.maxTokens
		}, emitter);
	}
});