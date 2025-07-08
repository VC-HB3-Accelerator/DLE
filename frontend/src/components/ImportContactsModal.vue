<template>
  <el-dialog v-model="visible" title="Импорт контактов" width="800px" @close="$emit('close')">
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
        <div class="el-upload__text">Перетащите файл сюда или <em>нажмите для выбора</em></div>
        <div class="el-upload__tip">Поддерживаются форматы CSV и JSON</div>
      </el-upload>
    </div>
    <div v-else-if="step === 2">
      <div style="margin-bottom:1em;">Сопоставьте столбцы файла с полями контакта:</div>
      <el-table :data="previewRows" border style="width:100%;margin-bottom:1em;">
        <el-table-column v-for="(col, idx) in columns" :key="col" :label="col">
          <template #header>
            <el-select v-model="mapping[col]" placeholder="Выбрать поле" size="small">
              <el-option v-for="f in fields" :key="f.value" :label="f.label" :value="f.value" />
            </el-select>
          </template>
          <template #default="scope">
            {{ scope.row[col] }}
          </template>
        </el-table-column>
        <el-table-column label="Удалить" width="80">
          <template #default="scope">
            <el-button type="danger" icon="el-icon-delete" size="small" @click="removeRow(scope.$index)" circle />
          </template>
        </el-table-column>
      </el-table>
      <el-button @click="step = 1" style="margin-right:1em;">Назад</el-button>
      <el-button type="primary" @click="submitImport" :loading="loading">Импортировать</el-button>
    </div>
    <div v-else-if="step === 3">
      <div v-if="result.success" style="color:green;">Импорт завершён: добавлено {{result.added}}, обновлено {{result.updated}}</div>
      <div v-if="result.errors && result.errors.length" style="color:red;max-height:120px;overflow:auto;">
        Ошибки:
        <ul>
          <li v-for="err in result.errors" :key="err.row">Строка {{err.row}}: {{err.error}}</li>
        </ul>
      </div>
      <el-button type="primary" @click="closeAndRefresh">Закрыть</el-button>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import Papa from 'papaparse';
import { ElMessage } from 'element-plus';
const visible = ref(true);
const step = ref(1);
const file = ref(null);
const rawRows = ref([]);
const columns = ref([]);
const previewRows = ref([]);
const mapping = reactive({});
const loading = ref(false);
const result = ref({});
const fields = [
  { label: 'Имя', value: 'name' },
  { label: 'Email', value: 'email' },
  { label: 'Telegram', value: 'telegram' },
  { label: 'Wallet', value: 'wallet' }
];
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
          throw new Error('JSON должен содержать массив объектов на любом уровне вложенности');
        }
        data = dataCandidate;
      } catch (e) {
        ElMessage.error('Ошибка парсинга JSON: ' + e.message);
        return;
      }
    }
    if (!data.length) {
      ElMessage.error('Файл не содержит данных');
      return;
    }
    rawRows.value = data;
    columns.value = Object.keys(data[0]);
    previewRows.value = data.slice(0, 10);
    // Автоматический маппинг по названию
    for (const col of columns.value) {
      const lower = col.toLowerCase();
      if (lower.includes('mail')) mapping[col] = 'email';
      else if (lower.includes('tele')) mapping[col] = 'telegram';
      else if (lower.includes('wallet')) mapping[col] = 'wallet';
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
  // Собираем данные по маппингу
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
    ElMessage.error('Ошибка импорта: ' + e.message);
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
    // Сообщаем родителю об успешном импорте
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