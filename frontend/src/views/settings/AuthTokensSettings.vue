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
  <div class="auth-tokens-settings">
    <h4>{{ $t('settings.authTokens.title') }}</h4>
    
    <!-- Отображение текущего уровня доступа -->
    <div v-if="userAccessLevel && userAccessLevel.hasAccess" class="access-level-info">
      <div class="access-level-badge" :class="getLevelClass(userAccessLevel.level)">
        <i class="fas fa-shield-alt"></i>
        <span>{{ getLevelDescription(userAccessLevel.level) }}</span>
        <span class="token-count">{{ $t('settings.authTokens.tokenCount', userAccessLevel.tokenCount) }}</span>
      </div>
      <div class="access-level-description">
        {{ getAccessLevelDescription(userAccessLevel.level) }}
      </div>
    </div>
    <div v-if="authTokens.length > 0" class="tokens-list">
      <div v-for="(token, index) in authTokens" :key="token.address + token.network" class="token-entry">
        <span><strong>{{ $t('settings.authTokens.name') }}</strong> {{ token.name }}</span>
        <span><strong>{{ $t('settings.authTokens.address') }}</strong> {{ token.address }}</span>
        <span><strong>{{ $t('settings.authTokens.network') }}</strong> {{ getNetworkLabel(token.network) }}</span>
        <span><strong>{{ $t('settings.authTokens.minBalance') }}</strong> {{ token.minBalance }}</span>
        <span><strong>{{ $t('settings.authTokens.readOnly') }}</strong> {{ token.readonlyThreshold || 1 }} {{ getTokenSuffix(token.readonlyThreshold || 1) }}</span>
        <span><strong>{{ $t('settings.authTokens.editor') }}</strong> {{ token.editorThreshold || 2 }} {{ getTokenSuffix(token.editorThreshold || 2) }}</span>
        <button 
          class="btn btn-sm" 
          :class="canManageSettings ? 'btn-danger' : 'btn-secondary'" 
          @click="canManageSettings ? removeToken(index) : null"
          :disabled="!canManageSettings"
        >
          {{ $t('common.delete') }}
        </button>
      </div>
    </div>
    <p v-else>{{ $t('settings.authTokens.empty') }}</p>
    <div class="add-token-form">
      <h5>{{ $t('settings.authTokens.addTitle') }}</h5>
      <div class="form-group">
        <label>{{ $t('settings.authTokens.name') }}</label>
        <input 
          type="text" 
          v-model="newToken.name" 
          class="form-control" 
          placeholder="test2"
          :disabled="!canManageSettings"
        >
      </div>
      <div class="form-group">
        <label>{{ $t('settings.authTokens.address') }}</label>
        <input 
          type="text" 
          v-model="newToken.address" 
          class="form-control" 
          placeholder="0x..."
          :disabled="!canManageSettings"
        >
      </div>
      <div class="form-group">
        <label>{{ $t('settings.authTokens.network') }}</label>
        <select v-model="newToken.network" class="form-control" :disabled="!canManageSettings">
          <option value="">{{ $t('settings.authTokens.selectNetwork') }}</option>
          <optgroup v-for="(group, groupIndex) in networkGroups" :key="groupIndex" :label="group.label">
            <option v-for="option in group.options" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </optgroup>
        </select>
      </div>
      <div class="form-group">
        <label>{{ $t('settings.authTokens.minBalance') }}</label>
        <input 
          type="number" 
          v-model.number="newToken.minBalance" 
          class="form-control" 
          placeholder="0"
          min="0"
          step="0.01"
          :disabled="!canManageSettings"
        >
        <small class="form-text">{{ $t('settings.authTokens.minBalanceHelp') }}</small>
      </div>
      
      <!-- Настройки прав доступа -->
      <div class="access-settings">
        <h6>{{ $t('settings.authTokens.accessSettings') }}</h6>
        <div class="form-group">
          <label>{{ $t('settings.authTokens.readonlyThreshold') }}</label>
          <input 
            type="number" 
            v-model="newToken.readonlyThreshold" 
            class="form-control" 
            placeholder="1"
            min="1"
            :disabled="!canManageSettings"
          >
          <small class="form-text">{{ $t('settings.authTokens.readonlyThresholdHelp') }}</small>
        </div>
        <div class="form-group">
          <label>{{ $t('settings.authTokens.editorThreshold') }}</label>
          <input 
            type="number" 
            v-model="newToken.editorThreshold" 
            class="form-control" 
            placeholder="2"
            min="2"
            :disabled="!canManageSettings"
          >
          <small class="form-text">{{ $t('settings.authTokens.editorThresholdHelp') }}</small>
        </div>
      </div>
      <button 
        class="btn" 
        :class="canManageSettings ? 'btn-primary' : 'btn-secondary'" 
        @click="canManageSettings ? addToken() : null"
        :disabled="!canManageSettings"
      >
        {{ $t('settings.authTokens.addButton') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { reactive, computed, onMounted } from 'vue';
import useBlockchainNetworks from '@/composables/useBlockchainNetworks';
import api from '@/api/axios';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import eventBus from '@/utils/eventBus';
const props = defineProps({
  authTokens: { type: Array, required: true }
});
const emit = defineEmits(['update']);
const newToken = reactive({ 
  name: '', 
  address: '', 
  network: '', 
  minBalance: 0,
  readonlyThreshold: 1,
  editorThreshold: 2
});

const { networkGroups, networks } = useBlockchainNetworks();
const { checkTokenBalances, address, checkAuth, userAccessLevel, checkUserAccessLevel } = useAuthContext();
const { canManageSettings, getLevelClass, getLevelDescription } = usePermissions();

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[AuthTokensSettings] Clearing tokens data');
    // Очищаем данные при выходе из системы
    tokens.value = [];
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[AuthTokensSettings] Refreshing tokens data');
    loadTokens(); // Обновляем данные при входе в систему
  });
});

