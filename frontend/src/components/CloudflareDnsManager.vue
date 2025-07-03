<template>
  <div class="dns-manager">
    <h3>Управление DNS записями</h3>
    
    <!-- Индикатор загрузки -->
    <div v-if="isLoading" class="loading-section">
      <div class="loading-spinner"></div>
      <span>Загрузка DNS записей...</span>
    </div>

    <!-- Сообщения об ошибках -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Сообщения об успехе -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- Таблица DNS записей -->
    <div v-if="!isLoading && records.length > 0" class="dns-records-table">
      <table>
        <thead>
          <tr>
            <th>Тип</th>
            <th>Имя</th>
            <th>Содержимое</th>
            <th>TTL</th>
            <th>Прокси</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in records" :key="record.id">
            <td>{{ record.type }}</td>
            <td>{{ record.name }}</td>
            <td class="content-cell">{{ record.content }}</td>
            <td>{{ record.ttl === 1 ? 'Auto' : record.ttl }}</td>
            <td>
              <span v-if="['A', 'AAAA', 'CNAME'].includes(record.type)" 
                    :class="['proxy-status', record.proxied ? 'proxied' : 'not-proxied']">
                {{ record.proxied ? 'Да' : 'Нет' }}
              </span>
              <span v-else>-</span>
            </td>
            <td class="actions-cell">
              <button class="btn-edit" @click="editRecord(record)">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-delete" @click="deleteRecord(record.id)" 
                      :disabled="isDeletingRecord === record.id">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Пустое состояние -->
    <div v-if="!isLoading && records.length === 0 && !errorMessage" class="empty-state">
      <p>DNS записи не найдены</p>
    </div>

    <!-- Кнопка добавления новой записи -->
    <div class="add-record-section" v-if="!isLoading && !errorMessage">
      <button class="btn-primary" @click="showAddForm = true" v-if="!showAddForm">
        <i class="fas fa-plus"></i> Добавить DNS запись
      </button>
    </div>

    <!-- Форма создания/редактирования DNS записи -->
    <div v-if="showAddForm || editingRecord" class="dns-form">
      <h4>{{ editingRecord ? 'Редактирование DNS записи' : 'Добавление DNS записи' }}</h4>
      
      <div class="form-row">
        <div class="form-group">
          <label>Тип записи:</label>
          <select v-model="formData.type" class="form-control">
            <option value="A">A</option>
            <option value="AAAA">AAAA</option>
            <option value="CNAME">CNAME</option>
            <option value="MX">MX</option>
            <option value="TXT">TXT</option>
            <option value="SRV">SRV</option>
            <option value="NS">NS</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Имя:</label>
          <input v-model="formData.name" type="text" class="form-control" 
                 placeholder="example.com или @" />
        </div>
      </div>

      <div class="form-group">
        <label>Содержимое:</label>
        <input v-model="formData.content" type="text" class="form-control" 
               :placeholder="getContentPlaceholder(formData.type)" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>TTL:</label>
          <select v-model="formData.ttl" class="form-control">
            <option value="1">Auto</option>
            <option value="300">5 минут</option>
            <option value="1800">30 минут</option>
            <option value="3600">1 час</option>
            <option value="14400">4 часа</option>
            <option value="86400">1 день</option>
          </select>
        </div>

        <div class="form-group" v-if="['A', 'AAAA', 'CNAME'].includes(formData.type)">
          <label>
            <input type="checkbox" v-model="formData.proxied" />
            Проксировать через Cloudflare
          </label>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-primary" @click="saveRecord" :disabled="isSavingRecord">
          {{ isSavingRecord ? 'Сохранение...' : (editingRecord ? 'Обновить' : 'Создать') }}
        </button>
        <button class="btn-secondary" @click="cancelForm">Отмена</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

const emit = defineEmits(['dns-updated']);

const records = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const showAddForm = ref(false);
const editingRecord = ref(null);
const isSavingRecord = ref(false);
const isDeletingRecord = ref(null);

const formData = ref({
  type: 'A',
  name: '',
  content: '',
  ttl: 1,
  proxied: false
});

// Загрузка DNS записей
async function loadDnsRecords() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await fetch('/api/cloudflare/dns-records');
    const data = await response.json();
    
    if (data.success) {
      records.value = data.records || [];
    } else {
      errorMessage.value = data.message || 'Ошибка загрузки DNS записей';
    }
  } catch (e) {
    errorMessage.value = 'Ошибка соединения: ' + e.message;
  } finally {
    isLoading.value = false;
  }
}

