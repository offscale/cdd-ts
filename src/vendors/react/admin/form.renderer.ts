import { FormProperty, Resource } from '@src/core/types/index.js';

/**
 * Handles generating form models and field configurations for React.
 */
export class FormRenderer {
    /**
     * Extracts form field models from a resource to build React hook forms.
     * @param resource The resource to analyze.
     * @returns An array of field configuration objects.
     */
    public static extractFields(resource: Resource): FormProperty[] {
        // Form properties are resolved during resource discovery, so we can just return them.
        return resource.formProperties || [];
    }
}
