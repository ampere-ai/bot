import { type Bot, type ComponentEmoji, TextStyles } from "@discordeno/bot";

import type { DBMarketplaceEntry, DBMarketplaceType } from "../../db/types/marketplace.js";
import { emojiToString, emojiToUnicode, stringToEmoji } from "../utils/helpers.js";

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
	message: string;
}

interface MarketplaceCreatorField {
	/** Name of the field, displayed to the user */
	name: string;

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
		name: "Name", builtIn: true,
		minLength: 1, maxLength: 32,
		style: TextStyles.Short,
		parse: entry => entry.name
	},

	emoji: {
		name: "Fitting emoji", builtIn: true,
		minLength: 1, maxLength: 64,
		style: TextStyles.Short,
		placeholder: ":flushed:, flushed, 😳",
		parse: entry => emojiToString(entry.emoji),

		validate: input => {
			if (!stringToEmoji(emojiToUnicode(input))) return {
				message: "Invalid emoji"
			};
		}
	},

	description: {
		name: "Description",
		builtIn: true, optional: true,
		minLength: 1, maxLength: 100,
		style: TextStyles.Short,
		parse: entry => entry.description
	}
};

type FieldsWithRequiredProperty<T extends Record<string, MarketplaceCreatorField>> = {
	[K in keyof T]: T[K]["optional"] extends true
		? string | null : string;
};

interface MarketplaceCreator<Fields extends Record<string, MarketplaceCreatorField>> {
	fields: Fields;
	create: (fields: FieldsWithRequiredProperty<Fields> & FieldsWithRequiredProperty<typeof MARKETPLACE_BASE_FIELDS>, bot: Bot) => object;
}

export interface MarketplaceCategory<
	Fields extends Record<string, MarketplaceCreatorField> = Record<string, MarketplaceCreatorField>
> {
	type: DBMarketplaceType;
	emoji: ComponentEmoji;
	name?: string;
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
					name: "Initial prompt, given to the AI model",
					placeholder: "From now on, you must act as a ...",
					parse: entry => entry.data.prompt
				}
			},

			create: fields => ({
				prompt: fields.prompt
			})
		}
	}),

	createCategory({
		type: "style", emoji: { name: "🖌️" },
		key: "image:style", default: "style-none",

		creator: {
			fields: {
				tags: {
					name: "List of tags, separated by newline",
					placeholder: "cinematic\nvignette\n4k rtx",
					style: TextStyles.Paragraph,
					parse: entry => entry.data.tags ? entry.data.tags.join("\n") : null
				}
			},

			create: fields => ({
				tags: fields.tags ? fields.tags.split("\n").map(tag => tag.trim()) : null
			})
		}
	}),

	createCategory({
		type: "indicator", emoji: { name: "🔄" }, name: "loading indicator",
		key: "general:indicator", default: "indicator-orb",

		creator: {
			fields: {},

			create: (fields, bot) => 
				bot.rest.changeToDiscordFormat(stringToEmoji(emojiToUnicode(
					fields.emoji
				)!)!)
		}
	})
];