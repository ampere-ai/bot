import { type Bot, type DiscordEmbedField, type Embed, type User, type Guild, ActionRow, ButtonComponent, ButtonStyles, MessageComponentTypes, avatarUrl, guildIconUrl } from "@discordeno/bot";

import type { DBGuild } from "../../db/types/guild.js";
import type { DBUser } from "../../db/types/user.js";

import { type ModerationOptions, type ModerationResult, SourceToEmoji, SourceToName } from "./types/mod.js";
import { type DBInfraction, InfractionTypeToEmoji } from "../../db/types/moderation.js";
import { type MessageResponse, EmbedColor } from "../utils/response.js";
import { InteractionHandlerOptions } from "../types/interaction.js";
import { titleCase, truncate } from "../utils/helpers.js";
import { banEntry, isBanned, warnEntry } from "./mod.js";
import { MODERATION_FILTERS } from "./filters.js";
import { BRANDING_COLOR } from "../../config.js";
import { QUICK_ACTIONS } from "./types/quick.js";

interface ModerationTarget {
	/** Type of the target */
	type: "guild" | "user";

	/** Name of the target */
	name: string;

	/** Icon of the target */
	icon?: string;

	/** ID of the target */
	id: bigint;
}

export async function buildModerationLogs(options: ModerationOptions, result: ModerationResult): Promise<MessageResponse> {
	const user = toModerationTarget(options.user);

	const fields: DiscordEmbedField[] = [];

	if (result.auto) fields.push(
		{ name: "Filter 🚩", value: `\`${result.auto!.reason}\``, inline: true },
		{ name: "Action ⚠️", value: `\`${result.auto!.type}\``, inline: true }
	);

	if (!result.auto) fields.push({
		name: "Blocked ⛔", value: result.blocked ? "✅" : "❌", inline: true
	});

	const embed: Embed = {
		title: `${SourceToName[options.source]} ${SourceToEmoji[options.source]}`,
		description: `\`\`\`${options.content}\`\`\``,
		author: { name: `${user.name} [${user.id}]`, iconUrl: user.icon },
		color: EmbedColor.Yellow, fields
	};
	
	return {
		components: buildModerationToolbar("user", options.env.user, "flag"),
		embeds: embed
	};
}

export async function handleModerationInteraction({ bot, interaction, args }: InteractionHandlerOptions): Promise<MessageResponse | void> {
	const action = args.shift()! as "view" | "warn" | "ban" | "unban";
	const location = args.shift()! as "user" | "guild";

	const id = BigInt(args.shift()!);
	let db = await bot.db.fetch<DBUser | DBGuild>(`${location}s`, id);

	const discordEntry = location === "guild"
		? await bot.helpers.getGuild(id)
		: await bot.helpers.getUser(id);

	if (action === "view") {
		return buildModerationOverview(bot, location, discordEntry);

	} else {
		/* The user selected an option from the list */
		if (interaction.data?.componentType === MessageComponentTypes.SelectMenu) {
			const quick = QUICK_ACTIONS.find(q => q.reason === interaction.data!.values![0])!;
			const messageId = args[0] ? BigInt(args[0]) : null;

			const original = messageId ? await bot.helpers.getMessage(interaction.channelId!, messageId)
				.catch(() => null) : null;

			if (action === "ban" || action === "unban") {
				db = await banEntry(bot, db, {
					by: interaction.user.id.toString(),
					reason: quick.reason,
					duration: quick.duration?.asMilliseconds(),
					status: action === "ban"
				});
			} else {
				db = await warnEntry(bot, db, {
					by: interaction.user.id.toString(),
					reason: quick.reason
				});
			}

			const infraction = db.infractions[db.infractions.length - 1];

			const embed: Embed = {
				title: `${action === "warn" ? "Warning given" : action === "unban" ? "Ban revoked" : "Banned"} ${InfractionTypeToEmoji[action]}`,
				author: { name: interaction.user.username, iconUrl: avatarUrl(interaction.user.id, interaction.user.discriminator, { avatar: interaction.user.avatar, format: "png" }) },
				fields: buildInfractionInfo(infraction).fields,
				color: EmbedColor.Yellow
			};

			if (original) original.edit({
				embeds: [ ...original?.embeds ?? [], embed ], components: []
			});

			await interaction.update({
				embeds: embed, components: []
			});

		/** The user pressed either the `Ban` or `Warning` button */
		} else {
			/* Where this action originated from */
			const type = args.shift()!;

			const row: ActionRow = {
				type: MessageComponentTypes.ActionRow,

				components: [ {
					type: MessageComponentTypes.SelectMenu,
					customId: `mod:${action}:${location}:${id}${type === "flag" && interaction.message ? `:${interaction.message.id}` : ""}`,
					placeholder: `Select ${action === "unban" ? "an" : "a"} ${action === "warn" ? "warning" : action === "unban" ? "un-ban" : "ban"} reason ${InfractionTypeToEmoji[action]}`,
	
					options: QUICK_ACTIONS
						.filter(q => q.action ? q.action === action : true)
						.filter(q => action === "unban" ? q.action === "unban" : true)
						.map(q => ({
							label: q.reason,
							emoji: { name: InfractionTypeToEmoji[action] },
							description: q.duration && action === "ban" ? q.duration.humanize() : undefined,
							value: q.reason
						}))
				} ]
			};

			return {
				components: [ row ],
				ephemeral: true
			};
		}
	}
}

