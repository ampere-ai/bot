import type { DiscordUser, User } from "@discordeno/bot";

import { createTransformer } from "../helpers/transformer.js";

export default createTransformer<"user", User, DiscordUser>({
	name: "user", properties: [ "username", "avatar", "id" ]
});