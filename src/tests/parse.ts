import { CallExpression, SourceFile, SyntaxKind, StringLiteral, NoSubstitutionTemplateLiteral } from 'ts-morph';

export interface ParsedTestBlock {
    description: string;
    type: 'describe' | 'it' | 'test';
    children?: ParsedTestBlock[];
}

export function parseTests(sourceFile: SourceFile): ParsedTestBlock[] {
    if (!sourceFile) return [];

    const testBlocks: ParsedTestBlock[] = [];
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    const processedNodes = new Set<any>();

    for (const callExpr of callExpressions) {
        if (processedNodes.has(callExpr)) continue;
        const block = extractTestBlock(callExpr as any, processedNodes);
        if (block) testBlocks.push(block);
    }
    return testBlocks;
}

function extractTestBlock(callExpr: CallExpression, processedNodes: Set<any>): ParsedTestBlock | undefined {
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

    const firstArg = args[0] as any;
    let description = '';

    if (firstArg.isKind(SyntaxKind.StringLiteral) || firstArg.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
        description = (firstArg as StringLiteral | NoSubstitutionTemplateLiteral).getLiteralText();
    } else {
        description = firstArg.getText();
    }

    const type = functionName as 'describe' | 'it' | 'test';
    const children: ParsedTestBlock[] = [];

    if (type === 'describe') {
        const bodyFn = args[1] as any;
        if (bodyFn && (bodyFn.isKind(SyntaxKind.ArrowFunction) || bodyFn.isKind(SyntaxKind.FunctionExpression))) {
            const nestedCalls = bodyFn.getDescendantsOfKind(SyntaxKind.CallExpression);
            for (const nestedCall of nestedCalls) {
                if (!processedNodes.has(nestedCall)) {
                    const nestedBlock = extractTestBlock(nestedCall as any, processedNodes);
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
