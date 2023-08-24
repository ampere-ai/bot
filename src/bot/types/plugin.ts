import type { ComponentEmoji } from "@discordeno/bot";

export interface ChatPlugin {
	/** Display name of the plugin */
	name: string;

	/** Emoji of the plugin */
	emoji: ComponentEmoji;

	/** Description of the plugin */
	description: string;

	/** Identifier of the plugin */
	id: string;
}

export type ToolResult = object & {
    image?: string;
}

export interface ToolData {
    name: string | null;
    input: object | null;
    result: ToolResult | null;
    error: object | null;
}