import { ActionRow, Bot, ButtonComponent, ButtonStyles, MessageComponentTypes, SelectMenuComponent, SelectOption } from "@discordeno/bot";
import { randomUUID } from "crypto";

import { SettingsCategory, SettingsLocation, SettingsOption, SettingsOptionType } from "./types/settings.js";

import type { InteractionHandlerOptions } from "./types/interaction.js";
import type { Conversation } from "./types/conversation.js";
import type { DBEnvironment } from "../db/types/mod.js";
import type { DBGuild } from "../db/types/guild.js";
import type { DBUser } from "../db/types/user.js";

import { type MessageResponse, EmbedColor } from "./utils/response.js";
import { canUse, restrictionTypes } from "./utils/restriction.js";
import { CHAT_MODELS } from "./chat/models/mod.js";
import { resetConversation } from "./chat/mod.js";
import { IMAGE_MODELS } from "./image/models.js";
import { USER_LOCALES } from "./types/locale.js";

export const SettingsCategories: SettingsCategory[] = [
	{
		id: "general",
		emoji: "🧭",

		options: [
			{
				id: "language",
				emoji: "🌐", type: SettingsOptionType.Choices,
				location: SettingsLocation.User,
				default: "en",
				
				choices: USER_LOCALES.map(l => ({
					name: l.localName ?? l.name,
					description: l.localName ? l.name : undefined,
					emoji: l.emoji, value: l.id
				}))
			},

			{
				id: "indicator",
				emoji: "🔄", type: SettingsOptionType.String,
				hidden: true, default: "indicator-orb",
				location: SettingsLocation.User
			}
		]
	},

	{
		id: "chat",
		emoji: "🗨️",

		options: [
			{
				id: "model",
				emoji: "🤖", type: SettingsOptionType.Choices,
				location: SettingsLocation.User,
				default: "chatgpt",
				
				choices: CHAT_MODELS.map(m => ({
					name: m.name, description: `chat.models.${m.id}.desc`, emoji: m.emoji, restrictions: m.restrictions, value: m.id
				})),

				handler: async (bot, env) => {
					const conversation = await bot.db.get<Conversation>("conversations", env.user.id);
					if (conversation) await resetConversation(bot, conversation);
				}
			},

			{
				id: "plugins",
				emoji: "🚀", type: SettingsOptionType.MultipleChoices,
				location: SettingsLocation.User,
				max: 2, min: 0,
				default: [],
				choices: [],

				fetch: bot => {
					return bot.dynamic.plugins.map(p => ({
						name: `chat.plugins.${p.id}.name`,
						description: `chat.plugins.${p.id}.desc`,
						value: p.id, emoji: p.emoji
					}));
				}
			},

			{
				id: "partial_messages",
				emoji: "⏳", default: true,
				type: SettingsOptionType.Boolean,
				location: SettingsLocation.User
			}
		]
	},

	{
		id: "image",
		emoji: "🖼️",
		
		options: [
			{
				id: "model", emoji: "🖼️",
				location: SettingsLocation.User, default: IMAGE_MODELS[0].id,
				type: SettingsOptionType.Choices,

				choices: IMAGE_MODELS.map(m => ({
					name: m.name, description: `image.models.${m.id}`, value: m.id
				}))
			}
		]
	}
];

function categoryOptionKey(category: SettingsCategory, option: SettingsOption): `${string}:${string}` {
	return `${category.id}:${option.id}`;
}

export function whichEntry(location: SettingsLocation, env: DBEnvironment): DBUser | DBGuild {
	return location === SettingsLocation.Guild
		? env.guild! : env.user;
}

function getOption(key: string): SettingsOption | null {
	const [ categoryID, optionID ] = key.split(":");

	const category = SettingsCategories.find(c => c.id === categoryID);
	if (!category) return null;

	return category.options.find(o => o.id === optionID) ?? null;
}

export function updateSettings<T extends DBUser | DBGuild>(
	bot: Bot, env: DBEnvironment, location: "guild" | "user", changes: Record<string, any>
): Promise<T> {
	for (const [key, value] of Object.entries(changes)) {
		const option = getOption(key);

		/** FIXME: Why do I have to cast it to 'never'?? */
		if (option && option.handler) option.handler(bot, env, value as never);
	}
	
	return bot.db.update<any>(`${location}s`, env[location]!, {
		settings: { ...env.user.settings, ...changes }
	});
}

