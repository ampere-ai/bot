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

	constructor(response: Response | null, body: any | null) {
		super();

		this.options = {
			code: response?.status ?? 500,
			data: body?.error ?? null
		};

		this.name = "APIError";
		this.message = this.options.data?.message ?? "API error";
	}
}