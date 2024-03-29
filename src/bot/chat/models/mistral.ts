import { createChatModel } from "../../helpers/chat.js";

export default createChatModel({
	name: "Mistral", id: "mistral",
	emoji: { name: "mistral", id: 1157006746603245628n },

	maxTokens: 2048,
	
	handler: async ({ bot, emitter, history }) => {
		return bot.api.text.deepinfra({
			model: "mistralai/Mistral-7B-Instruct-v0.1",

			messages: history.messages,
			maxTokens: history.maxTokens,
			temperature: history.temperature
		}, emitter);
	}
});