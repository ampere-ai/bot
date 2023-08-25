import EventEmitter from "events";

import type { ConversationResult } from "../types/conversation.js";
import type { ImageGenerationResult } from "../types/image.js";
import type { ChatModelResult } from "../chat/models/mod.js";

import { ChatError, ChatErrorType } from "../errors/chat.js";

export type EmitterData = ConversationResult | ChatModelResult | ImageGenerationResult

export class Emitter<T extends EmitterData> {
	private readonly emitter: EventEmitter;

	constructor() {
		this.emitter = new EventEmitter();
	}

	public emit(data: T) {
		this.emitter.emit("data", data);
	}

	public on(listener: (data: T) => void) {
		this.emitter.on("data", listener);
	}

	/** Wait until the request has been completed. */
	public async wait(timeout: number = 120 * 1000): Promise<T> {
		return Promise.race<T>([
			new Promise(resolve => {
				this.on(data => {
					if (data.done) resolve(data);
				});
			}),

			new Promise((_, reject) => {
				setTimeout(() => {
					reject(new ChatError(ChatErrorType.TimedOut));
				}, timeout);
			})
		]);
	}
}