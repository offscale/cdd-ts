/**
 * SCSS stylesheet generator for Angular admin form components.
 *
 * @module vendors/angular/admin/html/form-component-scss.builder
 */

/**
 * Generates the default SCSS stylesheet content for an Angular admin form component.
 *
 * @returns SCSS stylesheet string.
 */
export function generateFormComponentScss(): string {
	return `
.admin-form-container { padding: 24px; }
.admin-form-fields { display: flex; flex-direction: column; }
.admin-form-actions { margin-top: 24px; display: flex; justify-content: flex-end; gap: 8px; }
.admin-toggle-group, .admin-radio-group { display: flex; flex-direction: column; margin-bottom: 16px; mat-radio-group { display: flex; gap: 16px; margin-top: 8px; } }
`;
}
