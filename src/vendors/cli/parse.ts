/**
 * Reverse-parses generated Commander CLI TypeScript source files back into partial OpenAPI specifications.
 *
 * @module vendors/cli/parse
 */
import { type CallExpression, Project, SyntaxKind } from "ts-morph";
import type {
	Parameter,
	PathItem,
	SpecOperation,
	SwaggerSpec,
} from "../../core/types/index.js";

/**
 * Parses a generated Commander CLI TypeScript source string into a partial `SwaggerSpec`.
 *
 * @param sourceText - TypeScript source code of `cli.ts`.
 * @param filePath - Virtual file path used when creating the `ts-morph` source file.
 * @returns Reconstructed partial `SwaggerSpec` containing info, servers, and paths.
 */
export function parseGeneratedCliSource(
	sourceText: string,
	filePath = "cli.ts",
): Partial<SwaggerSpec> {
	const project = new Project({ useInMemoryFileSystem: true });
	const sourceFile = project.createSourceFile(filePath, sourceText, {
		overwrite: true,
	});

	const info: NonNullable<SwaggerSpec["info"]> = {
		title: "api-cli",
		version: "1.0.0",
	};
	const paths: NonNullable<SwaggerSpec["paths"]> = {};
	const servers: NonNullable<SwaggerSpec["servers"]> = [];

	const spec: Partial<SwaggerSpec> = {
		openapi: "3.1.0",
		info,
		paths,
		servers,
	};

	function getBaseIdentifier(
		node: import("ts-morph").Node,
	): string | undefined {
		if (node.getKind() === SyntaxKind.Identifier) {
			return node.getText();
		}
		if (node.getKind() === SyntaxKind.CallExpression) {
			return getBaseIdentifier((node as CallExpression).getExpression());
		}
		if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
			return getBaseIdentifier(
				(node as import("ts-morph").PropertyAccessExpression).getExpression(),
			);
		}
		return undefined;
	}

	const programDecls = sourceFile
		.getVariableDeclarations()
		.filter((v) => v.getName() === "program");
	if (programDecls.length > 0) {
		(
			sourceFile.getDescendantsOfKind(
				SyntaxKind.CallExpression,
			) as CallExpression[]
		).forEach((call) => {
			const exp = call.getExpression();
			if (exp.getKind() === SyntaxKind.PropertyAccessExpression) {
				const prop = exp as import("ts-morph").PropertyAccessExpression;
				const baseName = getBaseIdentifier(prop.getExpression());
				if (baseName === "program") {
					const name = prop.getName();
					const args = call.getArguments();

					if (name === "name" && args[0]) {
						info.title = args[0].getText().replace(/['"]/g, "");
					}

					if (name === "version" && args[0]) {
						info.version = args[0].getText().replace(/['"]/g, "");
					}

					if (name === "description" && args[0]) {
						// Check that this is chained directly to program.name or program itself
						const exprText = prop.getExpression().getText();
						const isProgramDesc =
							exprText === "program" || exprText.startsWith("program.name(");

						if (isProgramDesc) {
							info.description = args[0]
								.getText()
								.replace(/['"]/g, "")
								.replace(/\\'/g, "'");
						}
					}
					if (name === "option" && args[0]) {
						const optStr = args[0].getText().replace(/['"]/g, "");
						if (optStr.includes("--server")) {
							const url = args[2] ? args[2].getText().replace(/['"]/g, "") : "";
							if (url) {
								servers.push({ url });
							}
						}
					}
				}
			}
		});
	}

	const groupVars = sourceFile
		.getVariableDeclarations()
		.filter((v) => v.getName().endsWith("Command"));

	groupVars.forEach((v) => {
		const tag = v.getName().replace("Command", "");
		(
			sourceFile.getDescendantsOfKind(
				SyntaxKind.CallExpression,
			) as CallExpression[]
		).forEach((call) => {
			const exp = call.getExpression();
			const prop = exp as import("ts-morph").PropertyAccessExpression;
			const isGroupCommand =
				exp.getKind() === SyntaxKind.PropertyAccessExpression &&
				prop.getName() === "command" &&
				getBaseIdentifier(prop.getExpression()) === v.getName();
			if (isGroupCommand) {
				const methodArg = call.getArguments()[0];
				if (methodArg) {
					const methodName = methodArg.getText().replace(/['"]/g, "");
					const pathKey = `/${tag}/${methodName}`;

					const pathItem: PathItem = {};
					paths[pathKey] = pathItem;

					const op: SpecOperation = {
						operationId: methodName,
						tags: [tag.charAt(0).toUpperCase() + tag.slice(1)],
						responses: { "200": { description: "Success" } },
					};

					let httpMethod:
						| "get"
						| "post"
						| "put"
						| "delete"
						| "patch"
						| "head"
						| "options" = "post";
					const lowerMethod = methodName.toLowerCase();
					if (
						lowerMethod.startsWith("delete") ||
						lowerMethod.startsWith("remove")
					) {
						httpMethod = "delete";
					} else if (
						lowerMethod.startsWith("put") ||
						lowerMethod.startsWith("update")
					) {
						httpMethod = "put";
					} else if (lowerMethod.startsWith("patch")) {
						httpMethod = "patch";
					}

					let parent = call.getParent();
					while (
						parent &&
						parent.getKind() === SyntaxKind.PropertyAccessExpression
					) {
						const pCall = parent.getParentIfKind(SyntaxKind.CallExpression) as
							| CallExpression
							| undefined;
						if (!pCall) {
							break;
						}
						const pName = (
							parent as import("ts-morph").PropertyAccessExpression
						).getName();
						if (pName === "description") {
							op.description = (
								pCall.getArguments()[0] as import("ts-morph").Node
							)
								.getText()
								.replace(/['"]/g, "");
						} else if (pName === "option") {
							const optStr = (
								pCall.getArguments()[0] as import("ts-morph").Node
							)
								.getText()
								.replace(/['"]/g, "");
							const optDesc = pCall
								.getArguments()[1]
								?.getText()
								.replace(/['"]/g, "");
							const optMatch = optStr.match(
								/--([a-zA-Z0-9-]+)\s+(<[^>]+>|\[[^\]]+\])/,
							);
							if (optMatch) {
								if (!op.parameters) op.parameters = [];
								op.parameters.push({
									name: optMatch[1] as string,
									in: "query",
									required: (optMatch[2] as string).startsWith("<"),
									description: optDesc,
								} as Parameter);
							}
						}
						parent = pCall.getParent();
					}

					pathItem[httpMethod] = op;
					if (httpMethod !== "post") {
						pathItem.post = op;
					}
				}
			}
		});
	});

	return spec;
}
