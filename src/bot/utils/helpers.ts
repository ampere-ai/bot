import type { ComponentEmoji } from "@discordeno/bot";
import EmojiMap from "emoji-name-map";

export function titleCase(content: string) {
	return content
		.split(" ")
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function truncate(content: string, length: number, suffix = "...") {
	return content.length > length
		? content.slice(0, length - suffix.length) + suffix
		: content;
}

export function chunk<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];

	for (let i = 0; i < arr.length; i += size) {
		const chunk = arr.slice(i, i + size);
		chunks.push(chunk);
	}

	return chunks;
}

export function emojiToString(emoji: ComponentEmoji) {
	if (!emoji.id) return emoji.name;
	return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
}

export function stringToEmoji(content: string): ComponentEmoji | null {
	const UNICODE_REGEXP = /\p{Emoji_Presentation}/gu;
	const DISCORD_REGEXP = /<(a)?:([a-zA-Z0-9_]+):([0-9]+)>/g;

	/* Regular Unicode emoji */
	if(UNICODE_REGEXP.test(emojiToUnicode(content))) {
		return {
			name: emojiToUnicode(content).match(UNICODE_REGEXP)![0]
		};
	}
  
	/* Custom Discord emoji, animated or static */
	if(DISCORD_REGEXP.test(content)) {
		/**
		 * matches[1] will be "a" for animated emojis, undefined for static
		 * matches[2] will be the emoji name
		 * matches[3] will be the emoji ID
		 */
		DISCORD_REGEXP.lastIndex = 0;
		const matches = DISCORD_REGEXP.exec(content)!;

		return {
			id: BigInt(matches[3]),
			name: matches[2],
			animated: !!matches[1]
		};
	}

	return null;
}

function emojiToUnicode(content: string) {
	return EmojiMap.get(content) ?? content;
}