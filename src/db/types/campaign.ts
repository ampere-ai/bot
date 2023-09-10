import type { ActionRow, Embed } from "@discordeno/bot";
import type { EmbedColor } from "../../bot/utils/response.js";

type DBCampaignButton = DBCampaignLinkButton | DBCampaignIDButton

interface DBCampaignLinkButton {
	type: "Link";

	/** Link of the button */
	url: string;

	/** Label of the button */
	label?: string;
}

interface DBCampaignIDButton {
	type: "Primary" | "Secondary" | "Success" | "Danger";

	/** Label of the button */
	label: string;

	/** Emoji of the button */
	emoji?: string;

	/** Custom ID of the button */
	id?: string;
}

interface DBCampaignSettings {
    /** Title of the campaign, to display in the embed */
    title: string;

    /** Description of the campaign, to display in the embed */
    description: string;

    /** Color of the embed, optional */
    color?: keyof typeof EmbedColor;

    /** Image of the embed, optional */
    image?: string;

    /** Thumbnail of the embed, optional */
    thumbnail?: string;
}

interface DBCampaignStatistics {
    clicks: {
        /** Total amount of clicks to this campaign */
        total: number;
    };

    views: {
        /** Total amount of views to this campaign */
        total: number;
    };
}

export type DBCampaignBudgetType = "click" | "view" | "none"

export interface DBCampaignBudget {
    /** The total budget of the campaign */
    total: number;

    /** How much has already been used */
    used: number;

    /** Whether cost should be per-view or per-click */
    type: DBCampaignBudgetType;

    /** CPM - Cost per thousand clicks or views, depending on the type */
    cost: number;
}

export interface DBCampaign {
    /** Unique identifier of the campaign */
    id: string;

    /** Name of the campaign */
    name: string;

    /** When the campaign was created */
    created: string;

    /** Whether the campaign is active */
    active: boolean;

    /** What the budget of this campaign is */
    budget: DBCampaignBudget;

    /** Discord IDs of the members of this campaign */
    members: string[];

    /** Link to the the campaign's target site */
    button: DBCampaignButton | null;

    /** Settings of the campaign, used for storing title, description, etc. */
    settings: DBCampaignSettings;

    /** Statistics of the campaign, e.g. how many clicks */
    stats: DBCampaignStatistics;
}

export interface CampaignRender {
	row: ActionRow;
    embed: Embed;
}

export interface CampaignDisplay {
	response: CampaignRender;
    campaign: DBCampaign;
}