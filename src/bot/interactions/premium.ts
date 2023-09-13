import { ButtonStyles, MessageComponentTypes } from "@discordeno/bot";

import { createInteractionHandler } from "../helpers/interaction.js";
import { EmbedColor } from "../utils/response.js";
import { SUPPORT_INVITE } from "../../config.js";

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

	handler: async ({ bot, interaction, args }) => {
		const action = args.shift()!;

		if (action === "purchase") {
			const step: PremiumPurchaseStep = args[0] ? parseInt(args.shift()!) : PremiumPurchaseStep.ChooseType;

			if (step === PremiumPurchaseStep.ChooseType) {
				return {
					embeds: {
						title: "Purchase Premium ✨",
						description: "*Select which kind of Premium suits you best.*",

						color: EmbedColor.Orange,

						fields: [
							{
								name: "What's the Premium subscription?",
								value: "A **Premium subscription** allows you to use the bot with a way lower cool-down for all features, higher response limits (although not unlimited) & exclusive features. This should be the best plan for most users."
							},

							{
								name: "What's the Premium plan with credits?",
								value: "The **Premium plan** is meant for power users and allows you to configure the **length limits** all by yourself. This comes at the cost of paying per request, instead of a monthly payment."
							}
						]
					},

					components: [ {
						type: MessageComponentTypes.ActionRow,
	
						components: [
							{
								type: MessageComponentTypes.Button,
								label: "Subscription", emoji: { name: "💸" },
								customId: `premium:purchase:${PremiumPurchaseStep.ChooseLocation}:subscription`,
								style: ButtonStyles.Secondary
							},

							{
								type: MessageComponentTypes.Button,
								label: "Credits", emoji: { name: "📊" },
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
						title: "How much credit do you want to charge up? 💰",
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
						title: "Do you want Premium for yourself or this server? 🫂",
						color: EmbedColor.Orange
					},

					components: [ {
						type: MessageComponentTypes.ActionRow,
	
						components: [
							{
								type: MessageComponentTypes.Button,
								label: "For myself", emoji: { name: "👤" },
								customId: `premium:purchase:${PremiumPurchaseStep.Done}:${type}:${credits}:user`,
								style: ButtonStyles.Secondary
							},

							{
								type: MessageComponentTypes.Button,
								label: "For the server", emoji: { name: "🤝" },
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
						title: "Great choice! 👏",
						description: "You may now finish the purchase in your browser. Once done, you'll receive a DM from the bot.",
						color: EmbedColor.Orange,

						fields: [
							{
								name: "Did something go wrong with your Premium purchase?",
								value: `If so, we would be glad to help you out on our **[support server](https://${SUPPORT_INVITE})**.`
							}
						],

						footer: {
							text: id
						}
					},

					components: [ {
						type: MessageComponentTypes.ActionRow,
	
						components: [
							{
								type: MessageComponentTypes.Button,
								label: "Continue in your browser",
								url, style: ButtonStyles.Link
							}
						]
					} ],
					
					ephemeral: true
				});
			}

		} else if (action === "ads") {
			const perks = [
				"Way lower cool-down for chatting & commands",
				"Bigger character limit for chatting",
				"Early access to new features",
				"More to come in the future..."
			];

			return {
				components: [ {
					type: MessageComponentTypes.ActionRow,

					components: [
						{
							type: MessageComponentTypes.Button,
							label: "Purchase", emoji: { name: "💸" },
							customId: "premium:purchase",
							style: ButtonStyles.Success
						},

						{
							type: MessageComponentTypes.Button,
							style: ButtonStyles.Link,
							label: "Vote",
							url: `https://top.gg/bot/${bot.id}`
						}
					]
				} ],

				embeds: [
					{
						title: "Want to get rid of annoying ads? ✨",
						description: `**Premium** gets rid of all ads in the bot & also gives you additional benefits, such as\n\n${perks.map(p => `- ${p}`).join("\n")}`,
						color: EmbedColor.Orange
					},

					{
						title: "Voting for the bot <:topgg:1151514119749521468>",
						description: "You can also **vote** for the bot on **top.gg** <:topgg:1151514119749521468>, to reduce the frequency of ads in the bot.",
						color: 0xff3366
					},
				],

				ephemeral: true
			};
		}
	}
});