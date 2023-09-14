interface APIErrorOptions {
	/** Information about the error */
	data: {
		message: string;
		id: string | null;
	} | null;
	
	/** Status code of the error */
	code: number;
}

export class APIError extends Error {
	public readonly options: APIErrorOptions;

	constructor(response: Response, body: any | null) {
		super();

		this.options = {
			code: response.status,
			data: body?.error ?? null
		};

		this.name = "APIError";
		this.message = this.options.data?.message ?? "API error";
	}
}