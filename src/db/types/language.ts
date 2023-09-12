export interface UserLanguage {
	/** Name of the language */
	name: string;

	/** Name to pass to the AI model, when translating */
	modelName?: string;

	/** Emoji of the language, e.g. the country's flag */
	emoji: string;

	/** ISO code of the language */
	id: string;
}

export const USER_LANGUAGES: UserLanguage[] = [
	{
		name: "English", id: "en-US", emoji: "🇬🇧"
	},

	{
		name: "Spanish", id: "es-ES", emoji: "🇪🇸"
	},

	{
		name: "Brazilian Portuguese", id: "pt-BR", emoji: "🇧🇷"
	},

	{
		name: "Portuguese", id: "pt-PT", emoji: "🇵🇹"
	},

	{
		name: "French", id: "fr-FR", emoji: "🇫🇷"
	},

	{
		name: "German", id: "de-DE", emoji: "🇩🇪"
	},

	{
		name: "Italian", id: "it-IT", emoji: "🇮🇹"
	},

	{
		name: "Polish", id: "pl", emoji: "🇵🇱"
	},

	{
		name: "Russian", id: "ru-RU", emoji: "🇷🇺"
	},

	{
		name: "Bulgarian", id: "bg", emoji: "🇧🇬"
	},

	{
		name: "Czech", id: "cs", emoji: "🇨🇿"
	},

	{
		name: "Japanese", id: "jp-JP", emoji: "🇯🇵"
	},

	{
		name: "Chinese", id: "zh-CN", emoji: "🇨🇳"
	},

	{
		name: "Vietnamese", id: "vn", emoji: "🇻🇳"
	},

	{
		name: "Persian", id: "ir", emoji: "🇮🇷",
	},

	{
		name: "Pirate", modelName: "Heavy English pirate speak", id: "pirate", emoji: "🏴‍☠️"
	}
];