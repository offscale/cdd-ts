/**
 * Assembles OpenAPI webhooks, callbacks, links, and response header metadata onto an OpenAPI specification.
 *
 * @module openapi/emitters/assemble_webhooks_callbacks
 */
import type {
	OpenApiValue,
	SpecOperation,
	SwaggerSpec,
} from "../../core/types/index.js";
import type { ReverseMetadata } from "./assemble_components.js";

/**
 * Finds an operation by `operationId` across all paths and `additionalOperations` in `spec`.
 *
 * @param spec - OpenAPI specification to search.
 * @param opId - Target `operationId`.
 * @returns Matching `SpecOperation` or `undefined`.
 */
export function findOperationById(
	spec: SwaggerSpec,
	opId: string,
): SpecOperation | undefined {
	for (const pVal of Object.values(spec.paths || {})) {
		const pathObj = pVal as Record<string, OpenApiValue>;

		for (const methodKey of [
			"get",
			"post",
			"put",
			"patch",
			"delete",
			"options",
			"head",
			"trace",
			"query",
		]) {
			const methodRec = pathObj[methodKey] as
				| Record<string, OpenApiValue>
				| undefined;
			if (methodRec?.operationId === opId)
				return methodRec as OpenApiValue as SpecOperation;
		}

		if (pathObj.additionalOperations) {
			for (const opValEntry of Object.values(
				pathObj.additionalOperations as Record<string, OpenApiValue>,
			)) {
				const opRec = opValEntry as Record<string, OpenApiValue>;
				if (opRec.operationId === opId)
					return opRec as OpenApiValue as SpecOperation;
			}
		}
	}
	return undefined;
}

/**
 * Applies extracted response header objects, operation links, callbacks, webhooks, and path items onto `out`.
 *
 * @param out - Target `SwaggerSpec` to enrich.
 * @param metadata - Extracted `ReverseMetadata`.
 */
export function applyWebhooksAndCallbacks(
	out: SwaggerSpec,
	metadata: ReverseMetadata,
): void {
	const components = out.components as NonNullable<SwaggerSpec["components"]>;

	if (metadata.responseHeaderObjects) {
		Object.entries(metadata.responseHeaderObjects).forEach(
			([opId, statusMap]) => {
				const op = findOperationById(out, opId);
				if (op?.responses) {
					Object.entries(statusMap).forEach(([status, headers]) => {
						const opRespRec = op.responses[status] as
							| Record<string, OpenApiValue>
							| undefined;
						if (opRespRec) {
							opRespRec.headers = {
								...((opRespRec.headers as object) || {}),
								...headers,
							};
						}
					});
				}
			},
		);
	}

	if (metadata.links) {
		Object.entries(metadata.links).forEach(([opId, statusMap]) => {
			const op = findOperationById(out, opId);
			if (op?.responses) {
				Object.entries(statusMap).forEach(([status, links]) => {
					const opRespRec = op.responses[status] as
						| Record<string, OpenApiValue>
						| undefined;
					if (opRespRec) {
						opRespRec.links = links;
					}
				});
			}
		});
	}

	if (metadata.callbacks) {
		metadata.callbacks.forEach((cb) => {
			components.callbacks = components.callbacks || {};
			const callbacksRec = components.callbacks as Record<string, OpenApiValue>;
			if (!callbacksRec[cb.name]) {
				callbacksRec[cb.name] = {};
			}
			const m = callbacksRec[cb.name] as Record<string, OpenApiValue>;
			if (cb.expression) m[cb.expression] = cb.pathItem;
		});
	}

	if (metadata.webhooks) {
		metadata.webhooks.forEach((wh) => {
			const scope = wh.scope || "root";
			if (scope === "root") {
				out.webhooks = out.webhooks || {};
				(out.webhooks as Record<string, OpenApiValue>)[wh.name] = wh.pathItem;
				components.webhooks = components.webhooks || {};
				(components.webhooks as Record<string, OpenApiValue>)[wh.name] =
					wh.pathItem;
			} else {
				components.webhooks = components.webhooks || {};
				(components.webhooks as Record<string, OpenApiValue>)[wh.name] =
					wh.pathItem;
			}
		});
	}

	if (metadata.paths) {
		out.paths = out.paths || {};
		const paths = out.paths;
		Object.entries(metadata.paths).forEach(([pth, item]) => {
			const targetPath = paths[pth] || {};
			paths[pth] = targetPath;
			Object.assign(targetPath, item);
		});
	}
}
