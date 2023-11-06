import type { Bot, ComponentEmoji, Embed } from "@discordeno/bot";
import { type ActionRow, TextStyles } from "@discordeno/types";

import type { DBCampaign, DBCampaignBudgetType } from "../../db/types/campaign.js";

import { emojiToString, stringToEmoji } from "../utils/helpers.js";
import { DBEnvironment } from "../../db/types/mod.js";
import { EmbedColor } from "../utils/response.js";
import { campaigns } from "../campaign.js";
import { LocaleString } from "../i18n.js";

export interface CampaignRender {
	row: ActionRow;
	embed: Embed;
}

export interface CampaignDisplay {
	response: CampaignRender;
	campaign: DBCampaign;
}

export enum CampaignCategoryType {
	General = "general",
	Embed = "embed",
	Button = "button",
	Budget = "budget"
}

export interface CampaignParameterCategory {
	/** Identifier of this category */
	id: CampaignCategoryType;

	/** Emoji of this category */
	emoji: ComponentEmoji;

	/** Fields to display in this category */
	fields?: (options: { campaign: DBCampaign; bot: Bot; }) => ({ name: string, value: string })[];

	/** Parameters of this category */
	parameters: CampaignParameter[];
}

export interface CampaignParameter {
	/** Name of the parameter */
	id: string;

	/** Whether this parameter is optional */
	optional?: boolean;

	/** Which input type this parameter is */
	type: TextStyles;

	/** Minimum & maximum length restrictions of the parameter */
	length?: {
		min?: number;
		max?: number;
	};

	/** Function to call, to figure out if this parameter should be displayed */
	display?: (campaign: DBCampaign) => boolean;

	/** Placeholder to display */
	placeholder?: string | ((campaign: DBCampaign) => string);

	/** Function to call, to validate the user's input */
	validate?: (options: { value: string; env: DBEnvironment; bot: Bot; }) => LocaleString | true | void;

	/** Function to call, to update the campaign in the database */
	update: (options: { value: string; campaign: DBCampaign; bot: Bot; }) => Partial<DBCampaign> | void;

	/** Function to call, to get the previous value of this variable */
	previous: (campaign: DBCampaign) => string | null;
}

/* Generic URL validator */
const createURLValidator: (optional: boolean) => CampaignParameter["validate"] =
	optional => ({ value }) => {
		if (optional && value.length === 0) return true;

		try {
			new URL(value);
		} catch (error) {
			return { key: "invalid_url" };
		}
	};

/* Generic color validator */
const validateColor: CampaignParameter["validate"] = ({ value }) => {
	if (!Object.keys(EmbedColor).includes(value)) return { key: "invalid_color" };
	else return true;
};

/* Generic number validator */
const createNumberValidator: (min: number, max: number) => CampaignParameter["validate"] =
	(min, max) => ({ value }) => {
		const num = parseFloat(value);

		if (isNaN(num)) return { key: "invalid_number" };
		if (num > max || num < min) return { key: "number_range", data: { min, max } };
	};

