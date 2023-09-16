import { ActionRow, Bot, ButtonComponent, ButtonStyles, MessageComponentTypes, SelectMenuComponent, SelectOption } from "@discordeno/bot";
import { randomUUID } from "crypto";

import { SettingsCategory, SettingsLocation, SettingsOption, SettingsOptionType } from "./types/settings.js";

import type { InteractionHandlerOptions } from "./types/interaction.js";
import type { DBEnvironment } from "../db/types/mod.js";
import type { DBGuild } from "../db/types/guild.js";
import type { DBUser } from "../db/types/user.js";

import { type MessageResponse, EmbedColor } from "./utils/response.js";
import { canUse, restrictionTypes } from "./utils/restriction.js";
import { USER_LANGUAGES } from "../db/types/language.js";
import { CHAT_MODELS } from "./chat/models/mod.js";
import { resetConversation } from "./chat/mod.js";
import { IMAGE_MODELS } from "./image/models.js";

export const SettingsCategories: SettingsCategory[] = [
	{
		name: "General",
		emoji: "🧭",

		options: [
			{
				name: "Language",
				description: "Primary language to use for the bot",
				emoji: "🌐", type: SettingsOptionType.Choices,
				location: SettingsLocation.User,
				default: "en-US",
				
				choices: USER_LANGUAGES.map(l => ({
					name: l.name, emoji: l.emoji, value: l.id
				}))
			},

			{
				name: "Indicator",
				description: "Which emoji to use throughout the bot to indicating loading",
				emoji: "🔄", type: SettingsOptionType.String,
				hidden: true, default: "indicator-orb",
				location: SettingsLocation.User,
			}
		]
	},

	{
		name: "Chat",
		emoji: "🗨️",

		options: [
			{
				name: "Model",
				description: "Which AI language model to use for chatting",
				emoji: "🤖", type: SettingsOptionType.Choices,
				location: SettingsLocation.User,
				default: "chatgpt",
				
				choices: CHAT_MODELS.map(m => ({
					name: m.name, description: m.description, emoji: m.emoji, restrictions: m.restrictions, value: m.id
				})),

				handler: (bot, env) => {
					return resetConversation(bot, env);
				}
			},

			{
				name: "Personality", emoji: "😊",
				description: "How the AI language model should act",
				type: SettingsOptionType.String,
				location: SettingsLocation.User,
				hidden: true, default: "personality-neutral",

				handler: (bot, env) => {
					return resetConversation(bot, env);
				}
			},

			{
				name: "Partial messages",
				description: "Whether chat messages by the bot should be shown while they're being generated",
				emoji: "⏳", default: true,
				type: SettingsOptionType.Boolean,
				location: SettingsLocation.User
			}
		]
	},

	{
		name: "Image",
		emoji: "🖼️",
		
		options: [
			{
				name: "Model", emoji: "🖼️",
				description: "Which image generation model to use",
				location: SettingsLocation.User, default: IMAGE_MODELS[0].id,
				type: SettingsOptionType.Choices,

				choices: IMAGE_MODELS.map(m => ({
					name: m.name, description: m.description, value: m.id
				}))
			},

			{
				name: "Style", emoji: "🖌️",
				description: "Which image style to use",
				location: SettingsLocation.User,
				type: SettingsOptionType.String,
				default: "style-none", hidden: true
			},
		]
	},

	{
		name: "Premium",
		emoji: "✨",
		
		options: [
			{
				name: "Type priority", emoji: "✨",
				description: "Which premium type to prioritize",
				location: SettingsLocation.Both, default: "plan",
				type: SettingsOptionType.Choices,

				choices: [
					{
						name: "Pay-as-you-go", emoji: "📊", value: "plan",
						description: "Use the credit-based pay-as-you-go plan first"
					},
		
					{
						name: "Subscription", emoji: "💸", value: "subscription",
						description: "Use the fixed subscription first"
					}
				]
			},

			{
				name: "Location priority", emoji: "✨",
				description: "Whether to prioritize your own or the server's Premium",
				location: SettingsLocation.User, default: "guild",
				type: SettingsOptionType.Choices,

				choices: [
					{
						name: "The server's Premium", emoji: "☎️", value: "guild",
						description: "Use the server's Premium before using your own"
					},
		
					{
						name: "My own Premium", emoji: "👤", value: "user",
						description: "Always use your own Premium, not regarding whether the server has Premium or not"
					}
				]
			}
		]
	}
];

function categoryKey(category: SettingsCategory) {
	return category.name.toLowerCase().replaceAll(" ", "_");
}

function optionKey(option: SettingsOption) {
	return option.name.toLowerCase().replaceAll(" ", "_");
}

function categoryOptionKey(category: SettingsCategory, option: SettingsOption): `${string}:${string}` {
	return `${categoryKey(category)}:${optionKey(option)}`;
}

export function whichEntry(location: SettingsLocation, env: DBEnvironment): DBUser | DBGuild {
	return location === SettingsLocation.Guild
		? env.guild! : env.user;
}

function getOption(key: string): SettingsOption {
	const [ categoryName, optionName ] = key.split(":");

	const category = SettingsCategories.find(c => categoryKey(c) === categoryName)!;
	const option = category.options.find(o => optionKey(o) === optionName)!;

	return option;
}

export function updateSettings<T extends DBUser | DBGuild>(
	bot: Bot, env: DBEnvironment, location: "guild" | "user", changes: Record<string, any>
): Promise<T> {
	for (const [key, value] of Object.entries(changes)) {
		const option = getOption(key);

		/** FIXME: Why do I have to cast it to 'never'?? */
		if (option.handler) option.handler(bot, env, value as never);
	}
	
	return bot.db.update<any>(`${location}s`, env[location]!, {
		settings: { ...env.user.settings, ...changes }
	});
}

