declare namespace Express {
	export interface RequestFile {
		name: string;
		path: string;
	}

	export interface Request {
		files: RequestFile[];
	}
}