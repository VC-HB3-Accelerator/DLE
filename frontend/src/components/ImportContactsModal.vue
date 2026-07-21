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
  <el-dialog v-model="visible" :title="t('contacts.importModal.title')" width="800px" @close="$emit('close')">
    <div v-if="step === 1">
      <el-upload
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept=".csv,.json"
        @change="handleFileChange"
        style="width:100%"
      >
        <i class="el-icon-upload"></i>
        <div class="el-upload__text">{{ t('contacts.importModal.dragDrop') }} <em>{{ t('contacts.importModal.clickToSelect') }}</em></div>
        <div class="el-upload__tip">{{ t('contacts.importModal.formats') }}</div>
      </el-upload>
    </div>
    <div v-else-if="step === 2">
      <div style="margin-bottom:1em;">{{ t('contacts.importModal.mapColumns') }}</div>
      <el-table :data="previewRows" border style="width:100%;margin-bottom:1em;">
        <el-table-column v-for="(col, idx) in columns" :key="col" :label="col">
          <template #header>
            <el-select v-model="mapping[col]" :placeholder="t('contacts.importModal.selectField')" size="small">
              <el-option v-for="f in fields" :key="f.value" :label="f.label" :value="f.value" />
            </el-select>
          </template>
          <template #default="scope">
            {{ scope.row[col] }}
          </template>
        </el-table-column>
        <el-table-column :label="t('contacts.importModal.remove')" width="80">
          <template #default="scope">
            <el-button type="danger" icon="el-icon-delete" size="small" @click="removeRow(scope.$index)" circle />
          </template>
        </el-table-column>
      </el-table>
      <el-button @click="step = 1" style="margin-right:1em;">{{ t('contacts.importModal.back') }}</el-button>
      <el-button type="primary" @click="submitImport" :loading="loading">{{ t('contacts.importModal.importBtn') }}</el-button>
    </div>
    <div v-else-if="step === 3">
      <div v-if="result.success" style="color:green;">{{ t('contacts.importModal.importSuccess', { added: result.added, updated: result.updated }) }}</div>
      <div v-if="result.errors && result.errors.length" style="color:red;max-height:120px;overflow:auto;">
        {{ t('common.errors') }}
        <ul>
          <li v-for="err in result.errors" :key="err.row">{{ t('common.row', { row: err.row, error: err.error }) }}</li>
        </ul>
      </div>
      <el-button type="primary" @click="closeAndRefresh">{{ t('common.close') }}</el-button>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Papa from 'papaparse';
import { ElMessage } from 'element-plus';

const { t } = useI18n();
const emit = defineEmits(['close', 'imported']);

const visible = ref(true);
const step = ref(1);
const file = ref(null);
const rawRows = ref([]);
const columns = ref([]);
const previewRows = ref([]);
const mapping = reactive({});
const loading = ref(false);
const result = ref({});

const fields = computed(() => [
  { label: t('contacts.name'), value: 'name' },
  { label: t('contacts.email'), value: 'email' },
  { label: t('contacts.telegram'), value: 'telegram' },
  { label: t('contacts.wallet'), value: 'wallet' },
  { label: t('contacts.comment'), value: 'crm_comment' },
  { label: t('contacts.link'), value: 'crm_link' }
]);

function handleFileChange(e) {
  const f = e.raw || (e.target && e.target.files && e.target.files[0]);
  if (!f) return;
  file.value = f;
  const reader = new FileReader();
  reader.onload = (evt) => {
    let data = [];
    if (f.name.endsWith('.csv')) {
      const parsed = Papa.parse(evt.target.result, { header: true });
      data = parsed.data.filter(r => Object.values(r).some(Boolean));
    } else if (f.name.endsWith('.json')) {
      try {
        let parsed = JSON.parse(evt.target.result);
        let dataCandidate = Array.isArray(parsed) ? parsed : findFirstArray(parsed);
        if (!Array.isArray(dataCandidate)) {
          throw new Error(t('contacts.importModal.jsonArrayRequired'));
        }
        data = dataCandidate;
      } catch (e) {
        ElMessage.error(t('contacts.importModal.jsonParseError', { error: e.message }));
        return;
      }
    }
    if (!data.length) {
      ElMessage.error(t('contacts.importModal.emptyFile'));
      return;
    }
    rawRows.value = data;
    columns.value = Object.keys(data[0]);
    previewRows.value = data.slice(0, 10);
    for (const col of columns.value) {
      const lower = col.toLowerCase();
      if (lower.includes('mail')) mapping[col] = 'email';
      else if (lower.includes('tele')) mapping[col] = 'telegram';
      else if (lower.includes('wallet')) mapping[col] = 'wallet';
      else if (lower.includes('comment') || lower.includes('коммент')) mapping[col] = 'crm_comment';
      else if (lower.includes('link') || lower.includes('url') || lower.includes('site') || lower.includes('ссыл')) mapping[col] = 'crm_link';
      else if (lower.includes('name')) mapping[col] = 'name';
      else mapping[col] = '';
    }
    step.value = 2;
  };
  reader.readAsText(f);
}
function removeRow(idx) {
  rawRows.value.splice(idx, 1);
  previewRows.value = rawRows.value.slice(0, 10);
}
async function submitImport() {
  loading.value = true;
  const contacts = rawRows.value.map(row => {
    const obj = {};
    for (const col of columns.value) {
      const field = mapping[col];
      if (field) obj[field] = row[col];
    }
    return obj;
  });
  try {
    const resp = await fetch('/users/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contacts)
    });
    const data = await resp.json();
    result.value = data;
    step.value = 3;
  } catch (e) {
    ElMessage.error(t('contacts.importModal.importError', { error: e.message }));
  } finally {
    loading.value = false;
  }
}
function closeAndRefresh() {
  visible.value = false;
  setTimeout(() => {
    step.value = 1;
    result.value = {};
    rawRows.value = [];
    columns.value = [];
    previewRows.value = [];
    file.value = null;
    Object.keys(mapping).forEach(k => delete mapping[k]);
    loading.value = false;
    emit('imported');
    emit('close');
  }, 300);
}
function findFirstArray(obj) {
  if (Array.isArray(obj)) return obj;
  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      const found = findFirstArray(obj[key]);
      if (found) return found;
    }
  }
  return null;
}
</script>

<style scoped>
.el-upload {
  width: 100%;
  margin-bottom: 1em;
}
</style>
