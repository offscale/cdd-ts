/**
 * Downgrades an OpenAPI 3.x specification structure to Swagger 2.0 when `out.swagger` is set.
 *
 * @module openapi/emitters/downgrade_openapi
 */
import type {
	OpenApiValue,
	SecurityScheme,
	SwaggerSpec,
} from "../../core/types/index.js";

/**
 * Converts OpenAPI 3.x `servers`, `components`, `requestBody`, and `responses.content` into Swagger 2.0 equivalents when `out.swagger` is present.
 *
 * @param out - Mutable `SwaggerSpec` object to downgrade in-place if `out.swagger` is defined.
 * @returns The downgraded `SwaggerSpec` object.
 */
export function downgradeOpenApiToSwagger2(out: SwaggerSpec): SwaggerSpec {
	if (out.swagger) {
		// Convert servers to host, basePath, schemes
		if (out.servers && out.servers.length > 0) {
			const serverUrl = out.servers[0].url;
			try {
				let parsedUrl: URL;
				if (serverUrl.startsWith("/")) {
					out.basePath = serverUrl;
				} else if (typeof URL !== "undefined") {
					parsedUrl = new URL(serverUrl);
					out.host = parsedUrl.host;
					out.basePath = parsedUrl.pathname !== "/" ? parsedUrl.pathname : "/";
					out.schemes = [parsedUrl.protocol.replace(":", "")];
				}
			} catch (_e) {
				// Ignore if not a full URL
			}
			delete out.servers;
		}

		// Convert components to definitions, parameters, responses, securityDefinitions
		if (out.components) {
			if (out.components.schemas) {
				out.definitions = out.components.schemas;
			}
			if (out.components.parameters) {
				out.parameters = out.components.parameters;
			}
			if (out.components.responses) {
				out.responses = out.components.responses;
			}
			if (out.components.securitySchemes) {
				out.securityDefinitions = out.components.securitySchemes as Record<
					string,
					SecurityScheme
				>;
			}
			delete out.components;
		}

		// Convert paths
		if (out.paths) {
			for (const pathKey of Object.keys(out.paths as Record<string, unknown>)) {
				const pathObj = (out.paths as Record<string, unknown>)[
					pathKey
				] as Record<string, unknown>;
				for (const method of [
					"get",
					"post",
					"put",
					"delete",
					"options",
					"head",
					"patch",
				]) {
					if (pathObj[method]) {
						const op = pathObj[method] as {
							requestBody?: {
								content?: Record<string, { schema: unknown }>;
								description?: string;
								required?: boolean;
							};
							consumes?: string[];
							parameters?: OpenApiValue[];
							responses?: Record<
								string,
								{
									content?: Record<string, { schema: unknown }>;
									schema?: unknown;
								}
							>;
							produces?: string[];
						};

						// Handle Request Body -> consumes + in: 'body'
						if (op.requestBody?.content) {
							const mediaTypes = Object.keys(op.requestBody.content);
							if (mediaTypes.length > 0) {
								op.consumes = op.consumes || [];
								for (const mt of mediaTypes) {
									if (!op.consumes.includes(mt)) op.consumes.push(mt);
								}

								const schema = op.requestBody.content[mediaTypes[0]].schema as {
									properties?: Record<
										string,
										{ type?: string; format?: string; description?: string }
									>;
									required?: string[];
								};
								op.parameters = op.parameters || [];

								if (
									mediaTypes[0] === "application/x-www-form-urlencoded" ||
									mediaTypes[0] === "multipart/form-data"
								) {
									if (schema.properties) {
										for (const propName of Object.keys(schema.properties)) {
											const prop = schema.properties[propName];
											const isFile =
												prop.type === "string" &&
												(prop.format === "binary" || prop.format === "base64");
											op.parameters.push({
												in: "formData",
												name: propName,
												type: isFile ? "file" : prop.type || "string",
												description: prop.description,
												required: schema.required?.includes(propName),
											});
										}
									}
								} else {
									op.parameters.push({
										in: "body",
										name: "body",
										description: op.requestBody.description,
										required: op.requestBody.required,
										schema: schema,
									});
								}
							}
							delete op.requestBody;
						}

						// Handle Responses -> produces
						if (op.responses) {
							for (const status of Object.keys(op.responses)) {
								const resp = op.responses[status] as {
									content?: Record<string, { schema: unknown }>;
									schema?: unknown;
								};
								if (resp.content) {
									const mediaTypes = Object.keys(resp.content);
									if (mediaTypes.length > 0) {
										op.produces = op.produces || [];
										for (const mt of mediaTypes) {
											if (!op.produces.includes(mt)) op.produces.push(mt);
										}
										resp.schema = resp.content[mediaTypes[0]].schema;
									}
									delete resp.content;
								}
							}
						}
					}
				}
			}
		}
	}

	return out;
}
