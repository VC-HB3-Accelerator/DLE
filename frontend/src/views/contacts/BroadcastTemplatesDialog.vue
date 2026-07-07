<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.

  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <el-dialog
    v-model="visible"
    :title="t('contacts.broadcast.templates.title')"
    width="560px"
    class="broadcast-templates-dialog"
    append-to-body
    @open="onOpen"
  >
    <div class="templates-section">
      <h3>{{ t('contacts.broadcast.templates.selectTitle') }}</h3>
      <el-select
        v-model="selectedTemplateId"
        :placeholder="t('contacts.broadcast.templates.selectPlaceholder')"
        clearable
        filterable
        class="template-select"
        :loading="loading"
      >
        <el-option
          v-for="template in templates"
          :key="template.id"
          :label="template.name"
          :value="template.id"
        />
      </el-select>

      <div class="template-actions">
        <el-button
          type="primary"
          native-type="button"
          :disabled="!selectedTemplateId || loading"
          @click="applySelectedTemplate"
        >
          {{ t('contacts.broadcast.templates.apply') }}
        </el-button>
        <el-button
          type="danger"
          plain
          native-type="button"
          :disabled="!selectedTemplateId || loading"
          @click="deleteSelectedTemplate"
        >
          {{ t('common.delete') }}
        </el-button>
      </div>
    </div>

    <el-divider />

    <div class="templates-section">
      <h3>{{ t('contacts.broadcast.templates.saveTitle') }}</h3>

      <el-alert
        v-if="missingFields.length"
        type="warning"
        :closable="false"
        show-icon
        class="template-validation-alert"
      >
        <template #title>
          {{ t('contacts.broadcast.templates.missingFields', { fields: missingFields.join(', ') }) }}
        </template>
      </el-alert>

      <el-form label-position="top" @submit.prevent="saveTemplate">
        <el-form-item :label="t('contacts.broadcast.templates.name')" required>
          <el-input
            v-model="templateName"
            :placeholder="t('contacts.broadcast.templates.namePlaceholder')"
            maxlength="120"
            show-word-limit
            @keyup.enter="saveTemplate"
          />
        </el-form-item>
      </el-form>

      <div class="template-actions">
        <el-button
          type="success"
          native-type="button"
          :loading="saving"
          @click="saveTemplate"
        >
          {{ t('contacts.broadcast.templates.save') }}
        </el-button>
        <el-button
          v-if="selectedTemplateId"
          native-type="button"
          :disabled="!canSave || saving"
          :loading="saving"
          @click="updateSelectedTemplate"
        >
          {{ t('contacts.broadcast.templates.update') }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import messagesService from '@/services/messagesService.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  subject: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'apply']);

const { t } = useI18n();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const loading = ref(false);
const saving = ref(false);
const templates = ref([]);
const selectedTemplateId = ref(null);
const templateName = ref('');

const trimmedSubject = computed(() => String(props.subject || '').trim());
const trimmedMessage = computed(() => String(props.message || '').trim());

const missingFields = computed(() => {
  const fields = [];
  if (!templateName.value.trim()) {
    fields.push(t('contacts.broadcast.templates.name'));
  }
  if (!trimmedSubject.value) {
    fields.push(t('contacts.broadcast.subject'));
  }
  if (!trimmedMessage.value) {
    fields.push(t('contacts.broadcast.message'));
  }
  return fields;
});

const canSave = computed(() => missingFields.value.length === 0);

watch(() => props.subject, (value) => {
  if (!templateName.value.trim() && String(value || '').trim()) {
    templateName.value = String(value).trim().slice(0, 120);
  }
});

watch(selectedTemplateId, (templateId) => {
  if (!templateId) {
    return;
  }

  const template = templates.value.find(item => item.id === templateId);
  if (template) {
    templateName.value = template.name;
  }
});

async function loadTemplates() {
  loading.value = true;
  try {
    const data = await messagesService.getBroadcastTemplates();
    templates.value = data.templates || [];
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.templates.loadError'));
  } finally {
    loading.value = false;
  }
}

function onOpen() {
  loadTemplates();
  if (!templateName.value.trim() && trimmedSubject.value) {
    templateName.value = trimmedSubject.value.slice(0, 120);
  }
}

function applySelectedTemplate() {
  const template = templates.value.find(item => item.id === selectedTemplateId.value);
  if (!template) {
    return;
  }

  emit('apply', {
    subject: template.subject,
    message: template.body
  });
  templateName.value = template.name;
  ElMessage.success(t('contacts.broadcast.templates.applied'));
  visible.value = false;
}

async function saveTemplate() {
  if (!canSave.value) {
    ElMessage.warning(t('contacts.broadcast.templates.missingFields', {
      fields: missingFields.value.join(', ')
    }));
    return;
  }

  saving.value = true;
  try {
    const data = await messagesService.createBroadcastTemplate({
      name: templateName.value.trim(),
      subject: trimmedSubject.value,
      body: trimmedMessage.value
    });
    const template = data?.template;
    if (!template?.id) {
      throw new Error(t('contacts.broadcast.templates.saveError'));
    }

    templates.value = [template, ...templates.value.filter(item => item.id !== template.id)];
    selectedTemplateId.value = template.id;
    ElMessage.success(t('contacts.broadcast.templates.saved'));
  } catch (error) {
    const details = error?.response?.data?.details;
    const message = error?.response?.data?.error || error?.message || t('contacts.broadcast.templates.saveError');
    ElMessage.error(details ? `${message}: ${details}` : message);
  } finally {
    saving.value = false;
  }
}

async function updateSelectedTemplate() {
  if (!selectedTemplateId.value || !canSave.value) {
    ElMessage.warning(t('contacts.broadcast.templates.missingFields', {
      fields: missingFields.value.join(', ')
    }));
    return;
  }

  saving.value = true;
  try {
    const data = await messagesService.updateBroadcastTemplate(selectedTemplateId.value, {
      name: templateName.value.trim(),
      subject: trimmedSubject.value,
      body: trimmedMessage.value
    });
    const template = data?.template;
    if (!template?.id) {
      throw new Error(t('contacts.broadcast.templates.updateError'));
    }

    templates.value = templates.value.map(item => (item.id === template.id ? template : item));
    ElMessage.success(t('contacts.broadcast.templates.updated'));
  } catch (error) {
    const details = error?.response?.data?.details;
    const message = error?.response?.data?.error || error?.message || t('contacts.broadcast.templates.updateError');
    ElMessage.error(details ? `${message}: ${details}` : message);
  } finally {
    saving.value = false;
  }
}

async function deleteSelectedTemplate() {
  if (!selectedTemplateId.value) {
    return;
  }

  try {
    await ElMessageBox.confirm(
      t('contacts.broadcast.templates.confirmDelete'),
      t('contacts.confirmDeleteTitle'),
      { type: 'warning' }
    );
  } catch {
    return;
  }

  loading.value = true;
  try {
    await messagesService.deleteBroadcastTemplate(selectedTemplateId.value);
    templates.value = templates.value.filter(item => item.id !== selectedTemplateId.value);
    selectedTemplateId.value = null;
    ElMessage.success(t('contacts.broadcast.templates.deleted'));
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.templates.deleteError'));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.templates-section h3 {
  margin: 0 0 12px;
  font-size: 1rem;
}

.template-select {
  width: 100%;
}

.template-validation-alert {
  margin-bottom: 12px;
}

.template-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
</style>
