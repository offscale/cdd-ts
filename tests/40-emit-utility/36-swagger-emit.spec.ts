import { describe, it, expect } from 'vitest';
import { applyReverseMetadata } from '../../src/openapi/emit.js';
import { SwaggerSpec } from '../../src/core/types/index.js';

describe('Utility: Swagger 2.0 Emitter', () => {
    it('should emit swagger 2.0 spec when documentMeta has swagger', () => {
        const spec: SwaggerSpec = {
            openapi: '3.2.0',
            info: { title: 'Test', version: '1.0' },
            paths: {
                '/test': {
                    post: {
                        operationId: 'createTest',
                        requestBody: {
                            description: 'A test body',
                            required: true,
                            content: {
                                'application/json': {
                                    schema: { type: 'object' },
                                },
                            },
                        },
                        responses: {
                            '200': {
                                description: 'OK',
                                content: {
                                    'application/json': {
                                        schema: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            servers: [{ url: 'https://example.com/api/v1' }],
        };
        const metadata = {
            documentMeta: {
                swagger: '2.0',
            },
        };
        const result = applyReverseMetadata(spec, metadata);
        expect(result.swagger).toBe('2.0');
        expect(result.openapi).toBeUndefined();
        expect(result.jsonSchemaDialect).toBeUndefined();

        // Host, basePath, schemes translation
        expect(result.host).toBe('example.com');
        expect(result.basePath).toBe('/api/v1');
        expect(result.schemes).toEqual(['https']);
        expect(result.servers).toBeUndefined();

        // Path operation translation
        const op = result.paths['/test'].post;
        expect(op.requestBody).toBeUndefined();
        expect(op.consumes).toEqual(['application/json']);
        expect(op.produces).toEqual(['application/json']);

        expect(op.parameters).toBeDefined();
        expect(op.parameters[0].in).toBe('body');
        expect(op.parameters[0].schema).toEqual({ type: 'object' });

        const resp = op.responses['200'];
        expect(resp.content).toBeUndefined();
        expect(resp.schema).toEqual({ type: 'string' });
    });
});
