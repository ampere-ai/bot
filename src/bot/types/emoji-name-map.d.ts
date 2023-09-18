declare module "emoji-name-map" {
	interface EmojiNameMap {
		get: (name: string) => string;
	}
  
	const map: EmojiNameMap;
	export default map;
  }
  