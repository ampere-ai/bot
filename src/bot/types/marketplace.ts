import { type Bot, type ComponentEmoji, TextStyles } from "@discordeno/bot";
import type { DBMarketplaceEntry, DBMarketplaceType } from "../../db/types/marketplace.js";

export interface MarketplaceFilterOptions {
	type: "browse" | "create";
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

	/** Minimum & maximum length of this field */
	minLength?: number;
	maxLength?: number;

	/** Validator of this field */
	validate?: (input: string) => MarketplaceCreatorError | null;

	/** Marketplace entry -> field converter */
	parse: (entry: DBMarketplaceEntry) => string | null;
}

export const MARKETPLACE_BASE_FIELDS: Record<string, MarketplaceCreatorField> = {
	name: {
		name: "Name",
		minLength: 1, maxLength: 32,
		style: TextStyles.Short,
		parse: entry => entry.name
	},

	emoji: {
		name: "Fitting emoji",
		minLength: 1, maxLength: 32,
		style: TextStyles.Short,
		placeholder: ":flushed:, flushed, 😳",
		parse: entry => entry.emoji.name
	},

	description: {
		name: "Description", optional: true,
		minLength: 1, maxLength: 100,
		style: TextStyles.Short,
		parse: entry => entry.description
	}
};

interface MarketplaceCreator<T extends Record<string, MarketplaceCreatorField>> {
	/** All fields that the user can specify for this type */
	fields: T;

	/** Fields -> marketplace entry data converter */
	create: (fields: Record<keyof T, string | null>, bot: Bot) => object;
}

export interface MarketplaceCategory<Fields extends Record<string, MarketplaceCreatorField> = Record<string, MarketplaceCreatorField>> {
	/** Which type this category corresponds to */
	type: DBMarketplaceType;

	/** Fitting emoji for this category */
	emoji: ComponentEmoji;

	/** Display name of the category */
	name?: string;

	/** Which settings key this category corresponds to */
	key: string;

	/** Information about how an entry for this category is created */
	creator?: MarketplaceCreator<Fields>;
}

function createCategory<
	Fields extends Record<string, MarketplaceCreatorField>
>(category: MarketplaceCategory<Fields>) {
	return category;
}
export const MARKETPLACE_CATEGORIES: MarketplaceCategory[]  = [
	createCategory({
		type: "personality", emoji: { name: "😊" }, key: "chat:personality",

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
		type: "style", emoji: { name: "🖌️" }, key: "image:style",

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
		type: "indicator", emoji: { name: "🔄" }, name: "loading indicator", key: "general:indicator"
	})
];