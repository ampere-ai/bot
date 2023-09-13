import { ApplicationCommandOptionTypes, DiscordEmbedField, MessageComponentTypes, MessageComponents } from "@discordeno/bot";
import { ActionRow, Bot, ButtonStyles, Interaction } from "@discordeno/bot";

import type { ImageGenerationAction, ImageModel, ImagePrompt, ImageSampler, ImageGenerationOptions, ImageGenerationSize } from "../types/image.js";
import type { InteractionHandlerOptions } from "../types/interaction.js";
import type { DBEnvironment } from "../../db/types/mod.js";
import type { DBImage } from "../../db/types/image.js";

import { getLoadingIndicatorFromUser, loadingIndicatorToString } from "../../db/types/indicator.js";
import { findBestSize, generate, interrogate, validRatio } from "../image/mod.js";
import { type ImageGenerationResult, IMAGE_SAMPLERS } from "../types/image.js";
import { EmbedColor, MessageResponse } from "../utils/response.js";
import { moderate, moderationNotice } from "../moderation/mod.js";
import { ModerationSource } from "../moderation/types/mod.js";
import { ResponseError } from "../errors/response.js";
import { createCommand } from "../helpers/command.js";
import { handleError } from "../moderation/error.js";
import { getSettingsValue } from "../settings.js";
import { IMAGE_MODELS } from "../image/models.js";
import { IMAGE_STYLES } from "../image/styles.js";
import { BRANDING_COLOR } from "../../config.js";
import { mergeImages } from "../utils/merge.js";
import { truncate } from "../utils/helpers.js";
import { Emitter } from "../utils/event.js";
import { charge } from "../premium.js";
import { pickAdvertisement } from "../campaign.js";

interface ImageStartOptions {
	bot: Bot;
	interaction: Interaction;
	env: DBEnvironment;
	guidance?: number;
	sampler?: ImageSampler;
	ratio: string;
	model: ImageModel;
	steps?: number;
	count: number;
	prompt: ImagePrompt;
	action: ImageGenerationAction;
	source?: string;
}

interface ImageToolbarOptions {
	action: ImageGenerationAction;
	result: ImageGenerationResult;
}

export interface ImageFormatOptions {
	result: ImageGenerationResult;
	action: ImageGenerationAction;
	prompt: ImagePrompt;
	interaction: Interaction;
	size: ImageGenerationSize;
	env: DBEnvironment;
}

const DEFAULT_GEN_OPTIONS = {
	guidance: 7, steps: 30, count: 2, sampler: "k_euler_a"
};

