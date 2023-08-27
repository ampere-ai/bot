import { fetchEventSource } from "@waylaidwanderer/fetch-event-source";

import type { ConversationMessage } from "./types/conversation.js";
import type { ChatModelResult } from "./chat/models/mod.js";

import { Emitter, EmitterData } from "./utils/event.js";
import { API_KEY, API_HOST } from "../config.js";
import { APIError } from "./errors/api.js";
import { ImageGenerationResult } from "./types/image.js";


interface BaseAPIOptions {
	key: string;
	host: string;
}

class BaseAPI {
	private readonly options: BaseAPIOptions;

	constructor(options: BaseAPIOptions) {
		this.options = options;
	}

	public async fetch<T extends EmitterData>(path: string, options: object, emitter?: Emitter<T>): Promise<T>;

	public async fetch<T extends EmitterData>(
		path: string, options: object & { stream?: boolean }, emitter?: Emitter<T>
	): Promise<T> {
		const url = `${this.options.host}/${path}`;

		const headers = {
			"Content-Type": "application/json",
			Authorization: this.options.key
		};

		if (options.stream && emitter) {
			return new Promise<T>((resolve, reject) => {
				fetchEventSource(url, {
					method: "POST", headers,
					body: JSON.stringify(options),
	
					onopen: async response => {
						if (!response.ok) {
							reject(new APIError(response, await response.json()));
						}
					},
	
					onmessage: ({ data: raw }) => {
						const data: T = JSON.parse(raw);
						emitter.emit(data);

						if (data.done) resolve(data);
					}
				}).catch(() => {});
			});

		} else {
			const response = await fetch(url, {
				method: "POST", headers,
				body: JSON.stringify(options)
			});

			const data = await response.json();
			if (!response.ok) throw new APIError(response, data);

			return data;
		}
	}
}

class TextAPI extends BaseAPI {
	public async gpt(options: {
		messages: ConversationMessage[],
		maxTokens?: number,
		temperature?: number,
		model?: string
	}, emitter: Emitter<ChatModelResult>): Promise<ChatModelResult> {
		return this.fetch("text/gpt", {
			...options, stream: true
		}, emitter);
	}
}

class ImageAPI extends BaseAPI {
	public async sh(options: {
		prompt: string;
		negativePrompt?: string;
		width?: number;
		height?: number;
		steps?: number;
		guidance?: number;
		sampler?: string;
		amount?: number;
		model?: string;
	}, emitter: Emitter<ImageGenerationResult>): Promise<ImageGenerationResult> {
		return this.fetch("image/sh", {
			...options, stream: true
		}, emitter);
	}
}

class OtherAPI extends BaseAPI {
	public async pay(options: {
		user: {
			name: string;
			id: string;
		};
		guild?: string;
		type: string;
		credits?: number;
	}): Promise<{
		url: string;
		id: string;
	}> {
		return this.fetch<any>("pay", options);
	}
}

export function createAPI() {
	return {
		text: new TextAPI({
			key: API_KEY,
			host: API_HOST
		}),

		image: new ImageAPI({
			key: API_KEY,
			host: API_HOST
		}),

		other: new OtherAPI({
			key: API_KEY,
			host: API_HOST
		})
	};
}