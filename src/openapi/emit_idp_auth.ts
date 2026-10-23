/**
 * Generates the `utils/auth-session.ts` module providing `SdkAuthClient` and `AuthSession` helpers for authenticating against the integrated Identity Provider (IdP) / Auth Server.
 *
 * @module openapi/emit_idp_auth
 */
import * as path from "node:path";
import { type CodeBlockWriter, type Project, Scope } from "ts-morph";

/**
 * Generates `utils/auth-session.ts` inside a generated client SDK.
 * Provides `SdkAuthClient` with `.register()`, `.login()`, `.refresh()`, `.logout()`, session management, and automatic `Bearer` header attachment.
 */
export class IdpAuthHelperGenerator {
	/**
	 * Creates a new `IdpAuthHelperGenerator`.
	 *
	 * @param project - Target `ts-morph` project.
	 */
	constructor(private readonly project: Project) {}

	/**
	 * Generates `utils/auth-session.ts` in the specified `outputDir`.
	 *
	 * @param outputDir - Root output directory of the generated SDK.
	 */
	public generate(outputDir: string): void {
		const filePath = path.join(outputDir, "utils", "auth-session.ts");
		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		sourceFile.addInterface({
			name: "AuthSession",
			isExported: true,
			docs: [
				"Represents an authenticated session returned by the integrated Identity Provider (IdP).",
			],
			properties: [
				{
					name: "username",
					type: "string",
					hasQuestionToken: true,
					docs: ["Authenticated username."],
				},
				{
					name: "accessToken",
					type: "string",
					docs: ["Issued access token used for Bearer authentication."],
				},
				{
					name: "refreshToken",
					type: "string",
					hasQuestionToken: true,
					docs: ["Issued refresh token used to rotate the access token."],
				},
				{
					name: "tokenType",
					type: "string",
					docs: ['Token scheme prefix (typically `"Bearer"`).'],
				},
			],
		});

		const authClass = sourceFile.addClass({
			name: "SdkAuthClient",
			isExported: true,
			docs: [
				"Client helper for authenticating against the integrated Identity Provider (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`) and automatically attaching Bearer credentials to subsequent SDK requests.",
			],
		});

		authClass.addProperty({
			name: "sharedSession",
			scope: Scope.Private,
			isStatic: true,
			type: "AuthSession | null",
			initializer: "null",
			docs: ["Shared session across SDK service instances."],
		});

		authClass.addProperty({
			name: "basePath",
			scope: Scope.Private,
			type: "string",
			initializer: '""',
			docs: ["Base URL of the target API / Auth Server."],
		});

		authClass.addProperty({
			name: "session",
			scope: Scope.Private,
			type: "AuthSession | null",
			initializer: "null",
			docs: ["Instance-scoped session state."],
		});

		authClass.addConstructor({
			docs: [
				{
					description: "Creates a new `SdkAuthClient`.",
				},
			],
			parameters: [
				{
					name: "basePath",
					type: "string",
					initializer: '""',
				},
			],
			statements: "this.basePath = basePath;",
		});

		authClass.addMethod({
			name: "register",
			isAsync: true,
			returnType: "Promise<AuthSession>",
			docs: [
				{
					description:
						"Registers a new user via `POST /auth/register` and stores the resulting session token.",
				},
			],
			parameters: [
				{ name: "username", type: "string" },
				{ name: "password", type: "string" },
				{
					name: "extra",
					type: "Record<string, unknown>",
					hasQuestionToken: true,
				},
			],
			statements: (writer: CodeBlockWriter) => {
				writer.writeLine(
					"const response = await fetch(`${this.basePath}/auth/register`, {",
				);
				writer.indent(() => {
					writer.writeLine("method: 'POST',");
					writer.writeLine("headers: { 'Content-Type': 'application/json' },");
					writer.writeLine(
						"body: JSON.stringify({ username, password, ...(extra || {}) }),",
					);
				});
				writer.writeLine("});");
				writer.writeLine("if (!response.ok) {");
				writer.indent(() => {
					writer.writeLine(
						"throw new globalThis.Error(`Registration failed: ${response.status}`);",
					);
				});
				writer.writeLine("}");
				writer.writeLine(
					"const session = (await response.json()) as AuthSession;",
				);
				writer.writeLine("this.setSession(session);");
				writer.writeLine("return session;");
			},
		});

		authClass.addMethod({
			name: "login",
			isAsync: true,
			returnType: "Promise<AuthSession>",
			docs: [
				{
					description:
						"Exchanges credentials for an access and refresh token via `POST /auth/login` and stores the session.",
				},
			],
			parameters: [
				{ name: "username", type: "string" },
				{ name: "password", type: "string" },
			],
			statements: (writer: CodeBlockWriter) => {
				writer.writeLine(
					"const response = await fetch(`${this.basePath}/auth/login`, {",
				);
				writer.indent(() => {
					writer.writeLine("method: 'POST',");
					writer.writeLine("headers: { 'Content-Type': 'application/json' },");
					writer.writeLine("body: JSON.stringify({ username, password }),");
				});
				writer.writeLine("});");
				writer.writeLine("if (!response.ok) {");
				writer.indent(() => {
					writer.writeLine(
						"throw new globalThis.Error(`Login failed: ${response.status}`);",
					);
				});
				writer.writeLine("}");
				writer.writeLine(
					"const session = (await response.json()) as AuthSession;",
				);
				writer.writeLine("this.setSession(session);");
				writer.writeLine("return session;");
			},
		});

		authClass.addMethod({
			name: "refresh",
			isAsync: true,
			returnType: "Promise<AuthSession>",
			docs: [
				{
					description:
						"Rotates the active refresh token via `POST /auth/refresh` and updates the stored session.",
				},
			],
			parameters: [
				{ name: "refreshToken", type: "string", hasQuestionToken: true },
			],
			statements: (writer: CodeBlockWriter) => {
				writer.writeLine(
					"const tokenToRefresh = refreshToken || this.getRefreshToken();",
				);
				writer.writeLine(
					"const response = await fetch(`${this.basePath}/auth/refresh`, {",
				);
				writer.indent(() => {
					writer.writeLine("method: 'POST',");
					writer.writeLine("headers: { 'Content-Type': 'application/json' },");
					writer.writeLine(
						"body: JSON.stringify({ refreshToken: tokenToRefresh }),",
					);
				});
				writer.writeLine("});");
				writer.writeLine("if (!response.ok) {");
				writer.indent(() => {
					writer.writeLine(
						"throw new globalThis.Error(`Token refresh failed: ${response.status}`);",
					);
				});
				writer.writeLine("}");
				writer.writeLine(
					"const session = (await response.json()) as AuthSession;",
				);
				writer.writeLine("this.setSession(session);");
				writer.writeLine("return session;");
			},
		});

		authClass.addMethod({
			name: "logout",
			isAsync: true,
			returnType: "Promise<void>",
			docs: [
				{
					description:
						"Revokes the current session via `POST /auth/logout` and clears stored tokens.",
				},
			],
			statements: (writer: CodeBlockWriter) => {
				writer.writeLine("const accessToken = this.getAccessToken();");
				writer.writeLine("const refreshToken = this.getRefreshToken();");
				writer.writeLine("await fetch(`${this.basePath}/auth/logout`, {");
				writer.indent(() => {
					writer.writeLine("method: 'POST',");
					writer.writeLine(
						"headers: { 'Content-Type': 'application/json', ...this.getAuthorizationHeader() },",
					);
					writer.writeLine(
						"body: JSON.stringify({ accessToken, refreshToken }),",
					);
				});
				writer.writeLine("});");
				writer.writeLine("this.setSession(null);");
			},
		});

		authClass.addMethod({
			name: "getSession",
			returnType: "AuthSession | null",
			docs: [
				{
					description:
						"Returns the currently active `AuthSession`, or `null` if unauthenticated.",
				},
			],
			statements: "return this.session ?? SdkAuthClient.sharedSession;",
		});

		authClass.addMethod({
			name: "setSession",
			returnType: "void",
			docs: [
				{
					description: "Updates the instance and shared `AuthSession`.",
				},
			],
			parameters: [{ name: "session", type: "AuthSession | null" }],
			statements: (writer: CodeBlockWriter) => {
				writer.writeLine("this.session = session;");
				writer.writeLine("SdkAuthClient.sharedSession = session;");
			},
		});

		authClass.addMethod({
			name: "getAccessToken",
			returnType: "string | null",
			docs: [
				{
					description:
						"Returns the active access token string, or `null` if not authenticated.",
				},
			],
			statements: "return this.getSession()?.accessToken ?? null;",
		});

		authClass.addMethod({
			name: "getRefreshToken",
			returnType: "string | null",
			docs: [
				{
					description:
						"Returns the active refresh token string, or `null` if not present.",
				},
			],
			statements: "return this.getSession()?.refreshToken ?? null;",
		});

		authClass.addMethod({
			name: "getAuthorizationHeader",
			returnType: "Record<string, string>",
			docs: [
				{
					description:
						"Constructs the `Authorization` header map for outgoing SDK requests when an active session token exists.",
				},
			],
			statements: (writer: CodeBlockWriter) => {
				writer.writeLine("const active = this.getSession();");
				writer.writeLine("if (active && active.accessToken) {");
				writer.indent(() => {
					writer.writeLine(
						"return { Authorization: `${active.tokenType || 'Bearer'} ${active.accessToken}` };",
					);
				});
				writer.writeLine("}");
				writer.writeLine("return {};");
			},
		});

		sourceFile.formatText();
	}
}
