import { MessageComponentTypes, ButtonStyles, type ActionRow, type Embed, ButtonComponent } from "@discordeno/bot";

import type { CampaignDisplay, CampaignRender, DBCampaign } from "../db/types/campaign.js";
import type { DBEnvironment } from "../db/types/mod.js";

import { DBUserType } from "../db/types/user.js";
import { EmbedColor } from "./utils/response.js";
import { bot } from "./mod.js";

/** Ad display counters */
const counters = new Map<string, number>();

/** After how many interactions to display an advertisement, for each user type */
const COUNTER_LIMITS: Record<DBUserType, number | null> = {
	plan: null,
	subscription: null,
	voter: 10,
	user: 5
};

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
	/* Type of the user, e.g. "voter" or just "user" */
	const type = bot.db.type(env);
	if (COUNTER_LIMITS[type] === null) return null;

	/* Current advertisement counter */
	const currentCounter = counters.get(env.user.id) ?? 0;

	/* If an ad was requested to be displayed, but one was already shown too recently, increment the counter & return. */
	if (COUNTER_LIMITS[type]! > currentCounter) {
		counters.set(env.user.id, currentCounter + 1);
		return null;
	}

	const campaign = pick();
	if (!campaign) return null;

	/* Reset the counter, if an ad was displayed. */
	counters.delete(env.user.id);

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

		footer: { text: "Sponsored advertisement" }
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