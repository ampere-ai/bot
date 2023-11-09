import { Locales, Localization } from "@discordeno/types";
import i18next, { TOptions, i18n } from "i18next";
import { constants } from "fs";
import fs from "fs/promises";

import { DISCORD_LOCALE_MAP, USER_LOCALES } from "./types/locale.js";
import { DBEnvironment } from "../db/types/mod.js";
import { getSettingsValue } from "./settings.js";
import { bot } from "./mod.js";

export type LocaleString = {
	key: string;
	data?: Record<string, any>;
}

export type ToLocaleStrings<T> = T extends string
	? LocaleString | string
	: {
		[P in keyof T]: T[P] extends string ? LocaleString | string : ToLocaleStrings<T[P]>
	};

/** Wrapper around i18n.t(), to easily pass the user's language. */
export function t({ env, key, lang, options }: {
	env?: DBEnvironment;
	lang?: string;
	key: string | LocaleString;
	options?: TOptions;
}): string {
	/* Key with additional data */
	if (typeof key === "object") {
		options = { ...options, ...key.data };
		key = key.key;
	}

	if (!hasTranslation({ env, key, lang }) && !hasTranslation({ env, key: `${key}_one`, lang })) return key;

	if (env) {
		const lng = getSettingsValue<string>(bot, env, "user", "general:language");
		return i18next.t(key, { lng, ns: lng, ...options ?? {} });
	} else {
		return i18next.t(key, { lng: lang ?? "en", ns: lang ?? "en", ...options ?? {} });
	}
}

/** Check whether a key exists in the given locale. */
export function hasTranslation({ env, key, lang }: {
	env?: DBEnvironment;
	lang?: string;
	key: string;
}): boolean {
	if (env) {
		const lng = getSettingsValue<string>(bot, env, "user", "general:language");
		return i18next.exists(key, { lng, ns: lng });
	} else {
		return i18next.exists(key, { lng: lang, ns: lang });
	}
}

/** Translate all strings of an object. */
export function translateObject<T extends {[key: string]: any } | LocaleString | string | Array<unknown>>(obj: T, env?: DBEnvironment): T {
	if (!obj) return obj;

	if (typeof obj == "string") {
		const [ key, ...other ] = obj.split(" ");
		return (`${t({ key, env })}${other.length > 0 ? ` ${other.join(" ")}` : ""}`) as T;

	} else if (Array.isArray(obj)) {
		return (obj.map(o => translateObject(o, env))) as T;

	} else if (typeof obj == "object" && "key" in obj) {
		return t({ key: obj.key, options: obj.data, env }) as T;

	} else if (typeof obj == "object") {
		const translated: any = {};

		for (const key of Object.keys(obj)) {
			translated[key] = key !== "customId" && key !== "url" && key !== "id"
				? translateObject(obj[key], env)
				: obj[key];
		}
		
		return translated as T;
	} else {
		return obj;
	}
}

export function createLocalizationMap(key: string, replacement?: string) {
	const locales: Localization = {};

	const fallback = hasTranslation({ key })
		? t({ key }) : replacement ?? key;

	for (const locale of USER_LOCALES) {
		if (locale.supported && hasTranslation({ key, lang: locale.id })) {
			locales[DISCORD_LOCALE_MAP[locale.id] ?? locale.id as Locales] = 
				t({ key, lang: locale.id });
		}
	}

	return { locales, fallback };
}

export async function setupI18N() {
	await i18next.init({
		resources: {},

		fallbackLng: "en", fallbackNS: "en",
		lng: "en", ns: "en",
	
		interpolation: {
			escapeValue: false
		}
	});

	/* Load all of the locales. */
	await Promise.all(USER_LOCALES.map(async l => {
		const path = `locales/${l.id}.json`;

		return fs.access(path, constants.F_OK)
			.then(async () => {
				const data = JSON.parse((await fs.readFile(path)).toString());
				(i18next as unknown as i18n).addResourceBundle(l.id, l.id, data);
			}).catch(() => {});
	}));
}