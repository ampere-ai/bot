import { ActionRow, Bot, ButtonComponent, ButtonStyles, Component, ComponentEmoji, InteractionTypes, MessageComponentTypes, ModalResponse, SelectOption, TextStyles, avatarUrl } from "@discordeno/bot";
import { randomUUID } from "crypto";

import type { InteractionHandlerOptions } from "./types/interaction.js";
import type { DBEnvironment } from "../db/types/mod.js";

import { type MarketplaceFilterOptions, type MarketplacePage, MARKETPLACE_CATEGORIES, MARKETPLACE_BASE_FIELDS, MarketplaceCategory } from "./types/marketplace.js";
import { type DBMarketplaceEntry, type DBMarketplaceType, DBMarketplaceStatistics } from "../db/types/marketplace.js";
import { type MessageResponse, EmbedColor } from "./utils/response.js";
import { emojiToString, stringToEmoji } from "./utils/helpers.js";
import { getSettingsValue, updateSettings } from "./settings.js";
import { hasTranslation, t } from "./i18n.js";
import { DBRole } from "../db/types/user.js";

/** How many marketplace entries can be on a single page, max. 25 */
const MARKETPLACE_PAGE_SIZE = 25;

async function createEntry(bot: Bot, data: Omit<DBMarketplaceEntry, "id" | "created" | "stats">): Promise<DBMarketplaceEntry> {
	const id = randomUUID();

	return bot.db.update("marketplace", id, {
		created: new Date().toISOString(),
		stats: { uses: 0, views: 0 },
		...data
	});
}

async function getEntries(bot: Bot, { page, creator }: MarketplaceFilterOptions): Promise<Record<DBMarketplaceType, MarketplacePage>> {
	const all = (await bot.db.all<DBMarketplaceEntry>("marketplace"));
	const map = {} as Record<DBMarketplaceType, MarketplacePage>;

	for (const category of MARKETPLACE_CATEGORIES) {
		const entries = all.filter(e => e.type === category.type);

		map[category.type] = {
			entries: entries
				.slice(page * MARKETPLACE_PAGE_SIZE, (page * MARKETPLACE_PAGE_SIZE) + MARKETPLACE_PAGE_SIZE)
				.filter(entry => creator ? entry.creator === creator : true),

			count: Math.ceil(entries.length / MARKETPLACE_PAGE_SIZE)
		};
	}

	return map;
}

async function pageCount(map: Record<DBMarketplaceType, MarketplacePage>): Promise<number> {
	return Math.max(...Object.values(map).map(page => page.count));
}

export function getMarketplaceEntry<T extends DBMarketplaceEntry | null = DBMarketplaceEntry | null>(bot: Bot, id: string) {
	return bot.db.get<T>("marketplace", id);
}

export function fetchMarketplaceEntry<T extends DBMarketplaceEntry = DBMarketplaceEntry>(bot: Bot, id: string) {
	return bot.db.fetch<T>("marketplace", id);
}

function getMarketplaceCategory(type: string): MarketplaceCategory {
	return MARKETPLACE_CATEGORIES.find(category => category.type === type)! as MarketplaceCategory;
}

async function incrementStatistics(bot: Bot, db: DBMarketplaceEntry, key: keyof DBMarketplaceStatistics) {
	return bot.db.update<DBMarketplaceEntry>("marketplace", db, {
		stats: {
			...db.stats,
			[key]: (db.stats[key] ?? 0) + 1
		}
	});
}

export async function getMarketplaceSetting<T extends DBMarketplaceEntry>(
	bot: Bot, env: DBEnvironment, type: DBMarketplaceType
): Promise<T> {
	const { key, default: defaultID } = getMarketplaceCategory(type);
	const id: string = getSettingsValue(bot, env, "user", key);

	/* First, try getting the actual specified marketplace entry ID. If that doesn't exist, use the given default ID. */
	const entry =
		await getMarketplaceEntry<T>(bot, id)
		?? await fetchMarketplaceEntry<T>(bot, defaultID);

	return entry;
}

