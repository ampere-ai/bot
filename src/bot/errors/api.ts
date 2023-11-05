interface APIErrorOptions {
	/** Information about the error */
	data: {
		message: string;
		id: string | null;
	} | null;
	
	/** Path of the original API request */
	path: string;

	/** Status code of the error */
	code: number;
}

export class APIError extends Error {
	public readonly options: APIErrorOptions;

	constructor(response: Response | null, path: string, body: {
		error?: NonNullable<APIErrorOptions["data"]>
	} | null) {
		super();

		this.options = {
			code: response?.status ?? 500,
			data: body?.error ?? null,
			path
		};

		this.name = "APIError";
		this.message = `API request /${this.options.path} failed with code ${this.options.code}${this.options.data ? ` -> ${this.options.data.message}` : ""}`;
	}
}