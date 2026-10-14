/**
 * View model types for Angular Material admin list/table component generation.
 *
 * @module vendors/angular/admin/analysis/list-types
 */
import type { ResourceOperation } from "../../../../core/types/index.js";

/** Defines abstract categories for UI actions to remain framework-agnostic. */
export type ListActionKind =
	| "destructive"
	| "constructive"
	| "state-change"
	| "navigation"
	| "default";

/** Represents a single data column in a generated admin table view. */
export interface ListColumn {
	/** Property name on the resource model (e.g. `'email'`). */
	key: string;
	/** Human-readable column header (e.g. `'Email'`). */
	header: string;
	/** True when this column represents the primary identifier of the resource. */
	isId: boolean;
}

/** Represents a custom toolbar or row action in a generated admin table view. */
export interface ListAction {
	/** Service method name to invoke (e.g. `'rebootServer'`). */
	name: string;
	/** Human-readable button label (e.g. `'RebootServer'`). */
	label: string;
	/** Abstract classification of the action's purpose. */
	kind: ListActionKind;
	/** True if the action operates on the collection (toolbar) rather than a single row. */
	isCollectionAction: boolean;
	/** True if the action requires a resource row ID parameter. */
	requiresId: boolean;
	/** Reference to the underlying analyzed resource operation. */
	operation: ResourceOperation;
}

/** Complete view model for generating an Angular Material list component. */
export interface ListViewModel {
	/** Machine-friendly resource name. */
	resourceName: string;
	/** PascalCase model name. */
	modelName: string;
	/** Generated Angular service class name. */
	serviceName: string;

	/** Table data columns to render. */
	columns: ListColumn[];
	/** Array of column identifiers for `mat-table` (including `'actions'` when applicable). */
	displayedColumns: string[];
	/** Name of the primary ID property on the model. */
	idProperty: string;

	/** True if the resource supports a create operation. */
	hasCreate: boolean;
	/** True if the resource supports an update/edit operation. */
	hasEdit: boolean;
	/** True if the resource supports a delete operation. */
	hasDelete: boolean;
	/** Additional custom operations exposed as toolbar or row actions. */
	customActions: ListAction[];
	/** True if the table should render a trailing actions column. */
	hasActionsColumn: boolean;

	/** Service method name used to load the resource list. */
	listOperationName: string;
}
