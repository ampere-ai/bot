import type { Channel, DiscordChannel } from "@discordeno/bot";

import { transformResponse, type MessageResponse } from "../utils/response.js";
import { createTransformer } from "../helpers/transformer.js";

export default createTransformer<"channel", Channel, DiscordChannel>({
	name: "channel",
	properties: [ "id", "name" ],
	
	handler: (bot, channel) => {
		Object.defineProperty(channel, "send", {
			value: function(response: MessageResponse) {
				return bot.helpers.sendMessage(channel.id, transformResponse(response));
			}
		});

		return channel;
	}
});