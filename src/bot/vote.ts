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
			const channel = await bot.helpers.getDmChannel(data.id);
			const env = await bot.db.env(BigInt(data.id));

			await channel.send({
				embeds: {
					title: "vote.thanks.title 📩",
					description: { key: "vote.thanks.desc", data: { time: VOTE_DURATION.asHours() } },
					color: BRANDING_COLOR
				}, env
			});
	
		} catch (error) {
			bot.logger.warn(`Couldn't DM user ${bold(data.id)} about vote ->`, error);
		}
	});
}