export default createCommand({
	name: "imagine",
	description: "Generate beautiful images using AI",

	cooldown: {
		user: 1.75 * 60 * 1000,
		voter: 1.5 * 60 * 1000,
		subscription: 30 * 1000
	},

	options: {
		prompt: {
			type: ApplicationCommandOptionTypes.String,
			description: "The possibilities are endless... 💫",
			required: true
		},

		model: {
			type: ApplicationCommandOptionTypes.String,
			description: "Which model to use",

			choices: IMAGE_MODELS.map(m => ({
				name: `${m.name} • ${m.description}`, value: m.id
			}))
		},

		style: {
			type: ApplicationCommandOptionTypes.String,
			description: "Which style to use",

			choices: IMAGE_STYLES.map(s => ({
				name: `${s.emoji} ${s.name}`, value: s.id
			}))
		},

		negative: {
			type: ApplicationCommandOptionTypes.String,
			description: "Things to *not include in the generated images",
		},

		count: {
			type: ApplicationCommandOptionTypes.Integer,
			description: "How many images to generate",
			default: DEFAULT_GEN_OPTIONS.count,
			min: 1, max: 4
		},

		ratio: {
			type: ApplicationCommandOptionTypes.String,
			description: "Which aspect ratio the images should have, e.g. 16:9 or 1.5:1",
			default: "1:1"
		},

		steps: {
			type: ApplicationCommandOptionTypes.Integer,
			description: "How many steps to generate the image for",
			default: DEFAULT_GEN_OPTIONS.steps,
			min: 15, max: 50
		},

		guidance: {
			type: ApplicationCommandOptionTypes.Integer,
			description: "Higher values will make the AI prioritize your prompt; lower values make the AI more creative",
			default: DEFAULT_GEN_OPTIONS.guidance,
			min: 1, max: 24
		},

		sampler: {
			type: ApplicationCommandOptionTypes.String,
			description: "The sampler responsible for carrying out the denoising steps",
			default: DEFAULT_GEN_OPTIONS.sampler,

			choices: IMAGE_SAMPLERS.map(s => ({
				name: s.toUpperCase(), value: s
			}))
		},
	},

	handler: async ({ bot, env, interaction, options }) => {
		const { count, steps, guidance, prompt, negative: negativePrompt, ratio } = options;

		/* The sampler responsible for carrying out the denoising steps */
		const sampler: ImageSampler = options.sampler ?? DEFAULT_GEN_OPTIONS.sampler;

		/* Which model to use */
		const modelID = options.model ?? getSettingsValue(env.user, "image:model");
		const model = IMAGE_MODELS.find(m => m.id === modelID)!;
	
		/* Which style to apply additionally */
		const styleID: string | null = options.style ?? getSettingsValue(env.user, "image:style");
		const style = styleID !== null ? IMAGE_STYLES.find(s => s.id === styleID)! : null;

		if (model.settings?.forcedSize && ratio !== "1:1") throw new ResponseError({
			message: `**${model.name}** has a fixed resolution of \`${model.settings.forcedSize.width}×${model.settings.forcedSize.height}\`; *you cannot modify the aspect ratio*`
		});

		const moderation = await moderate({
			bot, env, user: interaction.user, content: prompt, source: ModerationSource.ImagePrompt
		});

		if (moderation.blocked) return moderationNotice({ result: moderation });

		try {
			await start({
				bot, action: "generate",
				ratio, count, env, guidance, interaction, model, sampler, steps,

				prompt: {
					prompt: prompt, negative: negativePrompt,
					style: style ? style.id : undefined
				}
			});

		} catch (error) {
			if (error instanceof ResponseError) {
				return void await interaction.editReply(
					error.display()
				);
			}

			await interaction.editReply(
				await handleError(bot, {
					error, guild: interaction.guildId
				})
			).catch(() => {});
		}
	}
});

export async function handleImagineInteraction({ bot, interaction, env, args }: InteractionHandlerOptions) {
	const action = args.shift()!;

	/* Fetch the image. */
	const image = await bot.api.dataset.get<DBImage>("image", args.shift()!);
	if (!image) return;

	const { prompt, model, options: { ratio, amount, guidance, sampler, steps } } = image;

	/* Which individual result was selected */
	const imageResult = args.length > 0 ? image.results.at(Number(args[0])) : null;
	if (action === "upscale" && !imageResult) return;

	/* Original message corresponding to the button */
	const original = interaction.message;
	if (!original || original.components.length === 0) return;

	/* Which button was pressed */
	const pressed = original.components[0].components!
		.find(c => c.customId === interaction.data!.customId)!;

	pressed.style = ButtonStyles.Primary;
	pressed.disabled = true;

	/* Disable the button that was pressed, so it can only be used once. */
	await bot.helpers.editMessage(original.channelId, original.id, {
		components: original.components as MessageComponents
	});

	try {
		if (action === "upscale") {
			const buffer = await bot.api.storage.get("images", `${imageResult!.id}.png`);
	
			await start({
				bot, interaction, action,
	
				ratio: `${ratio.a}:${ratio.b}`,
				count: amount, env, guidance,
				model: IMAGE_MODELS.find(m => m.id === model)!,
				source: buffer.toString("base64"),
	
				sampler, steps, prompt
			});
	
		} else if (action === "redo") {
			await start({
				bot, interaction,
				
				action: "generate",
				ratio: `${ratio.a}:${ratio.b}`,
				count: amount, env, guidance,
				model: IMAGE_MODELS.find(m => m.id === model)!,
	
				sampler, steps, prompt
			});
		}
	} catch (error) {
		pressed.style = ButtonStyles.Danger;
		pressed.disabled = false;
	
		/* Enable the pressed button again, because the action failed. */
		await bot.helpers.editMessage(original.channelId, original.id, {
			components: original.components as MessageComponents
		});

		throw error;
	}
}

