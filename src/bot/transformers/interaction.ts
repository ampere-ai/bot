import { type DiscordInteraction, type Interaction, type InteractionCallbackData, InteractionResponseTypes } from "@discordeno/bot";

import { type MessageResponse, transformResponse } from "../utils/response.js";
import { createTransformer } from "../helpers/transformer.js";
import { translateObject } from "../i18n.js";

export default createTransformer<"interaction", Interaction, DiscordInteraction>({
	name: "interaction",
	properties: null,

	handler: (bot, interaction) => {
		Object.defineProperty(interaction, "showModal", {
			value: function(response: Pick<MessageResponse, "components" | "env">) {
				return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
					type: InteractionResponseTypes.Modal,
					data: translateObject(response as InteractionCallbackData, response.env)
				});
			}
		});

		Object.defineProperty(interaction, "reply", {
			value: function(response: MessageResponse) {
				return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: transformResponse<InteractionCallbackData>(response)
				});
			}
		});

		Object.defineProperty(interaction, "editReply", {
			value: function(response: MessageResponse) {
				return bot.helpers.editOriginalInteractionResponse(interaction.token, transformResponse(response));
			}
		});

		Object.defineProperty(interaction, "update", {
			value: function(response: MessageResponse) {
				return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
					type: InteractionResponseTypes.UpdateMessage,
					data: transformResponse<InteractionCallbackData>(response)
				});
			}
		});

		Object.defineProperty(interaction, "deleteReply", {
			value: function() {
				return bot.helpers.deleteOriginalInteractionResponse(interaction.token);
			}
		});

		Object.defineProperty(interaction, "deferReply", {
			value: function(ephemeral?: boolean) {
				return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
					type: InteractionResponseTypes.DeferredChannelMessageWithSource,
					data: ephemeral ? {
						flags: 64
					} : undefined
				});
			}
		});

		Object.defineProperty(interaction, "deferUpdate", {
			value: function() {
				return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
					type: InteractionResponseTypes.DeferredUpdateMessage
				});
			}
		});
		
		return interaction;
	}
});