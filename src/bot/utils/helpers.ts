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