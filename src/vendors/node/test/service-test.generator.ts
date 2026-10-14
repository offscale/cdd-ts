/**
 * Generates unit test files for Node.js `http`/`https` API client services.
 *
 * @module vendors/node/test/service-test.generator
 */

import type { ImportDeclarationStructure, OptionalKind } from "ts-morph";
import type { PathInfo } from "../../../core/types/index.js";
import { PromiseServiceTestGenerator } from "../../../tests/emit_service_test.js";

/**
 * Generates unit tests for Node.js HTTP/HTTPS API services.
 */
export class NodeServiceTestGenerator extends PromiseServiceTestGenerator {
	/**
	 * Node services always use the `.service.ts` naming convention.
	 *
	 * @returns `false`.
	 */
	protected override isVanillaClient(): boolean {
		return false;
	}

	/**
	 * Adds `EventEmitter`, `http`, and `https` imports to the generated test file.
	 *
	 * @returns Import declarations for `node:events`, `https`, and `http`.
	 */
	protected override getAdditionalImports(): OptionalKind<ImportDeclarationStructure>[] {
		return [
			{
				moduleSpecifier: "node:events",
				namedImports: ["EventEmitter"],
			},
			{
				moduleSpecifier: "https",
				defaultImport: "https",
			},
			{
				moduleSpecifier: "http",
				defaultImport: "http",
			},
		];
	}

	/**
	 * Emits `vi.spyOn(http, 'request')` mock setup returning a mocked `EventEmitter` response stream.
	 *
	 * @param _op - The operation being tested.
	 * @param _serviceName - The generated service class name.
	 * @returns Array of setup statements.
	 */
	protected override getTransportMockSetupLines(
		_op: PathInfo,
		_serviceName: string,
	): string[] {
		return [
			`const mockResponse = {};`,
			`const requestSpy = vi.spyOn(http, 'request').mockImplementation(((options: unknown, callback?: (res: EventEmitter & { statusCode?: number; headers?: Record<string, string> }) => void) => {`,
			`    const res = new EventEmitter() as EventEmitter & { statusCode?: number; headers?: Record<string, string> };`,
			`    res.statusCode = 200;`,
			`    res.headers = { 'content-type': 'application/json' };`,
			`    if (callback) {`,
			`        callback(res);`,
			`    }`,
			`    res.emit('data', Buffer.from(JSON.stringify(mockResponse)));`,
			`    res.emit('end');`,
			`    const req = new EventEmitter() as EventEmitter & { write: () => void; end: () => void };`,
			`    req.write = vi.fn();`,
			`    req.end = vi.fn();`,
			`    return req as never;`,
			`}) as never);`,
		];
	}

	/**
	 * Emits assertions verifying `http.request` options and the parsed response value.
	 *
	 * @param op - The operation being tested.
	 * @returns Array of assertion statements.
	 */
	protected override getTransportMockAssertionLines(op: PathInfo): string[] {
		return [
			`expect(requestSpy).toHaveBeenCalledWith(expect.objectContaining({ method: '${op.method.toUpperCase()}' }), expect.any(Function));`,
			`expect(result).toEqual(mockResponse);`,
		];
	}
}
