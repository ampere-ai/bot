import dotenv from "dotenv";
dotenv.config();

import { calculateBits, camelToSnakeCase, createLogger } from "@discordeno/utils";
import { RequestMethods, createRestManager } from "@discordeno/bot";

import formData from "express-form-data";
import express from "express";

import { BOT_TOKEN, REST_PORT, HTTP_AUTH } from "../config.js";
import { readFile } from "fs/promises";
import { bold } from "colorette";

const logger = createLogger({ name: "[REST]" });

const rest = createRestManager({
	token: BOT_TOKEN
});

/* Fix broken localization keys, due to requests going through this function two times */
rest.changeToDiscordFormat = (obj: any) => {
	if (obj === null) return null;

	if (typeof obj === "object") {
		if (Array.isArray(obj)) return obj.map((item) => rest.changeToDiscordFormat(item));
		const newObj: any = {};

		for (const key of Object.keys(obj)){
			const value = obj[key];

			if (value !== undefined) {
				switch(key){
					case "permissions":
					case "allow":
					case "deny":
						newObj[key] = typeof value === "string" ? value : calculateBits(value);
						continue;
					case "defaultMemberPermissions":
						newObj.default_member_permissions = typeof value === "string" ? value : calculateBits(value);
						continue;
					case "nameLocalizations":
					case "name_localizations":
						newObj.name_localizations = value;
						continue;
					case "descriptionLocalizations":
					case "description_localizations":
						newObj.description_localizations = value;
						continue;
				}
			}
			
			newObj[camelToSnakeCase(key)] = rest.changeToDiscordFormat(value);
		}

		return newObj;
	}

	if (typeof obj === "bigint") return obj.toString();
	return obj;
};

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

app.use(formData.parse({
	autoClean: true
}));

app.use(formData.format());

app.use(express.json({
	limit: "50mb"
}));



app.all("/*", async (req, res) => {
	if (HTTP_AUTH !== req.headers.authorization) {
		return res.status(401).json({ error: "Invalid authorization" });
	}

	try {
		req.body.files = [];

		/* Add all files to the request. */
		for (const file of Object.values(req.files)) {
			req.body.files.push({
				name: file.name, blob: new Blob([ await readFile(file.path) ])
			});
		}

		/* If files were uploaded, parse the original payload again. */
		if (req.body.payload_json) {
			req.body = { ...req.body, ...JSON.parse(req.body.payload_json) };
			delete req.body.payload_json;
		}

		const result = await rest.makeRequest(
			req.method as RequestMethods, req.url.substring(4),

			{
				body: req.method !== "DELETE" && req.method !== "GET" ? req.body : undefined,
				files: req.body.files.length > 0 ? req.body.files : undefined
			}
		);

		if (result) res.status(200).json(result);
		else res.status(204).json();

	} catch (err) {
		if (err instanceof Error) {
			logger.error(bold("An error occurred"), "->", err);

			return res.status(500).json({
				error: err.toString(),
				success: false
			});
		}

		const error = err as RESTError;

		logger.error(req.method, req.url, `status code ${error.status} ->`, error.body);
		res.status(error.status ?? 500).json(error);
	}
});

app.listen(REST_PORT, () => {
	logger.info("Started.");
});