function getTokenSuffix(count) {
  const n = Math.abs(Number(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return t('settings.authTokens.tokenSuffixOne');
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return t('settings.authTokens.tokenSuffixFew');
  return t('settings.authTokens.tokenSuffixMany');
}

async function addToken() {
  if (!newToken.name || !newToken.address || !newToken.network) {
    alert(t('settings.authTokens.allFieldsRequired'));
    return;
  }
  
  // Валидация порогов доступа
  if (newToken.readonlyThreshold >= newToken.editorThreshold) {
    alert(t('settings.authTokens.thresholdInvalid'));
    return;
  }
  
  const tokenData = {
    name: newToken.name,
    address: newToken.address,
    network: newToken.network,
    minBalance: Number(newToken.minBalance) || 0,
    readonlyThreshold: newToken.readonlyThreshold !== null && newToken.readonlyThreshold !== undefined && newToken.readonlyThreshold !== '' ? Number(newToken.readonlyThreshold) : 1,
    editorThreshold: newToken.editorThreshold !== null && newToken.editorThreshold !== undefined && newToken.editorThreshold !== '' ? Number(newToken.editorThreshold) : 2
  };
  
  console.log('[AuthTokensSettings] Отправляем данные токена:', tokenData);
  console.log('[AuthTokensSettings] newToken объект:', newToken);
  console.log('[AuthTokensSettings] newToken.readonlyThreshold:', newToken.readonlyThreshold, 'тип:', typeof newToken.readonlyThreshold);
  console.log('[AuthTokensSettings] newToken.editorThreshold:', newToken.editorThreshold, 'тип:', typeof newToken.editorThreshold);
  
  try {
    await api.post('/settings/auth-token', tokenData);
    
    // После добавления токена перепроверяем баланс пользователя и обновляем состояние аутентификации
    try {
      if (address.value) {
        await checkTokenBalances(address.value);
        await checkUserAccessLevel(address.value);
        console.log('[AuthTokensSettings] Баланс токенов и уровень доступа перепроверены после добавления');
      }
      
      // Обновляем состояние аутентификации чтобы отразить изменения роли
      await checkAuth();
      console.log('[AuthTokensSettings] Состояние аутентификации обновлено после добавления токена');
      
      // Уведомляем App.vue об изменении настроек аутентификации
      eventBus.emit('auth-settings-saved');
      console.log('[AuthTokensSettings] Событие auth-settings-saved отправлено');
    } catch (balanceError) {
      console.error('[AuthTokensSettings] Ошибка при перепроверке баланса:', balanceError);
    }
    
    // Небольшая задержка для синхронизации с backend
    setTimeout(() => {
      emit('update');
    }, 100);
    
    newToken.name = '';
    newToken.address = '';
    newToken.network = '';
    newToken.minBalance = 0;
    newToken.readonlyThreshold = 1;
    newToken.editorThreshold = 2;
  } catch (e) {
    alert(t('settings.authTokens.addError', { error: e.response?.data?.error || e.message }));
  }
}

async function removeToken(index) {
  const token = props.authTokens[index];
  if (!token) return;
  if (!confirm(t('settings.authTokens.confirmDelete', { name: token.name, address: token.address }))) return;
  
  console.log('[AuthTokensSettings] Удаление токена:', token);
  console.log('[AuthTokensSettings] URL:', `/settings/auth-token/${token.address}/${token.network}`);
  
  try {
    const response = await api.delete(`/settings/auth-token/${token.address}/${token.network}`);
    console.log('[AuthTokensSettings] Успешное удаление:', response.data);
    
    // После удаления токена перепроверяем баланс пользователя и обновляем состояние аутентификации
    try {
      if (address.value) {
        await checkTokenBalances(address.value);
        await checkUserAccessLevel(address.value);
        console.log('[AuthTokensSettings] Баланс токенов и уровень доступа перепроверены после удаления');
      }
      
      // Обновляем состояние аутентификации чтобы отразить изменения роли
      await checkAuth();
      console.log('[AuthTokensSettings] Состояние аутентификации обновлено после удаления токена');
      
      // Уведомляем App.vue об изменении настроек аутентификации
      eventBus.emit('auth-settings-saved');
      console.log('[AuthTokensSettings] Событие auth-settings-saved отправлено');
    } catch (balanceError) {
      console.error('[AuthTokensSettings] Ошибка при перепроверке баланса:', balanceError);
    }
    
    // Небольшая задержка для синхронизации с backend
    setTimeout(() => {
      emit('update');
    }, 100);
  } catch (e) {
    console.error('[AuthTokensSettings] Ошибка при удалении токена:', e);
    console.error('[AuthTokensSettings] Response:', e.response);
    alert(t('settings.authTokens.deleteError', { error: e.response?.data?.error || e.message }));
  }
}

function getNetworkLabel(networkId) {
  const found = networks.value.find(n => n.value === networkId);
  return found ? found.label : networkId;
}


function getAccessLevelDescription(level) {
  switch (level) {
    case 'readonly':
      return t('settings.authTokens.accessReadonly');
    case 'editor':
      return t('settings.authTokens.accessEditor');
    case 'user':
    default:
      return t('settings.authTokens.accessUser');
  }
}
</script>

<style scoped>
.tokens-list { margin-bottom: 1rem; }
.token-entry { 
  display: flex; 
  gap: 1rem; 
  align-items: center; 
  margin-bottom: 0.5rem; 
  flex-wrap: wrap;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.token-entry span {
  font-size: 0.875rem;
  white-space: nowrap;
}
.add-token-form { margin-top: 1rem; }

/* Стили для секции настроек прав доступа */
.access-settings {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.access-settings h6 {
  margin-bottom: 1rem;
  color: #495057;
  font-weight: 600;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 0.5rem;
}

.form-text {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: #6c757d;
}

/* Стили для отображения уровня доступа */
.access-level-info {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.access-level-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.access-level-badge i {
  font-size: 1rem;
}

.access-readonly {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.access-editor {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.access-user {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.token-count {
  font-weight: 400;
  opacity: 0.8;
}

.access-level-description {
  font-size: 0.85rem;
  color: #6c757d;
  margin-top: 0.25rem;
}

/* Стили для неактивных кнопок */
.btn[disabled], .btn:disabled {
  background: #e0e0e0 !important;
  color: #aaa !important;
  border-color: #ccc !important;
  cursor: not-allowed !important;
  opacity: 1 !important;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

/* Стили для неактивных полей формы */
.form-control[disabled], .form-control:disabled {
  background-color: #f8f9fa !important;
  color: #6c757d !important;
  border-color: #dee2e6 !important;
  cursor: not-allowed !important;
  opacity: 1 !important;
}

.form-control {
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}
</style> 