import { createChatModel } from "../../helpers/chat.js";

export default createChatModel({
	name: "LLaMA", id: "llama",
	emoji: { name: "meta", id: 1151164065209651280n },

	maxTokens: 2048,

	initialPrompt: {
		role: "system",
		content: "You are LLaMA, a foundational large language model, created by Meta."
	},

	handler: async ({ bot, emitter, history }) => {
		return bot.api.text.deepinfra({
			model: "meta-llama/Llama-2-13b-chat-hf",

			messages: history.messages,
			maxTokens: history.maxTokens,
			temperature: history.temperature
		}, emitter);
	}
});