import { Locales } from "@discordeno/types";

export interface UserLocale {
	/** Name of the language */
	name: string;

	/** Localized name of the language */
	localName?: string;

	/** Name to pass to the AI model, when translating */
	modelName?: string;

	/** Emoji of the language, e.g. the country's flag */
	emoji: string;

	/** Whether this language is supported by Discord */
	supported?: boolean;

	/** ISO code of the language */
	id: string;
}

export const DISCORD_LOCALE_MAP: Record<string, Locales> = {
	"en": Locales.EnglishUs,
	"es": Locales.Spanish
};

export const USER_LOCALES: UserLocale[] = [
	/* Actual languages */
	{ id: "en", name: "English", emoji: "🇬🇧", supported: true },
	{ id: "es", name: "Spanish", localName: "Español", emoji: "🇪🇸", supported: true },
	{ id: "fr", name: "French", localName: "Français", emoji: "🇫🇷", supported: true },
	{ id: "de", name: "German", localName: "Deutsch", emoji: "🇩🇪", supported: true },
	{ id: "pt-BR", name: "Brazilian Portuguese", localName: "Português (Brasil)", emoji: "🇧🇷", supported: true },
	{ id: "it", name: "Italian", localName: "Italiano", emoji: "🇮🇹", supported: true },
	{ id: "pl", name: "Polish", localName: "Polski", emoji: "🇵🇱", supported: true },
	{ id: "ru", name: "Russian", localName: "Русский", emoji: "🇷🇺", supported: true },
	{ id: "bg", name: "Bulgarian", localName: "Български", emoji: "🇧🇬", supported: true },
	{ id: "cs", name: "Czech", localName: "Čeština", emoji: "🇨🇿", supported: true },
	{ id: "ja", name: "Japanese", localName: "日本語", emoji: "🇯🇵", supported: true },
	{ id: "zh-CN", name: "Chinese", localName: "中文", emoji: "🇨🇳", supported: true },
	{ id: "vi", name: "Vietnamese", localName: "Tiếng Việt", emoji: "🇻🇳", supported: true },
	{ id: "ir", name: "Persian", localName: "فارسی", emoji: "🇮🇷" },
	{ id: "en@pirate", name: "Pirate", modelName: "Heavy English pirate speak", emoji: "🏴‍☠️" }
];