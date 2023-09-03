import type { ImageGenerationBody, ImageGenerationAction, ImagePrompt, ImageResult } from "../../bot/types/image.js";

export interface DBImage {
    /* Which model was used */
    model: string;

    /* Which action was performed */
    action: ImageGenerationAction;

    /* Which prompt was used to generate the image */
    prompt: ImagePrompt;

    /* Generation options used for this image */
    options: ImageGenerationBody;

    /* Generated image results */
    results: ImageResult[];

    /* How much this generation costs */
    cost: number;
}