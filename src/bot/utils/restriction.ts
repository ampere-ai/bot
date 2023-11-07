import type { Bot } from "@discordeno/bot";

import type { DBEnvironment } from "../../db/types/mod.js";
import { DBRole } from "../../db/types/user.js";
import { t } from "../i18n.js";

export interface RestrictionType {
	/** Name of the restriction */
	name: RestrictionName;

	/** Emoji of the restriction */
	emoji: string;

	/** Description of the restriction, e.g. "premium-only" */
	description: string;
}

export enum RestrictionName {
	/** Restricted to bot developers & the development server */
	Developer = "dev",

	/** Restricted to Premium members of both types */
	Premium = "premium",

	/** Restricted to bot moderators */
	Moderator = "mod",

	/** Restricted to Premium pay-as-you-go plan members */
	PremiumPlan = "plan",

	/** Restricted to Premium subscription members */
	PremiumSubscription = "sub"
}

const RestrictionEmojiMap: Record<RestrictionName, string> = {
	[RestrictionName.Developer]: "🔧",
	[RestrictionName.Premium]: "✨",
	[RestrictionName.Moderator]: "🛠️",
	[RestrictionName.PremiumPlan]: "📊",
	[RestrictionName.PremiumSubscription]: "💸"
};

/** Determine which restriction type applies to a user. */
function restrictions(bot: Bot, env: DBEnvironment): RestrictionName[] {
	const types: RestrictionName[] = [];

	if (env.user.roles.includes(DBRole.Owner)) types.push(RestrictionName.Developer);
	if (env.user.roles.includes(DBRole.Moderator)) types.push(RestrictionName.Moderator);

	const premium = bot.db.premium(env);

	if (premium) {
		if (premium.type === "subscription") types.push(RestrictionName.PremiumSubscription);
		if (premium.type === "plan") types.push(RestrictionName.PremiumPlan);
		
		types.push(RestrictionName.Premium);
	}

	return types;
}

/** Determine whether a user is equal to the restriction type. */
export function canUse(bot: Bot, env: DBEnvironment, types: RestrictionName[]): boolean {
	return restrictions(bot, env).some(r => types.includes(r));
}

export function restrictionTypes(env: DBEnvironment, restrictions: RestrictionName[]) {
	const types: RestrictionType[] = [];

	for (const r of restrictions) {
		types.push({
			name: r, description: t({ key: `restrictions.types.${r}`, env }),
			emoji: RestrictionEmojiMap[r]
		});
	}

	return types;
}