import type { ImageModel } from "../types/image.js";

export const IMAGE_MODELS: ImageModel[] = [
	{
		name: "Kandinsky",
		id: "kandinsky",
		path: "kandinsky",

		settings: {
			baseSize: { width: 768, height: 768 }
		}
	},

	{
		name: "SDXL",
		id: "sdxl",
		path: "deepinfra",

		settings: {
			forcedSize: { width: 1024, height: 1024 }
		},

		body: {
			model: "stability-ai/sdxl"
		}
	},

	{
		name: "Stable Diffusion v2.1",
		id: "sd21",
		path: "deepinfra",

		settings: {
			baseSize: { width: 768, height: 768 }
		},

		body: {
			model: "stabilityai/stable-diffusion-2-1"
		}
	},

	{
		name: "Dall-E 3",
		id: "dalle3",
		path: "openai",

		settings: {
			forcedSize: { width: 1024, height: 1024 }
		}
	},

	{
		name: "Project Unreal Engine 5",
		id: "ue5",
		path: "sh",

		body: {
			model: "Project Unreal Engine 5"
		}
	},

	{
		name: "Dreamshaper",
		id: "dreamshaper",
		path: "sh",

		body: {
			model: "Dreamshaper"
		}
	},
    
	{
		name: "I Can't Believe It's Not Photography",
		id: "icbinp",
		path: "sh",
        
		body: {
			model: "ICBINP - I Can't Believe It's Not Photography"
		}
	},

	{
		name: "Anything Diffusion",
		id: "anything",
		path: "sh",

		body: {
			model: "Anything Diffusion"
		}
	}
];