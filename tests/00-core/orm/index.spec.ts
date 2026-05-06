import { describe, it, expect } from 'vitest';

describe('Core ORM Index', () => {
    it('should export type definitions without error', async () => {
        const orm = await import('@src/core/orm/index.js');
        expect(orm).toBeDefined();
    });
});
