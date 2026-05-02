import { CallExpression, SourceFile, SyntaxKind, StringLiteral, NoSubstitutionTemplateLiteral } from 'ts-morph';

/**
 * Represents a parsed test block from a source file.
 */
export interface ParsedTestBlock {
    /** The description or name of the test block. */
    description: string;
    /** The type of the test block (e.g., 'describe', 'it', 'test'). */
    type: 'describe' | 'it' | 'test';
    /** Nested test blocks. */
    children?: ParsedTestBlock[];
}

/**
 * Parses a TypeScript source file to extract testing structures like \`describe\`, \`it\`, and \`test\` blocks.
 * This is useful for analyzing test coverage and linking tests to OpenAPI operations.
 *
 * @param sourceFile - The ts-morph SourceFile to parse.
 * @returns An array of parsed test blocks.
 */
export function parseTests(sourceFile: SourceFile): ParsedTestBlock[] {
    if (!sourceFile) {
        return [];
    }

    const testBlocks: ParsedTestBlock[] = [];
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    // Keep track of processed nodes to avoid duplicating nested nodes as root nodes
    const processedNodes = new Set<CallExpression>();

    for (const callExpr of callExpressions) {
        if (processedNodes.has(callExpr)) {
            continue;
        }

        const block = extractTestBlock(callExpr, processedNodes);
        if (block) {
            testBlocks.push(block);
        }
    }

    // Filter out blocks that were processed as children
    return testBlocks;
}

function extractTestBlock(callExpr: CallExpression, processedNodes: Set<CallExpression>): ParsedTestBlock | undefined {
    const expression = callExpr.getExpression();
    const functionName = expression.getText();

    if (functionName !== 'describe' && functionName !== 'it' && functionName !== 'test') {
        return undefined;
    }

    processedNodes.add(callExpr);

    const args = callExpr.getArguments();
    if (args.length < 2) {
        return undefined;
    }

    const firstArg = args[0];
    let description = '';

    if (firstArg.isKind(SyntaxKind.StringLiteral) || firstArg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
        description = (firstArg as StringLiteral | NoSubstitutionTemplateLiteral).getLiteralText();
    } else {
        // Fallback for complex expressions
        description = firstArg.getText();
    }

    const type = functionName as 'describe' | 'it' | 'test';
    const children: ParsedTestBlock[] = [];

    // If it's a describe block, we want to process its children immediately
    // to build the hierarchy and mark them as processed.
    if (type === 'describe') {
        const bodyFn = args[1];
        if (bodyFn && (bodyFn.isKind(SyntaxKind.ArrowFunction) || bodyFn.isKind(SyntaxKind.FunctionExpression))) {
            const nestedCalls = bodyFn.getDescendantsOfKind(SyntaxKind.CallExpression);
            for (const nestedCall of nestedCalls) {
                if (!processedNodes.has(nestedCall)) {
                    const nestedBlock = extractTestBlock(nestedCall, processedNodes);
                    if (nestedBlock) {
                        children.push(nestedBlock);
                    }
                }
            }
        }
    }

    return {
        description,
        type,
        ...(children.length > 0 ? { children } : {}),
    };
}
