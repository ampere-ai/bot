import type { Transformer, TransformerName } from "../transformers/mod.js";

export function createTransformer<T extends TransformerName, Transformed, Raw>(
	transformer: Transformer<T, Transformed, Raw>
): Transformer<T, Transformed, Raw> {
	return transformer;
}