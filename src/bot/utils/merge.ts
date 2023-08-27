import { Image, createCanvas } from "@napi-rs/canvas";
import type { ImageFormatOptions } from "../commands/imagine.js";

/** Render the specified image generation results into a single image, to display in a Discord embed. */
export async function mergeImages({ result, size }: Pick<ImageFormatOptions, "result" | "size">): Promise<Buffer> {
	/* If there's only a single image, simply return that one instead of creating a canvas to only render one. */
	if (result.results.length === 1) return Buffer.from(
		result.results[0].data, "base64"
	);

	/* How many images to display per row, maximum */
	const perRow: number = result.results.length > 4 ? 4 : 2;
	const rows: number = Math.ceil(result.results.length / perRow);

	/* Width & height of the canvas */
	const width: number = size.width * perRow;
	const height: number = rows * size.height;

	const canvas = createCanvas(width, height);
	const context = canvas.getContext("2d");

	result.results.forEach((result, index) => {
		const x: number = (index % perRow) * size.width;
		const y: number = Math.floor(index / perRow) * size.height;

		const image: Image = new Image();
		image.src = Buffer.from(result.data, "base64");

		context.drawImage(
			image, x, y, size.width, size.height
		);
	});

	return await canvas.encode("png");
}