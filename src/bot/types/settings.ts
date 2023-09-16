import type { Bot, ComponentEmoji } from "@discordeno/bot";

import type { RestrictionName } from "../utils/restriction.js";
import type { DBEnvironment } from "../../db/types/mod.js";

export enum SettingsLocation {
	Guild = "guild",
	User = "user",
	Both = "both"
}

export enum SettingsOptionType {
    /** Simple true-false value */
    Boolean,

	/** Users can enter an arbitrary string in a modal menu */
	String,

    /** Users can choose one option from a list */
    Choices,

	/** Users can choose multiple options from a list */
	MultipleChoices
}

export type DBSettings = Record<string, any>

export interface SettingsOptionChoice<T> {
	/** Name of the choice */
	name: string;

    /** Description of the choice */
    description?: string;

	/** Emoji of the choice */
	emoji?: ComponentEmoji | string;

	/** Restrictions of the choice */
	restrictions?: RestrictionName[];

	/** Value of the choice */
	value: T;
}

export type SettingsOption<T extends string  = any> = BooleanSettingsOption | StringSettingsOption | ChoiceSettingsOption<T> | MultipleChoiceSettingsOption<T>

interface BaseSettingsOption<T> {
    /** Name of the settings option */
    name: string;

    /** Emoji for the settings option */
    emoji: string;

    /** Description of the settings option */
    description: string;

    /** Type of the setting */
    type: SettingsOptionType;

    /** Location of the setting */
    location?: SettingsLocation;

    /** Handler to execute when this setting is changed */
    handler?: (bot: Bot, env: DBEnvironment, value: T) => Promise<void> | void;

	/** Whether this option is not required */
	optional?: boolean;

	/** Whether this option is hidden from the user & only used internally */
	hidden?: boolean;

    /** Default value of this settings option */
    default: T;
}

type BooleanSettingsOption = BaseSettingsOption<boolean> & {
	type: SettingsOptionType.Boolean;
}

type StringSettingsOption = BaseSettingsOption<string> & {
	type: SettingsOptionType.String;

	/* Minimum & maximum length of the string */
	minLength?: number;
	maxLength?: number;
}

type ChoiceSettingsOption<T> = BaseSettingsOption<T | null> & {
	type: SettingsOptionType.Choices;

	/** Choices for the option */
	choices: SettingsOptionChoice<T>[];
}

type MultipleChoiceSettingsOption<T> = BaseSettingsOption<T> & {
	type: SettingsOptionType.MultipleChoices;

	/** Choices for the option */
	choices: SettingsOptionChoice<T>[];

	/* Minimum & maximum of options to pick */
	min?: number;
	max?: number;
}

export interface SettingsCategory {
    /** Name of the category */
    name: string;

    /** Emoji for the category */
    emoji: ComponentEmoji | string;

	/** Available options for the category */
	options: SettingsOption[];
}