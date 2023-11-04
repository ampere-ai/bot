export interface UserLocale {
	/** Name of the language */
	name: string;

	/** Name to pass to the AI model, when translating */
	modelName?: string;

	/** Emoji of the language, e.g. the country's flag */
	emoji: string;

	/** Whether this language is supported by Discord */
	supported?: boolean;

	/** ISO code of the language */
	id: string;
}

export const USER_LOCALES: UserLocale[] = [
	/* Actual languages */
	{ name: "English", id: "en-US", emoji: "🇬🇧", supported: true },
	{ name: "Spanish", id: "es-ES", emoji: "🇪🇸", supported: true },
	{ name: "French", id: "fr", emoji: "🇫🇷", supported: true },
	{ name: "German", id: "de", emoji: "🇩🇪", supported: true },
	{ name: "Brazilian Portuguese", id: "pt-BR", emoji: "🇧🇷", supported: true },
	{ name: "Italian", id: "it", emoji: "🇮🇹", supported: true },
	{ name: "Polish", id: "pl", emoji: "🇵🇱", supported: true },
	{ name: "Russian", id: "ru", emoji: "🇷🇺", supported: true },
	{ name: "Bulgarian", id: "bg", emoji: "🇧🇬", supported: true },
	{ name: "Czech", id: "cs", emoji: "🇨🇿", supported: true },
	{ name: "Japanese", id: "ja", emoji: "🇯🇵", supported: true },
	{ name: "Chinese", id: "zh-CN", emoji: "🇨🇳", supported: true },
	{ name: "Vietnamese", id: "vi", emoji: "🇻🇳", supported: true },
	{ name: "Persian", id: "ir", emoji: "🇮🇷", },

	/* Fun languages */
	{ name: "Pirate", modelName: "Heavy English pirate speak", id: "pirate", emoji: "🏴‍☠️" }
];