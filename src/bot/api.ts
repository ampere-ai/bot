import { fetchEventSource } from "@waylaidwanderer/fetch-event-source";

import type { ConversationMessage } from "./types/conversation.js";
import type { ChatModelResult } from "./chat/models/mod.js";

import { Emitter, EmitterData } from "./utils/event.js";
import { API_KEY, API_HOST } from "../config.js";
import { APIError } from "./errors/api.js";


interface BaseAPIOptions {
	key: string;
	host: string;
}

class BaseAPI {
	private readonly options: BaseAPIOptions;

	constructor(options: BaseAPIOptions) {
		this.options = options;
	}

	public async fetch<T extends EmitterData>(path: string, options: object & { stream: true }): Promise<Emitter<T>>;
	public async fetch<T extends EmitterData>(path: string, options: object & { stream?: false }): Promise<T>;

	public async fetch<T extends EmitterData>(
		path: string, options: object & { stream?: boolean }
	): Promise<Emitter<T> | T> {
		const url = `${this.options.host}/${path}`;

		const headers = {
			"Content-Type": "application/json",
			Authorization: this.options.key
		};

		if (options.stream) {
			const emitter = new Emitter<T>();

			fetchEventSource(url, {
				method: "POST", headers,
				body: JSON.stringify(options),

				onopen: async response => {
					if (!response.ok) {
						throw new APIError(response, await response.json());
					}
				},

				onerror: error => {
					throw error;
				},

				onmessage: ({ data: raw }) => {
					const data = JSON.parse(raw);
					emitter.emit(data);
				}
			});

			return emitter;

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
	}): Promise<Emitter<ChatModelResult>> {
		return this.fetch("text/gpt", {
			...options, stream: true
		});
	}
}

class ImageAPI extends BaseAPI {

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
		})
	};
}