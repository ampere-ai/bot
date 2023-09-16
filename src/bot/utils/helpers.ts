import type { ComponentEmoji } from "@discordeno/bot";


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



export function emojiToString(emoji: ComponentEmoji) {
	if (!emoji.id) return emoji.name;
	return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
}