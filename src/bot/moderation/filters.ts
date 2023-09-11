import { bold } from "colorette";

import type { ModerationFilter, ModerationFilterAction, ModerationFilterActionType } from "./types/filter.js";
import type { GiveInfractionOptions } from "../../db/types/moderation.js";

import { type ModerationOptions, ModerationSource } from "./types/mod.js";
import { DBRole } from "../../db/types/user.js";

interface ModerationFilterWord {
    /* Words to block */
    words: string[]; 

    /* White-listed words */
    allowed?: string[];

	/** For which source(s) this filter applies */
	source?: ModerationSource[] | ModerationSource;

    /* Which infraction to execute for this flagged word */
    action: Omit<ModerationFilterAction, "filter">;
}

export const MODERATION_FILTERS: ModerationFilter[] = [
	{
		name: "Development filter",

		handler: async ({ env, content }) => {
			if (!env.user.roles.includes(DBRole.Owner)) return null;

			/* Types of actions to take */
			const types: ModerationFilterActionType[] = [ "ban", "warn", "block", "flag" ];

			const parts: string[] = content.split(":");
			if (parts.length === 1 || parts[0] !== "testFlag") return null;

			const type: string = parts[parts.length - 1];
			if (!types.includes(type as ModerationFilterActionType)) return null;

			return {
				type: type as ModerationFilterActionType,
				reason: "Development test flag"
			};
		}
	},

	{
		name: "Word filter",
	
		handler: async ({ source, content }) => {
			const normalize = (content: string): string => {
				const replacements: Record<string, string> = {
					"@": "a", "$": "s", "3": "e", "8": "b",
					"1": "i", "¡": "i", "5": "s", "0": "o",
					"4": "h", "7": "t", "9": "g", "6": "b"
				};
			
				return content
					.toLowerCase()
					.normalize("NFD")
					.replace(/[\u0300-\u036f]/g, "")
					.split("")
					.map(char => replacements[char] || char)
					.join("")
					.replace(/ +(?= )/g, "");
			};			
	
			const matches = (filter: ModerationFilterWord, input: string): boolean => {
				return filter.words.some(word => 
					filter.allowed && filter.allowed.includes(word) ? false : input.includes(word)
				);
			};

			/* I hope that I never have to touch this list ever again.. */
			const words: ModerationFilterWord[] = [
				{
					words: [ "child porn", "i love cp", "send cp", "love cp", "get cp", "pornografia infantil", "children porn", "infant porn", "children sex", "child sex", "infant sex", "childporn", "childsex", "childrensex" ],
					action: { type: "ban", reason: "Sexual content involving minors" }
				},
				
				{
					words: [ "loli" ], allowed: [ "hololive" ],
					action: { type: "warn", reason: "Content involving underage characters" }
				},

				{
					words: [ "nigger", "n i g g e r", "niggr", "nigga" ],
					action: { type: "ban", reason: "Racist content", duration: 7 * 24 * 60 * 60 * 1000 }
				},

				{
					words: [ "trannie", "tranny", "faggot", "fagget" ],
					action: { type: "block", reason: "Homophobic content" }
				},

				{
					words: [ "sex", "no clothes", "naked", "nude", "uncensored", "clit", "uterus", "vagina", "penis", "dick", "breasts", "sexy", "ass", "titty", "tits", "cum", "creampied", "nsfw" ],
					action: { type: "block", reason: "Sexual content" },
					source: ModerationSource.ImagePrompt
				},

				{
					words: [ "kid", "child", "teen", "young", "boy", "girl", "underage", "minor", "prepubescent" ],
					action: { type: "block", reason: "Possibly sexual content involving minors" },
					source: ModerationSource.ImagePrompt
				}
			];
	
			const clean = normalize(content);

			const flaggedFilter = words
				.filter(f => f.source ? Array.isArray(f.source) ? f.source.includes(source) : f.source === source : true)
				.find(f => matches(f, clean));
	
			if (!flaggedFilter) return null;
			return flaggedFilter.action;
		}
	}
];

/** Execute all of the moderation filters. */
export async function executeFilters({ bot, env, source, content }: ModerationOptions): Promise<ModerationFilterAction | null> {
	/* Which action should be performed, if any */
	let action: ModerationFilterAction | null = null;

	for (const filter of MODERATION_FILTERS) {
		/* Try to execute the filter. */
		try {
			const result = await filter.handler({
				bot, env, source, content
			});

			if (result !== null) {
				action = { ...result, filter: filter.name };
				break;
			}

		} catch (error) {
			bot.logger.warn(`Failed to execute moderation filter ${bold(filter.name)} ->`, error);
		}
	}

	if (action === null) return null;
	if (action.type !== "ban" && action.duration) delete action.duration;

	return action;
}

/** Apply the executed filter's infractions to the entry. */
export function applyFilters({ auto }: {
	auto: ModerationFilterAction
}): GiveInfractionOptions | null {
	if (auto.type === "warn") {
		return {
			type: "warn", reason: auto.reason
		};
	} else if (auto.type === "ban") {
		return {
			type: "ban", reason: auto.reason,
			
			until: auto.duration
				? Date.now() + auto.duration
				: undefined
		};
	}

	return null;
}