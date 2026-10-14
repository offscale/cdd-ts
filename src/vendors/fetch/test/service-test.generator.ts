/**
 * Generates unit test files for Fetch-based API client services.
 *
 * @module vendors/fetch/test/service-test.generator
 */
import type { PathInfo } from "../../../core/types/index.js";
import { PromiseServiceTestGenerator } from "../../../tests/emit_service_test.js";

/**
 * Generates unit tests for Fetch API services.
 */
export class FetchServiceTestGenerator extends PromiseServiceTestGenerator {
	/**
	 * Emits `globalThis.fetch` mock setup for each test case.
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
			`const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }));`,
		];
	}

	/**
	 * Emits assertions verifying `globalThis.fetch` arguments and the parsed response value.
	 *
	 * @param op - The operation being tested.
	 * @returns Array of assertion statements.
	 */
	protected override getTransportMockAssertionLines(op: PathInfo): string[] {
		const pathPrefix = op.path.split("{")[0];
		return [
			`expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('${pathPrefix}'), expect.objectContaining({ method: '${op.method.toUpperCase()}' }));`,
			`expect(result).toEqual(mockResponse);`,
		];
	}
}
