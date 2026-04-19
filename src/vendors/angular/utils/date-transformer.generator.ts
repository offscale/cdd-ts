import { Project, VariableDeclarationKind } from 'ts-morph';
import * as path from 'node:path';
import { UTILITY_GENERATOR_HEADER_COMMENT } from '@src/core/constants.js';

export class DateTransformerGenerator {
    /* v8 ignore next */
    constructor(private project: Project) {}

    public generate(outputDir: string): void {
        /* v8 ignore next */
        const utilsDir = path.join(outputDir, 'utils');
        /* v8 ignore next */
        const filePath = path.join(utilsDir, 'date-transformer.ts');

        /* v8 ignore next */
        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        /* v8 ignore next */
        sourceFile.insertText(0, UTILITY_GENERATOR_HEADER_COMMENT);

        /* v8 ignore next */
        sourceFile.addImportDeclarations([
            {
                namedImports: ['HttpEvent', 'HttpHandler', 'HttpInterceptor', 'HttpRequest', 'HttpResponse'],
                moduleSpecifier: '@angular/common/http',
            },
            {
                namedImports: ['Injectable'],
                moduleSpecifier: '@angular/core',
            },
            {
                namedImports: ['Observable', 'map'],
                moduleSpecifier: 'rxjs',
            },
        ]);

        /* v8 ignore next */
        sourceFile.addVariableStatement({
            isExported: true,
            declarationKind: VariableDeclarationKind.Const,
            declarations: [
                {
                    name: 'ISO_DATE_REGEX',
                    initializer: `/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$/`,
                },
            ],
            docs: ['A regex pattern to identify strings that are likely ISO 8601 date-time formats.'],
        });

        /* v8 ignore next */
        sourceFile.addFunction({
            name: 'transformDates',
            isExported: true,
            typeParameters: ['T'],
            parameters: [
                { name: 'body', type: 'T' },
            ],
            returnType: 'T',
            docs: ['Recursively traverses an object or array and converts ISO date strings to Date objects.'],
            statements: `
    if (body === null || body === undefined || typeof body !== 'object') { 
        return body; 
    } 

    if (Array.isArray(body)) { 
        return (body as (string | number | boolean | object | undefined | null)[]).map(item => transformDates(item)) as T; 
    } 

    const transformedBody: Record<string, string | number | boolean | object | undefined | null> = {};
    for (const key of Object.keys(body as Record<string, string | number | boolean | object | undefined | null>)) { 
        const value = (body as Record<string, string | number | boolean | object | undefined | null>)[key]; 
        if (typeof value === 'string' && ISO_DATE_REGEX.test(value)) { 
            transformedBody[key] = new Date(value); 
        } else if (typeof value === 'object' && value !== null) { 
            transformedBody[key] = transformDates(value); 
        } else { 
            transformedBody[key] = value; 
        } 
    } 
    return transformedBody as T;`,
        });

        /* v8 ignore next */
        sourceFile.addClass({
            name: 'DateInterceptor',
            isExported: true,
            decorators: [{ name: 'Injectable', arguments: [`{ providedIn: 'root' }`] }],
            implements: ['HttpInterceptor'],
            docs: ['Intercepts HTTP responses and transforms ISO date strings to Date objects in the response body.'],
            methods: [
                {
                    name: 'intercept',
                    parameters: [
                        {
                            name: 'req',
                            type: 'HttpRequest<Record<string, string | number | boolean | object | undefined | null>>',
                        },
                        { name: 'next', type: 'HttpHandler' },
                    ],
                    returnType:
                        'Observable<HttpEvent<Record<string, string | number | boolean | object | undefined | null>>>',
                    statements: `
    return next.handle(req).pipe( 
        map(event => { 
            if (event instanceof HttpResponse && event.body) { 
                return event.clone({ body: transformDates(event.body) }); 
            } 
            return event; 
        }) 
    );`,
                },
            ],
        });

        /* v8 ignore next */
        sourceFile.formatText();
    }
}
