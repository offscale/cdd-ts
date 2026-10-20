/**
 * Framework-agnostic list view model builder for Admin UI table components.
 *
 * @module core/admin/list-model.builder
 */
import { pascalCase } from "../../functions/utils.js";
import type { Resource } from "../types/index.js";
import type {
	ListAction,
	ListActionKind,
	ListColumn,
	ListViewModel,
} from "./list-types.js";

/** Builds the intermediate representation (IR) for an Admin UI list/table view model. */
export class ListModelBuilder {
	/**
	 * Builds the intermediate representation (IR) for a list view model.
	 * @param resource - The API resource to analyze.
	 * @returns The generated list view model result.
	 */
	public build(resource: Resource): ListViewModel {
		const idProperty = this.getIdProperty(resource);
		const customActions = this.getCustomActions(resource);
		const hasCreate = resource.operations.some((op) => op.action === "create");
		const hasEdit = resource.operations.some((op) => op.action === "update");
		const hasDelete = resource.operations.some((op) => op.action === "delete");
		const hasActionsColumn =
			hasEdit || hasDelete || customActions.some((a) => !a.isCollectionAction);

		const columns: ListColumn[] = [];

		if (idProperty) {
			columns.push({
				key: idProperty,
				header: pascalCase(idProperty),
				isId: true,
			});
		}

		resource.listProperties.forEach((p) => {
			if (p.name !== idProperty) {
				columns.push({ key: p.name, header: pascalCase(p.name), isId: false });
			}
		});

		if (columns.length === 0) {
			columns.push({ key: "id", header: "Id", isId: true });
		}

		const displayedColumns = columns.map((c) => c.key);

		if (hasActionsColumn) {
			displayedColumns.push("actions");
		}

		const listOp = resource.operations.find((op) => op.action === "list");

		if (!listOp) {
			throw new Error(
				`Cannot generate list view for resource '${resource.name}': No 'list' action found.`,
			);
		}

		return {
			resourceName: resource.name,
			modelName: resource.modelName,
			serviceName: `${pascalCase(resource.name)}Service`,
			columns,
			displayedColumns,
			idProperty,
			hasCreate,
			hasEdit,
			hasDelete,
			customActions,
			hasActionsColumn,
			listOperationName: listOp.methodName as string,
		};
	}

	private getIdProperty(resource: Resource): string {
		const allProps = resource.formProperties;
		if (allProps.some((p) => p.name === "id")) {
			return "id";
		}
		return allProps.length > 0 ? (allProps[0] as { name: string }).name : "id";
	}

	private getCustomActions(resource: Resource): ListAction[] {
		const ops = resource.operations.filter(
			(op) => op.isCustomCollectionAction || op.isCustomItemAction,
		);

		return ops.map((op) => ({
			name: op.action,
			label: pascalCase(op.action),
			kind: this.getActionKind(op.action),
			isCollectionAction: Boolean(op.isCustomCollectionAction),
			requiresId: Boolean(op.isCustomItemAction),
			operation: op,
		}));
	}

	private getActionKind(action: string): ListActionKind {
		const lowerAction = action.toLowerCase();

		if (
			lowerAction.includes("delete") ||
			lowerAction.includes("remove") ||
			lowerAction.includes("cancel") ||
			lowerAction.includes("block")
		) {
			return "destructive";
		}

		if (lowerAction.includes("add") || lowerAction.includes("create")) {
			return "constructive";
		}

		if (
			lowerAction.includes("edit") ||
			lowerAction.includes("update") ||
			lowerAction.includes("approve") ||
			lowerAction.includes("check")
		) {
			return "state-change";
		}

		if (
			lowerAction.includes("reboot") ||
			lowerAction.includes("refresh") ||
			lowerAction.includes("sync")
		) {
			return "state-change";
		}

		if (
			lowerAction.includes("start") ||
			lowerAction.includes("play") ||
			lowerAction.includes("stop") ||
			lowerAction.includes("pause")
		) {
			return "default";
		}

		return "default";
	}
}
