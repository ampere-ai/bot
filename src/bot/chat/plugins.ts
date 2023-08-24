import type { ChatPlugin } from "../types/plugin.js";

export const CHAT_PLUGINS: ChatPlugin[] = [
	{
		name: "Google", emoji: { name: "google", id: 1102619904185733272n },
		description: "Searches Google to get up-to-date information from internet.",
		id: "google"
	},
	
	{
		name: "Weather", emoji: { name: "⛅" },
		description: "View current weather information for a specific location.",
		id: "weather"
	},

	{
		name: "Wikipedia", emoji: { name: "wikipedia", id: 1118608403086966844n },
		description: "Search on Wikipedia for information on various topics.",
		id: "wikipedia"
	},

	{
		name: "Tenor", emoji: { name: "tenor", id: 1118631079859986452n },
		description: "Search for GIFs on Tenor.",
		id: "tenor"
	},

	{
		name: "FreeToGame", emoji: { name: "freetogame", id: 1118612404373311498n },
		description: "Browse for free games from different platforms or categories.",
		id: "free-games"
	},

	{
		name: "Tasty", emoji: { name: "🍝" },
		description: "Get tasty recipes from tasty.co.",
		id: "tasty"
	},

	{
		name: "World News", emoji: { name: "🌎" },
		description: "Search for current news around the world.",
		id: "world-news"
	},

	{
		name: "Calculator", emoji: { name: "calculator", id: 1118900577653510164n },
		description: "Calculate something using MathJS.",
		id: "calculator"
	},

	{
		name: "GitHub", emoji: { name: "github", id: 1097828013871222865n },
		description: "Search for users & projects on GitHub.",
		id: "github"
	},

	{
		name: "Code Interpreter", emoji: { name: "📡" },
		description: "Execute code in a sandbox using WandBox.",
		id: "code-interpreter"
	},

	{
		name: "Diagrams", emoji: { name: "📊" },
		description: "Display beautiful charts, diagrams & mindmaps.",
		id: "render-diagrams"
	}
];