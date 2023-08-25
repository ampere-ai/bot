import type { DiscordMessage, Message } from "@discordeno/bot";

import { transformResponse, type MessageResponse } from "../utils/response.js";
import { createTransformer } from "../helpers/transformer.js";

export default createTransformer<"message", Message, DiscordMessage>({
	name: "message",
	properties: [ "content", "mentions", "author", "channelId", "id" ],
	
	handler: (bot, message) => {
		Object.defineProperty(message, "reply", {
			value: function(response: Omit<MessageResponse, "reference">) {
				return bot.helpers.sendMessage(message.channelId, transformResponse({
					...response, reference: message
				}));
			}
		});

		Object.defineProperty(message, "edit", {
			value: function(response: Omit<MessageResponse, "reference">) {
				return bot.helpers.editMessage(message.channelId, message.id, transformResponse(response));
			}
		});

		Object.defineProperty(message, "delete", {
			value: function() {
				return bot.helpers.deleteMessage(message.channelId, message.id);
			}
		});

		return message;
	}
});