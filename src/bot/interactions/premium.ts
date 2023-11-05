import { ButtonStyles, MessageComponentTypes } from "@discordeno/bot";

import { createInteractionHandler } from "../helpers/interaction.js";
import { EmbedColor } from "../utils/response.js";
import { SUPPORT_INVITE } from "../../config.js";
import { t } from "../i18n.js";

enum PremiumPurchaseStep {
	/** The user chooses whether they want a Premium subscription or plan */
	ChooseType,

	/** The user chooses how much credit they want, if they selected plan */
	ChooseCredits,

	/** The user choose whether they want it for themselves or the server */
	ChooseLocation,

	/** The user has completed all steps */
	Done
}

/* Which credit options to display */
const PREMIUM_CREDITS = [
	2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100
];

export default createInteractionHandler({
	name: "premium",

	handler: async ({ bot, interaction, env, args }) => {
		const action = args.shift()!;

		if (action === "purchase") {
			const step: PremiumPurchaseStep = args[0] ? parseInt(args.shift()!) : PremiumPurchaseStep.ChooseType;

			if (step === PremiumPurchaseStep.ChooseType) {
				return {
					embeds: {
						title: "premium.buy.title ✨",
						description: "premium.buy.desc",

						color: EmbedColor.Orange,

						fields: [
							{
								name: "premium.buy.fields.0.name",
								value: "premium.buy.fields.0.value"
							},

							{
								name: "premium.buy.fields.1.name",
								value: "premium.buy.fields.1.value"
							}
						]
					},

					components: [ {
						type: MessageComponentTypes.ActionRow,
	
						components: [
							{
								type: MessageComponentTypes.Button,
								label: "premium.types.sub", emoji: { name: "💸" },
								customId: `premium:purchase:${PremiumPurchaseStep.ChooseLocation}:subscription`,
								style: ButtonStyles.Secondary
							},

							{
								type: MessageComponentTypes.Button,
								label: "premium.types.payg", emoji: { name: "📊" },
								customId: `premium:purchase:${PremiumPurchaseStep.ChooseCredits}:plan`,
								style: ButtonStyles.Secondary
							}
						]
					} ],

					ephemeral: true
				};

			} else if (step === PremiumPurchaseStep.ChooseCredits) {
				interaction.update({
					embeds: {
						title: "premium.buy.messages.credit_amount 💰",
						color: EmbedColor.Orange
					},

					components: [ {
						type: MessageComponentTypes.ActionRow,
	
						components: [ {
							type: MessageComponentTypes.SelectMenu,
							customId: `premium:purchase:${PremiumPurchaseStep.ChooseLocation}:plan`,
							placeholder: "...",

							options: PREMIUM_CREDITS.map(credit => ({
								label: `${credit}$`, value: credit.toString()
							}))
						} ]
					} ],

					ephemeral: true
				});

			} else if (step === PremiumPurchaseStep.ChooseLocation) {
				/* Which Premium type was selected */
				const type = args[0];

				/* How much credit to charge up */
				const credits = interaction.data && interaction.data.values
					? parseInt(interaction.data.values[0]) : 0;

				await interaction.update({
					embeds: {
						title: "premium.buy.messages.type 🫂",
						color: EmbedColor.Orange
					},

					components: [ {
						type: MessageComponentTypes.ActionRow,
	
						components: [
							{
								type: MessageComponentTypes.Button,
								label: "premium.buy.type.user", emoji: { name: "👤" },
								customId: `premium:purchase:${PremiumPurchaseStep.Done}:${type}:${credits}:user`,
								style: ButtonStyles.Secondary
							},

							{
								type: MessageComponentTypes.Button,
								label: "premium.buy.type.server", emoji: { name: "🤝" },
								customId: `premium:purchase:${PremiumPurchaseStep.Done}:${type}:${credits}:guild`,
								style: ButtonStyles.Secondary
							}
						]
					} ],

					ephemeral: true
				});

			} else if (step === PremiumPurchaseStep.Done) {
				/* Which Premium type was selected */
				const type = args[0];

				/* How much credit to charge up, if applicable */
				const credits = parseInt(args[1]) || undefined;

				/* Location of the Premium subscription or plan */
				const location = args[2];

				/* Create the payment invoice using the API. */
				const { url, id } = await bot.api.other.pay({
					type, credits,
					guild: location === "guild" ? interaction.guildId?.toString() : undefined,
					user: {
						name: interaction.user.username,
						id: interaction.user.id.toString()
					}
				});

				await interaction.update({
					embeds: {
						title: "premium.buy.done.title 👏",
						description: "premium.buy.done.desc",
						color: EmbedColor.Orange,

						fields: [ {
							name: "premium.buy.done.field.name",
							value: { key: "premium.buy.done.field.value", data: { invite: SUPPORT_INVITE } }
						} ],

						footer: {
							text: id
						}
					},

					components: [ {
						type: MessageComponentTypes.ActionRow,
	
						components: [
							{
								type: MessageComponentTypes.Button,
								label: "premium.buy.done.continue",
								url, style: ButtonStyles.Link
							}
						]
					} ],
					
					ephemeral: true
				});
			}

		} else if (action === "ads") {
			const perks: string[] = [];

			for (let i = 0; i < 4; i++) {
				perks.push(t({ key: `premium.perks.${i}`, env }));
			}

			return {
				components: [ {
					type: MessageComponentTypes.ActionRow,

					components: [
						{
							type: MessageComponentTypes.Button,
							label: "premium.buttons.purchase", emoji: { name: "💸" },
							customId: "premium:purchase",
							style: ButtonStyles.Success
						},

						{
							type: MessageComponentTypes.Button,
							style: ButtonStyles.Link,
							label: "vote.button",
							url: `https://top.gg/bot/${bot.id}`
						}
					]
				} ],

				embeds: [
					{
						title: "premium.ads.title ✨",
						description: `${t({ key: "premium.ads.desc", env })}\n\n${perks.map(p => `- ${p}`).join("\n")}`,
						color: EmbedColor.Orange
					},

					{
						title: "vote.ad.title <:topgg:1151514119749521468>",
						description: { key: "vote.ad.desc", data: { emoji: "<:topgg:1151514119749521468>" } },
						color: 0xff3366
					},
				],

				ephemeral: true
			};
		}
	}
});