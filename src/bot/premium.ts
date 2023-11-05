import { type Embed, type Bot, type Interaction, type ButtonComponent, ButtonStyles, MessageComponentTypes } from "@discordeno/bot";
import { bold } from "colorette";

import type { DBPlan, PlanExpense } from "../db/types/premium.js";
import type { DBEnvironment } from "../db/types/mod.js";
import type { PaymentData } from "./types/premium.js";
import type { DBGuild } from "../db/types/guild.js";

import { EmbedColor, type MessageResponse } from "./utils/response.js";
import { DBRole, type DBUser } from "../db/types/user.js";
import { ResponseError } from "./errors/response.js";
import { titleCase } from "./utils/helpers.js";
import { displayBar } from "./utils/bar.js";
import { t } from "./i18n.js";

/** Default fee for the pay-as-you-go plan, in % */
const PAYG_FEE = 0.2;

async function handlePayment(bot: Bot, data: PaymentData) {
	try {
		/* Get the DM channel with the user. */
		const channel = await bot.helpers.getDmChannel(data.userId);

		/* Fetch the guild that Premium was purchased for, if applicable. */
		const guild = data.guildId
			? await bot.helpers.getGuild(data.guildId)
			: null;

		await channel.send({
			embeds: {
				title: t({ key: "premium.dm.title", options: { type: data.type === "subscription" ? "Premium" : "Premium credits" } }),
				description: `You ${data.extended ? "extended" : "purchased"} ${data.type === "subscription" ? "a Premium subscription" : `**${data.credits}$** worth of credits`} ${data.location === "user" ? "for yourself" : `for the server **${guild?.name}**`}.`,
				color: EmbedColor.Orange
			}
		});

	} catch (error) {
		bot.logger.warn(`Couldn't DM user ${bold(data.userId)} about Premium upgrade ->`, error);
	}
}

export function setupPaymentHandler(bot: Bot) {
	bot.rabbitmq.createConsumer({
		queue: "payment"
	}, async message => {
		await handlePayment(bot, message.body);
	});
}

export function buildPremiumOverview(bot: Bot, interaction: Interaction, { user, guild }: DBEnvironment) {
	/* Current subscription & plan */
	const subscriptions = {
		user: user.subscription, guild: guild ? guild.subscription : null
	};

	const plans = {
		user: user.plan, guild: guild ? guild.plan : null
	};

	/* Subscription type of the user */
	const type = bot.db.premium({ user, guild });

	/* The user's permissions */
	const permissions = interaction.member?.permissions;

	const embed: Embed = {
		color: EmbedColor.Orange
	};

	const buttons: ButtonComponent[] = [
		{
			type: MessageComponentTypes.Button,
			label: "premium.buttons.purchase", emoji: { name: "💸" },
			customId: "premium:purchase",
			style: ButtonStyles.Success
		}
	];

	const response: Omit<MessageResponse, "embeds"> & { embeds: Embed[] } = {
		ephemeral: true, embeds: []
	};

	if (type !== null) {
		if (type.type === "plan") {
			if (type.location === "guild") {
				if (permissions && !permissions.has("MANAGE_GUILD")) throw new ResponseError({
					message: "premium.errors.missing_permissions", emoji: "😔"
				});
			}

			/* The user's (or guild's) plan */
			const plan = plans[type.location]!;

			/* Previous plan expenses */
			const expenses = plan.expenses.filter(e => e.type !== "api").slice(-10);

			if (expenses.length > 0) response.embeds.push({
				title: "premium.overview.expenses",

				fields: expenses.map(expense => {
					return {
						name: `${titleCase(expense.type)} — **$${Math.round(expense.used * Math.pow(10, 5)) / Math.pow(10, 5)}**`,
						value: `*<t:${Math.floor(expense.time / 1000)}:F>*`
					};
				})
			});

			/* Previous plan purchase history */
			const history = plan.history.slice(-10);

			if (history.length > 0) response.embeds.push({
				title: "premium.overview.charges",

				fields: history.map(credit => ({
					name: `${titleCase(credit.type)}${credit.gateway ? `— *${t({ key: "premium.overview.using_gateway", options: { gateway: credit.gateway } })}*` : ""}`,
					value: `**$${credit.amount.toFixed(2)}** — *<t:${Math.floor(credit.time / 1000)}:F>*`
				}))
			});

			const percentage = plan.used / plan.total;
			const size = 25;
			
			/* Whether the user has exceeded the limit */
			const exceededLimit = plan.used >= plan.total;

			/* Final, formatted diplay message */
			const displayMessage = !exceededLimit
				? `**$${plan.used.toFixed(2)}** \`${displayBar({ percentage, total: size })}\` **$${plan.total.toFixed(2)}**`
				: "premium.overview.out_of_credits";

			embed.title = `premium.overview.title.payg.${type.location}`;
			embed.description = displayMessage;

		} else if (type.type === "subscription") {
			const subscription = subscriptions[type.location];
			embed.title = `premium.overview.title.sub.${type.location}`;

			if (subscription === null && user.roles.includes(DBRole.Moderator)) {
				embed.description = "premium.overview.moderator";	
			}

			if (subscription) embed.fields = [
				{
					name: "premium.sub.since", inline: true,
					value: `<t:${Math.floor(subscription.since / 1000)}:F>`,
				},

				{
					name: "premium.sub.until", inline: true,
					value: `<t:${Math.floor(subscription.expires / 1000)}:F>, <t:${Math.floor(subscription.expires / 1000)}:R>`,
				}
			];
		}

		buttons.push({
			type: MessageComponentTypes.Button,
			label: "settings.button", emoji: { name: "⚙️" },
			customId: `settings:view:${type.location}:premium`,
			style: ButtonStyles.Secondary
		});

	} else {
		embed.description = "premium.messages.purchase";
	}

	response.components = [
		{
			type: MessageComponentTypes.ActionRow,
			components: buttons as [ ButtonComponent ]
		}
	];

	response.embeds.push(embed);
	return response;
}

export async function charge<T extends PlanExpense>(
	bot: Bot, env: DBEnvironment, { type, used, data, bonus }: Pick<T, "type" | "used" | "data"> & { bonus?: number }
): Promise<T | null> {
	if (used === 0) return null;

	const premium = bot.db.premium(env);
	if (!premium || premium.type !== "plan") return null;

	/* Which entry gets charged for this expense, guild or user */
	const entry = env[premium.location]!;
	if (!isPlanRunning(entry)) return null;
	
	/* The new expense */
	const expense: T = {
		type, used, data,
		time: Date.now()
	} as T;

	const updatedUsage = entry.plan.used + used * ((bonus ?? PAYG_FEE) + 1);

	await bot.db.update(location(entry), entry, {
		plan: {
			...entry.plan,

			expenses: [ ...entry.plan.expenses, expense ],
			used: updatedUsage
		}
	});

	return expense;
}

function isPlanRunning(entry: DBGuild | DBUser): entry is DBGuild & { plan: DBPlan } | DBUser & { plan: DBPlan } {
	return entry.plan !== null && entry.plan.total > entry.plan.used;
}

function location(entry: DBGuild | DBUser) {
	return (entry as DBUser).voted !== undefined ? "users" : "guilds";
}