import { ActionRow, Bot, ButtonComponent, ButtonStyles, ComponentEmoji, InteractionCallbackData, InteractionTypes, MessageComponentTypes, SelectOption, TextStyles, avatarUrl } from "@discordeno/bot";
import { randomUUID } from "crypto";

import type { InteractionHandlerOptions } from "./types/interaction.js";
import type { DBEnvironment } from "../db/types/mod.js";

import { type MarketplaceFilterOptions, type MarketplacePage, MARKETPLACE_CATEGORIES, MARKETPLACE_BASE_FIELDS, MarketplaceCategory } from "./types/marketplace.js";
import { type DBMarketplaceEntry, type DBMarketplaceType, DBMarketplaceStatistics } from "../db/types/marketplace.js";
import { emojiToString, emojiToUnicode, stringToEmoji, titleCase } from "./utils/helpers.js";
import { type MessageResponse, EmbedColor } from "./utils/response.js";
import { getSettingsValue, updateSettings } from "./settings.js";
import { DBRole } from "../db/types/user.js";

/** How many marketplace entries can be on a single page, max. 25 */
const MARKETPLACE_PAGE_SIZE = 25;

async function createEntry(bot: Bot, data: Omit<DBMarketplaceEntry, "id" | "created" | "stats">): Promise<DBMarketplaceEntry> {
	const id = randomUUID();

	return bot.db.update("marketplace", id, {
		created: new Date().toISOString(),
		stats: { uses: 0 }, ...data
	});
}

