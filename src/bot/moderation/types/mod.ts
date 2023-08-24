import type { Bot } from "@discordeno/bot";

import type { DBEnvironment } from "../../../db/types/mod.js";
import type { ModerationFilterAction } from "./filter.js";

export enum ModerationSource {
	ChatFromUser = "chatUser",
	ChatFromBot = "chatBot",
	ImagePrompt = "image"
}

export interface ModerationOptions {
	bot: Bot;
	env: DBEnvironment;
	source: ModerationSource;
	content: string;
}

export interface ModerationResult {
    /* Whether the message was flagged */
    flagged: boolean;

    /* Whether the message should be completely blocked */
    blocked: boolean;

    /* Auto moderation filter result */
    auto: ModerationFilterAction | null;

    /* Source of the moderation request */
    source: ModerationSource;
}

export interface ModerationNoticeOptions {
	result: ModerationResult;
}