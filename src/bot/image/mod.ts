import type {
	ImageGenerationOptions, ImageGenerationRatio, ImageGenerationResult, ImageGenerationSize, ImageModel, ImageInterrogateOptions, ImageInterrogateResult
} from "../types/image.js";

import { Emitter } from "../utils/event.js";

export async function generate({ bot, model, emitter, body }: ImageGenerationOptions) {
	return bot.api.image[model.path]({
		...body, ...model.body ?? {}, stream: true
	} as any, emitter);
}

export async function interrogate({ bot, emitter: target, url }: ImageInterrogateOptions): Promise<ImageGenerationResult> {
	const emitter = new Emitter<ImageInterrogateResult>();

	emitter.on(data => {
		target.emit({
			results: response.result ? [ {
				id: response.id, status: "success",
				data: response.result
			} ] : [],
			
			cost: response.cost, id: response.id,
			progress: 0, done: data.done
		});
	});

	const response = await bot.api.image.interrogate({
		url, model: "RealESRGAN_x2plus"
	}, emitter);

	return {
		results: response.result ? [ {
			id: response.id, status: "success",
			data: response.result
		} ] : [],
		
		cost: response.cost, id: response.id,
		progress: 0, done: response.done
	};
}

export function validRatio(ratio: string, max: number = 3): ImageGenerationRatio | null {
	const [ a, b ] = ratio.split(":").map(Number);
	if (!a || !b || isNaN(a) || isNaN(b)) return null;

	if (a <= 0 || b <= 0 || a / b > max || b / a > max) return null;
	return { a, b };
}

export function findBestSize({ a, b }: ImageGenerationRatio, model: ImageModel, step: number = 64): ImageGenerationSize {
	const max = model.settings?.baseSize ?? { width: 512, height: 512 };
	const pixelCount = Math.max(max.width * max.height, Math.ceil(a * b / step / step) * step * step);

	let width = Math.round(Math.sqrt(pixelCount * a / b));
	let height = Math.round(Math.sqrt(pixelCount * b / a));

	width += width % step > 0 ? step - width % step : 0;
	height += height % step > 0 ? step - height % step : 0;

	return width > max.width ? {
		width: max.width, height: Math.round(max.width * b / a / step) * step
	} : height > max.height ? {
		width: Math.round(max.height * a / b / step) * step, height: max.height
	} : {
		width, height
	};
}