interface APIErrorOptions {
	/** Information about the error */
	data: string;
	
	/** Status code of the error */
	code: number;
}

export class APIError extends Error {
	public readonly options: APIErrorOptions;

	constructor(response: Response, body: any) {
		super(body.error.toString());
		this.name = "APIError";

		this.options = {
			code: response.status,
			data: body.error
		};
	}
}