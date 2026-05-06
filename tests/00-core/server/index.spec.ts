import { describe, it, expect } from 'vitest';

describe('Core Server Index', () => {
    it('should export type definitions without error', async () => {
        const server = await import('@src/core/server/index.js');
        expect(server).toBeDefined();
    });
});
