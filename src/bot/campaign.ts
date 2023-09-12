import { MessageComponentTypes, ButtonStyles, type ActionRow, type Embed, ButtonComponent } from "@discordeno/bot";

import type { CampaignDisplay, CampaignRender, DBCampaign } from "../db/types/campaign.js";
import type { DBEnvironment } from "../db/types/mod.js";

import { EmbedColor } from "./utils/response.js";
import { DBRole } from "../db/types/user.js";
import { bot } from "./mod.js";

/** List of all database campaigns */
let campaigns: DBCampaign[] = [];

/** Fetch all campaigns from the database. */
export async function fetchCampaigns() {
	campaigns = await bot.db.all("campaigns");
}

export function getCampaign(id: string) {
	return campaigns.find(c => c.id === id) ?? null;
}

/** Pick a random campaign to display, increment its views & format it accordingly. */
export async function pickAdvertisement(env: DBEnvironment): Promise<CampaignDisplay | null> {
	/* Disable all ads for Premium users, that are not developers of the bot. */
	const type = bot.db.premium(env);
	if (type !== null && !env.user.roles.includes(DBRole.Owner)) return null;

	const campaign = pick();
	if (!campaign) return null;

	/* TODO: Increment statistics */

	return {
		campaign, response: render(campaign)
	};
}

/** Choose a random campaign to display. */
function pick() {
	const sorted = campaigns.filter(c => c.active && available(c));
	let final: DBCampaign = null!;

	const totalBudget: number = sorted.reduce(
		(previous, campaign) => previous + campaign.budget.total, 0
	);

	const random: number = Math.floor(Math.random() * 100) + 1;
	let start: number = 0; let end: number = 0;

	for (const campaign of sorted) {
		let percent: number = Math.round((campaign.budget.total / totalBudget) * 100);
		end += percent;

		if (percent > 20) percent = 20 - (percent - 20);
		if (percent < 5) percent = 5 + (10 - percent);

		if (random > start && random <= end) {
			final = campaign;
			break;
		}

		start += percent;
	}

	if (final === null) return null;
	return final;
}

/** Figure out whether a campaign can run, making sure that its budget is still under the limit. */
function available(campaign: DBCampaign) {
	return campaign.budget.total >= campaign.budget.used;
}

/** Format a campaign into a nice-looking embed. */
function render(campaign: DBCampaign): CampaignRender {
	const embed: Embed = {
		title: campaign.settings.title,
		description: campaign.settings.description,

		color: campaign.settings.color
			? EmbedColor[campaign.settings.color] ?? EmbedColor.Orange
			: undefined,

		image: campaign.settings.image
			? { url: campaign.settings.image }
			: undefined,

		thumbnail: campaign.settings.thumbnail
			? { url: campaign.settings.thumbnail }
			: undefined,

		footer: { text: "This is a sponsored advertisement." }
	};

	const row: ActionRow = {
		type: MessageComponentTypes.ActionRow,

		components: [
			{
				type: MessageComponentTypes.Button,
				label: "Remove ads", emoji: { name: "✨" },
				style: ButtonStyles.Secondary,
				customId: "premium:ads"
			}
		]
	};

	const button = buildCampaignButton(campaign);
	if (button) row.components.unshift(button);

	return { embed, row };
}

function buildCampaignButton(campaign: DBCampaign): ButtonComponent | null {
	if (!campaign.button) return null;

	if (campaign.button.type === "Link") {
		return {
			type: MessageComponentTypes.Button,
			style: ButtonStyles.Primary,
			label: campaign.button.label ?? "Visit",
			emoji: { name: "share", id: 1122241895133884456n },
			customId: `campaign:link:${campaign.id}`
		};

	} else {
		return {
			type: MessageComponentTypes.Button,
			style: ButtonStyles[campaign.button.type],
			label: campaign.button.label,
			emoji: campaign.button.emoji ? {
				name: campaign.button.emoji
			} : undefined,
			customId: campaign.button.id
		};
	}
}