/** Load the choices of all dynamic settings. */
export async function fetchSettings(bot: Bot) {
	for (const category of SettingsCategories) {
		for (const option of category.options) {
			if (option.type !== SettingsOptionType.Choices && option.type !== SettingsOptionType.MultipleChoices) continue;
			if (!option.fetch) continue;

			option.choices = await option.fetch(bot);
		}
	}
}

export function getSettingsValue<T = string | number | boolean>(
	bot: Bot, env: DBEnvironment, location: "guild" | "user", key: string
): T {
	const value = env[location]!.settings[key] as T;
	const option = getOption(key);

	if (option && option.type === SettingsOptionType.Choices) {
		/* If no option is selected & it's optional, return null. */
		if (value === "none") return null as T;
		
		/* If the option is a select menu & the user doesn't have the permission to use the current choice, reset it. */
		const choice = option.choices.find(c => c.value === value) ?? null;
		if (choice?.restrictions && !canUse(bot, env, choice.restrictions)) return option.default;
		else if (choice === null) return option.default;
	}
	
	return value ?? option?.default;
}

export async function handleSettingsInteraction({ bot, args, env, interaction }: InteractionHandlerOptions) {
	const action = args.shift()!;
	const location = args.shift()! as SettingsLocation;

	const categoryName = args.shift()!;
	const category = SettingsCategories.find(c => c.id === categoryName)!;

	/* Change the page */
	if (action === "page") {
		/* Current category index */
		const currentIndex = SettingsCategories.findIndex(c => c.id === category.id);

		/* How to switch the pages, either -1 or (+)1 */
		const delta = parseInt(args[0]);

		/* Which category to switch to */
		const newCategory = SettingsCategories[currentIndex + delta];
		if (!newCategory) return;

		return void await interaction.update(
			buildSettingsPage(
				bot, location, newCategory, env
			)
		);

	/** Update a setting value */
	} else if (action === "change") {
		/* Which option to update */
		const option = category.options.find(o => o.id === args[0]);
		if (!option) return;

		const key = categoryOptionKey(category, option);

		const currentValue = getSettingsValue(bot, env, "user", key);
		let newValue: string | number | boolean | string[] | null = null;

		if (option.type === SettingsOptionType.Boolean) {
			newValue = !currentValue;

		} else if (option.type === SettingsOptionType.String) {
			/** TODO: Implement modal */
			newValue = "";

		} else if (option.type === SettingsOptionType.Choices) {
			newValue = interaction.data?.values?.[0] ?? currentValue;
			const choice = option.choices.find(c => c.value === newValue) ?? null;

			if (choice && choice.restrictions && !canUse(bot, env, choice.restrictions)) {
				const allowed = restrictionTypes(env, choice.restrictions);

				return void await interaction.reply({
					embeds: {
						description: { key: "restrictions.messages.choice", data: { choice: choice.name, restrictions: allowed.map(a => `**${a.description}** ${a.emoji}`).join(", ") } },
						color: EmbedColor.Orange
					},
		
					ephemeral: true, env
				});
			}
		} else if (option.type === SettingsOptionType.MultipleChoices) {
			newValue = (interaction.data?.values ?? currentValue) as string[];

			for (const val of newValue) {
				const choice = option.choices.find(c => c.value === val)!;

				if (choice.restrictions && !canUse(bot, env, choice.restrictions)) {
					const allowed = restrictionTypes(env, choice.restrictions);
	
					return void await interaction.reply({
						embeds: {
							description: { key: "restrictions.messages.choice", data: { choice: choice.name, restrictions: allowed.map(a => `**${a.description}** ${a.emoji}`).join(", ") } },
							color: EmbedColor.Orange
						},
			
						ephemeral: true, env
					});
				}
			}
		}

		if (newValue !== null && location !== SettingsLocation.Both) {
			env[location] = await updateSettings(bot, env, location, {
				[key]: newValue
			});
		}

	/* View a specific settings category */
	} else if (action === "view") {
		return void await interaction.reply(
			buildSettingsPage(bot, location, category, env)
		);
	}

	await interaction.update(
		buildSettingsPage(bot, location, category, env)
	);
}

