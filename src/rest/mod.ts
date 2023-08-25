import dotenv from "dotenv";
dotenv.config();

import { RequestMethods, createRestManager } from "@discordeno/bot";
import { createLogger } from "@discordeno/utils";
import express from "express";

import { BOT_TOKEN, REST_PORT, HTTP_AUTH } from "../config.js";

const logger = createLogger({ name: "[REST]" });

const rest = createRestManager({
	token: BOT_TOKEN
});

interface RESTError {
	ok: boolean;
	status: number;
	body: string;
}

// @ts-expect-error Missing property
rest.convertRestError = (errorStack, data) => {
	if (!data) return { message: errorStack.message };
	return { ...data, message: errorStack.message };
};

const app = express();

app.use(
	express.urlencoded({
		extended: true, limit: "50mb"
	})
);

app.use(express.json({
	limit: "50mb"
}));

app.all("/*", async (req, res) => {
	if (HTTP_AUTH !== req.headers.authorization) {
		return res.status(401).json({ error: "Invalid authorization" });
	}

	try {
		if (req.body.file) {
			req.body.file.blob = new Blob([ Buffer.from(req.body.file.blob, "base64") ]);
		}

		const result = await rest.makeRequest(
			req.method as RequestMethods, req.url.substring(4),
			{ body: req.method !== "DELETE" && req.method !== "GET" ? req.body : undefined }
		);

		logger.debug(req.method, req.url);

		if (result) res.status(200).json(result);
		else res.status(204).json();

	} catch (err) {
		const error = err as RESTError;

		logger.error(req.method, req.url, `status code ${error.status} ->`, error.body);
		res.status(error.status).json(error);
	}
});

app.listen(REST_PORT, () => {
	logger.info("Started.");
});