async function start(options: ImageStartOptions) {
	const { bot, ratio: rawRatio, model, prompt, action, source, sampler, steps, guidance, count, interaction, env } = options;

	/* Parse & validate the given aspect ratio. */
	const ratio = validRatio(rawRatio);

	if (ratio === null) throw new ResponseError({
		message: "You specified an **invalid** aspect ratio"
	});

	/* Find the best size for the specified aspect ratio. */
	const size = !model.settings?.forcedSize
		? findBestSize(ratio, model) : model.settings.forcedSize;

	/* The image generation style to apply additionally */
	const style = IMAGE_STYLES.find(s => s.id === prompt.style) ?? null;

	/* The formatted prompt, to pass to the API */
	let formattedPrompt = prompt.prompt;
	if (style && style.tags) formattedPrompt += `, ${style.tags.join(", ")}`;

	/* Just why... */
	await interaction.reply(
		await formatResult({ ...options, size, result: {
			cost: 0, done: false, id: "", progress: 0, results: []
		}})
	);

	/* Fetch the interaction reply, so we can edit it later. */
	const message = await bot.helpers.getOriginalInteractionResponse(interaction.token);

	const handler = async (data: ImageGenerationResult) => {
		if (data.done) return;

		await message.edit(
			await formatResult({ ...options, result: data, size })
		).catch(() => {});
	};

	const emitter = new Emitter<ImageGenerationResult>();
	emitter.on(handler);

	/* Image generation options */
	const body: ImageGenerationOptions = {
		body: {
			prompt: formattedPrompt,
			negativePrompt: prompt.negative ? prompt.negative : undefined,

			sampler, steps, width: size.width, height: size.height, ratio,
			amount: count, guidance
		},

		bot, model, emitter
	};

	const result = action === "upscale" && source !== undefined
		? await interrogate({ bot, url: source, emitter })
		: await generate(body);

	/* Whether the generated images are still usable */
	const usable: boolean = result.results.filter(i => i.status === "success").length > 0;

	if (!usable) throw new ResponseError({
		message: "All of the generated images were deemed as **not safe for work**", emoji: "🔞"
	});

	await charge(bot, env, {
		type: "image", used: result.cost ?? 0, data: {
			model: model.id
		}
	});

	/* Add the image request to the dataset. */
	await bot.api.dataset.add<DBImage>("image", result.id, {
		cost: result.cost, model: model.id,
		action, prompt, options: body.body,

		results: result.results.map(({ id, status }) => ({
			id, status
		}))
	});

	/* Upload all of the generation results. */
	await Promise.all(result.results.map(r => {
		return bot.api.storage.upload(
			"images", `${r.id}.png`, Buffer.from(r.data, "base64")
		);
	}));

	const response = await message.edit(await formatResult({
		...options, result, size
	}));

	/* Advertisement to display */
	const ad = await pickAdvertisement(env);

	if (ad) {
		await response.reply({
			components: [ ad.response.row ],
			embeds: ad.response.embed
		});
	}
}

