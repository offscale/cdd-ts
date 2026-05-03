// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { CliGenerator } from '../../src/vendors/cli/emit.js';

describe('CliGenerator', () => {
    it('should generate cli.ts with correct imports and commands', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const generator = new CliGenerator();

        const mockParser = {
            spec: {
                openapi: '3.1.0',
                info: { title: 'api-cli', version: '1.0.0', description: 'Test CLI' },
                servers: [{ url: 'http://api.example.com' }],
                components: {
                    securitySchemes: {
                        BearerAuth: { type: 'http', scheme: 'bearer' },
                    },
                },
            },
            operations: [
                {
                    tags: ['Users'],
                    operationId: 'getUser',
                    path: '/users/{id}',
                    summary: 'Get User',
                    parameters: [{ name: 'id', in: 'path', required: true }],
                },
                { tags: [{ name: 'Posts' }], path: '/posts', description: 'List Posts' },
                { path: '/no-tag', summary: 'No Tag', requestBody: { content: {} } },
            ],
        } as
            | string
            | number
            | boolean
            | object
            | undefined
            | null as import('../../src/openapi/parse.js').SwaggerParser;

        generator.generate(project, mockParser, {} as string | number | boolean | object | undefined | null, '/out');

        const cliFile = project.getSourceFileOrThrow('/out/cli.ts');
        const text = cliFile.getFullText();

        expect(text).toContain('import { Command, Option } from "commander";');
        expect(text).toContain('import * as services from "./services/index.js";');
        expect(text).toContain("program.name('api-cli')");

        expect(text).toContain("const usersCommand = program.command('users')");
        expect(text).toContain(".description('Get User')");
        expect(text).toContain("const postsCommand = program.command('posts')");
        expect(text).toContain("const defaultCommand = program.command('default')");
        expect(text).toContain(".description('No Tag')");
        expect(text).toContain('const client = new services.UsersService();');
    });

    it('should generate cli.ts with coverage for openIdConnect, externalDocs, deprecated, and callbacks', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const generator = new CliGenerator();

        const mockParser = {
            spec: {
                openapi: '3.1.0',
                info: {
                    title: 'api-cli-full',
                    version: '1.0.0',
                    description: 'Test CLI',
                    contact: { name: 'Support', email: 'support@example.com', url: 'https://support.com' },
                    license: { name: 'MIT', identifier: 'MIT', url: 'https://mit.com' },
                    termsOfService: 'https://tos.com',
                },
                externalDocs: { description: 'Spec Docs', url: 'https://spec.docs.com' },
                servers: [
                    {
                        url: 'http://api.example.com/{version}',
                        variables: {
                            version: { enum: ['v1', 'v2'], description: 'API Version', default: 'v1' },
                        },
                    },
                ],
                components: {
                    securitySchemes: {
                        OidcAuth: {
                            type: 'openIdConnect',
                            openIdConnectUrl: 'https://example.com/oidc',
                            description: 'OIDC token',
                        },
                        DeprecatedAuth: { type: 'http', scheme: 'basic', deprecated: true },
                        OAuth2Auth: {
                            type: 'oauth2',
                            description: 'OAuth2 auth',
                            flows: { implicit: {}, authorizationCode: {} },
                            oauth2MetadataUrl: 'https://example.com/oauth2',
                        },
                    },
                },
            },
            operations: [
                {
                    tags: ['Complex'],
                    operationId: 'complexOp',
                    path: '/complex',
                    summary: 'Complex Operation',
                    externalDocs: { description: 'Docs', url: 'https://docs.com' },
                    deprecated: true,
                    callbacks: { myCallback: {} },
                },
            ],
        } as any;

        generator.generate(project, mockParser, {} as any, '/out');

        const cliFile = project.getSourceFileOrThrow('/out/cli.ts');
        const text = cliFile.getFullText();

        expect(text).toContain('External Docs: Spec Docs https://spec.docs.com');
        expect(text).toContain('// Server variable: version (enum: v1,v2) - API Version');
        expect(text).toContain('// OAuth2 Flows supported: implicit, authorizationCode');
        expect(text).toContain("program.option('--auth-oauth2auth <token>', 'OAuth2 auth');");
        expect(text).toContain('// OAuth2 Metadata: https://example.com/oauth2');
        expect(text).toContain('// OpenID Connect URL: https://example.com/oidc');
        expect(text).toContain("program.option('--auth-oidcauth <token>', 'OIDC token');");
        expect(text).toContain('// Deprecated security scheme: DeprecatedAuth');
        expect(text).toContain('External Docs: Docs https://docs.com');
        expect(text).toContain('// Deprecated operation');
        expect(text).toContain('// Supports Callbacks');
    });
});
