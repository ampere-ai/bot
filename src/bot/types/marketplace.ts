import { type Bot, type ComponentEmoji, TextStyles } from "@discordeno/bot";

import type { DBMarketplaceEntry, DBMarketplaceType } from "../../db/types/marketplace.js";
import type { LocaleString } from "../i18n.js";

import { emojiToString, stringToEmoji } from "../utils/helpers.js";

export interface MarketplaceFilterOptions {
	creator?: string;
	page: number;
}

export interface MarketplacePage {
	/** Entries of this page */
	entries: DBMarketplaceEntry[];

	/** How many pages there are in total */
	count: number;
}

interface MarketplaceCreatorError {
	message: string | LocaleString;
}

interface MarketplaceCreatorField {
	/** Placeholder of this field */
	placeholder?: string;

	/** Type of this field */
	style?: TextStyles;

	/** Whether this field is optional */
	optional?: boolean;

	/** Whether this is a built-in field & always present in the modal */
	builtIn?: boolean;

	/** Minimum & maximum length of this field */
	minLength?: number;
	maxLength?: number;

	/** Validator of this field */
	validate?: (input: string) => MarketplaceCreatorError | null | void;

	/** Marketplace entry -> field converter */
	parse: (entry: DBMarketplaceEntry) => string | null;
}

export const MARKETPLACE_BASE_FIELDS: Record<"name" | "emoji" | "description", MarketplaceCreatorField> = {
	name: {
		builtIn: true,
		minLength: 1, maxLength: 32,
		style: TextStyles.Short,
		parse: entry => entry.name
	},

	emoji: {
		builtIn: true,
		placeholder: ":flushed:, flushed, 😳",
		minLength: 1, maxLength: 64,
		style: TextStyles.Short,
		parse: entry => emojiToString(entry.emoji),

		validate: input => {
			if (!stringToEmoji(input)) return {
				message: "marketplace.errors.invalid_emoji"
			};
		}
	},

	description: {
		builtIn: true, optional: true,
		minLength: 1, maxLength: 256,
		style: TextStyles.Paragraph,
		parse: entry => entry.description,

		validate: input => {
			if (input.split("\n").length > 4) return {
				message: { key: "marketplace.errors.too_long", data: { length: 4 } }
			};
		}
	}
};

type FieldsWithRequiredProperty<T extends Record<string, MarketplaceCreatorField>> = {
	[K in keyof T]: T[K]["optional"] extends true
		? string | null : string;
};

interface MarketplaceCreator<Fields extends Record<string, MarketplaceCreatorField>> {
	fields: Fields;

	create: (
		fields: FieldsWithRequiredProperty<Fields> & FieldsWithRequiredProperty<typeof MARKETPLACE_BASE_FIELDS>,
		bot: Bot
	) => object;
}

export interface MarketplaceCategory<
	Fields extends Record<string, MarketplaceCreatorField> = Record<string, MarketplaceCreatorField>
> {
	type: DBMarketplaceType;
	emoji: ComponentEmoji;
	key: string;
	default: string;
	creator?: MarketplaceCreator<Fields>;
}

function createCategory<Fields extends Record<string, MarketplaceCreatorField>>(
	category: MarketplaceCategory<Fields>
) {
	return category;
}

export const MARKETPLACE_CATEGORIES = [
	createCategory({
		type: "personality", emoji: { name: "😊" },
		key: "chat:personality", default: "personality-neutral",

		creator: {
			fields: {
				prompt: {
					placeholder: "From now on, you must act as a ...",
					style: TextStyles.Paragraph, maxLength: 2048,
					parse: entry => entry.data.prompt
				},

				disableHistory: {
					style: TextStyles.Short, maxLength: 5,
					placeholder: "true / false",
					parse: entry => Boolean(entry.data.disableHistory).toString(),
					validate: input => {
						if (![ "true", "false" ].includes(input)) return {
							message: "marketplace.errors.invalid_bool"
						};
					}
				}
			},

			create: fields => ({
				prompt: fields.prompt,
				disableHistory: fields.disableHistory
			})
		}
	}),

	createCategory({
		type: "style", emoji: { name: "🖌️" },
		key: "image:style", default: "style-none",

		creator: {
			fields: {
				tags: {
					style: TextStyles.Paragraph,
					placeholder: "cinematic\nvignette\n4k rtx",
					parse: entry => entry.data.tags ? entry.data.tags.join("\n") : null
				}
			},

			create: fields => ({
				tags: fields.tags ? fields.tags.split("\n").map(tag => tag.trim()) : null
			})
		}
	}),

	createCategory({
		type: "indicator", emoji: { name: "🔄" },
		key: "general:indicator", default: "indicator-orb",

		creator: {
			fields: {},

			create: (fields, bot) => 
				bot.rest.changeToDiscordFormat(stringToEmoji(
					fields.emoji
				)!)
		}
	})
];