import { createChatModel } from "../../helpers/chat.js";

export default createChatModel({
	name: "LLaMA", description: "A foundational large language model, by Meta", id: "llama",
	emoji: { name: "meta", id: 1151164065209651280n },

	maxTokens: 2048,
	
	cooldown: {
		user: 80 * 1000,
		voter: 60 * 1000,
		subscription: 10 * 1000
	},

	initialPrompt: {
		role: "system",
		content: "You are LLaMA, a foundational large language model, created by Meta."
	},

	handler: async ({ bot, emitter, history }) => {
		return bot.api.text.llama({
			messages: history.messages,
			maxTokens: history.maxTokens
		}, emitter);
	}
});