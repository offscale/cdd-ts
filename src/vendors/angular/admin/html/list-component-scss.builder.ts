/**
 * SCSS stylesheet generator for Angular admin list components.
 *
 * @module vendors/angular/admin/html/list-component-scss.builder
 */

/**
 * Generates the default SCSS stylesheet content for an Angular admin list/table component.
 *
 * @returns SCSS stylesheet string.
 */
export function generateListComponentScss(): string {
	return `
.admin-list-container { padding: 24px; }
.admin-list-toolbar { border-radius: 4px 4px 0 0; }
.toolbar-spacer { flex: 1 1 auto; }
.table-container { position: relative; overflow: auto; }
table { width: 100%; }
.mat-mdc-paginator { border-radius: 0 0 4px 4px; }
.admin-list-toolbar button { margin-left: 8px; }
`;
}
