import type EventEmitter from "events";

import { RestrictionName } from "../../utils/restriction.js";
import { createChatModel } from "../../helpers/chat.js";

export default createChatModel({
	name: "Claude 2", description: "Second version of Anthropic's AI assistant", id: "claude-2",
	emoji: { name: "anthropic", id: 1097849339432423454n },

	restrictions: [ RestrictionName.PremiumPlan ],
	maxTokens: 100000,

	initialPrompt: [
		{
			role: "user", content: "Who are you?"
		},

		{
			role: "assistant", content: "I am Claude, an AI chatbot created by Anthropic."
		}
	],

	handler: async ({ bot, emitter, history }) => {
		const event: EventEmitter = await bot.api.text.anthropic({
			messages: history.messages,
			max_tokens: history.maxTokens,
			model: "claude-instant-1-100k"
		}) as EventEmitter;

		event.on("data", data => {
			emitter.emit({
				content: data.result,
				finishReason: data.finishReason,
				cost: data.cost,
				done: data.done
			});
		});
	}
});