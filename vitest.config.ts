import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
    test: {
        watch: false,
        globals: true,
        environment: 'node',
        include: ['tests/**/*.spec.ts'],
        exclude: ['tests/fixtures/**'],
        testTimeout: 60000,
        hookTimeout: 60000,
        reporters: ['verbose', 'junit'],
        alias: {
            '@src': path.resolve(__dirname, './src'),
        },
        outputFile: {
            junit: 'coverage/junit.xml',
        },
        coverage: {
            provider: 'v8',
            thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
            reporter: ['text', 'html', 'lcov', 'json-summary'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts'],
            exclude: ['src/cli.ts', 'src/vendors/cli/**', 'src/index.ts', 'src/classes/**', 'src/functions/**', 'src/openapi/**', 'src/routes/**', 'src/core/runtime-expressions.ts', 'src/vendors/angular/admin/**', 'src/vendors/angular/service/service-method.generator.ts', 'src/vendors/angular/utils/**', 'src/vendors/fetch/service/service-method.generator.ts', 'src/vendors/vanilla/admin/**', 'src/vendors/node/test/**', 'tests/**'],
        },
    },
    plugins: [
        {
            name: 'vite-plugin-inline-text-files',
            transform(_code, id) {
                if (id.endsWith('.template')) {
                    const fileContent = fs.readFileSync(id, 'utf-8');
                    return {
                        code: `export default ${JSON.stringify(fileContent)};`,
                        map: null,
                    };
                }
                return;
            },
        },
    ],
});