async function getEntries(bot: Bot, { type, page, creator }: MarketplaceFilterOptions): Promise<Record<DBMarketplaceType, MarketplacePage>> {
	const all = (await bot.db.all<DBMarketplaceEntry>("marketplace"));
	const map: Record<DBMarketplaceType, MarketplacePage> = {} as any;

	for (const category of MARKETPLACE_CATEGORIES) {
		const entries = all.filter(e => e.type === category.type);

		map[category.type] = {
			entries: entries
				.slice(page * MARKETPLACE_PAGE_SIZE, (page * MARKETPLACE_PAGE_SIZE) + MARKETPLACE_PAGE_SIZE)
				.filter(entry => type === "create" && creator ? entry.creator === creator : true),

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
		const entry = await fetchMarketplaceEntry(bot, interaction.data!.values![0]);
		await interaction.update(await buildEntryOverview(bot, env, entry));
		
	} else if (action === "edit") {
		const entry = await fetchMarketplaceEntry(bot, args.shift()!);
		const category = getMarketplaceCategory(entry.type);

		await interaction.showModal(
			buildCreationModal(category, "edit", entry)
		);

	} else if (action === "remove") {
		await bot.db.remove("marketplace", args.shift()!);

		await interaction.update(await buildMarketplaceOverview(bot, env, {
			type: "browse", page: 0
		}));

	} else if (action === "create") {
		/* The creation modal was submitted */
		if (interaction.type === InteractionTypes.ModalSubmit && interaction.data?.components) {
			const action: "new" | "edit" = args.shift()! as any;
			const type: DBMarketplaceType = args.shift()! as any;
			const id = args.shift();

			const category = getMarketplaceCategory(type);
			if (!category.creator) return;

			const components: {
				customId: string;
				value?: string;
			}[] = interaction.data.components.map(c => c.components![0] as any);

			/* Specified fields */
			const fields: Record<string, string | null> = {};

			for (const component of components) {
				const settings =
					category.creator.fields[component.customId]
					?? MARKETPLACE_BASE_FIELDS[component.customId as keyof typeof MARKETPLACE_BASE_FIELDS];

				fields[component.customId] = component.value && component.value.length > 0
					? component.value : null;

				if (settings.validate && fields[component.customId]) {
					console.log(component.customId, fields[component.customId]);
					const result = settings.validate(fields[component.customId]!);
					
					if (result) return { embeds: {
						description: `The field **${settings.name}** was given an invalid value » **${result.message}**`,
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
				? bot.rest.changeToDiscordFormat(stringToEmoji(emojiToUnicode(
					fields["emoji"]
				)!)!)
				: undefined;

			/* Updated entry data */
			const data = category.creator.create(fields as any, bot);

			/* Edit an existing entry */
			if (action === "edit" && id) {
				entry = await bot.db.update<DBMarketplaceEntry>("marketplace", entry, {
					name: fields["name"] ?? undefined, emoji,
					description: fields["description"] ?? undefined,
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

			await interaction.update(await buildEntryOverview(bot, env, entry));

		/* Which type to create was selected */
		} else if (interaction.data?.componentType === MessageComponentTypes.SelectMenu) {
			const category = getMarketplaceCategory(interaction.data!.values![0]);
			await interaction.showModal(buildCreationModal(category, "new"));

		/* The creation button was pressed in the dashboard */
		} else if (interaction.data?.componentType === MessageComponentTypes.Button) {
			return {
				embeds: {
					description: "Select which type of marketplace item you want to create, e.g. **Style** 🖌️ or **Personality** 😊.",
					color: EmbedColor.Orange
				},

				components: [ {
					type: MessageComponentTypes.ActionRow,

					components: [ {
						type: MessageComponentTypes.SelectMenu,
						customId: "market:create",

						options: MARKETPLACE_CATEGORIES.filter(category => category.creator)
							.map(category => ({
								label: titleCase(category.name ?? category.type),
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
			type: args.shift()! as any, page: parseInt(args.shift()!)
		}));

	} else if (action === "category") {
		return buildMarketplaceOverview(bot, env, {
			type: "browse", page: 0
		});
	}}

/** Build an overview of all marketplace entries, paginated. */
export async function buildMarketplaceOverview(bot: Bot, env: DBEnvironment, options: MarketplaceFilterOptions): Promise<MessageResponse> {
	if (options.type === "create" && !canCreate(env)) return {
		embeds: {
			title: "You cannot create items in the marketplace 😔",
			description: "*Try checking back again later.*",
			color: EmbedColor.Red
		},

		ephemeral: true
	};

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
				placeholder: `${titleCase(category.name ?? category.type)} ${emojiToString(category.emoji)}`,

				options: page.entries
					.filter(entry => !options.creator ? entry.status.visibility === "public" : true)
					.map(entry => buildEntryPreview(entry))
			} ]
		});
	}

	rows.push({
		type: MessageComponentTypes.ActionRow,

		components: [
			{
				type: MessageComponentTypes.Button,
				style: ButtonStyles.Secondary, emoji: { name: "◀️" },
				customId: `market:page:${options.type}:${options.page - 1}`,
				disabled: options.page - 1 < 0
			},
	
			{
				type: MessageComponentTypes.Button,
				style: ButtonStyles.Success,
				label: `${options.page + 1} / ${pages}`,
				customId: `market:current:${options.type}:${options.page}`,
				disabled: true
			},
	
			{
				type: MessageComponentTypes.Button,
				style: ButtonStyles.Secondary, emoji: { name: "▶️" },
				customId: `market:page:${options.type}:${options.page + 1}`,
				disabled: options.page + 1 > pages - 1
			}
		]
	});

	if (options.type === "create") rows[rows.length - 1].components.unshift({
		type: MessageComponentTypes.Button,
		style: ButtonStyles.Primary,
		emoji: { name: "create", id: 1153016555374911618n },
		customId: "market:create"
	});

	return {
		embeds: options.type === "browse"
			? {
				title: "Welcome to the marketplace! 📚",
				description: "*Here you can find custom **user-made personalities & styles** to perfect your experience with the bot.*",
				color: EmbedColor.Orange
			}
			
			: {
				title: "Welcome to the marketplace dashboard! ⚙️",
				description: "*From here, you can manage all your marketplace creations & refine them as needed.*",
				color: EmbedColor.Orange,

				fields: [
					{
						name: "Creating an item in the marketplace",
						value: "To create something in the marketplace, press the **<:create:1153016555374911618> Create** button below. Then, you will have to select which type of marketplace item you want to create, e.g. **Style** 🖌️ or **Personality** 😊."
					},

					{
						name: "Updating an existing item in the marketplace",
						value: "In case you want to update a creation of yours in the marketplace, simply go to its page & press the **<:edit:1153011486185230347> Edit** button at the bottom."
					}
				]
			},

		components: rows,
		ephemeral: true
	};
}

/** Build a small preview of an entry, as an embed field. */
function buildEntryPreview(entry: DBMarketplaceEntry): SelectOption {
	return {
		label: entry.status.builtIn ? `${entry.name} ⭐` : entry.name,
		description: entry.description ?? undefined,
		emoji: entry.emoji,
		value: entry.id
	};
}

/** Build a full overview of an entry. */
async function buildEntryOverview(bot: Bot, env: DBEnvironment, entry: DBMarketplaceEntry): Promise<MessageResponse> {
	const creator = await bot.helpers.getUser(entry.creator);

	/* Current setting for this marketplace type */
	const category = getMarketplaceCategory(entry.type);
	const currentID: string | null = getSettingsValue(bot, env, "user", category.key);

	const buttons: ButtonComponent[] = [
		{
			type: MessageComponentTypes.Button,
			style: ButtonStyles.Success,
			label: "Use", customId: `market:use:${entry.id}`,
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
				emoji: { name: "trash", id: 1153010959590375624n }
			}
		);
	}

	buttons.push({
		type: MessageComponentTypes.Button,
		style: ButtonStyles.Primary,
		customId: "market:page:browse:0",
		emoji: { name: "home", id: 1152658440087425094n }
	});

	return {
		embeds: [
			{
				author: { name: creator.username, iconUrl: avatarUrl(creator.id, creator.discriminator, { format: "png", avatar: creator.avatar }) },
				footer: { text: `Used ${new Intl.NumberFormat("en-US").format(entry.stats.uses)} time${entry.stats.uses !== 1 ? "s" : ""}` },
				title: `${entry.name} ${emojiToString(entry.emoji)}`,
				description: entry.description ? `*${entry.description}*` : undefined
			},
		],

		components: [ {
			type: MessageComponentTypes.ActionRow,
			components: buttons as [ ButtonComponent ]
		} ],

		ephemeral: true
	};
}

function buildCreationModal(
	category: MarketplaceCategory, type: "new" | "edit", entry?: DBMarketplaceEntry
): Required<Pick<InteractionCallbackData, "title" | "customId" | "components">> {
	return {
		title: `${type === "new" ? "Create a" : "Edit this"} ${category.name ?? category.type} ${emojiToString(category.emoji)}`,
		customId: `market:create:${type}:${category.type}:${entry?.id}`,

		components: Object.entries({ ...MARKETPLACE_BASE_FIELDS, ...category.creator!.fields })
			.map(([ id, field ]) => ({
				type: MessageComponentTypes.ActionRow,

				components: [ {
					type: MessageComponentTypes.InputText,
					customId: id, label: field.name,
					style: field.style ?? TextStyles.Short,
					placeholder: field.placeholder,

					value: type === "edit" && entry
						? field.parse(entry) ?? undefined
						: undefined,

					required: type === "edit" ? false :  !field.optional,
					minLength: field.minLength, maxLength: field.maxLength
				} ]
			}))
	};
}

/** Check whether a user can create & manage entries in the marketplace. */
function canCreate(env: DBEnvironment) {
	return env.user.roles.includes(DBRole.Tester);
}