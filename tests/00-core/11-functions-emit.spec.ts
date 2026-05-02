import { describe, it, expect } from 'vitest';
import * as functionEmitters from '../../src/functions/emit.js';

describe('Functions Emitters Barrel', () => {
    it('should export all expected emitters', () => {
        expect(functionEmitters.CallbackGenerator).toBeDefined();
        expect(functionEmitters.MultipartBuilderGenerator).toBeDefined();
        expect(functionEmitters.ParameterSerializerGenerator).toBeDefined();
        expect(functionEmitters.AbstractServiceGenerator).toBeDefined();
        expect(functionEmitters.WebhookGenerator).toBeDefined();
    });
});
