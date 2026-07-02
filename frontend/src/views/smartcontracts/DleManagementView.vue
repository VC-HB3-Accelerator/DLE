<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="dle-management">
      <!-- Форма добавления DLE -->
      <div class="add-dle-form">
        <div class="form-header">
          <h4>{{ t('smartcontracts.dleManagement.addTitle') }}</h4>
        </div>
        
        <div class="form-content">
          <div class="form-group">
            <label for="dleLink">{{ t('smartcontracts.dleManagement.linkLabel') }}</label>
            <input 
              type="text" 
              id="dleLink" 
              v-model="newDle.link" 
              class="form-control"
              :placeholder="t('smartcontracts.dleManagement.linkPlaceholder')"
            >
            <small class="form-help">{{ t('smartcontracts.dleManagement.linkHelp') }}</small>
          </div>
          
          <div class="form-group">
            <label for="dleName">{{ t('smartcontracts.dleManagement.nameLabel') }}</label>
            <input 
              type="text" 
              id="dleName" 
              v-model="newDle.name" 
              class="form-control"
              :placeholder="t('smartcontracts.dleManagement.namePlaceholder')"
            >
          </div>
          
          <div class="form-group">
            <label for="dleDescription">{{ t('smartcontracts.dleManagement.descriptionLabel') }}</label>
            <textarea 
              id="dleDescription" 
              v-model="newDle.description" 
              class="form-control" 
              rows="3"
              :placeholder="t('smartcontracts.dleManagement.descriptionPlaceholder')"
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button 
              class="btn btn-primary" 
              @click="addDle"
              :disabled="!isFormValid || isAdding"
            >
              <i class="fas fa-plus"></i> 
              {{ isAdding ? t('smartcontracts.dleManagement.adding') : t('smartcontracts.dleManagement.addButton') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Список добавленных DLE -->
      <div class="dles-list">
        <div class="list-header">
          <h4>{{ t('smartcontracts.dleManagement.listTitle') }}</h4>
        </div>

        <div v-if="dles.length === 0" class="no-dles">
          <p>{{ t('smartcontracts.dleManagement.emptyTitle') }}</p>
          <p>{{ t('smartcontracts.dleManagement.emptyHint') }}</p>
        </div>

        <div v-else class="dles-grid">
          <div 
            v-for="dle in dles" 
            :key="dle.id" 
            class="dle-card"
          >
            <div class="dle-header">
              <h5>{{ dle.name }}</h5>
              <span class="dle-status">{{ t('smartcontracts.dleManagement.statusAdded') }}</span>
            </div>

            <div class="dle-details">
              <div class="detail-item">
                <strong>{{ t('smartcontracts.dleManagement.detailDescription') }}</strong> {{ dle.description }}
              </div>
              <div class="detail-item">
                <strong>{{ t('smartcontracts.dleManagement.detailLink') }}</strong> 
                <a :href="dle.link" target="_blank" class="dle-link">
                  {{ shortenUrl(dle.link) }}
                </a>
              </div>
              <div class="detail-item">
                <strong>{{ t('smartcontracts.dleManagement.detailAddedAt') }}</strong> {{ formatDate(dle.addedAt) }}
              </div>
            </div>

            <div class="dle-actions">
              <button 
                class="btn btn-sm btn-primary" 
                @click="openDle(dle.link)"
              >
                <i class="fas fa-external-link-alt"></i> {{ t('smartcontracts.dleManagement.open') }}
              </button>
              <button 
                class="btn btn-sm btn-danger" 
                @click="removeDle(dle.id)"
              >
                <i class="fas fa-trash"></i> {{ t('common.delete') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, defineProps, defineEmits } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';

const { t, locale } = useI18n();

const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

defineEmits(['auth-action-completed']);

const isAdding = ref(false);

const newDle = ref({
  link: '',
  name: '',
  description: ''
});

const dles = ref([]);

const isFormValid = computed(() => {
  return newDle.value.link && newDle.value.name;
});

function shortenUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return `${urlObj.hostname}${urlObj.pathname.substring(0, 20)}...`;
  } catch {
    return url.substring(0, 50) + '...';
  }
}

function formatDate(date) {
  if (!date) return '';
  const localeTag = locale.value === 'en' ? 'en-US' : 'ru-RU';
  return new Date(date).toLocaleDateString(localeTag, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function addDle() {
  if (!isFormValid.value) {
    alert(t('smartcontracts.dleManagement.fillRequired'));
    return;
  }

  isAdding.value = true;
  
  try {
    const dle = {
      id: Date.now(),
      link: newDle.value.link,
      name: newDle.value.name,
      description: newDle.value.description,
      addedAt: new Date().toISOString()
    };
    
    dles.value.unshift(dle);
    saveDlesToStorage();
    
    newDle.value = {
      link: '',
      name: '',
      description: ''
    };
    
    alert(t('smartcontracts.dleManagement.addSuccess'));
    
  } catch (error) {
    alert(t('smartcontracts.dleManagement.addError', { message: error.message }));
  } finally {
    isAdding.value = false;
  }
}

function removeDle(dleId) {
  if (!confirm(t('smartcontracts.dleManagement.confirmRemove'))) return;
  
  try {
    dles.value = dles.value.filter(dle => dle.id !== dleId);
    saveDlesToStorage();
    alert(t('smartcontracts.dleManagement.removeSuccess'));
  } catch (error) {
    alert(t('smartcontracts.dleManagement.removeError', { message: error.message }));
  }
}

function openDle(link) {
  window.open(link, '_blank');
}

function saveDlesToStorage() {
  try {
    localStorage.setItem('admin-dles', JSON.stringify(dles.value));
  } catch (error) {
    console.error('Error saving DLE:', error);
  }
}

function loadDlesFromStorage() {
  try {
    const saved = localStorage.getItem('admin-dles');
    if (saved) {
      dles.value = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading DLE:', error);
  }
}

onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    dles.value = [];
  });
  
  window.addEventListener('refresh-application-data', () => {
    loadDlesFromStorage();
  });

  loadDlesFromStorage();
});
</script>

<style scoped>
.dle-management {
  padding: 1rem;
}

.management-header {
  margin-bottom: 2rem;
  text-align: center;
}

.management-header h3 {
  color: var(--color-primary);
  margin-bottom: 0.5rem;
}

.add-dle-form {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.form-header {
  margin-bottom: 1rem;
}

.form-header h4 {
  margin: 0;
  color: var(--color-primary);
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #333;
}

.form-control {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-control:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-help {
  color: #666;
  font-size: 0.875rem;
}

.form-actions {
  margin-top: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.dles-list {
  margin-top: 2rem;
}

.list-header {
  margin-bottom: 1rem;
}

.list-header h4 {
  color: var(--color-primary);
  margin: 0;
}

.no-dles {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.dles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .dles-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .dle-card {
    padding: 1rem;
  }
  
  .dle-header h5 {
    font-size: 1.1rem;
  }
  
  .detail-item {
    font-size: 0.9rem;
  }
}

.dle-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
}

.dle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.dle-header h5 {
  margin: 0;
  color: var(--color-primary);
}

.dle-status {
  background: #28a745;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
}

.dle-details {
  margin-bottom: 1rem;
}

.detail-item {
  margin-bottom: 0.5rem;
}

.detail-item strong {
  color: #333;
}

.dle-link {
  color: var(--color-primary);
  text-decoration: none;
}

.dle-link:hover {
  text-decoration: underline;
}

.dle-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}
</style>
