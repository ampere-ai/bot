import type { Bot } from "@discordeno/bot";
import { bold } from "colorette";
import dayjs from "dayjs";

import { BRANDING_COLOR } from "../config.js";

interface VoteData {
	id: string;
}

export const VOTE_DURATION = dayjs.duration({
	hours: 12
});

export function setupVoteHandler(bot: Bot) {
	bot.rabbitmq.createConsumer({
		queue: "vote"
	}, async message => {
		const data: VoteData = message.body;

		try {
			/* Get the DM channel with the user. */
			const channel = await bot.helpers.getDmChannel(data.id);
	
			await channel.send({
				embeds: {
					title: "Thank you for voting for the bot 📩",
					description: `*Vote again in **${VOTE_DURATION.humanize()}** to keep your rewards*.`,
					color: BRANDING_COLOR
				}
			});
	
		} catch (error) {
			bot.logger.warn(`Couldn't DM user ${bold(data.id)} about vote ->`, error);
		}
	});
}