export function getSettingsValue<T = string | number | boolean>(
	bot: Bot, env: DBEnvironment, location: "guild" | "user", key: string
): T {
	const value = env[location]!.settings[key] as T;
	const option = getOption(key);

	/* If no option is selected & it's optional, return null. */
	if (option.type === SettingsOptionType.Choices) {
		if (value === "none") return null as T;
	}

	/* If the option is a select menu & the user doesn't have the permission to use the current choice, reset it. */
	if (option.type === SettingsOptionType.Choices) {
		const choice = option.choices.find(c => c.value === value) ?? null;
		if (choice?.restrictions && !canUse(bot, env, choice.restrictions)) return option.default;
	}
	
	return value ?? option.default;
}

export async function handleSettingsInteraction({ bot, args, env, interaction }: InteractionHandlerOptions) {
	const action: "page" | "current" | "change" | "view" = args.shift()! as any;
	const location: SettingsLocation = args.shift()! as SettingsLocation;

	const categoryName = args.shift()!;
	const category = SettingsCategories.find(c => categoryKey(c) === categoryName)!;

	/* Change the page */
	if (action === "page") {
		/* Current category index */
		const currentIndex = SettingsCategories.findIndex(c => c.name === category.name);

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
		const option = category.options.find(o => optionKey(o) === args[0]);
		if (!option) return;

		const key = categoryOptionKey(category, option);

		const currentValue = getSettingsValue(bot, env, "user", key);
		let newValue: string | number | boolean | string[] | null = null;

		if (option.type === SettingsOptionType.Boolean) {
			newValue = !currentValue;

		} else if (option.type === SettingsOptionType.String) {
			/** TODO: Implement */
			newValue = "";

		} else if (option.type === SettingsOptionType.Choices) {
			const choice = option.choices.find(c => c.value === newValue) ?? null;
			newValue = interaction.data?.values?.[0] ?? currentValue;

			if (choice && choice.restrictions && !canUse(bot, env, choice.restrictions)) {
				const allowed = restrictionTypes(choice.restrictions);

				return void await interaction.reply({
					embeds: {
						description: `The choice **${choice.name}** is ${allowed.map(a => `**${a.description}** ${a.emoji}`).join(", ")}.`,
						color: EmbedColor.Orange
					},
		
					ephemeral: true
				});
			}
		} else if (option.type === SettingsOptionType.MultipleChoices) {
			newValue = interaction.data?.values ?? currentValue;

			for (const val of newValue as string[]) {
				const choice = option.choices.find(c => c.value === val)!;

				if (choice.restrictions && !canUse(bot, env, choice.restrictions)) {
					const allowed = restrictionTypes(choice.restrictions);
	
					return void await interaction.reply({
						embeds: {
							description: `The choice **${choice.name}** is ${allowed.map(a => `**${a.description}** ${a.emoji}`).join(", ")}.`,
							color: EmbedColor.Orange
						},
			
						ephemeral: true
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

		if (!option.hidden) rows.push(buildOption(location, category, option, value));
	}

	rows.push(buildPageSwitcher(location, category));
	return { components: rows, ephemeral: true };
}

function buildOption(
	location: SettingsLocation, category: SettingsCategory, option: SettingsOption, current: string | number | boolean
): ActionRow {
	const components: (SelectMenuComponent | ButtonComponent)[] = [];

	if (option.type === SettingsOptionType.Boolean) {
		components.push(
			{
				type: MessageComponentTypes.Button,
				label: option.name, emoji: { name: option.emoji },
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
			const restrictions = c.restrictions ? restrictionTypes(c.restrictions) : [];

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
			label: "None", emoji: { name: "❌" },
			default: current === null, value: "none"
		});

		components.push({
			type: MessageComponentTypes.SelectMenu,
			customId: `settings:change:${location}:${categoryOptionKey(category, option)}`,

			maxValues: option.type === SettingsOptionType.MultipleChoices ? option.max : undefined,
			minValues: option.type === SettingsOptionType.MultipleChoices ? option.min : undefined,

			placeholder: `${option.name} ${option.emoji}`,
			options: choices
		});
	}
	return {
		type: MessageComponentTypes.ActionRow,
		components: components as [ ButtonComponent ]
	};
}

function buildPageSwitcher(location: SettingsLocation, category: SettingsCategory): ActionRow {
	const currentIndex = SettingsCategories.findIndex(c => c.name === category.name);

	const components: [ ButtonComponent, ButtonComponent, ButtonComponent ] = [
		{
			type: MessageComponentTypes.Button,
			style: ButtonStyles.Secondary, emoji: { name: "◀️" },
			customId: `settings:page:${location}:${categoryKey(category)}:-1`,
			disabled: currentIndex - 1 < 0
		},

		{
			type: MessageComponentTypes.Button,
			label: category.name,
			style: ButtonStyles.Success,
			emoji: typeof category.emoji === "string" ? { name: category.emoji } : category.emoji,
			customId: `settings:current:${location}:${categoryKey(category)}`
		},

		{
			type: MessageComponentTypes.Button,
			style: ButtonStyles.Secondary, emoji: { name: "▶️" },
			customId: `settings:page:${location}:${categoryKey(category)}:1`,
			disabled: currentIndex + 1 > SettingsCategories.length - 1
		}
	];

	return {
		type: MessageComponentTypes.ActionRow,
		components
	};
}