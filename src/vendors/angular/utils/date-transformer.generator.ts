import { Project, VariableDeclarationKind } from 'ts-morph';
import * as path from 'node:path';
import { UTILITY_GENERATOR_HEADER_COMMENT } from '@src/core/constants.js';

export class DateTransformerGenerator {
    constructor(private project: Project) {}

    public generate(outputDir: string): void {
        const utilsDir = path.join(outputDir, 'utils');

        const filePath = path.join(utilsDir, 'date-transformer.ts');

        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.insertText(0, UTILITY_GENERATOR_HEADER_COMMENT);

        sourceFile.addImportDeclarations([
            {
                namedImports: ['HttpEvent', 'HttpHandlerFn', 'HttpInterceptorFn', 'HttpRequest', 'HttpResponse'],
                moduleSpecifier: '@angular/common/http',
            },
            {
                namedImports: ['Observable', 'map'],
                moduleSpecifier: 'rxjs',
            },
        ]);

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

        sourceFile.addFunction({
            name: 'transformDates',
            isExported: true,
            typeParameters: ['T'],
            parameters: [{ name: 'body', type: 'T' }],
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
            transformedBody[key] = new globalThis.Date(value); 
        } else if (typeof value === 'object' && value !== null) { 
            transformedBody[key] = transformDates(value); 
        } else { 
            transformedBody[key] = value; 
        } 
    } 
    return transformedBody as T;`,
        });

        sourceFile.addFunction({
            name: 'dateInterceptor',
            isExported: true,
            parameters: [
                {
                    name: 'req',
                    type: 'HttpRequest<unknown>',
                },
                { name: 'next', type: 'HttpHandlerFn' },
            ],
            returnType: 'Observable<HttpEvent<unknown>>',
            docs: ['Intercepts HTTP responses and transforms ISO date strings to Date objects in the response body.'],
            statements: `
    return next(req).pipe( 
        map(event => { 
            if (event instanceof HttpResponse && event.body) { 
                return event.clone({ body: transformDates(event.body) }); 
            } 
            return event; 
        }) 
    );`,
        });

        sourceFile.formatText();
    }
}
