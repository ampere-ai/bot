import type { Bot, User } from "@discordeno/bot";

import type { DBEnvironment } from "../../../db/types/mod.js";
import type { ModerationFilterAction } from "./filter.js";

export enum ModerationSource {
	ChatFromUser = "chatUser",
	ChatFromBot = "chatBot",
	ImagePrompt = "image",
	TranslationPrompt = "translationPrompt"
}

export const SourceToEmoji: Record<ModerationSource, string> = {
	[ModerationSource.ChatFromUser]: "👤",
	[ModerationSource.ChatFromBot]: "🤖",
	[ModerationSource.ImagePrompt]: "🖼️",
	[ModerationSource.TranslationPrompt]: "🌐"
};

export const SourceToName: Record<ModerationSource, string> = {
	[ModerationSource.ChatFromUser]: "User message",
	[ModerationSource.ChatFromBot]: "Bot response",
	[ModerationSource.ImagePrompt]: "Image prompt",
	[ModerationSource.TranslationPrompt]: "Translation prompt"
};

export interface ModerationOptions {
	bot: Bot;
	user: User;
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
	env: DBEnvironment;
	result: ModerationResult;
	small?: boolean;
}