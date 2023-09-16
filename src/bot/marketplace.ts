import { ActionRow, Bot, ButtonStyles, MessageComponentTypes, SelectOption, avatarUrl } from "@discordeno/bot";

import type { InteractionHandlerOptions } from "./types/interaction.js";
import type { DBEnvironment } from "../db/types/mod.js";

import { type DBMarketplaceEntry, type DBMarketplaceType, MARKETPLACE_CATEGORIES } from "../db/types/marketplace.js";
import { type MessageResponse, EmbedColor } from "./utils/response.js";
import { getSettingsValue, updateSettings } from "./settings.js";
import { emojiToString } from "./utils/helpers.js";

/** How many marketplace entries can be on a single page, max. 25 */
const MARKETPLACE_PAGE_SIZE = 25;

interface MarketplaceFilterOptions {
	page: number;
}

async function getEntries(bot: Bot, { page }: MarketplaceFilterOptions): Promise<Record<DBMarketplaceType, DBMarketplaceEntry[]>> {
	const all = (await bot.db.all<DBMarketplaceEntry>("marketplace"));

	const map: Record<DBMarketplaceType, DBMarketplaceEntry[]> = {} as any;

	for (const category of MARKETPLACE_CATEGORIES) {
		const entries = all.filter(e => e.type === category.type);
		map[category.type] = entries.slice(page * MARKETPLACE_PAGE_SIZE, (page * MARKETPLACE_PAGE_SIZE) + MARKETPLACE_PAGE_SIZE);
	}

	return map;
}

async function pageCount(bot: Bot) {
	return Math.min(1, Math.floor(await bot.db.count("marketplace") / MARKETPLACE_PAGE_SIZE));
}

export function getMarketplaceEntry<T extends DBMarketplaceEntry | null = DBMarketplaceEntry>(bot: Bot, id: string): Promise<T> {
	return bot.db.fetch<T>("marketplace", id);
}

function getMarketplaceCategory(type: DBMarketplaceType) {
	return MARKETPLACE_CATEGORIES.find(category => category.type === type)!;
}

export async function getMarketplaceSetting<T extends DBMarketplaceEntry | null>(
	bot: Bot, env: DBEnvironment, type: DBMarketplaceType
): Promise<T> {
	/* Which settings key corresponds to the category */
	const key = getMarketplaceCategory(type).key;

	/* Get the configured marketplace entry's ID. */
	const id: string = getSettingsValue(bot, env, "user", key);
	const entry = await getMarketplaceEntry<T>(bot, id);

	return entry;
}

export async function handleMarketplaceInteraction({ bot, interaction, env, args }: InteractionHandlerOptions): Promise<MessageResponse | void> {
	const action: "use" | "view" | "page" | "category" = args.shift()! as any;

	if (action === "use") {
		const entry = await getMarketplaceEntry(bot, args.shift()!);
		const category = getMarketplaceCategory(entry.type);

		env.user = await updateSettings(bot, env, "user", {
			[category.key]: entry.id
		});
		
		await interaction.update(await buildEntryOverview(bot, env, entry));

	} else if (action === "view") {
		const entry = await getMarketplaceEntry(bot, interaction.data!.values![0]);
		await interaction.update(await buildEntryOverview(bot, env, entry));

	} else if (action === "page") {
		await interaction.update(await buildMarketplaceOverview(bot, {
			page: parseInt(args.shift()!)
		}));

	} else if (action === "category") {
		return buildMarketplaceOverview(bot, {
			page: 0
		});
	}}

/** Build an overview of all marketplace entries, paginated. */
export async function buildMarketplaceOverview(bot: Bot, options: MarketplaceFilterOptions): Promise<MessageResponse> {
	const map = await getEntries(bot, options);
	const pages = await pageCount(bot);

	const rows: ActionRow[] = [];

	for (const [ type, entries ] of Object.entries(map)) {
		const category = getMarketplaceCategory(type as DBMarketplaceType);
		if (entries.length === 0) continue;

		rows.push({
			type: MessageComponentTypes.ActionRow,

			components: [ {
				type: MessageComponentTypes.SelectMenu, customId: `market:view:${category.type}`,
				placeholder: `Pick a ${category.name ?? category.type} ...`,
				options: entries.map(entry => buildEntryPreview(entry))
			} ]
		});
	}

	if (pages > 1) rows.push({
		type: MessageComponentTypes.ActionRow,

		components: [
			{
				type: MessageComponentTypes.Button,
				style: ButtonStyles.Secondary, emoji: { name: "◀️" },
				customId: `market:page:${options.page - 1}`,
				disabled: options.page - 1 < 0
			},
	
			{
				type: MessageComponentTypes.Button,
				style: ButtonStyles.Success,
				label: `${options.page + 1} / ${pages}`,
				customId: `market:current:${options.page}`,
				disabled: true
			},
	
			{
				type: MessageComponentTypes.Button,
				style: ButtonStyles.Secondary, emoji: { name: "▶️" },
				customId: `market:page:${options.page + 1}`,
				disabled: options.page + 1 > pages - 1
			}
		]
	});

	return {
		embeds: {
			title: "Welcome to the marketplace! 📚",
			description: "*Here you can find custom **user-made personalities & styles** to perfect your experience with the bot.*",
			color: EmbedColor.Orange
		},

		components: rows,
		ephemeral: true
	};
}

/** Build a small preview of an entry, as an embed field. */
function buildEntryPreview(entry: DBMarketplaceEntry): SelectOption {
	return {
		label: entry.name, emoji: entry.emoji,
		description: entry.description ?? undefined,
		value: entry.id
	};
}

/** Build a full overview of an entry. */
async function buildEntryOverview(bot: Bot, env: DBEnvironment, entry: DBMarketplaceEntry): Promise<MessageResponse> {
	const creator = await bot.helpers.getUser(entry.creator);

	/* Current setting for this marketplace type */
	const category = getMarketplaceCategory(entry.type);
	const currentID: string | null = getSettingsValue(bot, env, "user", category.key);

	return {
		embeds: {
			author: { name: creator.username, iconUrl: avatarUrl(creator.id, creator.discriminator, { format: "png", avatar: creator.avatar }) },
			title: `${entry.name} ${emojiToString(entry.emoji)}`,
			description: entry.description ? `*${entry.description}*` : undefined
		},

		components: [ {
			type: MessageComponentTypes.ActionRow,

			components: [
				{
					type: MessageComponentTypes.Button,
					style: ButtonStyles.Primary,
					label: "Use", customId: `market:use:${entry.id}`,
					emoji: { name: "hand", id: 1152659477590458479n },
					disabled: currentID === entry.id
				},
		
				{
					type: MessageComponentTypes.Button,
					style: ButtonStyles.Secondary,
					customId: "market:page:0",
					emoji: { name: "home", id: 1152658440087425094n }
				}
			]
		} ],

		ephemeral: true
	};
}