export const CAMPAIGN_PARAMETER_CATEGORIES: CampaignParameterCategory[] = [
	{
		id: CampaignCategoryType.General,
		emoji: { name: "⚙️" },

		parameters: [
			{
				id: "name",
				type: TextStyles.Short, length: { min: 3, max: 64 },
				validate: ({ value }) => {
					if (campaigns.find(c => c.name === value) != undefined) return { key: "already_exists" };
					return true;
				},
				update: ({ value }) => ({ name: value }),
				previous: c => c.name
			},

			{
				id: "members",
				type: TextStyles.Paragraph,
				length: { max: 200 },
				validate: ({ value, env }) => {
					const ids = value.split(/[ ,\n]+/);
					if (!ids.some(id => id === env.user.id)) return { key: "remove_self" };
		
					return true;
				},
				update: ({ value }) => ({ members: value.split(/[ ,\n]+/) }),
				previous: c => c.members.join("\n")
			}
		]
	},

	{
		id: CampaignCategoryType.Embed,
		emoji: { name: "📜" },

		parameters: [
			{
				id: "title",
				type: TextStyles.Short, length: { min: 1, max: 256 },
				update: ({ value, campaign }) => ({ settings: { ...campaign.settings, title: value } }),
				previous: c => c.settings.title
			},
			
			{
				id: "desc",
				type: TextStyles.Paragraph, length: { min: 1, max: 512 },
				update: ({ value, campaign }) => ({ settings: { ...campaign.settings, description: value } }),
				previous: c => c.settings.description
			},
			
			{
				id: "color",
				type: TextStyles.Short, length: { min: 1, max: 16 },
				validate: validateColor,
				update: ({ value, campaign }) => ({ settings: { ...campaign.settings, color: value as keyof typeof EmbedColor } }),
				previous: c => c.settings.color as string ?? null
			},
			
			{
				id: "image",
				optional: true, type: TextStyles.Short,
				length: { min: 1, max: 128 },
				validate: createURLValidator(true),
				update: ({ value, campaign }) => ({ settings: { ...campaign.settings, image: value.length > 0 ? value : undefined } }),
				previous: c => c.settings.image ?? null
			},
			
			{
				id: "thumbnail",
				optional: true, type: TextStyles.Short,
				length: { min: 1, max: 128 },
				validate: createURLValidator(true),
				update: ({ value, campaign }) => ({ settings: { ...campaign.settings, thumbnail: value.length > 0 ? value : undefined } }),
				previous: c => c.settings.thumbnail ?? null
			}
		]
	},

	{
		id: CampaignCategoryType.Button,
		emoji: { name: "🖱️" },

		parameters: [
			{
				id: "type", type: TextStyles.Short,
				length: { min: 1, max: 16 }, optional: true,
				placeholder: "Link / Primary / Secondary / Success / Danger",

				previous: c => c.button?.type ?? null,
				validate: ({ value }) => {
					if (![ "Link", "Primary", "Secondary", "Success", "Danger" ].includes(value)) {
						return { key: "invalid_type" };
					}

					return true;
				},
				update: ({ value, campaign }) => {
					if (value.length === 0) return { button: null };
					else {
						if (campaign.button !== null) {
							return { button: { ...campaign.button, type: value as any } };
						} else {
							return {
								button: {
									type: value as any,
									label: "Placeholder",
									emoji: "❓",
									id: "placeholder",
									url: "https://example.com"
								}
							};
						}
					}
				}
			},

			{
				id: "link", type: TextStyles.Short,
				length: { min: 1, max: 256 }, optional: true,
				placeholder: "https://example.com",

				display: campaign => campaign.button?.type === "Link",
				previous: c => c.button?.type === "Link" ? c.button?.url : null,
				validate: createURLValidator(false),
				update: ({ value, campaign }) => ({ button: { ...campaign.button!, url: value } })
			},

			{
				id: "label", type: TextStyles.Short,
				length: { min: 1, max: 32 }, optional: true,

				display: campaign => campaign.button !== null,
				previous: c => c.button !== null && c.button.type !== "Link" ? c.button.label : null,
				update: ({ value, campaign }) => ({ button: { ...campaign.button!, label: value } })
			},

			{
				id: "emoji", type: TextStyles.Short,
				length: { min: 1, max: 32 }, optional: true,

				display: campaign => campaign.button !== null && campaign.button.type !== "Link",
				validate: ({ value }) => {
					if (value.length === 0) return true;

					if (stringToEmoji(value) === null) return {
						key: "invalid_emoji"
					};

					return true;
				},
				previous: c => c.button !== null && c.button.type !== "Link" && c.button.emoji ? emojiToString(c.button.emoji) : null,
				update: ({ value, campaign }) => ({
					button: { 
						...campaign.button!,
						emoji: value.length > 0 ? stringToEmoji(value) ?? undefined : undefined
					}
				})
			},

			{
				id: "id", type: TextStyles.Short,
				length: { min: 1, max: 32 },

				display: campaign => campaign.button !== null && campaign.button.type !== "Link",
				previous: c => c.button !== null && c.button.type !== "Link" ? c.button.id : null,
				update: ({ value, campaign }) => ({ button: { ...campaign.button!, id: value } })
			}
		]
	},

	{
		id: CampaignCategoryType.Budget,
		emoji: { name: "💸" },

		parameters: [
			{
				id: "type", type: TextStyles.Short,
				length: { min: 1, max: 16 }, optional: true,
				placeholder: "Per-click / per-view / <empty to disable>",

				previous: c => c.budget.type !== "none" ? c.budget.type : null,
				validate: ({ value }) => {
					if (![ "click", "view" ].includes(value) && value.length !== 0) {
						return { key: "invalid_type" };
					}

					return true;
				},
				update: ({ value, campaign }) => ({
					budget: { ...campaign.budget, type: value.length > 0 ? value as DBCampaignBudgetType : "none" }
				})
			},

			{
				id: "total", type: TextStyles.Short,
				length: { min: 1, max: 16 }, optional: true,

				display: campaign => campaign.budget.type !== "none",
				previous: c => c.budget.total.toString(),
				validate: createNumberValidator(1, 1000),
				update: ({ value, campaign }) => ({
					budget: { ...campaign.budget, total: parseFloat(value) }
				})
			},

			{
				id: "used", type: TextStyles.Short,
				length: { min: 1, max: 16 }, optional: true,

				display: campaign => campaign.budget.type !== "none",
				previous: c => c.budget.used.toString(),
				validate: createNumberValidator(0, 1000),
				update: ({ value, campaign }) => ({
					budget: { ...campaign.budget, used: parseFloat(value) }
				})
			},

			{
				id: "cpm", type: TextStyles.Short,
				length: { min: 1, max: 16 }, optional: true,

				display: campaign => campaign.budget.type !== "none",
				previous: c => c.budget.cost.toString(),
				validate: createNumberValidator(0, 10),
				update: ({ value, campaign }) => ({
					budget: { ...campaign.budget, cost: parseFloat(value) }
				})
			}
		]
	}
];