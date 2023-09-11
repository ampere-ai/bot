import type { ModerationResult, ModerationSource } from "../../bot/moderation/types/mod.js";

export type DBInfractionType = "ban" | "unban" | "warn" | "moderation"
export type DBInfractionReferenceType = "infraction" | ModerationSource

export const InfractionTypeToEmoji: Record<DBInfractionType, string> = {
	warn: "⚠️",
	ban: "🔨",
	unban: "🙌",
	moderation: "🤨"
};

export interface DBInfractionReference {
    type: DBInfractionReferenceType;
    data: string;
}

export interface DBInfraction {
    /** Type of moderation action */
    type: DBInfractionType;

    /** ID of the infraction */
    id: string;

    /** When this action was taken */
    when: number;

    /** Which bot moderator took this action, Discord identifier */
    by?: string;

    /** Why this action was taken */
    reason?: string;

    /** How long this infraction lasts, e.g. for bans */
    until?: number;

    /** Reference for this infraction */
    reference?: DBInfractionReference;

    /** Used for `moderation` infractions */
    moderation?: ModerationResult;
}

export type GiveInfractionOptions = Omit<DBInfraction, "id" | "when">;