// Получение placeholder для поля content в зависимости от типа записи
function getContentPlaceholder(type) {
  const placeholders = {
    A: '192.168.1.1',
    AAAA: '2001:db8::1',
    CNAME: 'example.com',
    MX: '10 mail.example.com',
    TXT: 'v=spf1 include:_spf.google.com ~all',
    SRV: '10 5 443 target.example.com',
    NS: 'ns1.example.com'
  };
  return placeholders[type] || 'Введите значение';
}

// Начало редактирования записи
function editRecord(record) {
  editingRecord.value = record;
  formData.value = {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl,
    proxied: record.proxied || false
  };
  showAddForm.value = false;
}

// Сохранение записи (создание или обновление)
async function saveRecord() {
  if (!formData.value.name || !formData.value.content) {
    errorMessage.value = 'Заполните все обязательные поля';
    return;
  }

  isSavingRecord.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const body = {
      type: formData.value.type,
      name: formData.value.name,
      content: formData.value.content,
      ttl: parseInt(formData.value.ttl),
      proxied: formData.value.proxied
    };

    if (editingRecord.value) {
      body.recordId = editingRecord.value.id;
    }

    const response = await fetch('/api/cloudflare/dns-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    
    if (data.success) {
      successMessage.value = data.message || 'DNS запись сохранена';
      cancelForm();
      await loadDnsRecords();
      emit('dns-updated');
      
      // Очищаем сообщение об успехе через 3 секунды
      setTimeout(() => {
        successMessage.value = '';
      }, 3000);
    } else {
      errorMessage.value = data.message || 'Ошибка сохранения DNS записи';
    }
  } catch (e) {
    errorMessage.value = 'Ошибка соединения: ' + e.message;
  } finally {
    isSavingRecord.value = false;
  }
}

// Удаление записи
async function deleteRecord(recordId) {
  if (!confirm('Вы уверены, что хотите удалить эту DNS запись?')) {
    return;
  }

  isDeletingRecord.value = recordId;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const response = await fetch(`/api/cloudflare/dns-records/${recordId}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    
    if (data.success) {
      successMessage.value = data.message || 'DNS запись удалена';
      await loadDnsRecords();
      emit('dns-updated');
      
      // Очищаем сообщение об успехе через 3 секунды
      setTimeout(() => {
        successMessage.value = '';
      }, 3000);
    } else {
      errorMessage.value = data.message || 'Ошибка удаления DNS записи';
    }
  } catch (e) {
    errorMessage.value = 'Ошибка соединения: ' + e.message;
  } finally {
    isDeletingRecord.value = null;
  }
}

// Отмена формы
function cancelForm() {
  showAddForm.value = false;
  editingRecord.value = null;
  formData.value = {
    type: 'A',
    name: '',
    content: '',
    ttl: 1,
    proxied: false
  };
}

// Очистка сообщений при изменении формы
watch([() => formData.value.type, () => formData.value.name, () => formData.value.content], () => {
  errorMessage.value = '';
});

onMounted(() => {
  loadDnsRecords();
});

defineExpose({
  loadDnsRecords
});
</script>

<style scoped>
.dns-manager {
  margin-top: 2rem;
  padding: 1.5rem;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  background: #f8f9fa;
}

.loading-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e1e5e9;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  padding: 0.75rem 1rem;
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.success-message {
  padding: 0.75rem 1rem;
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.dns-records-table {
  background: #fff;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.dns-records-table table {
  width: 100%;
  border-collapse: collapse;
}

.dns-records-table th,
.dns-records-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e1e5e9;
}

.dns-records-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
}

.content-cell {
  max-width: 200px;
  word-break: break-all;
  font-family: monospace;
  font-size: 0.9em;
}

.proxy-status.proxied {
  color: #28a745;
  font-weight: 500;
}

.proxy-status.not-proxied {
  color: #6c757d;
}

.actions-cell {
  width: 100px;
}

.btn-edit,
.btn-delete {
  background: none;
  border: none;
  padding: 0.25rem 0.5rem;
  margin: 0 0.25rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-edit {
  color: #007bff;
}

.btn-edit:hover {
  background: #e3f2fd;
}

.btn-delete {
  color: #dc3545;
}

.btn-delete:hover {
  background: #fdeaea;
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
  background: #fff;
  border-radius: 6px;
}

.add-record-section {
  margin-top: 1rem;
}

.dns-form {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e1e5e9;
}

.dns-form h4 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #495057;
}

.form-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  flex: 1;
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #495057;
}

.form-control {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
}

.form-control:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background: #5a6268;
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
  }
  
  .dns-records-table {
    font-size: 0.8rem;
  }
  
  .content-cell {
    max-width: 120px;
  }
}
</style> 