import { Project } from 'ts-morph';
import * as path from 'node:path';
import { Resource } from '@src/core/types/index.js';
import { pascalCase, camelCase } from '@src/functions/utils.js';

export class FormComponentGenerator {
    constructor(private project: Project) {}

    public generate(resource: Resource, adminDir: string): void {
        const componentName = `${pascalCase(resource.name)}Form`;
        const fileName = `${componentName}.vue`;
        const filePath = path.posix.join(adminDir, resource.name, fileName);

        const createOp = resource.operations.find(op => op.action === 'create');
        const updateOp = resource.operations.find(op => op.action === 'update');
        const getOp = resource.operations.find(op => op.action === 'getById');

        const serviceName = pascalCase(resource.name);

        const properties = resource.formProperties;

        const content = `<template>
    <div class="${resource.name}-form">
        <h1>{{ isEditMode ? t('${resource.name}.form.editTitle', 'Edit ${pascalCase(resource.name)}') : t('${resource.name}.form.createTitle', 'Create ${pascalCase(resource.name)}') }}</h1>

        <div v-if="loading" role="status" class="loading">
            {{ t('common.loading', 'Loading...') }}
        </div>
        
        <div v-else-if="error" role="alert" class="error">
            {{ error }}
        </div>

        <form v-else @submit.prevent="handleSubmit" class="form-container">
${properties
    .map(prop => {
        let inputType = 'text';
        const schemaType = (prop.schema as any)?.type;
        if (schemaType === 'number' || schemaType === 'integer') inputType = 'number';
        if (schemaType === 'boolean') inputType = 'checkbox';

        if (inputType === 'checkbox') {
            return `            <div class="form-group checkbox-group">
                <input 
                    type="checkbox" 
                    :id="'${prop.name}'" 
                    v-model="formData.${prop.name}" 
                />
                <label :for="'${prop.name}'">{{ t('${resource.name}.fields.${prop.name}', '${pascalCase(prop.name)}') }}</label>
            </div>`;
        }

        return `            <div class="form-group">
                <label :for="'${prop.name}'">{{ t('${resource.name}.fields.${prop.name}', '${pascalCase(prop.name)}') }}</label>
                <input 
                    type="${inputType}" 
                    :id="'${prop.name}'" 
                    v-model="formData.${prop.name}" 
                    class="form-control"
                />
            </div>`;
    })
    .join('\n')}

            <div class="form-actions">
                <button type="button" @click="goBack" class="btn btn-secondary">
                    {{ t('common.cancel', 'Cancel') }}
                </button>
                <button type="submit" class="btn btn-primary" :disabled="submitting">
                    {{ submitting ? t('common.saving', 'Saving...') : t('common.save', 'Save') }}
                </button>
            </div>
        </form>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { use${serviceName} } from '../../composables/${resource.name}.composable.js';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const ${camelCase(resource.name)}Service = use${serviceName}();

const isEditMode = computed(() => !!route.params.id);
const itemId = computed(() => route.params.id as string);

const formData = ref<Record<string, any>>({
${properties
    .map(prop => {
        const schemaType = (prop.schema as any)?.type;
        if (schemaType === 'boolean') return `    ${prop.name}: false,`;
        if (schemaType === 'number' || schemaType === 'integer') return `    ${prop.name}: 0,`;
        return `    ${prop.name}: '',`;
    })
    .join('\n')}
});

const loading = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
    if (isEditMode.value) {
        await loadData();
    }
});

const loadData = async () => {
    loading.value = true;
    error.value = null;
    try {
        ${
            getOp
                ? `const response = await ${camelCase(resource.name)}Service.${getOp.methodName}(itemId.value);
        const data = response.data || response;
        if (data) {
            Object.keys(formData.value).forEach(key => {
                if (data[key] !== undefined) {
                    formData.value[key] = data[key];
                }
            });
        }`
                : `// TODO: Implement fetch logic`
        }
    } catch (err: any) {
        error.value = err.message || t('common.errorFetching', 'Error fetching data');
    } finally {
        loading.value = false;
    }
};

const handleSubmit = async () => {
    submitting.value = true;
    error.value = null;
    try {
        if (isEditMode.value) {
            await ${camelCase(resource.name)}Service.${updateOp?.methodName}(itemId.value, formData.value);
        } else {
            await ${camelCase(resource.name)}Service.${createOp?.methodName}(formData.value);
        }
        router.push(\`/admin/${resource.name}\`);
    } catch (err: any) {
        error.value = err.message || t('common.errorSaving', 'Error saving data');
    } finally {
        submitting.value = false;
    }
};

const goBack = () => {
    router.push(\`/admin/${resource.name}\`);
};
</script>

<style scoped>
.${resource.name}-form {
    padding: 20px;
    max-width: 600px;
    margin: 0 auto;
}
.form-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.checkbox-group {
    flex-direction: row;
    align-items: center;
}
.form-control {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
}
.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
}
.btn {
    padding: 8px 16px;
    cursor: pointer;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
}
.btn-primary {
    background-color: #007bff;
    color: white;
}
.btn-primary:disabled {
    background-color: #a0c4ff;
    cursor: not-allowed;
}
.btn-secondary {
    background-color: #6c757d;
    color: white;
}
.loading, .error {
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
