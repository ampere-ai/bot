import {
	MessageFlags, type ActionRow, type CreateMessageOptions, type EditMessage, type Embed, type InteractionCallbackData, type Message, AllowedMentions
} from "@discordeno/bot";

export interface MessageResponse {
    /** Content of the message */
    content?: string;

    /** Embeds of the message */
    embeds?: Embed | Embed[];

	/** Components of the message */
	components?: ActionRow[];

	/** Which file to upload */
	file?: {
		/** Name of the file */
		name: string;

		/** Base64-encoded data of the file */
		blob: string;
	};

    /** Whether the response should only be shown to the author */
    ephemeral?: boolean;

	/** Mention settings */
	mentions?: AllowedMentions;

    /** Message to reply to */
    reference?: Message;
}

export enum EmbedColor {
	White = 0xffffff,
	Aqua = 0x1abc9c,
	Green = 0x57f287,
	Blue = 0x3498db,
	Yellow = 0xfee75c,
	Purple = 0x9b59b6,
	LuminousVividPink = 0xe91e63,
	Fuchsia = 0xeb459e,
	Gold = 0xf1c40f,
	Orange = 0xe67e22,
	Red = 0xed4245,
	Grey = 0x95a5a6,
	Navy = 0x34495e,
	DarkAqua = 0x11806a,
	DarkGreen = 0x1f8b4c,
	DarkBlue = 0x206694,
	DarkPurple = 0x71368a,
	DarkVividPink = 0xad1457,
	DarkGold = 0xc27c0e,
	DarkOrange = 0xa84300,
	DarkRed = 0x992d22,
	DarkGrey = 0x979c9f,
	DarkerGrey = 0x7f8c8d,
	LightGrey = 0xbcc0c0,
	DarkNavy = 0x2c3e50,
	Blurple = 0x5865f2,
	Greyple = 0x99aab5,
	DarkButNotBlack = 0x2c2f33,
	NotQuiteBlack = 0x23272a
}

export function transformResponse<T extends (CreateMessageOptions | EditMessage | InteractionCallbackData) & {
    messageReference?: CreateMessageOptions["messageReference"];
    ephemeral?: boolean;
} = CreateMessageOptions>(
	response: MessageResponse
): T {
	return {
		content: response.content,

		embeds: response.embeds
			? Array.isArray(response.embeds)
				? response.embeds
				: [ response.embeds ]
			: undefined,

		flags: response.ephemeral ? MessageFlags.Ephemeral : undefined,
		components: response.components,
		
		files: response.file ? [
			{
				name: response.file.name,
				blob: new Blob([ Buffer.from(response.file.blob, "base64") ])
			}
		] : undefined,

		allowedMentions: response.mentions,

		messageReference: response.reference ? {
			failIfNotExists: false,
			channelId: response.reference.channelId.toString(),
			guildId: response.reference.guildId?.toString(),
			messageId: response.reference.id.toString()
		} : undefined
	} as T;
}