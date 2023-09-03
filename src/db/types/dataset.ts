export type DatasetType = "conversation" | "image";

export interface DBDatasetEntry<T = any> {
	/** Unique identifier of the entry */
	id: string;

	/** Name of the dataset this entry corresponds to */
	type: DatasetType;

	/** When this entry was added */
	created: string;

	/** Data of the dataset entry */
	data: T;
}