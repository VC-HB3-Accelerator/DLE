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
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="settings-container">
      <!-- Основной контент -->
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div v-if="dleInfo?.address" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ dleInfo.address }}
        </div>
        <div v-else-if="address" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ address }}
        </div>
        <div v-else-if="isLoading" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ t('common.loading') }}
        </div>
        <button class="close-btn" @click="goBackToBlocks">×</button>
      </div>
      <div v-if="dleInfo" class="main-content">
        <!-- Отображение в футере -->
        <div v-if="canSetFooterDle" class="footer-card">
          <div class="footer-header">
            <h3>{{ t('smartcontracts.settings.footerDisplay') }}</h3>
          </div>
          <div class="footer-content">
            <p>{{ t('smartcontracts.settings.footerDescription') }}</p>
            <div v-if="isSelectedForFooter" class="selected-info">
              <i class="fas fa-check-circle"></i>
              <span>{{ t('smartcontracts.settings.selectedForFooter') }}</span>
            </div>
            <div v-else-if="hasFooterDle" class="other-selected-info">
              <i class="fas fa-info-circle"></i>
              <span>{{ t('smartcontracts.settings.otherSelectedForFooter', { name: footerDle.value?.name, symbol: footerDle.value?.symbol }) }}</span>
            </div>
            <div class="footer-actions">
              <button 
                v-if="!isSelectedForFooter" 
                @click="setAsFooterDle" 
                class="btn-primary" 
                :disabled="isLoading"
              >
                <i class="fas fa-eye"></i>
                {{ t('smartcontracts.settings.showInFooter') }}
              </button>
              <button 
                v-if="isSelectedForFooter" 
                @click="removeFromFooter" 
                class="btn-danger" 
                :disabled="isLoading"
              >
                <i class="fas fa-trash"></i>
                {{ t('smartcontracts.settings.removeFromFooter') }}
              </button>
              <button 
                v-if="hasFooterDle && !isSelectedForFooter" 
                @click="removeFromFooter" 
                class="btn-danger btn-sm" 
                :disabled="isLoading"
              >
                <i class="fas fa-trash"></i>
                {{ t('smartcontracts.settings.removeFromFooter') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Удаление DLE -->
        <div class="danger-card">
          <div class="danger-header">
            <h3>{{ t('smartcontracts.settings.deleteSection') }}</h3>
          </div>
          <div class="danger-content">
            <p>{{ t('smartcontracts.settings.deleteDescription') }}</p>
            <div class="warning-info">
              <h4>{{ t('smartcontracts.settings.important') }}</h4>
              <ul>
                <li>{{ t('smartcontracts.settings.warningTokens') }}</li>
                <li>{{ t('smartcontracts.settings.warningVoting') }}</li>
                <li>{{ t('smartcontracts.settings.warningActive') }}</li>
                <li>{{ t('smartcontracts.settings.warningOwner') }}</li>
              </ul>
            </div>
            <button @click="deleteDLE" class="btn-danger" :disabled="isLoading">
              {{ isLoading ? t('common.loading') : t('smartcontracts.settings.deleteDleBtn') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Сообщение если DLE не выбран -->
      <div v-if="!address" class="no-dle-card">
        <h3>{{ t('smartcontracts.settings.noDleSelected') }}</h3>
        <p>{{ t('smartcontracts.settings.noDleSelectedDesc') }}</p>
        <button @click="goBackToBlocks" class="btn-primary">
          {{ t('smartcontracts.settings.backToList') }}
        </button>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, defineProps, defineEmits, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthContext } from '../../composables/useAuth';
import { useFooterDle } from '../../composables/useFooterDle';
import { usePermissions } from '../../composables/usePermissions';
import { ROLES } from '../../composables/permissions';
import BaseLayout from '../../components/BaseLayout.vue';
import { deactivateDLE } from '../../utils/dle-contract.js';
import api from '../../api/axios';
import { errorMessageMatches } from '../../utils/i18nErrorMatch';

const { t } = useI18n();

// Определяем props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Состояние
const isSaving = ref(false);
const dleAddress = ref('');
const dleInfo = ref(null);
const isLoading = ref(false);

// Получаем адрес DLE из URL параметров
const address = route.query.address || props.dleAddress;

// Функция возврата к блокам управления
const goBackToBlocks = () => {
  if (address) {
    router.push(`/management/dle-blocks?address=${address}`);
  } else {
    router.push('/management');
  }
};

// Получаем адрес пользователя из контекста аутентификации
const { address: userAddress } = useAuthContext();

// Используем composable для проверки прав доступа
const { currentRole } = usePermissions();

// Используем composable для выбранного DLE
const { footerDle, setFooterDle, clearFooterDle } = useFooterDle();

// Проверяем, может ли пользователь устанавливать DLE для футера (только редактор)
const canSetFooterDle = computed(() => {
  return currentRole.value === ROLES.EDITOR;
});

// Проверяем, выбран ли этот DLE для отображения в футере
const isSelectedForFooter = computed(() => {
  if (!address || !footerDle.value) return false;
  // Сравниваем адреса в нижнем регистре для надежности
  return footerDle.value.address && footerDle.value.address.toLowerCase() === address.toLowerCase();
});

// Проверяем, есть ли какой-либо DLE в футере
const hasFooterDle = computed(() => {
  return footerDle.value !== null && footerDle.value.address !== null;
});

// Устанавливает выбранный DLE для отображения в футере
const setAsFooterDle = async () => {
  // Проверяем права доступа (только редактор может устанавливать DLE для футера)
  if (!canSetFooterDle.value) {
    alert(t('smartcontracts.settings.alerts.editorOnlySetFooter'));
    return;
  }

  if (!dleInfo.value || !address) {
    alert(t('smartcontracts.settings.alerts.dleInfoNotLoaded'));
    return;
  }

  try {
    // Устанавливаем адрес, данные будут загружены из блокчейна
    await setFooterDle(address, dleInfo.value?.currentChainId ?? null);
    
    alert(t('smartcontracts.settings.alerts.footerSetSuccess', {
      name: dleInfo.value.name,
      symbol: dleInfo.value.symbol
    }));
  } catch (error) {
    console.error('Ошибка при установке выбранного DLE:', error);
    alert(t('smartcontracts.settings.alerts.footerSetFailed'));
  }
};

// Удаляет DLE из футера
const removeFromFooter = async () => {
  // Проверяем права доступа (только редактор может удалять DLE из футера)
  if (!canSetFooterDle.value) {
    alert(t('smartcontracts.settings.alerts.editorOnlyRemoveFooter'));
    return;
  }

  if (!confirm(t('smartcontracts.settings.alerts.confirmRemoveFooter'))) {
    return;
  }

  try {
    await clearFooterDle();
    alert(t('smartcontracts.settings.alerts.footerRemoved'));
  } catch (error) {
    console.error('Ошибка при удалении DLE из футера:', error);
    alert(t('smartcontracts.settings.alerts.footerRemoveFailed'));
  }
};

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    // Очищаем данные при выходе из системы
    dleInfo.value = null;
  });
  
  window.addEventListener('refresh-application-data', () => {
    loadDLEInfo(); // Обновляем данные при входе в систему
  });
});

