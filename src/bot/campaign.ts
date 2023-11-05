import { type ActionRow, type Embed, MessageComponentTypes, ButtonStyles, ButtonComponent, InteractionCallbackData, InteractionTypes, TextStyles } from "@discordeno/bot";

import type { DBCampaign, DBCampaignIDButton, DBCampaignStatistics } from "../db/types/campaign.js";
import type { DBEnvironment } from "../db/types/mod.js";

import { type CampaignCategoryType, type CampaignDisplay, type CampaignRender, type CampaignParameter, CAMPAIGN_PARAMETER_CATEGORIES, CampaignParameterCategory } from "./types/campaign.js";
import { type DBUser, DBUserType, DBRole } from "../db/types/user.js";
import { InteractionHandlerOptions } from "./types/interaction.js";
import { EmbedColor, MessageResponse } from "./utils/response.js";
import { handleInteraction } from "./interactions/mod.js";
import { BRANDING_COLOR } from "../config.js";
import { chunk } from "./utils/helpers.js";
import { bot } from "./mod.js";
import { randomUUID } from "crypto";
import { ToLocaleStrings, t, translateObject } from "./i18n.js";

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
export let campaigns: DBCampaign[] = [];

/** Fetch all campaigns from the database. */
export async function fetchCampaigns() {
	campaigns = await bot.db.all("campaigns");
}

/** Create a new campaign. */
async function createCampaign(db: DBUser, name: string) {
	return bot.db.update<DBCampaign>("campaigns", randomUUID(), {
		budget: { type: "none", used: 0, total: 0, cost: 0 },
		active: false, button: null,
		created: new Date().toISOString(),
		members: [ db.id ], name,

		stats: {
			clicks: { total: 0 },
			views: { total: 0 }
		},

		settings: {
			title: "This is your advertisement 👋",
			description: "This embed shows up on various messages of the bot, and you can change its look using the buttons below. You can use Markdown **formatting** *here* __too__, ||if you want||. Once you've configured the ad to your liking, deploy it using the **✅ Enable** button.",
			color: "Yellow"
		}
	});
}

/** Update a specific campaign. */
async function updateCampaign(db: DBCampaign, changes: Partial<DBCampaign>) {
	const updated = await bot.db.update<DBCampaign>("campaigns", db, changes);

	const index = campaigns.findIndex(c => c.id === db.id);
	campaigns[index] = updated;

	return updated;
}

/** Increment the statistics of a campaign. */
export async function incrementCampaignStatistics(campaign: DBCampaign, key: keyof DBCampaignStatistics) {
	campaign.stats[key].total += 1;
	return updateCampaign(campaign, campaign);
}

/** Get a specific campaign, using its ID. */
export function getCampaign(id: string) {
	return campaigns.find(c => c.id === id) ?? null;
}

/** Get a list of campaigns using specific filters. */
export function filterCampaigns(db: DBUser) {
	return campaigns.filter(c => db.roles.includes(DBRole.Owner) || c.members.includes(db.id));
}

/** Pick a random campaign to display, increment its views & format it accordingly. */
export async function pickAdvertisement(env: DBEnvironment): Promise<CampaignDisplay | null> {
	/* Type of the user, e.g. "voter" or just "user" */
	const type = bot.db.type(env);
	if (COUNTER_LIMITS[type] === null) return null;

	/* Current advertisement counter */
	const currentCounter = counters.get(env.user.id) ?? 0;

	/* If an ad was requested to be displayed but one was already shown too recently, increment the counter & return. */
	if (COUNTER_LIMITS[type]! > currentCounter) {
		counters.set(env.user.id, currentCounter + 1);
		return null;
	}

	let campaign = pickCampaign();
	if (!campaign) return null;

	/* Reset the counter, if an ad was displayed. */
	counters.delete(env.user.id);

	campaign = await incrementCampaignStatistics(campaign, "views");
	return { campaign, response: render(campaign) };
}

/** Choose a random campaign to display. */
function pickCampaign() {
	const filtered = campaigns.filter(c => c.active && available(c));
	if (filtered.length === 0) return null;

	return filtered[Math.floor(Math.random() * filtered.length)];
}

