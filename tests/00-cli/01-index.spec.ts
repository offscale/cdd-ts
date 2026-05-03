import { describe, it, expect } from 'vitest';
import { getGeneratorFactory } from '../../src/index.js';
import { AngularClientGenerator } from '../../src/vendors/angular/angular-client.generator.js';
import { ReactClientGenerator } from '../../src/vendors/react/react-client.generator.js';
import { VueClientGenerator } from '../../src/vendors/vue/vue-client.generator.js';

describe('index.ts', () => {
    it('returns AngularClientGenerator by default', () => {
        expect(getGeneratorFactory('unknown')).toBeInstanceOf(AngularClientGenerator);
    });
    it('returns ReactClientGenerator for react', () => {
        expect(getGeneratorFactory('react')).toBeInstanceOf(ReactClientGenerator);
    });
    it('returns VueClientGenerator for vue', () => {
        expect(getGeneratorFactory('vue')).toBeInstanceOf(VueClientGenerator);
    });
});
