import { Image, createCanvas } from "@napi-rs/canvas";
import type { ImageFormatOptions } from "../commands/imagine.js";

/** Render the specified image generation results into a single image, to display in a Discord embed. */
export async function mergeImages({ result, size }: Pick<ImageFormatOptions, "result" | "size">) {
	/* If there's only a single image, simply return that one instead of creating a canvas to only render one. */
	if (result.results.length === 1) return Buffer.from(
		result.results[0].data, "base64"
	);

	/* How many images to display per row, maximum */
	const perRow = result.results.length > 4 ? 4 : 2;
	const rows = Math.ceil(result.results.length / perRow);

	/* Width & height of the canvas */
	const width = size.width * perRow;
	const height = rows * size.height;

	const canvas = createCanvas(width, height);
	const context = canvas.getContext("2d");

	result.results.forEach((result, index) => {
		const x = (index % perRow) * size.width;
		const y = Math.floor(index / perRow) * size.height;

		const image = new Image();
		image.src = Buffer.from(result.data, "base64");

		context.drawImage(
			image, x, y, size.width, size.height
		);
	});

	return canvas.encode("png");
}