// Загружаем информацию о DLE
const loadDLEInfo = async () => {
  if (!address) {
    console.error('Адрес DLE не указан');
    return;
  }

  try {
    isLoading.value = true;
    
    // Загружаем данные DLE из блокчейна через API
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: address
    });
    
    if (response.data.success) {
      const dleData = response.data.data;
      
      dleInfo.value = {
        name: dleData.name,           // Название DLE из блокчейна
        symbol: dleData.symbol,       // Символ DLE из блокчейна
        address: dleData.dleAddress || address,  // Адрес из API или из URL
        logoURI: dleData.logoURI || '', // URL логотипа
        currentChainId: Number(dleData.currentChainId) || null
      };
    } else {
      console.error('Ошибка загрузки DLE:', response.data.error);
      throw new Error(response.data.error || t('smartcontracts.settings.alerts.dleLoadFailed'));
    }
    
  } catch (error) {
    console.error('Ошибка при загрузке информации о DLE:', error);
    // В случае ошибки НЕ устанавливаем fallback данные, оставляем null
    // чтобы не показывать некорректную информацию
    dleInfo.value = null;
  } finally {
    isLoading.value = false;
  }
};

// Методы
const deleteDLE = async () => {
  if (!address) {
    alert(t('smartcontracts.settings.alerts.addressNotFound'));
    return;
  }

  // Проверяем аутентификацию
  if (!props.isAuthenticated || !userAddress.value) {
    alert(t('smartcontracts.settings.alerts.authRequired'));
    return;
  }

  const dleName = dleInfo.value?.name || address;

  if (!confirm(t('smartcontracts.settings.alerts.confirmDeactivate', { name: dleName }))) {
    return;
  }
  
  if (!confirm(t('smartcontracts.settings.alerts.confirmDeactivateAgain'))) {
    return;
  }

  try {
    isSaving.value = true;
    
    // Выполняем деактивацию DLE
    const result = await deactivateDLE(address, userAddress.value);
    
    alert(t('smartcontracts.settings.alerts.deactivateSuccess', {
      name: dleInfo.value?.name || address,
      txHash: result.txHash
    }));
    
    // Перенаправляем на страницу блоков управления
    goBackToBlocks();
    
  } catch (error) {
    console.error('Ошибка при деактивации DLE:', error);
    
    let errorMessage = t('smartcontracts.settings.alerts.deactivateError');
    
    if (error.message.includes('execution reverted')) {
      errorMessage = t('smartcontracts.settings.alerts.deactivateReverted');
    } else if (errorMessageMatches(error.message, 'smartcontracts.settings.errorPatterns.owner')) {
      errorMessage = t('smartcontracts.settings.alerts.ownerOnly');
    } else if (errorMessageMatches(error.message, 'smartcontracts.settings.errorPatterns.wallet')) {
      errorMessage = t('smartcontracts.settings.alerts.walletRequired');
    } else if (errorMessageMatches(error.message, 'smartcontracts.settings.errorPatterns.deactivated')) {
      errorMessage = t('smartcontracts.settings.alerts.alreadyDeactivated');
    } else if (errorMessageMatches(error.message, 'smartcontracts.settings.errorPatterns.tokens')) {
      errorMessage = t('smartcontracts.settings.alerts.tokensRequired');
    } else if (errorMessageMatches(error.message, 'smartcontracts.settings.errorPatterns.smartContractConditions')) {
      errorMessage = t('smartcontracts.settings.alerts.deactivateReverted');
    } else {
      errorMessage = t('smartcontracts.settings.alerts.errorWithMessage', { message: error.message });
    }
    
    alert(errorMessage);
  } finally {
    isSaving.value = false;
  }
};

