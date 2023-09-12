import { ButtonStyles, MessageComponentTypes } from "@discordeno/types";
import { memoryUsage } from "process";

import type { ManagerHTTPWorkerInfoResponse } from "../../gateway/types/manager.js";

import { BRANDING_COLOR, GATEWAY_URL, HTTP_AUTH, SHARDS_PER_WORKER, SUPPORT_INVITE } from "../../config.js";
import { createCommand } from "../helpers/command.js";

export default createCommand({
	name: "bot",
	description: "View information & statistics about the bot",

	handler: async ({ bot, interaction }) => {
		const info: ManagerHTTPWorkerInfoResponse = await (
			await fetch(GATEWAY_URL, {
				method: "POST",

				headers: {
					"Content-Type": "application/json",
					Authorization: HTTP_AUTH
				},

				body: JSON.stringify({
					type: "WORKER_INFO"
				})
			})
		).json();

		const shardId = interaction.guildId
			? bot.gateway.calculateShardId(interaction.guildId, info.shards.length)
			: 0;

		const workerId = shardId % SHARDS_PER_WORKER;
		const shard = info.shards[shardId];

		const guildCount = info.workers.reduce<number>((acc, worker) => acc + worker.guildCount, 0);
		const mem = memoryUsage();

		return {
			embeds: {
				title: "Bot Statistics",
				color: BRANDING_COLOR,

				fields: [
					{
						name: "Servers 🖥️", inline: true,
						value: `${new Intl.NumberFormat("en-US").format(guildCount)}`
					},

					{
						name: "Cluster & Shard 💎", inline: true,
						value: `\`${workerId + 1}\`/\`${info.workers.length}\`— \`${shardId + 1}\`/\`${info.shards.length}\``
					},

					{
						name: "Latency 🏓", inline: true,
						value: `**\`${shard.rtt}\`** ms`
					},


					{
						name: "RAM 🖨️", inline: true,
						value: `**\`${(mem.heapUsed / 1024 / 1024).toFixed(2)}\`** MB`
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
							label: "Add me to your server",
							url: `https://discord.com/oauth2/authorize?client_id=${bot.id}&permissions=281357371712&scope=bot%20applications.commands`
						},

						{
							type: MessageComponentTypes.Button,
							style: ButtonStyles.Link,
							label: "Support server",
							url: `https://${SUPPORT_INVITE}`
						},

						{
							type: MessageComponentTypes.Button,
							style: ButtonStyles.Link,
							label: "GitHub",
							url: "https://github.com/ampere-ai"
						}
					]
				}
			],

			ephemeral: true
		};
	}
});