export function buildModerationToolbar(
	location: "user" | "guild", entry: DBUser | DBGuild, type: "flag" | "overview"
): ActionRow[] {
	function buildButton({ label, emoji, action }: {
		label: string; emoji: string; action: string;
	}): ButtonComponent {
		return {
			type: MessageComponentTypes.Button,
			style: ButtonStyles.Secondary,
			label: type === "overview" ? label : undefined,
			customId: `mod:${action}:${location}:${entry.id}:${type}`,
			emoji: { name: emoji }
		};
	}

	const buttons = [
		buildButton({ label: "Warning", emoji: "✉️", action: "warn" })
	];

	if (isBanned(entry)) buttons.push(buildButton({ label: "Pardon", emoji: "🙌", action: "unban" }));
	else buttons.push(buildButton({ label: "Ban", emoji: "🔨", action: "ban" }));

	if (type === "flag") buttons.push(
		buildButton({ label: "Overview", emoji: "🔎", action: "view" })
	);

	return [ {
		type: MessageComponentTypes.ActionRow,
		components: buttons as [ ButtonComponent ]
	} ];
}

export async function buildModerationOverview(bot: Bot, location: "user" | "guild", entry: Guild | User): Promise<MessageResponse> {
	const target = toModerationTarget(entry);
	const db = await bot.db.fetch<DBGuild | DBUser>(`${target.type}s`, target.id);

	const fields: DiscordEmbedField[] = [ {
		name: "mod.info.first_interaction 🙌",
		value: `<t:${Math.floor(Date.parse(db.created) / 1000)}:f>` 
	} ];

	if (target.type === "user") {
		const user = db as DBUser;

		fields.push(
			{ name: "mod.info.roles ⚒️", value: [ ...user.roles, "*User*" ].map(role => `**${titleCase(role)}**`).join(", ") },
			{ name: "mod.info.voted 📩", value: user.voted ? `<t:${Math.round(Date.parse(user.voted) / 1000)}:R>` : "❌" },
		);
	} else {
		const guild = entry as Guild;

		if (guild.description) fields.push({
			name: "mod.info.desc 🗒️", value: guild.description
		});

		if (guild.approximateMemberCount) fields.push({
			name: "mod.info.members 🫂", value: guild.approximateMemberCount.toString()
		});

		if (guild.vanityUrlCode) fields.push({
			name: "mod.info.invite 📨", value: `[.gg/${guild.vanityUrlCode}](https://discord.gg/${guild.vanityUrlCode})`
		});
	}

	const embeds: Embed[] = [
		{
			author: { name: target.name, iconUrl: target.icon },
			color: BRANDING_COLOR,
			
			fields: fields.map(f => ({ ...f, inline: true }))
		}
	];

	/* Previous automated moderation flags for the user */
	const flags = db.infractions
		.filter(i => i.type === "moderation" && i.moderation && i.reference && typeof i.reference === "object" && i.reference.data)
		.slice(-25);

	if (flags.length > 0) embeds.push({
		title: "mod.info.flags 👀", color: EmbedColor.Orange,

		fields: flags.sort((a, b) => b.when - a.when).map(flag => {
			const action = flag.moderation!.auto
				? MODERATION_FILTERS.find(filter => filter.name === flag.moderation!.auto!.filter)
				: null;

			return {
				name: `· ${flag.reason ?? action?.name ?? ""} ${SourceToEmoji[flag.moderation!.source]}`,
				value: `\`${truncate(flag.reference!.data, 100)}\` · <t:${Math.floor(flag.when / 1000)}:f>`,
				inline: true
			};
		})
	});

	const warnings = db.infractions
		.filter(i => i.type === "warn" && i.reason).slice(-25);

	if (warnings.length > 0) embeds.push({
		title: "mod.info.warns ⚠️", color: EmbedColor.Yellow,

		fields: warnings.sort((a, b) => b.when - a.when).map(w => ({
			name: `· ${w.reason!}${!w.by ? " 🤖" : ""}`, inline: true,
			value: `${w.by ? `<@${w.by}> · ` : ""}<t:${Math.floor(w.when / 1000)}:f>`
		}))
	});

	const banned = isBanned(db);

	if (banned) embeds.push({
		title: "mod.info.ban 🔨", color: EmbedColor.Red,
		fields: buildInfractionInfo(banned, [ "by" ]).fields
	});

	return {
		components: buildModerationToolbar(location, db, "overview"),
		ephemeral: true, embeds
	};
}

export function buildInfractionInfo(infraction: DBInfraction, display: "by"[] = []): Embed {
	const fields: DiscordEmbedField[] = [];

	if (infraction.reason) fields.push({
		name: "mod.infraction.reason", value: infraction.reason, inline: true
	});

	if (infraction.by && display.includes("by")) fields.push({
		name: "mod.infraction.by", value: `<@${infraction.by}>`, inline: true
	});

	if (infraction.until) {
		const until = Math.floor(infraction.until / 1000);

		fields.push({
			name: "mod.infraction.until", value: `<t:${until}:f>, <t:${until}:R>`, inline: true
		});
	}

	return {
		color: EmbedColor.Red, fields
	};
}

export function toModerationTarget(entry: Guild | User): ModerationTarget {
	if (isUser(entry)) {
		return {
			type: "user", name: entry.username, id: entry.id,
			icon: avatarUrl(entry.id, entry.discriminator, { avatar: entry.avatar, format: "png" })
		};

	} else {
		return {
			type: "guild", name: entry.name, id: entry.id,
			icon: guildIconUrl(entry.id, entry.icon, { format: "png" })
		};
	}
}

function isUser(entry: Guild | User): entry is User {
	return (entry as User).username != undefined;
}