/** Figure out whether a campaign can run, making sure that its budget is still under the limit. */
function available(campaign: DBCampaign) {
	return campaign.budget.type !== "none" ? campaign.budget.total > campaign.budget.used : true;
}

/** Format a campaign into a nice-looking embed. */
function render(campaign: DBCampaign, preview = false): CampaignRender {
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

		footer: !preview ? { text: "campaign.notice" } : undefined
	};

	const row: ActionRow = {
		type: MessageComponentTypes.ActionRow,

		components: [
			{
				type: MessageComponentTypes.Button,
				label: "premium.buttons.remove_ads", emoji: { name: "✨" },
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

	return {
		type: MessageComponentTypes.Button,
		style: campaign.button.type !== "Link" ? ButtonStyles[campaign.button.type] : ButtonStyles.Primary,
		label: campaign.button.label ?? "Visit",
		emoji: (campaign.button as DBCampaignIDButton).emoji
			?? { name: "share", id: 1122241895133884456n },
		customId: `campaign:click:${campaign.id}`
	};
}


function buildCampaignSelector(campaigns: DBCampaign[]): ActionRow {
	return {
		type: MessageComponentTypes.ActionRow,

		components: [ {
			type: MessageComponentTypes.SelectMenu,
			customId: "campaign:ui:select",
			placeholder: "campaign.create.choose",
	
			options: campaigns.map(c => ({
				label: c.name,
				emoji: { name: c.active ? "✅" : "❌" },
				description: `${c.budget !== null ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c.budget.used)} / ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c.budget.total)} • ` : ""}${c.members.length} member${c.members.length > 1 ? "s" : ""}`,
				value: c.id
			}))
		} ]
	};
}

function buildCampaignFinderToolbar(): ActionRow {
	return {
		type: MessageComponentTypes.ActionRow,

		components: [
			{
				type: MessageComponentTypes.Button,
				customId: "campaign:ui:create",
				emoji: { name: "create", id: 1153016555374911618n },
				style: ButtonStyles.Secondary
			},

			{
				type: MessageComponentTypes.Button,
				customId: "campaign:ui:refresh",
				emoji: { name: "🔄" },
				style: ButtonStyles.Secondary
			}
		]
	};
}

export function buildCampaignFinder(env: DBEnvironment): MessageResponse {
	const campaigns = filterCampaigns(env.user);

	return {
		embeds: {
			description: { key: "campaign.create.welcome", data: { id: env.user.id } },
			color: BRANDING_COLOR
		},

		components: [
			buildCampaignSelector(campaigns),
			buildCampaignFinderToolbar()
		],

		ephemeral: true
	};
}

function buildCampaignButtons(campaign: DBCampaign, categoryId?: CampaignCategoryType): ActionRow[] {
	/* Main overview of the campaign */
	if (!categoryId) {
		const chunks = chunk(CAMPAIGN_PARAMETER_CATEGORIES, 5);
		
		const rows: ActionRow[] = chunks.map(arr => ({
			type: MessageComponentTypes.ActionRow,

			components: arr.map(c => ({
				type: MessageComponentTypes.Button,
				style: ButtonStyles.Secondary,
				label: c.name,
				emoji: c.emoji,
				customId: `campaign:ui:category:${campaign.id}:${c.id}`
			})) as [ ButtonComponent ]
		}));

		rows.unshift({
			type: MessageComponentTypes.ActionRow,

			components: [
				{
					type: MessageComponentTypes.Button,
					style: ButtonStyles.Primary,
					emoji: { name: "home", id: 1152658440087425094n },
					label: "campaign.buttons.home",
					customId: "campaign:ui:home"
				},

				{
					type: MessageComponentTypes.Button,
					style: ButtonStyles.Secondary,
					emoji: { name: "👀" },
					label: "campaign.buttons.preview",
					customId: `campaign:ui:preview:${campaign.id}`
				},

				{
					type: MessageComponentTypes.Button,
					style: ButtonStyles.Secondary,
					emoji: { name: campaign.active ? "❌" : "✅" },
					label: campaign.active ? "campaign.buttons.toggle.disable" : "campaign.buttons.toggle.enable",
					customId: `campaign:ui:toggle:${campaign.id}`
				}
			]
		});

		return rows;

	/* Specific category page of a campaign's parameters */
	} else {
		const category = CAMPAIGN_PARAMETER_CATEGORIES.find(c => c.id === categoryId)!;

		const chunks = chunk(
			category.parameters.filter(p => p.display ? p.display(campaign) : true), 4
		);

		const rows: ActionRow[] = chunks.map(arr => ({
			type: MessageComponentTypes.ActionRow,

			components: arr.map(p => ({
				type: MessageComponentTypes.Button,
				style: ButtonStyles.Secondary,
				label: p.name,
				emoji: { name: "✏️" },
				customId: `campaign:ui:edit:${campaign.id}:${category.id}:${p.name}`
			})) as [ ButtonComponent ]
		}));

		rows[0].components.unshift({
			type: MessageComponentTypes.Button,
			emoji: { name: "back", id: 1166827863190806688n },
			label: category.name,
			style: ButtonStyles.Primary,
			customId: `campaign:ui:select:${campaign.id}`
		});

		return rows;
	}
}

function buildCampaignOverview(campaign: DBCampaign, categoryId?: CampaignCategoryType): MessageResponse {
	const fields: { name: string, value: string }[] = [
		{ name: "active", value: campaign.active ? "✅" : "❌" },
		{ name: "members", value: `${campaign.members.map(id => `<@${id}>`).join(", ")}` },
		{ name: "views", value: new Intl.NumberFormat("en-US").format(campaign.stats.views.total) },
		{ name: "clicks", value: new Intl.NumberFormat("en-US").format(campaign.stats.clicks.total) }
	];

	if (campaign.budget.type !== "none") fields.push(
		{ name: "budget", value: `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(campaign.budget.used)} / ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(campaign.budget.total)}` },
		{ name: "cost", value: `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(campaign.budget.cost)} per 1K ${campaign.budget.type}s`},
		{
			name: "rate",
			value: campaign.stats.clicks.total !== 0 && campaign.stats.views.total !== 0
				? new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(campaign.stats.clicks.total / campaign.stats.views.total)
				: "-"
		}
	);

	/* Add the category-specific fields to the embed. */
	if (categoryId) {
		const category = CAMPAIGN_PARAMETER_CATEGORIES.find(c => c.id === categoryId)!;
		if (category.fields) fields.push(...category.fields({ campaign, bot })); 
	}

	return {
		embeds: [
			{
				title: { key: "campaign.create.overview", data: { name: campaign.name } },
				description: `${fields.map(f => `**${t({ key: `campaign.stats.${f.name}` })}** • ${f.value}`).join("\n")}`,
				color: BRANDING_COLOR
			},

			render(campaign, true).embed
		],

		components: buildCampaignButtons(campaign, categoryId),
		ephemeral: true
	};
}

function buildEditModal(
	campaign: DBCampaign, category: CampaignParameterCategory, param: CampaignParameter
): ToLocaleStrings<Required<Pick<InteractionCallbackData, "title" | "customId" | "components">>> {
	return {
		title: "campaign.create.edit_value",
		customId: `campaign:ui:edit:${campaign.id}:${category.id}:${param.name}`,

		components: [ {
			type: MessageComponentTypes.ActionRow,

			components: [ {
				type: MessageComponentTypes.InputText,
				customId: "value",
				style: param.type,

				label: `${param.tooltip ?? param.name}${
					param.length ?
						` (${
							param.length.min && param.length.max ? `${param.length.min}-${param.length.max}`
								: param.length.min && !param.length.max
									? { key: "number.min", data: { num: param.length.min } }
									: param.length.max && !param.length.min
										? { key: "number.max", data: { num: param.length.max } }
										: ""
						})`
						: ""
				}`,

				placeholder: param.placeholder ?
					typeof param.placeholder === "function" ? param.placeholder(campaign) : param.placeholder
					: "...",

				value: param.previous(campaign) ?? undefined,

				required: param.optional != undefined ? !param.optional : true,
				minLength: param.length && param.length.min ? param.length.min : 1,
				maxLength: param.length && param.length.max ? param.length.max : 999
			} ]
		} ]
	};
}

export async function handleCampaignInteraction({ interaction, env, args }: InteractionHandlerOptions): Promise<MessageResponse | void> {
	let action = args.shift()!;

	/* /campaign command */
	if (action === "ui") {
		action = args.shift()!;

		if (action === "select") {
			const id = interaction.data?.values ? interaction.data.values[0]! : args[0];
			const campaign = getCampaign(id)!;
	
			await interaction.update(buildCampaignOverview(campaign));

		} else if (action === "category") {
			const [ id, category ] = args; 
			const campaign = getCampaign(id)!;

			await interaction.update(buildCampaignOverview(campaign, category as CampaignCategoryType));

		} else if (action === "edit") {
			const [ id, categoryId, parameterId ] = args;
			let campaign = getCampaign(id)!;

			const category = CAMPAIGN_PARAMETER_CATEGORIES.find(c => c.id === categoryId)!;
			const param = category.parameters.find(p => p.name === parameterId)!;

			/* The edit modal was submitted */
			if (interaction.type === InteractionTypes.ModalSubmit && interaction.data?.components) {
				/* New value */
				const newValue = interaction.data.components[0].components![0].value!;

				/* Whether the new value validates the checks */
				const validated = param.validate
					? param.validate({ value: newValue, env, bot })
					: true;

				if (validated === false || typeof validated === "object") return void await interaction.reply({
					embeds: {
						description: `The value for **${param.name}** was given an invalid value${typeof validated === "object" ? ` » **${validated.message}**` : ""}`,
						color: EmbedColor.Red
					}, ephemeral: true
				});

				const changes = param.update({ value: newValue, campaign, bot });	
				if (changes) campaign = await updateCampaign(campaign, changes);

				await interaction.update(
					buildCampaignOverview(campaign, categoryId as CampaignCategoryType)
				);

			/* The edit button was pressed */
			} else {
				await interaction.showModal(
					translateObject(buildEditModal(campaign, category, param)) as any
				);
			}
		} else if (action === "toggle") {
			let campaign = getCampaign(args[0])!;

			campaign = await updateCampaign(campaign, {
				active: !campaign.active
			});

			await interaction.update(
				buildCampaignOverview(campaign)
			);

		} else if (action === "create") {
			/* The creation modal was submitted */
			if (interaction.type === InteractionTypes.ModalSubmit && interaction.data?.components) {
				/* Name of the new campaign */
				const name = interaction.data.components[0].components![0].value!;

				/* Create the campaign. */
				const campaign = await createCampaign(env.user, name);

				await interaction.update(
					buildCampaignOverview(campaign)
				);

			/* The creation button was pressed */
			} else {
				await interaction.showModal(translateObject({
					title: "campaign.create.title",
					customId: "campaign:ui:create",

					components: [ {
						type: MessageComponentTypes.ActionRow,

						components: [ {
							type: MessageComponentTypes.InputText,
							label: "campaign.create.name",
							customId: "name",
							placeholder: "...",
							style: TextStyles.Short,
							required: true,
							minLength: 3,
							maxLength: 128
						} ]
					} ]
				}, env));
			}

		} else if (action === "preview") {
			const campaign = getCampaign(args[0])!;
			const { embed, row } = render(campaign);

			return {
				embeds: embed,
				components: [ row ],
				ephemeral: true
			};

		} else if (action === "home") {
			await interaction.update(buildCampaignFinder(env));
		}

	/* Button in advertisements */
	} else if (action === "click") {
		const campaign = getCampaign(args[0]);
		if (!campaign || !campaign.button) return;

		await incrementCampaignStatistics(campaign, "clicks");

		if (campaign.button.type === "Link") {
			const url = campaign.button.url;
			const domain = new URL(url).hostname;
	
			return {
				components: [ {
					type: MessageComponentTypes.ActionRow,
	
					components: [ {
						type: MessageComponentTypes.Button,
						label: domain, url, style: ButtonStyles.Link
					} ]
				} ],
	
				ephemeral: true
			};

		} else {
			/* This is so hacky, but whatever it works */
			interaction.data!.customId = campaign.button.id;
			await handleInteraction(bot, interaction);
		}
	} 
}