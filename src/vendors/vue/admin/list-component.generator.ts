import { Project } from 'ts-morph';
import * as path from 'node:path';
import { Resource } from '@src/core/types/index.js';
import { pascalCase, camelCase } from '@src/functions/utils.js';

export class ListComponentGenerator {
    constructor(private project: Project) {}

    public generate(resource: Resource, adminDir: string): void {
        const componentName = `${pascalCase(resource.name)}List`;
        const fileName = `${componentName}.vue`;
        const filePath = path.posix.join(adminDir, resource.name, fileName);

        const listOp = resource.operations.find(op => op.action === 'list');
        const deleteOp = resource.operations.find(op => op.action === 'delete');

        const serviceName = pascalCase(resource.name);

        const properties = resource.listProperties.length > 0 ? resource.listProperties : resource.formProperties;

        const content = `<template>
    <div class="${resource.name}-list">
        <div class="header-actions">
            <h1>{{ t('${resource.name}.list.title', '${componentName}') }}</h1>
            <button @click="navigateToCreate" class="btn btn-primary" aria-label="Create New">
                {{ t('common.create', 'Create New') }}
            </button>
        </div>

        <div v-if="loading" role="status" class="loading">
            {{ t('common.loading', 'Loading...') }}
        </div>
        
        <div v-else-if="error" role="alert" class="error">
            {{ error }}
        </div>

        <table v-else class="data-table" aria-label="${componentName} Data">
            <thead>
                <tr>
${properties.map(prop => `                    <th scope="col">{{ t('${resource.name}.fields.${prop.name}', '${pascalCase(prop.name)}') }}</th>`).join('\n')}
                    <th scope="col">{{ t('common.actions', 'Actions') }}</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="item in items" :key="item.id || item._id">
${properties.map(prop => `                    <td>{{ item.${prop.name} }}</td>`).join('\n')}
                    <td class="actions">
                        <button @click="navigateToEdit(item.id || item._id)" class="btn btn-sm btn-edit" aria-label="Edit">
                            {{ t('common.edit', 'Edit') }}
                        </button>
                        ${
                            deleteOp
                                ? `<button @click="deleteItem(item.id || item._id)" class="btn btn-sm btn-delete" aria-label="Delete">
                            {{ t('common.delete', 'Delete') }}
                        </button>`
                                : ''
                        }
                    </td>
                </tr>
                <tr v-if="items.length === 0">
                    <td colspan="${properties.length + 1}" class="no-data">
                        {{ t('common.noData', 'No data available.') }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { use${serviceName} } from '../../composables/${resource.name}.composable.js';

const router = useRouter();
const { t } = useI18n();
const ${camelCase(resource.name)}Service = use${serviceName}();

const items = ref<any[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const fetchItems = async () => {
    loading.value = true;
    error.value = null;
    try {
        const response = await ${camelCase(resource.name)}Service.${listOp!.methodName}();
        items.value = response.data || response || [];
    } catch (err: any) {
        error.value = err.message || t('common.errorFetching', 'Error fetching data');
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchItems();
});

const navigateToCreate = () => {
    router.push(\`/admin/${resource.name}/create\`);
};

const navigateToEdit = (id: string | number) => {
    if (!id) return;
    router.push(\`/admin/${resource.name}/edit/\${id}\`);
};

${
    deleteOp
        ? `const deleteItem = async (id: string | number) => {
    if (!id) return;
    if (!confirm(t('common.confirmDelete', 'Are you sure you want to delete this item?'))) return;
    
    try {
        await ${camelCase(resource.name)}Service.${deleteOp?.methodName}(id);
        await fetchItems();
    } catch (err: any) {
        alert(err.message || t('common.errorDeleting', 'Error deleting item'));
    }
};`
        : ''
}
</script>

<style scoped>
.${resource.name}-list {
    padding: 20px;
}
.header-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}
.data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
}
.data-table th, .data-table td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
}
.data-table th {
    background-color: #f4f4f4;
}
.actions {
    display: flex;
    gap: 8px;
}
.btn {
    padding: 6px 12px;
    cursor: pointer;
    border: none;
    border-radius: 4px;
}
.btn-primary {
    background-color: #007bff;
    color: white;
}
.btn-sm {
    font-size: 0.875rem;
    padding: 4px 8px;
}
.btn-edit {
    background-color: #ffc107;
    color: black;
}
.btn-delete {
    background-color: #dc3545;
    color: white;
}
.loading, .error, .no-data {
    text-align: center;
    padding: 20px;
}
.error {
    color: #dc3545;
}
</style>
`;

        this.project.createSourceFile(filePath, content, { overwrite: true });
    }
}
