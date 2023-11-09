import { RestrictionName } from "../../utils/restriction.js";
import { createChatModel } from "../../helpers/chat.js";

export default createChatModel({
	name: "Bard", id: "bard",
	emoji: { name: "bard", id: 1151595393033977936n },

	restrictions: [ RestrictionName.Developer ],
	maxTokens: 2048,

	initialPrompt: {
		role: "system",
		content: "You are Bard, a next-generation large language model by Google."
	},

	handler: async ({ bot, emitter, history }) => {
		return bot.api.text.google({
			messages: history.messages, temperature: history.temperature
		}, emitter);
	}
});