import { fetchEventSource } from "@waylaidwanderer/fetch-event-source";
import type { RequestMethods } from "@discordeno/rest";

import type { ImageGenerationResult, ImageInterrogateResult } from "./types/image.js";
import type { APIChatMessage } from "./types/conversation.js";
import type { Emitter, EmitterData } from "./utils/event.js";
import type { ChatModelResult } from "./chat/models/mod.js";
import type { DatasetType } from "../db/types/dataset.js";

import { API_KEY, API_HOST } from "../config.js";
import { APIError } from "./errors/api.js";

interface BaseAPIOptions {
	key: string;
	host: string;
}

interface APIFetchOptions {
	/** Which path to request */
	path: string;

	/** JSON body to pass to the API */
	options?: object;

	/** Raw binary data to pass to the API */
	data?: Buffer;

	/** Request method to use */
	method?: RequestMethods;

	/** Whether the response should be streaming */
	stream?: boolean;

	/** Emitter to stream the response to, if applicable */
	emitter?: Emitter<EmitterData>;
}

class BaseAPI {
	private readonly options: BaseAPIOptions;

	constructor(options: BaseAPIOptions) {
		this.options = options;
	}

	protected async fetchBinary(
		{ path }: Pick<APIFetchOptions, "path">
	): Promise<Buffer> {
		const url = `${this.options.host}/${path}`;
		const headers = this.headers();

		const response = await fetch(url, {
			method: "GET", headers
		});

		if (!response.ok) throw new APIError(response, path, null);
		return Buffer.from(await response.arrayBuffer());
	}

	protected async fetch<T = any>(
		{ path, emitter, options, data: binary, method, stream }: APIFetchOptions
	): Promise<T> {
		const url = `${this.options.host}/${path}`;
		const headers = this.headers();

		if (stream && emitter) {
			// eslint-disable-next-line no-async-promise-executor
			return new Promise<T>(async (resolve, reject) => {
				await fetchEventSource(url, {
					method: method ?? "POST",
					headers,

					body: JSON.stringify({
						...options, stream: true
					}),
	
					onopen: async response => {
						if (!response.ok) {
							throw new APIError(response, path, await response.json());
						}
					},
					
					onerror: error => {
						throw error;
					},
	
					onmessage: ({ data: raw }) => {
						const data = JSON.parse(raw);

						if (data.error && !data.success) {
							throw new APIError(null, path, data);
						}

						emitter.emit(data);
						if (data.done) resolve(data);
					}
				}).catch(reject);
			});

		} else {
			if (binary) headers["Content-Type"] = "image/png";

			const response = await fetch(url, {
				method: options || binary ? "POST" : "GET",
				
				body: binary ? binary :  options ? JSON.stringify(options) : undefined,
				headers
			});

			const data = await response.json();
			if (!response.ok) throw new APIError(response, path, data);

			return data;
		}
	}

	private headers() {
		return {
			"Content-Type": "application/json",
			Authorization: this.options.key
		};
	}
}

class TextAPI extends BaseAPI {
	public async gpt(options: {
		messages: APIChatMessage[];
		maxTokens?: number;
		temperature?: number;
		plugins: string[];
		model?: string;
	}, emitter: Emitter<ChatModelResult>): Promise<ChatModelResult> {
		return this.fetch({
			path: "text/gpt", emitter, options, stream: true
		});
	}

	public async deepinfra(options: {
		model: string;
		messages: APIChatMessage[];
		maxTokens?: number;
		temperature?: number;
	}, emitter: Emitter<ChatModelResult>): Promise<ChatModelResult> {
		return this.fetch({
			path: "text/deepinfra", emitter, options, stream: true
		});
	}

	public async google(options: {
		messages: APIChatMessage[];
		temperature?: number;
		model?: "chat-bison-001";
	}, emitter: Emitter<ChatModelResult>): Promise<ChatModelResult> {
		return this.fetch({
			path: "text/google", emitter, options, stream: true
		});
	}

	public async translate(options: {
		content: string;
		language: string;
		maxTokens?: number;
		model?: string;
	}): Promise<{
		cost: number;
		done: boolean;
		content: string;
		error?: string;
		language: string;
	}> {
		return this.fetch({
			path: "text/translate", options, stream: false
		});
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
	}, emitter?: Emitter<ImageGenerationResult>): Promise<ImageGenerationResult> {
		return this.fetch({
			path: "image/sh", emitter, options, stream: true
		});
	}

	public async deepinfra(options: {
		prompt: string;
		negativePrompt?: string;
		width?: number;
		height?: number;
		steps?: number;
		guidance?: number;
		amount?: number;
		model?: string;
	}, emitter?: Emitter<ImageGenerationResult>): Promise<ImageGenerationResult> {
		return this.fetch({
			path: "image/deepinfra", emitter, options, stream: true
		});
	}

	public async kandinsky(options: {
		prompt: string;
		negativePrompt?: string;
		width?: number;
		height?: number;
		steps?: number;
		guidance?: number;
		sampler?: string;
		amount?: number;
	}, emitter?: Emitter<ImageGenerationResult>): Promise<ImageGenerationResult> {
		return this.fetch({
			path: "image/kandinsky", emitter, options, stream: true
		});
	}

	public async openai(options: {
		prompt: string;
		amount?: number;
	}, emitter?: Emitter<ImageGenerationResult>): Promise<ImageGenerationResult> {
		return this.fetch({
			path: "image/openai", emitter, options, stream: false
		});
	}

	public async interrogate(options: {
		url: string;
		model?: string;
	}, emitter?: Emitter<ImageInterrogateResult>): Promise<ImageInterrogateResult> {
		return this.fetch({
			path: "image/interrogate", emitter, options, stream: false
		});
	}
}

class DatasetAPI extends BaseAPI {
	public async get<T>(type: DatasetType, id: string): Promise<T> {
		return (await this.fetch({
			path: `dataset/${type}/${id}`
		})).data;
	}

	public async add<T>(type: DatasetType, id: string, data: T): Promise<T> {
		return await this.fetch({
			path: `dataset/${type}/${id}`, options: data as object
		});
	}
}

class StorageAPI extends BaseAPI {
	public async get(type: string, path: string): Promise<Buffer> {
		return this.fetchBinary({
			path: `storage/${type}/${path}`
		});
	}

	public async upload(type: string, path: string, data: Buffer): Promise<void> {
		await this.fetch({
			path: `storage/${type}/${path}`, data
		});
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
		return this.fetch({
			path: "pay", options
		});
	}

	public async plugins(): Promise<{
		url: string;
		id: string;
	}> {
		return this.fetch({
			path: "other/models", method: "GET", options
		});
	}
}

const options = {
	key: API_KEY, host: API_HOST
};

export function createAPI() {
	return {
		text: new TextAPI(options),
		image: new ImageAPI(options),
		dataset: new DatasetAPI(options),
		storage: new StorageAPI(options),
		other: new OtherAPI(options)
	};
}