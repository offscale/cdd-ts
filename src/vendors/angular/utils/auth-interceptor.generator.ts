import * as path from 'node:path';
import { Project } from 'ts-morph';
import { SwaggerParser } from '@src/openapi/parse.js';
import { UTILITY_GENERATOR_HEADER_COMMENT } from '@src/core/constants.js';
import { SecurityScheme } from '@src/core/types/index.js';
import { pascalCase } from '@src/functions/utils.js';

export class AuthInterceptorGenerator {
    constructor(
        private parser: SwaggerParser,

        private project: Project,
    ) {}

    public generate(outputDir: string): { tokenNames: string[] } | void {
        const securitySchemes = Object.values(this.parser.getSecuritySchemes());

        const hasApiKeyHeader = securitySchemes.some(s => s.type === 'apiKey' && s.in === 'header');

        const hasApiKeyQuery = securitySchemes.some(s => s.type === 'apiKey' && s.in === 'query');

        const hasApiKeyCookie = securitySchemes.some(s => s.type === 'apiKey' && s.in === 'cookie');

        // OAS 3.0 support: Generic HTTP schemes (Basic, Digest, etc) alongside Bearer/OAuth2/OIDC

        const hasHttpToken = securitySchemes.some(s => this.isHttpTokenScheme(s));

        const hasMutualTLS = securitySchemes.some(s => s.type === 'mutualTLS');

        if (!hasApiKeyHeader && !hasApiKeyQuery && !hasApiKeyCookie && !hasHttpToken && !hasMutualTLS) {
            return;
        }

        const authDir = path.join(outputDir, 'auth');

        const filePath = path.join(authDir, 'auth.interceptor.ts');

        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.insertText(0, UTILITY_GENERATOR_HEADER_COMMENT);

        const tokenImports: string[] = ['SECURITY_CONTEXT_TOKEN'];

        const tokenNames: string[] = [];

        if (hasApiKeyHeader || hasApiKeyQuery) {
            tokenImports.push('API_KEY_TOKEN');

            tokenNames.push('apiKey');
        }

        if (hasApiKeyCookie) {
            tokenImports.push('COOKIE_AUTH_TOKEN');

            tokenNames.push('cookieAuth');
        }

        if (hasHttpToken) {
            tokenImports.push('BEARER_TOKEN_TOKEN');

            tokenNames.push('bearerToken');
        }

        if (hasMutualTLS) {
            tokenImports.push('HTTPS_AGENT_CONFIG_TOKEN');

            tokenImports.push('HTTPS_AGENT_CONTEXT_TOKEN');

            tokenNames.push('httpsAgentConfig');
        }

        sourceFile.addImportDeclarations([
            {
                moduleSpecifier: '@angular/common/http',
                namedImports: ['HttpEvent', 'HttpHandlerFn', 'HttpInterceptorFn', 'HttpRequest', 'HttpHeaders'],
            },
            { moduleSpecifier: '@angular/core', namedImports: ['inject'] },
            { moduleSpecifier: 'rxjs', namedImports: ['Observable'] },
            { moduleSpecifier: './auth.tokens', namedImports: tokenImports },
            // Helper used for correct cookie serialization logic (OAS 3.2)
            ...(hasApiKeyCookie
                ? [
                      {
                          moduleSpecifier: '../utils/http-params-builder',
                          namedImports: ['HttpParamsBuilder'],
                      },
                  ]
                : []),
        ]);

        const schemeLogicParts: string[] = [];

        const uniqueSchemesMap = this.parser.getSecuritySchemes();

        Object.entries(uniqueSchemesMap).forEach(([name, scheme]) => {
            if (scheme.type === 'apiKey' && scheme.name) {
                if (scheme.in === 'header') {
                    schemeLogicParts.push(
                        `'${name}': (req, scopes, deps) => deps.apiKey ? req.clone({ headers: req.headers.set('${scheme.name}', deps.apiKey) }) : null`,
                    );
                } else if (scheme.in === 'query') {
                    schemeLogicParts.push(
                        `'${name}': (req, scopes, deps) => deps.apiKey ? req.clone({ params: req.params.set('${scheme.name}', deps.apiKey) }) : null`,
                    );
                } else if (scheme.in === 'cookie') {
                    schemeLogicParts.push(`'${name}': (req, scopes, deps) => {
                        if (!deps.cookieAuth) return null;
                        if (typeof window !== 'undefined') {
                            console.warn('Setting "Cookie" header manually for scheme "${name}". This usually fails in browsers.');
                        }
                        const cookieVal = HttpParamsBuilder.serializeCookieParam('${scheme.name}', deps.cookieAuth, 'form', true, false);
                        const existing = req.headers.get('Cookie') || '';
                        const newCookie = existing ? \`\${existing}; \${cookieVal}\` : cookieVal;
                        return req.clone({ headers: req.headers.set('Cookie', newCookie) });
                    }`);
                }
            } else if (this.isHttpTokenScheme(scheme)) {
                const prefix = this.getAuthPrefix(scheme);

                schemeLogicParts.push(`'${name}': (req, scopes, deps) => {
                    const token = typeof deps.bearerToken === 'function' ? deps.bearerToken() : deps.bearerToken;
                    return token ? req.clone({ headers: req.headers.set('Authorization', \`${prefix} \${token}\`) }) : null;
                }`);
            } else if (scheme.type === 'mutualTLS') {
                schemeLogicParts.push(
                    `'${name}': (req, scopes, deps) => deps.mtlsConfig ? req.clone({ context: req.context.set(HTTPS_AGENT_CONTEXT_TOKEN, deps.mtlsConfig) }) : req`,
                );
            }
        });

        const statementsBody = `
        const deps = {
            ${hasApiKeyHeader || hasApiKeyQuery ? 'apiKey: inject(API_KEY_TOKEN, { optional: true }),' : ''}
            ${hasApiKeyCookie ? 'cookieAuth: inject(COOKIE_AUTH_TOKEN, { optional: true }),' : ''}
            ${hasHttpToken ? 'bearerToken: inject(BEARER_TOKEN_TOKEN, { optional: true }),' : ''}
            ${hasMutualTLS ? 'mtlsConfig: inject(HTTPS_AGENT_CONFIG_TOKEN, { optional: true }),' : ''}
        };

        const requirements = req.context.get(SECURITY_CONTEXT_TOKEN);
        const applicators: Record<string, (r: HttpRequest<unknown>, scopes: string[] | undefined, d: typeof deps) => HttpRequest<unknown> | null> = {
            ${schemeLogicParts.join(',\n            ')}
        };

        if (requirements.length === 0) {
            return next(req);
        }

        for (const requirement of requirements) {
            let clone: HttpRequest<unknown> | null = req;
            let satisfied = true;

            if (Object.keys(requirement).length === 0) {
                return next(req);
            }

            for (const [scheme, scopes] of Object.entries(requirement)) {
                const apply = applicators[scheme];
                if (!apply) {
                    satisfied = false;
                    break;
                }
                clone = apply(clone!, scopes, deps);
                if (!clone) {
                    satisfied = false;
                    break;
                }
            }

            if (satisfied && clone) {
                return next(clone);
            }
        }

        return next(req);
        `;

        sourceFile.addFunction({
            name: `authInterceptor`,
            isExported: true,
            parameters: [
                {
                    name: 'req',
                    type: 'HttpRequest<unknown>',
                },
                { name: 'next', type: 'HttpHandlerFn' },
            ],
            returnType: 'Observable<HttpEvent<unknown>>',
            docs: ['Functional interceptor to apply authentication credentials based on OpenAPI security schemes.'],
            statements: statementsBody,
        });

        sourceFile.formatText();

        return { tokenNames };
    }

    private isHttpTokenScheme(s: SecurityScheme): boolean {
        return s.type === 'http' || s.type === 'oauth2' || s.type === 'openIdConnect';
    }

    private getAuthPrefix(s: SecurityScheme): string {
        if (s.type === 'oauth2' || s.type === 'openIdConnect') return 'Bearer';

        if (s.type === 'http') {
            // scheme is required for http type

            const scheme = s.scheme;

            if (!scheme || scheme.toLowerCase() === 'bearer') return 'Bearer';
            // Use pascalCase to handle casing conventions (e.g. basic -> Basic, digest -> Digest)

            return pascalCase(scheme);
        }

        return 'Bearer';
    }
}
