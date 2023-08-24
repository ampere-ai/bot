import { handleMessage, runningGenerations } from "../../chat/mod.js";
import { ResponseError } from "../../error/response.js";
import { createEvent } from "../../helpers/event.js";

export default createEvent("messageCreate", async (bot, message) => {
	try {
		await handleMessage(bot, message);
	} catch (error) {
		if (error instanceof ResponseError) {
			return void await (message).reply(
				error.display()
			).catch(() => {});
		}

		runningGenerations.delete(message.author.id);
		bot.logger.error("Failed to handle message ->", error);
	}
});