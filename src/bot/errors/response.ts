import type { DBEnvironment } from "../../db/types/mod.js";
import { t, type ToLocaleStrings } from "../i18n.js";

import { type MessageResponse, EmbedColor } from "../utils/response.js";

type ResponseErrorOptions = ToLocaleStrings<{
	/** Which message to display */
	message: string;

	/** Which emoji to use */
	emoji?: string;

	/** Which embed color to use */
	color?: EmbedColor;
}>

export class ResponseError extends Error {
	public readonly options: Required<ResponseErrorOptions>;

	constructor(options: ResponseErrorOptions) {
		super("");

		this.options = {
			color: EmbedColor.Red, emoji: "❌",
			...options
		};
	}

	public display(env?: DBEnvironment): MessageResponse {
		return {
			embeds: {
				description: `${t({ key: this.options.message })} ${this.options.emoji}`,
				color: this.options.color
			},

			ephemeral: true, env
		};
	}
}