export async function handleMarketplaceInteraction({ bot, interaction, env, args }: InteractionHandlerOptions): Promise<MessageResponse | void> {
	const action = args.shift()!;

	if (action === "use") {
		let entry = await fetchMarketplaceEntry(bot, args.shift()!);
		const category = getMarketplaceCategory(entry.type);

		env.user = await updateSettings(bot, env, "user", {
			[category.key]: entry.id
		});
		
		entry = await incrementStatistics(bot, entry, "uses");
		await interaction.update(await buildEntryOverview(bot, env, entry));

	} else if (action === "view") {
		let entry = await fetchMarketplaceEntry(bot, interaction.data!.values![0]);

		entry = await incrementStatistics(bot, entry, "views");
		await interaction.update(await buildEntryOverview(bot, env, entry));
		
	} else if (action === "edit") {
		const entry = await fetchMarketplaceEntry(bot, args.shift()!);
		const category = getMarketplaceCategory(entry.type);

		await interaction.showModal(
			buildCreationModal(env, category, "edit", entry)
		);

	} else if (action === "remove") {
		await bot.db.remove("marketplace", args.shift()!);

		await interaction.update(await buildMarketplaceOverview(bot, env, {
			page: 0
		}));

	} else if (action === "create") {
		/* The creation modal was submitted */
		if (interaction.type === InteractionTypes.ModalSubmit && interaction.data?.components) {
			const action: "new" | "edit" = args.shift()! as "new" | "edit";
			const type: DBMarketplaceType = args.shift()! as DBMarketplaceType;
			
			const id = args.shift();

			const category = getMarketplaceCategory(type);
			if (!category.creator) return;

			const components: {
				customId: string;
				value?: string;
			}[] = interaction.data.components.map(
				c => c.components![0] as Required<Component>
			);

			/* Specified fields */
			const fields: Record<string, string | null> = {};

			for (const component of components) {
				const settings =
					category.creator.fields[component.customId]
					?? MARKETPLACE_BASE_FIELDS[component.customId as keyof typeof MARKETPLACE_BASE_FIELDS];

				fields[component.customId] = component.value && component.value.length > 0
					? component.value : null;

				if (settings.validate && fields[component.customId]) {
					const result = settings.validate(fields[component.customId]!);
					
					if (result) return { embeds: {
						description: { key: "modal.errors.invalid_value", data: { name: t({ key: `marketplace.fields.${component.customId}`, env }), message: t({ key: result.message, env }) } },
						color: EmbedColor.Red
					}, ephemeral: true };
				}
			}

			/* Marketplace entry */
			let entry: DBMarketplaceEntry = action === "edit" && id
				? await bot.db.fetch("marketplace", id)
				: null!;

			/* Parsed emoji for the entry */
			const emoji: ComponentEmoji | undefined = fields["emoji"] !== null
				? bot.rest.changeToDiscordFormat(stringToEmoji(
					fields["emoji"]
				)!)
				: undefined;

			/* Updated entry data */
			const data = category.creator.create(fields as any, bot);

			/* Edit an existing entry */
			if (action === "edit" && id) {
				entry = await bot.db.update<DBMarketplaceEntry>("marketplace", entry, {
					name: fields["name"] ?? undefined, emoji,
					description: fields["description"] ?? null,
					data: { ...entry.data, ...data }
				});

			/* Create a new entry */
			} else if (action === "new") {
				if (!emoji) return;

				entry = await createEntry(bot, {
					creator: interaction.user.id.toString(),
					type, name: fields["name"]!,
					description: fields["description"]!,
					status: { type: "approved", visibility: "public" },
					emoji, data
				});
			}

			await interaction.update(
				await buildEntryOverview(bot, env, entry)
			);

		/* Which type to create was selected */
		} else if (interaction.data?.componentType === MessageComponentTypes.SelectMenu) {
			const category = getMarketplaceCategory(interaction.data!.values![0]);
			await interaction.showModal(buildCreationModal(env, category, "new"));

		/* The creation button was pressed in the dashboard */
		} else if (interaction.data?.componentType === MessageComponentTypes.Button) {
			return {
				embeds: {
					description: "marketplace.manage.select_type ✏️",
					color: EmbedColor.Orange
				},

				components: [ {
					type: MessageComponentTypes.ActionRow,

					components: [ {
						type: MessageComponentTypes.SelectMenu,
						customId: "market:create",

						options: MARKETPLACE_CATEGORIES.filter(category => category.creator)
							.map(category => ({
								label: `marketplace.categories.${category.type}`,
								emoji: category.emoji,
								value: category.type
							}))
					} ]
				} ],

				ephemeral: true
			};
		} 

	} else if (action === "page") {
		await interaction.update(await buildMarketplaceOverview(bot, env, {
			page: parseInt(args.shift()!)
		}));

	} else if (action === "category") {
		return buildMarketplaceOverview(bot, env, {
			page: 0
		});
	}}

