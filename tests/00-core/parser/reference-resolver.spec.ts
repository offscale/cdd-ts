// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReferenceResolver } from '@src/openapi/parse_reference_resolver.js';
import { SwaggerSpec } from '@src/core/types/index.js';

describe('Core: ReferenceResolver', () => {
    let cache: Map<string, SwaggerSpec>;
    let resolver: ReferenceResolver;
    const rootUri = 'file:///root.json';

    beforeEach(() => {
        cache = new Map();
        cache.set(rootUri, { openapi: '3.0.0', paths: {} } as string | number | boolean | object | undefined | null);
        resolver = new ReferenceResolver(cache, rootUri);
    });

    afterEach(() => {
        vi.restoreAllMocks(); // Clean up console spies to prevent cross-test pollution
    });

    describe('indexSchemaIds', () => {
        it('should return early for non-object specs', () => {
            const sizeBefore = cache.size;
            ReferenceResolver.indexSchemaIds(
                null as string | number | boolean | object | undefined | null,
                rootUri,
                cache,
            );
            expect(cache.size).toBe(sizeBefore);
        });

        it('should index standard $id and anchors', () => {
            const spec = {
                schemas: {
                    User: { $id: 'http://example.com/user', $anchor: 'local', $dynamicAnchor: 'dyn' },
                },
            };
            ReferenceResolver.indexSchemaIds(spec, rootUri, cache);
            expect(cache.has('http://example.com/user')).toBe(true);
            expect(cache.has('http://example.com/user#local')).toBe(true);
            expect(cache.has('http://example.com/user#dyn')).toBe(true);
        });

        it('should safely ignore invalid IDs', () => {
            const spec = { schemas: { Bad: { $id: 'invalid-uri' } } };
            expect(() => ReferenceResolver.indexSchemaIds(spec, rootUri, cache)).not.toThrow();
        });

        it('should skip inherited properties and avoid re-adding anchors', () => {
            const proto = { inherited: { $anchor: 'skip' } };

            const spec = Object.create(proto);

            spec.schemas = {
                User: { $id: 'http://example.com/user', $anchor: 'local', $dynamicAnchor: 'dyn' },
            };
            ReferenceResolver.indexSchemaIds(spec, rootUri, cache);
            const sizeAfterFirst = cache.size;
            ReferenceResolver.indexSchemaIds(spec, rootUri, cache);
            expect(cache.size).toBe(sizeAfterFirst);
            expect(cache.has('http://example.com/user#skip')).toBe(false);
        });
    });

    describe('resolveReference', () => {
        it('should handle JSON pointer traversal', () => {
            cache.set(rootUri, { nested: { val: 123 } } as string | number | boolean | object | undefined | null);
            const res = resolver.resolveReference('#/nested/val');
            expect(res).toBe(123);
        });

        it('should return undefined and warn when traversal fails on missing property', () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            cache.set(rootUri, { nested: {} } as string | number | boolean | object | undefined | null);
            const res = resolver.resolveReference('#/nested/missing');
            expect(res).toBeUndefined();
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('Failed to resolve reference part "missing"'));
        });

        it('should warn if property access fails during traversal', () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            cache.set(rootUri, { a: { b: 1 } } as string | number | boolean | object | undefined | null);
            const res = resolver.resolveReference('#/a/c');
            expect(res).toBeUndefined();
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('Failed to resolve reference part "c"'));
        });

        it('should return undefined and warn when traversal fails on null intermediate', () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            cache.set(rootUri, { nested: null } as string | number | boolean | object | undefined | null);
            const res = resolver.resolveReference('#/nested/child');
            expect(res).toBeUndefined();
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('Failed to resolve reference part "child"'));
        });

        it('should resolve references to external files in cache', () => {
            cache.set('http://external.com/doc.json', { id: 'extern' } as
                | string
                | number
                | boolean
                | object
                | undefined
                | null);
            const res = resolver.resolveReference('http://external.com/doc.json#/id');
            expect(res).toBe('extern');
        });

        it('should resolve JSON pointers with percent-encoded tokens', () => {
            const spec = {
                openapi: '3.2.0',
                paths: {
                    '/2.0/repositories/{username}': {
                        get: { operationId: 'getRepo', responses: { '200': { description: 'ok' } } },
                    },
                },
            };
            cache.set(rootUri, spec as string | number | boolean | object | undefined | null);

            const res = resolver.resolveReference('#/paths/~12.0~1repositories~1%7Busername%7D/get') as
                | string
                | number
                | boolean
                | object
                | undefined
                | null;

            expect(res?.operationId).toBe('getRepo');
        });

        it('should return undefined if external file missing from cache', () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const res = resolver.resolveReference('http://missing.com/doc.json');
            expect(res).toBeUndefined();
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unresolved external file reference'));
        });

        it('should NOT warn on invalid reference type input (not string)', () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const res = resolver.resolveReference(123 as string | number | boolean | object | undefined | null);
            expect(res).toBeUndefined();
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('findRefs', () => {
        it('should find all $ref and $dynamicRef strings', () => {
            const obj = {
                a: { $ref: '#/a' },
                b: [{ $dynamicRef: '#/b' }],
                c: 'not-a-ref',
            };
            const refs = ReferenceResolver.findRefs(obj);
            expect(refs).toContain('#/a');
            expect(refs).toContain('#/b');
            expect(refs.length).toBe(2);
        });

        it('should ignore inherited ref properties', () => {
            const proto = { inherited: { $ref: '#/proto' } };

            const obj = Object.create(proto);
            const refs = ReferenceResolver.findRefs(obj);
            expect(refs).toEqual([]);
        });
    });

    describe('resolve', () => {
        it('should augment resolved object with summary/description from ref wrapper', () => {
            cache.set(rootUri, { defs: { Target: { type: 'string', description: 'Original' } } } as
                | string
                | number
                | boolean
                | object
                | undefined
                | null);
            const refObj = {
                $ref: '#/defs/Target',
                description: 'Overridden',
                summary: 'Summary',
            };

            const res: string | number | boolean | object | undefined | null = resolver.resolve(refObj);

            expect(res.type).toBe('string');

            expect(res.description).toBe('Overridden');

            expect(res.summary).toBe('Summary');
        });

        it('should only override description when summary is omitted', () => {
            cache.set(rootUri, { defs: { Target: { type: 'string', description: 'Original' } } } as
                | string
                | number
                | boolean
                | object
                | undefined
                | null);
            const refObj = {
                $ref: '#/defs/Target',
                description: 'Only description',
            };

            const res: string | number | boolean | object | undefined | null = resolver.resolve(refObj);

            expect(res.description).toBe('Only description');

            expect(res.summary).toBeUndefined();
        });

        it('should only override summary when description is omitted', () => {
            cache.set(rootUri, { defs: { Target: { type: 'string', description: 'Original' } } } as
                | string
                | number
                | boolean
                | object
                | undefined
                | null);
            const refObj = {
                $ref: '#/defs/Target',
                summary: 'Only summary',
            };

            const res: string | number | boolean | object | undefined | null = resolver.resolve(refObj);

            expect(res.summary).toBe('Only summary');

            expect(res.description).toBe('Original');
        });

        it('should return null/undefined if input is null/undefined', () => {
            expect(resolver.resolve(null)).toBeUndefined();
            expect(resolver.resolve(undefined)).toBeUndefined();
        });

        it('should return input object if it is not a reference', () => {
            const obj = { type: 'number' };
            expect(resolver.resolve(obj)).toBe(obj);
        });

        it('should resolve relative $ref using nearest $id base URI', () => {
            const spec = {
                components: {
                    schemas: {
                        Foo: {
                            $id: 'http://example.com/schemas/foo',
                            type: 'object',
                            properties: {
                                bar: { $ref: 'bar' },
                            },
                        },
                        Bar: {
                            $id: 'http://example.com/schemas/bar',
                            type: 'string',
                        },
                    },
                },
            };

            cache.set(rootUri, spec as string | number | boolean | object | undefined | null);
            ReferenceResolver.indexSchemaIds(spec, rootUri, cache);

            const refObj = (spec as string | number | boolean | object | undefined | null).components.schemas.Foo
                .properties.bar;

            const resolved = resolver.resolve(refObj as string | number | boolean | object | undefined | null) as
                | string
                | number
                | boolean
                | object
                | undefined
                | null;

            expect(resolved).toBeDefined();

            expect(resolved.type).toBe('string');
        });
    });

    describe('$dynamicRef Resolution', () => {
        it('should prefer properties from the resolution stack over static definition', () => {
            const genericSchema = {
                $id: 'http://base/generic',
                $dynamicAnchor: 'meta',
                type: 'object',
                properties: {
                    data: { $dynamicRef: '#item' },
                },
                $defs: {
                    defaultItem: {
                        $dynamicAnchor: 'item',
                        type: 'string',
                        description: 'default string',
                    },
                },
            };

            const specificSchema = {
                $id: 'http://base/specific',
                allOf: [{ $ref: 'http://base/generic' }],
                $defs: {
                    overrideItem: {
                        $dynamicAnchor: 'item',
                        type: 'number',
                        description: 'override number',
                    },
                },
            };

            cache.set('http://base/generic', genericSchema as string | number | boolean | object | undefined | null);
            cache.set('http://base/specific', specificSchema as string | number | boolean | object | undefined | null);
            ReferenceResolver.indexSchemaIds(genericSchema, 'http://base/generic', cache);
            ReferenceResolver.indexSchemaIds(specificSchema, 'http://base/specific', cache);

            const stack = ['http://base/specific', 'http://base/generic'];

            const resolved = resolver.resolveReference('#item', 'http://base/generic', stack) as
                | string
                | number
                | boolean
                | object
                | undefined
                | null;

            expect(resolved).toBeDefined();

            expect(resolved.type).toBe('number');

            expect(resolved.description).toBe('override number');
        });

        it('should fallback to local anchor definition if no overrides in stack', () => {
            const genericSchema = {
                $id: 'http://base/generic',
                properties: {
                    data: { $dynamicRef: '#item' },
                },
                $defs: {
                    defaultItem: {
                        $dynamicAnchor: 'item',
                        type: 'string',
                    },
                },
            };
            cache.set('http://base/generic', genericSchema as string | number | boolean | object | undefined | null);
            ReferenceResolver.indexSchemaIds(genericSchema, 'http://base/generic', cache);

            const resolved = resolver.resolveReference('#item', 'http://base/generic', []) as
                | string
                | number
                | boolean
                | object
                | undefined
                | null;

            expect(resolved).toBeDefined();

            expect(resolved.type).toBe('string');
        });

        it('should return undefined when dynamic anchor is not found in stack', () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            cache.set('http://base/generic', { openapi: '3.0.0', paths: {} } as
                | string
                | number
                | boolean
                | object
                | undefined
                | null);
            const resolved = resolver.resolveReference('#missing', 'http://base/generic', ['http://base/generic']);
            expect(resolved).toBeUndefined();
        });

        it('should resolve dynamic anchors when scope URIs include fragments', () => {
            const specificSchema = {
                $id: 'http://base/specific',
                $defs: {
                    overrideItem: {
                        $dynamicAnchor: 'item',
                        type: 'number',
                    },
                },
            };

            cache.set('http://base/specific', specificSchema as string | number | boolean | object | undefined | null);
            ReferenceResolver.indexSchemaIds(specificSchema, 'http://base/specific', cache);

            const resolved = resolver.resolveReference('#item', 'http://base/specific', [
                'http://base/specific#/defs/overrideItem',
            ]) as string | number | boolean | object | undefined | null;

            expect(resolved?.type).toBe('number');
        });
    });

    describe('resolveReference edge cases', () => {
        it('should return entire document when ref has no pointer', () => {
            const spec = { openapi: '3.0.0', paths: { '/x': {} } } as
                | string
                | number
                | boolean
                | object
                | undefined
                | null;
            cache.set('http://doc.com/root.json', spec);
            const res = resolver.resolveReference('http://doc.com/root.json');

            expect(res).toBe(spec);
        });

        it('should return undefined without warning when current document is missing and ref has no file path', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const res = resolver.resolveReference('#/missing', 'file:///missing.json');
            expect(res).toBeUndefined();
            expect(warnSpy).not.toHaveBeenCalled();
        });

        it('should skip JSON pointer traversal when no fragment is present and cache has() returns false', () => {
            class NonHasCache extends Map<string, SwaggerSpec> {
                override has(_key: string): boolean {
                    return false;
                }
            }

            const customCache = new NonHasCache();

            const spec = { openapi: '3.0.0', paths: {} } as string | number | boolean | object | undefined | null;
            customCache.set('http://doc.com/root.json', spec);
            const customResolver = new ReferenceResolver(customCache, 'http://doc.com/root.json');
            const res = customResolver.resolveReference('http://doc.com/root.json');

            expect(res).toBe(spec);
        });

        it('should handle malformed JSON pointer fragments without throwing', () => {
            // "%" without a valid hex code throws URIError in decodeURIComponent
            const res = resolver.resolveReference('#/%');
            expect(res).toBeUndefined();
        });

        it('should fallback to returning value if split returns empty in stripFragment', () => {
            // This happens when there is no fragment or some weird JS edge case.
            // A simple test to cover the `?? value` fallback.
            // By overriding String.prototype.split temporarily we can force it.
            const originalSplit = String.prototype.split;
            String.prototype.split = function (this: string, separator: string | RegExp, limit?: number) {
                if (separator === '#' && limit === 1) return { 0: undefined } as any; // Mock array where index 0 is undefined
                return originalSplit.call(this, separator, limit);
            } as any;

            cache.set('weird#context#weird', 1 as any);
            // This will call stripFragment in ReferenceResolver.resolveReference for the dynamic schema
            const res = resolver.resolveReference('weird#weird', rootUri, ['weird#context']);
            expect(res).toBe(1);

            String.prototype.split = originalSplit;
        });
    });
});
