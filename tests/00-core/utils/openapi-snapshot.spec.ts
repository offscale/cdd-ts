// @ts-nocheck
import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { readOpenApiSnapshot, writeOpenApiSnapshot, SNAPSHOT_FILENAMES } from '@src/openapi/parse_snapshot.js';
import { SwaggerSpec } from '@src/core/types/index.js';

const tempDirs: string[] = [];

const makeTempDir = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdd-ts-snap-'));
    tempDirs.push(dir);
    return dir;
};

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir && fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('Core Utils: OpenAPI Snapshot', () => {
    const baseSpec: SwaggerSpec = {
        openapi: '3.2.0',
        info: { title: 'Snapshot', version: '1.0' },
        paths: {},
    };

    it('should write JSON and YAML snapshot files', () => {
        const dir = makeTempDir();
        const { jsonPath, yamlPath } = writeOpenApiSnapshot(
            baseSpec,
            dir,
            fs as string | number | boolean | object | undefined | null,
        );

        expect(fs.existsSync(jsonPath)).toBe(true);
        expect(fs.existsSync(yamlPath)).toBe(true);

        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
        expect(jsonContent).toContain('"openapi"');
        expect(jsonContent).toContain('"3.2.0"');
    });

    it('should read a snapshot from a directory', () => {
        const dir = makeTempDir();
        writeOpenApiSnapshot(baseSpec, dir, fs as string | number | boolean | object | undefined | null);

        const result = readOpenApiSnapshot(dir, fs as string | number | boolean | object | undefined | null);
        expect(result.spec.openapi).toBe('3.2.0');
        expect(result.sourcePath).toContain(SNAPSHOT_FILENAMES.json);
    });

    it('should read a snapshot from an explicit JSON file', () => {
        const dir = makeTempDir();
        writeOpenApiSnapshot(baseSpec, dir, fs as string | number | boolean | object | undefined | null);

        const jsonPath = path.join(dir, SNAPSHOT_FILENAMES.json);
        const result = readOpenApiSnapshot(jsonPath, fs as string | number | boolean | object | undefined | null);
        expect(result.spec.info.version).toBe('1.0');
        expect(result.format).toBe('json');
    });

    it('should read a snapshot from an explicit YAML file', () => {
        const dir = makeTempDir();
        writeOpenApiSnapshot(baseSpec, dir, fs as string | number | boolean | object | undefined | null);

        const yamlPath = path.join(dir, SNAPSHOT_FILENAMES.yaml);
        const result = readOpenApiSnapshot(yamlPath, fs as string | number | boolean | object | undefined | null);
        expect(result.spec.info.title).toBe('Snapshot');
        expect(result.format).toBe('yaml');
    });

    it('should throw if no snapshot file exists in directory', () => {
        const dir = makeTempDir();
        expect(() => readOpenApiSnapshot(dir, fs as string | number | boolean | object | undefined | null)).toThrow(
            /No OpenAPI snapshot found/,
        );
    });

    it('should throw on unsupported snapshot file extension', () => {
        const dir = makeTempDir();
        const filePath = path.join(dir, 'openapi.snapshot.txt');
        fs.writeFileSync(filePath, 'text');
        expect(() =>
            readOpenApiSnapshot(filePath, fs as string | number | boolean | object | undefined | null),
        ).toThrow(/Unsupported snapshot file extension/);
    });

    it('should throw if json snapshot does not contain an object', () => {
        const dir = makeTempDir();
        const filePath = path.join(dir, 'openapi.snapshot.json');
        fs.writeFileSync(filePath, 'true');
        expect(() => readOpenApiSnapshot(filePath, fs as any)).toThrow(
            'Parsed JSON snapshot did not produce an object.',
        );
    });

    it('should throw if yaml snapshot does not contain an object', () => {
        const dir = makeTempDir();
        const filePath = path.join(dir, 'openapi.snapshot.yaml');
        fs.writeFileSync(filePath, 'true');
        expect(() => readOpenApiSnapshot(filePath, fs as any)).toThrow(
            'Parsed YAML snapshot did not produce an object.',
        );
    });

    it('should resolve .yml snapshot correctly', () => {
        const dir = makeTempDir();
        const ymlPath = path.join(dir, 'openapi.snapshot.yml');
        fs.writeFileSync(ymlPath, 'openapi: 3.0.0');

        const result = readOpenApiSnapshot(dir, fs as any);
        expect(result.format).toBe('yaml');
        expect(result.spec.openapi).toBe('3.0.0');
    });

    it('should throw if input is neither file nor directory', () => {
        const dir = makeTempDir();
        const fifoPath = path.join(dir, 'fifo');
        const customFs = {
            existsSync: () => true,
            statSync: () => ({ isFile: () => false, isDirectory: () => false }),
            readFileSync: () => '',
        };
        expect(() => readOpenApiSnapshot(fifoPath, customFs as any)).toThrow(
            /Input path is neither a file nor a directory/,
        );
    });

    it('should skip JSON resolution if yaml is found', () => {
        const dir = makeTempDir();
        const yamlPath = path.join(dir, 'openapi.snapshot.yaml');
        fs.writeFileSync(yamlPath, 'openapi: 3.0.0');
        const result = readOpenApiSnapshot(dir, fs as any);
        expect(result.format).toBe('yaml');
    });
});
