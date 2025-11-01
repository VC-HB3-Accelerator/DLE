<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div v-if="isOpen" class="consent-modal-overlay" @click.self="close">
    <div class="consent-modal">
      <div class="consent-modal-header">
        <h2>Подписание документов</h2>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="consent-modal-content">
        <p class="consent-description">
          Для полноценного использования сервиса необходимо ознакомиться и подписать следующие документы:
        </p>
        
        <div v-if="loading" class="loading-state">
          <p>Загрузка документов...</p>
        </div>
        
        <div v-else-if="documents.length === 0" class="empty-state">
          <p>Документы не найдены</p>
        </div>
        
        <div v-else class="documents-list">
          <div v-for="doc in documents" :key="doc.id" class="document-item">
            <label class="document-checkbox">
              <input 
                type="checkbox" 
                :value="doc.id"
                v-model="selectedDocuments"
                class="checkbox-input"
              />
              <div class="document-info">
                <h3 class="document-title">{{ doc.title }}</h3>
                <p v-if="doc.summary" class="document-summary">{{ doc.summary }}</p>
                <a 
                  :href="`/content/published/${doc.id}`" 
                  target="_blank" 
                  class="document-link"
                  @click.stop
                >
                  Открыть документ →
                </a>
              </div>
            </label>
          </div>
        </div>
      </div>
      
      <div class="consent-modal-footer">
        <button class="btn-secondary" @click="close">Отмена</button>
        <button 
          class="btn-primary" 
          @click="submitConsent"
          :disabled="selectedDocuments.length === 0 || submitting"
        >
          {{ submitting ? 'Подписание...' : 'Подписать' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import api from '../api/axios';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  missingConsents: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'consent-granted']);

const documents = ref([]);
const selectedDocuments = ref([]);
const loading = ref(false);
const submitting = ref(false);

// Загружаем документы для подписания
async function loadDocuments() {
  loading.value = true;
  try {
    const response = await api.get('/consent/documents');
    documents.value = response.data || [];
    
    // Автоматически выбираем все документы
    selectedDocuments.value = documents.value.map(doc => doc.id);
  } catch (error) {
    console.error('Ошибка загрузки документов:', error);
    documents.value = [];
  } finally {
    loading.value = false;
  }
}

// Отправляем согласие
async function submitConsent() {
  if (selectedDocuments.value.length === 0) return;
  
  submitting.value = true;
  try {
    // Получаем типы согласий для выбранных документов
    const consentTypes = documents.value
      .filter(doc => selectedDocuments.value.includes(doc.id))
      .map(doc => doc.consentType)
      .filter(type => type);
    
    await api.post('/consent/grant', {
      documentIds: selectedDocuments.value,
      consentTypes: consentTypes,
    });
    
    emit('consent-granted');
    close();
  } catch (error) {
    console.error('Ошибка подписания документов:', error);
    alert('Ошибка при подписании документов. Попробуйте еще раз.');
  } finally {
    submitting.value = false;
  }
}

function close() {
  emit('close');
  selectedDocuments.value = [];
}

// Загружаем документы при открытии модалки
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    loadDocuments();
  }
});

onMounted(() => {
  if (props.isOpen) {
    loadDocuments();
  }
});
</script>

<style scoped>
.consent-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.consent-modal {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.consent-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
}

.consent-modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--color-primary, #333);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #888;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.consent-modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.consent-description {
  margin: 0 0 20px 0;
  color: #666;
  line-height: 1.6;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #888;
}

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.document-item {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s;
}

.document-item:hover {
  border-color: var(--color-primary, #007bff);
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.1);
}

.document-checkbox {
  display: flex;
  gap: 12px;
  cursor: pointer;
  align-items: flex-start;
}

.checkbox-input {
  margin-top: 4px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.document-info {
  flex: 1;
}

.document-title {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  color: var(--color-primary, #333);
  font-weight: 600;
}

.document-summary {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 0.9rem;
  line-height: 1.5;
}

.document-link {
  color: var(--color-primary, #007bff);
  text-decoration: none;
  font-size: 0.9rem;
  display: inline-block;
  margin-top: 8px;
}

.document-link:hover {
  text-decoration: underline;
}

.consent-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e9ecef;
}

.btn-secondary,
.btn-primary {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-primary {
  background: var(--color-primary, #007bff);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #0056b3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

