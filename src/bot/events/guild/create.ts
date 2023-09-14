import { type Guild, type Bot, ChannelTypes } from "@discordeno/bot";
import { bold } from "colorette";

import { BRANDING_COLOR, SUPPORT_INVITE } from "../../../config.js";
import type { MessageResponse } from "../../utils/response.js";
import { createEvent } from "../../helpers/event.js";

export default createEvent("guildCreate", async (bot, guild) => {
	bot.logger.info(`Bot was added to guild ${bold(guild.name)}, ID ${bold(guild.id.toString())}`);

	try {
		const channel = findFittingChannel(guild);
		if (channel) await channel.send(buildIntroductionMessage(bot, guild));

	} catch (error) {
		bot.logger.error(`Failed to send introduction message to guild ${bold(guild.id.toString())} ->`, error);
	}
});

function findFittingChannel(guild: Guild) {
	for (const channel of guild.channels.values()) {
		if (channel.type !== ChannelTypes.GuildText) continue;
		if (channel.permissionOverwrites.length > 0) continue;

		return channel;
	}

	return null;
}

function buildIntroductionMessage(bot: Bot, guild: Guild): MessageResponse {
	return {
		embeds: {
			title: "Hey there 👋",
			description: `Thank you for inviting me to your server **${guild.name}**.`,
			thumbnail: { url: "https://cdn.discordapp.com/avatars/1064152790181609532/9e3410d300b1d568d63768aaafdf9718.png?size=512" },
			color: BRANDING_COLOR,

			fields: [
				{
					name: "How do I chat with the bot?",
					value: `To chat with me, you can simply mention <@${bot.id}> at the start or end of your message.`
				},

				{
					name: "How do I generate images?",
					value: "You can use `/imagine` to generate beautiful images using AI in the bot."
				},

				{
					name: "Where can I get support?",
					value: `In case you need help with an issue or just have a general question, we welcome you to our **[support & community server](https://${SUPPORT_INVITE})**.`
				}
			]
		}
	};
}