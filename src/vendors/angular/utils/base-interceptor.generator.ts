import { Project } from 'ts-morph';
import * as path from 'node:path';
import { UTILITY_GENERATOR_HEADER_COMMENT } from '@src/core/constants.js';
import { camelCase, getClientContextTokenName, getInterceptorsTokenName, pascalCase } from '@src/functions/utils.js';

export class BaseInterceptorGenerator {
    private readonly clientName: string;
    private readonly capitalizedClientName: string;

    constructor(
        private project: Project,
        clientName?: string,
    ) {
        this.clientName = clientName || 'default';

        this.capitalizedClientName = pascalCase(this.clientName);
    }

    public generate(outputDir: string): void {
        const utilsDir = path.join(outputDir, 'utils');

        const filePath = path.join(utilsDir, 'base-interceptor.ts');

        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        sourceFile.insertText(0, UTILITY_GENERATOR_HEADER_COMMENT);

        const interceptorsTokenName = getInterceptorsTokenName(this.clientName);

        const clientContextTokenName = getClientContextTokenName(this.clientName);

        sourceFile.addImportDeclarations([
            {
                namedImports: ['HttpContextToken', 'HttpEvent', 'HttpHandlerFn', 'HttpInterceptorFn', 'HttpRequest'],
                moduleSpecifier: '@angular/common/http',
            },
            {
                namedImports: ['inject'],
                moduleSpecifier: '@angular/core',
            },
            {
                namedImports: ['Observable'],
                moduleSpecifier: 'rxjs',
            },
            {
                namedImports: [clientContextTokenName, interceptorsTokenName],
                moduleSpecifier: '../tokens',
            },
        ]);

        sourceFile.addFunction({
            name: `${camelCase(this.clientName)}BaseInterceptor`,
            isExported: true,
            docs: [`Base functional HttpInterceptor for the ${this.capitalizedClientName} client.`],
            parameters: [
                {
                    name: 'req',
                    type: 'HttpRequest<unknown>',
                },
                { name: 'next', type: 'HttpHandlerFn' },
            ],
            returnType: 'Observable<HttpEvent<unknown>>',
            statements: `
    const clientContext = inject(${clientContextTokenName});
    if (!req.context.has(clientContext)) { 
      return next(req); 
    } 

    const customInterceptors = inject(${interceptorsTokenName}, { optional: true }) || [];

    const executeInterceptors = (request: HttpRequest<unknown>, index: number): Observable<HttpEvent<unknown>> => {
        if (index >= customInterceptors.length) {
            return next(request);
        }
        const interceptor = customInterceptors[index];
        // Handle class-based custom interceptors for backwards compatibility
        return interceptor.intercept(request, {
            handle: (req) => executeInterceptors(req, index + 1)
        });
    };

    return executeInterceptors(req, 0);`,
        });

        sourceFile.formatText();
    }
}
