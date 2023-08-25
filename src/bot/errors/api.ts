interface APIErrorOptions {
	/** Information about the error */
	data: string | object;
	
	/** Status code of the error */
	code: number;
}

export class APIError extends Error {
	public readonly options: APIErrorOptions;

	constructor(response: Response, body: any) {
		super();

		this.options = {
			code: response.status,
			data: body.error
		};
	}
}