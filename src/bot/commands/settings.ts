import { SettingsCategories, buildSettingsPage } from "../settings.js";
import { SettingsLocation } from "../types/settings.js";
import { ResponseError } from "../errors/response.js";
import { createCommand } from "../helpers/command.js";

export default createCommand({
	name: "settings",

	sub: {
		me: {
			description: "Customize the bot for yourself"
		},

		server: {
			description: "Customize the bot for the entire server"
		}
	},

	handler: async ({ bot, interaction, sub, env }) => {
		const location = sub === "me" ? SettingsLocation.User : SettingsLocation.Guild;

		if (location === SettingsLocation.Guild && !env.guild) throw new ResponseError({
			message: "You can only view & change these settings on **servers**", emoji: "😔"
		});

		const permissions = interaction.member?.permissions;

		if (location === SettingsLocation.Guild && permissions && !permissions.has("MANAGE_GUILD")) throw new ResponseError({
			message: "You must have the `Manage Server` permission to view & change these settings", emoji: "😔"
		});

		return buildSettingsPage(
			bot, location, SettingsCategories[0], env
		);
	}
});