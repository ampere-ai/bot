interface APIErrorOptions {
	/** Information about the error */
	data: string | null;
	
	/** Status code of the error */
	code: number;
}

export class APIError extends Error {
	public readonly options: APIErrorOptions;

	constructor(response: Response, body: any | null) {
		super(body.error.toString());
		this.name = "APIError";

		this.options = {
			code: response.status,
			data: body?.error ?? null
		};
	}
}