export function buildSettingsPage(
	bot: Bot, location: SettingsLocation, category: SettingsCategory, env: DBEnvironment
): MessageResponse {
	const rows: ActionRow[] = [];

	for (const option of category.options.filter(
		o => o.location && o.location !== SettingsLocation.Both ? o.location === location : true
	)) {
		const value = getSettingsValue(
			bot, env, location === SettingsLocation.Guild ? "guild" : "user", categoryOptionKey(category, option)
		);

		if (!option.hidden) rows.push(buildOption(location, category, option, value, env));
	}

	rows.push(buildPageSwitcher(location, category));
	return { components: rows, ephemeral: true, env };
}

function buildOption(
	location: SettingsLocation, category: SettingsCategory, option: SettingsOption, current: string | number | boolean, env: DBEnvironment
): ActionRow {
	const components: (SelectMenuComponent | ButtonComponent)[] = [];

	if (option.type === SettingsOptionType.Boolean) {
		components.push(
			{
				type: MessageComponentTypes.Button,
				label: `settings.categories.${category.id}.options.${option.id}`, emoji: { name: option.emoji },
				style: ButtonStyles.Secondary, disabled: true,
				customId: randomUUID()
			},

			{
				type: MessageComponentTypes.Button,
				label: undefined!, emoji: { name: "🔘" },
				style: current ?  ButtonStyles.Success : ButtonStyles.Secondary,
				customId: `settings:change:${location}:${categoryOptionKey(category, option)}`
			}
		);

	} else if (option.type === SettingsOptionType.Choices || option.type === SettingsOptionType.MultipleChoices) {
		const choices: SelectOption[] = option.choices.map(c => {
			const restrictions = c.restrictions ? restrictionTypes(env, c.restrictions) : [];

			return {
				label: `${c.name} ${restrictions.map(r => r.emoji).join(" ")}`, value: c.value,
				description: c.restrictions
					? `${c.description ?? ""} (${restrictions.map(r => r.description).join(", ")})`
					: c.description,
				emoji: c.emoji ? typeof c.emoji === "string" ? { name: c.emoji } : c.emoji : undefined,
				default: Array.isArray(current) ? current.includes(c.value) : c.value === current
			};
		});

		if (option.type === SettingsOptionType.Choices && option.optional) choices.unshift({
			label: "settings.none", emoji: { name: "❌" },
			default: current === null, value: "none"
		});

		components.push({
			type: MessageComponentTypes.SelectMenu,
			customId: `settings:change:${location}:${categoryOptionKey(category, option)}`,

			maxValues: option.type === SettingsOptionType.MultipleChoices ? option.max : undefined,
			minValues: option.type === SettingsOptionType.MultipleChoices ? option.min : undefined,

			placeholder: `settings.categories.${category.id}.options.${option.id} ${option.emoji}`,
			options: choices
		});
	}
	return {
		type: MessageComponentTypes.ActionRow,
		components: components as [ ButtonComponent ]
	};
}

function buildPageSwitcher(location: SettingsLocation, category: SettingsCategory): ActionRow {
	const currentIndex = SettingsCategories.findIndex(c => c.id === category.id);

	const components: [ ButtonComponent, ButtonComponent, ButtonComponent ] = [
		{
			type: MessageComponentTypes.Button,
			style: ButtonStyles.Secondary, emoji: { name: "◀️" },
			customId: `settings:page:${location}:${category.id}:-1`,
			disabled: currentIndex - 1 < 0
		},

		{
			type: MessageComponentTypes.Button,
			label: `settings.categories.${category.id}.name`,
			style: ButtonStyles.Success,
			emoji: typeof category.emoji === "string" ? { name: category.emoji } : category.emoji,
			customId: `settings:current:${location}:${category.id}`
		},

		{
			type: MessageComponentTypes.Button,
			style: ButtonStyles.Secondary, emoji: { name: "▶️" },
			customId: `settings:page:${location}:${category.id}:1`,
			disabled: currentIndex + 1 > SettingsCategories.length - 1
		}
	];

	return {
		type: MessageComponentTypes.ActionRow,
		components
	};
}