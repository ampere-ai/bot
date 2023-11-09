import { memoryUsage } from "process";

import type { ManagerHTTPWorkerInfoResponse } from "../../gateway/types/manager.js";

import { BRANDING_COLOR, GATEWAY_URL, HTTP_AUTH, SHARDS_PER_WORKER } from "../../config.js";
import { createCommand } from "../helpers/command.js";

export default createCommand({
	name: "bot",

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
		const userCount = await bot.db.count("users");

		const mem = memoryUsage();

		return {
			embeds: {
				title: "info.title",
				color: BRANDING_COLOR,

				fields: [
					{
						name: "info.fields.servers 🖥️", inline: true,
						value: `${new Intl.NumberFormat("en-US").format(guildCount)}`
					},


					{
						name: "info.fields.users 🫂", inline: true,
						value: `${new Intl.NumberFormat("en-US").format(userCount)}`
					},

					{
						name: "info.fields.worker 💎", inline: true,
						value: `\`${workerId + 1}\`/\`${info.workers.length}\`— \`${shardId + 1}\`/\`${info.shards.length}\``
					},

					{
						name: "info.fields.latency 🏓", inline: true,
						value: `**\`${shard.rtt}\`** ms`
					},

					{
						name: "info.fields.memory 🖨️", inline: true,
						value: `**\`${(mem.heapUsed / 1024 / 1024).toFixed(2)}\`** MB`
					}
				]
			},

			ephemeral: true
		};
	}
});