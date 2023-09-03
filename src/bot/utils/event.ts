import EventEmitter from "events";

export type EmitterData = { done: boolean } & Record<string, any>;

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
}