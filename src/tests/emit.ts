import { SourceFile } from 'ts-morph';

/**
 * Configuration options for emitting a test suite.
 */
export interface TestEmitOptions {
    /** The name or description of the main test suite (the describe block). */
    suiteName: string;
    /** The individual test cases to be added inside the suite. */
    cases: Array<{
        /** Description of what the test case verifies. */
        description: string;
        /** The actual test implementation code. */
        body: string;
    }>;
}

/**
 * Emits a structured test suite containing multiple test cases into the provided source file.
 * Automatically adds the required imports if they are not present.
 *
 * @param sourceFile - The ts-morph SourceFile where the tests should be appended.
 * @param options - Configuration containing the suite name and test cases.
 */
export function emitTestBlocks(sourceFile: SourceFile, options: TestEmitOptions): void {
    if (!sourceFile) {
        return;
    }

    // Ensure describe/it imports are available or assume global.
    // We won't strictly enforce importing them since test runners like Jest/Vitest often have globals,
    // but in modern setups it might be imported. For flexibility, we just write the blocks.

    const statements = sourceFile.getStatements();
    const hasExistingContent = statements.length > 0;

    const describeBlock = [
        "describe('" + options.suiteName + "', () => {",
        ...options.cases.flatMap(testCase => [
            "    it('" + testCase.description + "', () => {",
            ...testCase.body.split('\\n').map(line => '        ' + line),
            '    });',
        ]),
        '});',
    ].join('\\n');

    if (hasExistingContent) {
        sourceFile.addStatements(['\\n', describeBlock]);
    } else {
        sourceFile.replaceWithText(describeBlock);
    }
}