/** Build an overview of all marketplace entries, paginated. */
export async function buildMarketplaceOverview(bot: Bot, env: DBEnvironment, options: MarketplaceFilterOptions): Promise<MessageResponse> {
	const canCreate = canCreateInMarketplace(env);

	const map = await getEntries(bot, options);
	const pages = await pageCount(map);

	const rows: ActionRow[] = [];

	for (const [ type, page ] of Object.entries(map)) {
		const category = getMarketplaceCategory(type);
		if (page.entries.length === 0) continue;

		rows.push({
			type: MessageComponentTypes.ActionRow,

			components: [ {
				type: MessageComponentTypes.SelectMenu, customId: `market:view:${category.type}`,
				placeholder: `marketplace.categories.${category.type} ${emojiToString(category.emoji)}`,

				options:
					sortEntries(page.entries
						.filter(entry => !options.creator ? entry.status.visibility === "public" : true)
					).map(entry => buildEntryPreview(entry, env))
			} ]
		});
	}

	rows.push({
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

	if (canCreate) rows[rows.length - 1].components.unshift({
		type: MessageComponentTypes.Button,
		style: ButtonStyles.Primary,
		emoji: { name: "create", id: 1153016555374911618n },
		customId: "market:create"
	});

	return {
		embeds: {
			title: "marketplace.title 📚",
			description: "marketplace.desc",
			color: EmbedColor.Orange
		},

		components: rows,
		ephemeral: true,
		env
	};
}

/** Build a small preview of an entry, as a select option. */
function buildEntryPreview(entry: DBMarketplaceEntry, env: DBEnvironment): SelectOption {
	const { name, desc } = localizeMarketplaceEntry(entry, env);

	return {
		label: entry.status.builtIn ? `${name} ⭐` : name,

		description: desc
			? desc.split("\n").length > 1 ? `${desc.split("\n")[0]} ...` : desc
			: undefined,
			
		emoji: entry.emoji,
		value: entry.id
	};
}

/** Build a full overview of an entry. */
async function buildEntryOverview(bot: Bot, env: DBEnvironment, entry: DBMarketplaceEntry): Promise<MessageResponse> {
	/* Current setting for this marketplace type */
	const category = getMarketplaceCategory(entry.type);
	const currentID: string | null = getSettingsValue(bot, env, "user", category.key);

	const creator = !entry.status.builtIn
		? await bot.helpers.getUser(entry.creator)
		: null;

	const buttons: ButtonComponent[] = [
		{
			type: MessageComponentTypes.Button,
			style: ButtonStyles.Success,
			label: "marketplace.buttons.use", customId: `market:use:${entry.id}`,
			emoji: { name: "hand", id: 1152659477590458479n },
			disabled: currentID === entry.id
		}
	];

	if (entry.creator === env.user.id || env.user.roles.includes(DBRole.Owner)) {
		buttons.push(
			{
				type: MessageComponentTypes.Button,
				style: ButtonStyles.Secondary,
				customId: `market:edit:${entry.id}`,
				emoji: { name: "edit", id: 1153011486185230347n }
			},

			{
				type: MessageComponentTypes.Button,
				style: ButtonStyles.Danger,
				customId: `market:remove:${entry.id}`,
				emoji: { name: "trash", id: 1153010959590375624n },
				disabled: entry.status.builtIn
			}
		);
	}

	buttons.push({
		type: MessageComponentTypes.Button,
		style: ButtonStyles.Primary,
		customId: "market:page:0",
		emoji: { name: "home", id: 1152658440087425094n }
	});

	const { name, desc } = localizeMarketplaceEntry(entry, env);

	return {
		embeds: [ {
			author: creator
				? { name: creator.username, iconUrl: avatarUrl(creator.id, creator.discriminator, { format: "png", avatar: creator.avatar }) }
				: undefined,

			footer: { text: `${t({ key: "marketplace.counts.views", options: { count: entry.stats.views }, env })} • ${t({ key: "marketplace.counts.uses", options: { count: entry.stats.uses }, env })}` },
			title: `${name} ${emojiToString(entry.emoji)}`,
			description: desc ? `*${desc}*` : undefined
		} ],

		components: [ {
			type: MessageComponentTypes.ActionRow,
			components: buttons as [ ButtonComponent ]
		} ],

		ephemeral: true, env
	};
}

function buildCreationModal(
	env: DBEnvironment, category: MarketplaceCategory, type: "new" | "edit", entry?: DBMarketplaceEntry
): ModalResponse {
	return {
		title: `${type === "new" ? "marketplace.manage.create" : "marketplace.manage.edit"} ${emojiToString(category.emoji)}`,
		customId: `market:create:${type}:${category.type}:${entry?.id}`, env,

		components: Object.entries({ ...MARKETPLACE_BASE_FIELDS, ...category.creator!.fields })
			.map(([ id, field ]) => ({
				type: MessageComponentTypes.ActionRow,

				components: [ {
					type: MessageComponentTypes.InputText,
					customId: id, style: field.style ?? TextStyles.Short,
					label: `marketplace.fields.${id}`,
					placeholder: field.placeholder,

					value: type === "edit" && entry
						? field.parse(entry) ?? undefined
						: undefined,

					required: !field.optional,
					minLength: field.minLength, maxLength: field.maxLength
				} ]
			}))
	};
}

/** Translate a marketplace entry, if needed. */
export function localizeMarketplaceEntry(entry: DBMarketplaceEntry, env: DBEnvironment) {
	const key = `marketplace.entries.${entry.type}.${entry.id.split("-").reverse()[0]}`;

	if (hasTranslation({ key, env })) {
		return {
			name: t({ key: `${key}.name`, env }),
			desc: t({ key: `${key}.desc`, env })
		};
	} else {
		return {
			name: entry.name,
			desc: entry.description
		};
	}
}

/** Check whether a user can create & manage entries in the marketplace. */
function canCreateInMarketplace(env: DBEnvironment) {
	return env.user.roles.includes(DBRole.Tester);
}

/** Sort the given marketplace entries accordingly. */
function sortEntries(entries: DBMarketplaceEntry[]): DBMarketplaceEntry[] {
	return entries.sort((a, b) => {
		/* Show default entries at the top. */
		if (a.status.default) return -1;
		if (b.status.default) return 1;

		return b.stats.uses - a.stats.uses;
	});
}