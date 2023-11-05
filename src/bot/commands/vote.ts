import { ButtonStyles, DiscordEmbedField, MessageComponentTypes } from "@discordeno/types";
import { createCommand } from "../helpers/command.js";

export default createCommand({
	name: "vote",

	handler: async ({ bot }) => {
		const fields: DiscordEmbedField[] = [];

		for (let i = 0; i < 3; i++) {
			fields.push({
				name: `vote.fields.${i}.name`,
				value: `vote.fields.${i}.value`
			});
		}

		return {
			embeds: {
				title: "vote.title <:topgg:1151514119749521468>",
				color: 0xff3366,
				fields
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