/** Format the image generation result into a clean embed. */
async function formatResult(options: ImageFormatOptions & ImageStartOptions): Promise<MessageResponse> {
	const { action, env, interaction, prompt, result, size } = options;

	if (!result.done) {
		const indicator = getLoadingIndicatorFromUser(env.user);
		const emoji = loadingIndicatorToString(indicator);

		return { embeds: {
			title: displayPrompt({ action, interaction, prompt }),
			description: `**${result.progress && (result.progress < 1 && result.progress > 0) ? `${Math.floor(result.progress * 100)}%` : "Generating"}** ... ${emoji}`,
			color: EmbedColor.Orange
		} };
	}

	const grid = (
		await mergeImages({ result, size })
	).toString("base64");

	return {
		embeds: {
			title: displayPrompt({ action, interaction, prompt }),
			image: { url: `attachment://${result.id}.png`, ...size },
			fields: displayFields(options),
			color: BRANDING_COLOR
		},

		components: buildToolbar({ action, result }),
		file: { name: `${result.id}.png`, blob: grid }
	};
}

function buildToolbar(options: ImageToolbarOptions): ActionRow[] | undefined {
	const rows: ActionRow[] = [];

	if (options.action === "generate") {
		rows.push(...buildActionButtons({
			...options, action: "upscale"
		}));
	}

	if (rows[0] && options.action === "generate") {
		rows[0].components.push({
			type: MessageComponentTypes.Button,
			customId: `i:redo:${options.result.id}`,
			style: ButtonStyles.Secondary,
			emoji: { name: "🔄" }
		});
	}

	return rows.length > 0 ? rows : undefined;
}

function buildActionButtons({ action, result: { id, results } }: ImageToolbarOptions): ActionRow[] {
	const rows: ActionRow[] = [];

	/* How many images to display per row */
	const perRow: number = 4;

	/* How many rows to display */
	const rowCount: number = Math.ceil(results.length / perRow);
	
	for (let i = 0; i < rowCount; i++) {
		rows.push({
			type: MessageComponentTypes.ActionRow,
			components: [] as any,
		});
	}

	results.forEach((image, index) => {
		const which: number = Math.ceil((index + 1) / perRow) - 1;
		const row = rows[which];

		row.components.push({
			type: MessageComponentTypes.Button,
			style: image.status === "success" ? ButtonStyles.Secondary : ButtonStyles.Danger,
			label: `${action.charAt(0).toUpperCase()}${index + 1}`,
			customId: `i:${action}:${id}:${index}`,
			disabled: image.status !== "success"
		});
	});

	return rows;
}

function displayFields(options: ImageStartOptions): DiscordEmbedField[] {
	const fields: Omit<DiscordEmbedField, "inline">[] = [];
	fields.push({ name: "Model", value: options.model.name });

	if (options.ratio !== "1:1") {
		const ratio = validRatio(options.ratio)!;
		const { width, height } = findBestSize(ratio, options.model);

		fields.push({ name: "Ratio", value: `\`${ratio.a}:${ratio.b}\` (**${width}**×**${height}**)` });
	}

	if (options.prompt.negative) fields.push({
		name: "Negative", value: `\`${options.prompt.negative}\``
	});

	if (options.steps !== DEFAULT_GEN_OPTIONS.steps) fields.push({
		name: "Steps", value: `${options.steps}`
	});

	if (options.guidance !== DEFAULT_GEN_OPTIONS.guidance) fields.push({
		name: "Guidance", value: `${options.guidance}`
	});

	if (options.prompt.style) {
		const style = IMAGE_STYLES.find(s => s.id === options.prompt.style)!;
		fields.push({ name: "Style", value: `${style.name} ${style.emoji}` });
	}

	return fields.map(field => ({ ...field, inline: true }));
}

/** Display the user's given prompt nicely. */
function displayPrompt(
	{ action, interaction, prompt }: Pick<ImageFormatOptions, "action" | "interaction" | "prompt">
) {
	return `**${truncate(prompt.prompt, 200)}** — @${interaction.user.username}${action !== null ? ` ${action === "upscale" ? "🔎" : ""}` : ""}`;
}