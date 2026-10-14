/**
 * Generates unit test files for Axios-based API client services.
 *
 * @module vendors/axios/test/service-test.generator
 */

import type { ImportDeclarationStructure, OptionalKind } from "ts-morph";
import type { PathInfo } from "../../../core/types/index.js";
import { PromiseServiceTestGenerator } from "../../../tests/emit_service_test.js";

/**
 * Generates unit tests for Axios API services.
 */
export class AxiosServiceTestGenerator extends PromiseServiceTestGenerator {
	/**
	 * Axios services always use the `.service.ts` naming convention.
	 *
	 * @returns `false`.
	 */
	protected override isVanillaClient(): boolean {
		return false;
	}

	/**
	 * Adds the `axios` default import to the generated test file.
	 *
	 * @returns Import declarations for `axios`.
	 */
	protected override getAdditionalImports(): OptionalKind<ImportDeclarationStructure>[] {
		return [
			{
				moduleSpecifier: "axios",
				defaultImport: "axios",
			},
		];
	}

	/**
	 * Emits `mockAxiosInstance` setup for each test case.
	 *
	 * @param _op - The operation being tested.
	 * @param serviceName - The generated service class name.
	 * @returns Array of setup statements.
	 */
	protected override getTransportMockSetupLines(
		_op: PathInfo,
		serviceName: string,
	): string[] {
		return [
			`const mockResponse = {};`,
			`const mockAxiosInstance = { request: vi.fn().mockResolvedValue({ data: mockResponse, status: 200 }) };`,
			`service = new ${serviceName}('http://localhost:8080/v2', mockAxiosInstance as never);`,
		];
	}

	/**
	 * Emits assertions verifying `mockAxiosInstance.request` arguments and the parsed response value.
	 *
	 * @param op - The operation being tested.
	 * @returns Array of assertion statements.
	 */
	protected override getTransportMockAssertionLines(op: PathInfo): string[] {
		const pathPrefix = op.path.split("{")[0];
		return [
			`expect(mockAxiosInstance.request).toHaveBeenCalledWith(expect.objectContaining({ method: '${op.method.toUpperCase()}', url: expect.stringContaining('${pathPrefix}') }));`,
			`expect(result).toEqual(mockResponse);`,
		];
	}
}