// Загружаем данные при монтировании компонента
onMounted(() => {
  if (address) {
    dleAddress.value = address;
    loadDLEInfo();
  }
});
</script>

<style scoped>
.settings-container {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
}

.header-content {
  flex-grow: 1;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2rem;
  margin: 0 0 5px 0;
}

.page-header p {
  color: var(--color-grey-dark);
  font-size: 1rem;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

/* Основной контент */
.main-content {
  display: grid;
  gap: 20px;
}

/* Карточки */
.footer-card,
.danger-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.footer-header {
  background: #f0f7ff;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
}

.footer-header h3 {
  color: var(--color-primary);
  margin: 0;
  font-size: 1.2rem;
}

.footer-content {
  padding: 20px;
}

.footer-content p {
  color: var(--color-grey-dark);
  margin-bottom: 15px;
  line-height: 1.5;
}

.footer-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #e6f7e6;
  border: 1px solid #b3e5b3;
  border-radius: 6px;
  padding: 10px 15px;
  margin-bottom: 15px;
  color: #2d5a2d;
  font-weight: 500;
}

.selected-info i {
  color: #28a745;
  font-size: 1.1rem;
}

.other-selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 10px 15px;
  margin-bottom: 15px;
  color: #856404;
  font-weight: 500;
}

.other-selected-info i {
  color: #ffc107;
  font-size: 1.1rem;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 0.875rem;
}

.danger-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
}

.danger-header h3 {
  color: #c53030;
  margin: 0;
  font-size: 1.2rem;
}

.danger-content {
  padding: 20px;
}

/* Кнопки */
.btn-primary,
.btn-danger {
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.btn-danger {
  background: #e53e3e;
  color: white;
}

.btn-danger:hover {
  background: #c53030;
  transform: translateY(-1px);
}

.btn-primary:active,
.btn-danger:active {
  transform: translateY(0);
}

/* Сообщение если DLE не выбран */
.no-dle-card {
  background: #fff5f5;
  border: 2px solid #fed7d7;
  border-radius: var(--radius-lg);
  padding: 30px;
  text-align: center;
}

.no-dle-card h3 {
  color: #c53030;
  margin-bottom: 10px;
  font-size: 1.2rem;
}

.no-dle-card p {
  color: #4a5568;
  margin-bottom: 15px;
  line-height: 1.5;
  font-size: 0.9rem;
}

/* Стили для блока предупреждения */
.warning-info {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 15px;
  margin: 15px 0;
}

.warning-info h4 {
  color: #856404;
  margin: 0 0 10px 0;
  font-size: 1rem;
}

.warning-info ul {
  margin: 0;
  padding-left: 20px;
  color: #856404;
}

.warning-info li {
  margin-bottom: 5px;
  font-size: 0.9rem;
  line-height: 1.4;
}
</style> 