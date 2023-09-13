import { ButtonStyles, MessageComponentTypes } from "@discordeno/types";
import { createCommand } from "../helpers/command.js";

export default createCommand({
	name: "vote",
	description: "Vote for our bot & get rewards",

	handler: async ({ bot }) => {
		return {
			embeds: {
				title: "Vote for our bot <:topgg:1151514119749521468>",
				color: 0xff3366,

				fields: [
					{
						name: "Way lower cool-down ⏰",
						value: "The cool-down between messages can get a bit annoying. Once you've voted for the bot, it'll be reduced by a bit, so you can enjoy the bot even more."
					},

					{
						name: "Less annoying ads ‼️",
						value: "By voting for the bot, you will be shown less ads throughout the bot."
					},
		
					{
						name: "Support our bot 🙏",
						value: "If you vote, you'll help us grow even further, and give people access to **ChatGPT** and other language models for completely free."
					}
				]
			},

			components: [
				{
					type: MessageComponentTypes.ActionRow,

					components: [
						{
							type: MessageComponentTypes.Button,
							style: ButtonStyles.Link,
							label: "top.gg",
							url: `https://top.gg/bot/${bot.id}`
						}
					]
				}
			],

			ephemeral: true
		};
	}
});