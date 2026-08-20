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
  <div v-if="show" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ isSuccess ? t('settings.rpc.titleSuccess') : t('settings.rpc.titleError') }}</h3>
        <button class="close-btn" @click="closeModal">&times;</button>
      </div>
      
      <div class="modal-body">
        <div v-if="isSuccess" class="success-content">
          <div class="success-icon">
            <UiGlyph name="check-circle" :size="48" />
          </div>
          <h4>{{ t('settings.rpc.connectionSuccess') }}</h4>
          <div class="connection-details">
            <div class="detail-row">
              <span class="label">{{ t('settings.rpc.network') }}</span>
              <span class="value">{{ result.networkId }}</span>
            </div>
            <div class="detail-row" v-if="result.blockNumber">
              <span class="label">{{ t('settings.rpc.blockNumber') }}</span>
              <span class="value">{{ result.blockNumber }}</span>
            </div>
            <div class="detail-row" v-if="result.message">
              <span class="label">{{ t('settings.rpc.message') }}</span>
              <span class="value">{{ result.message }}</span>
            </div>
          </div>
        </div>
        
        <div v-else class="error-content">
          <div class="error-icon">
            <UiGlyph name="warning" :size="48" />
          </div>
          <h4>{{ t('settings.rpc.connectionFailed') }}</h4>
          <div class="error-details">
            <div class="detail-row">
              <span class="label">{{ t('settings.rpc.network') }}</span>
              <span class="value">{{ result.networkId }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ t('settings.rpc.error') }}</span>
              <span class="value error-text">{{ result.error }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-primary" @click="closeModal">{{ t('common.ok') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import UiGlyph from './UiGlyph.vue';

const { t } = useI18n();

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  result: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['close']);

const isSuccess = computed(() => {
  return props.result.success === true;
});

const closeModal = () => {
  emit('close');
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  max-width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: var(--spacing-md);
  box-sizing: border-box;
  overflow-x: hidden;
}

.modal-content {
  background: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  min-width: 0;
  width: 100%;
  max-width: min(500px, 100%);
  max-height: 80vh;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px 24px;
  border-bottom: 1px solid #e5e5e5;
}

.modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  transition: color 0.2s;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 24px;
}

.success-content, .error-content {
  text-align: center;
}

.success-icon {
  font-size: 3rem;
  color: #4caf50;
  margin-bottom: 16px;
}

.error-icon {
  font-size: 3rem;
  color: #f44336;
  margin-bottom: 16px;
}

.success-content h4, .error-content h4 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 1.1rem;
}

.connection-details, .error-details {
  text-align: left;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.label {
  font-weight: 500;
  color: #666;
  flex-shrink: 0;
  margin-right: 12px;
}

.value {
  color: #333;
  font-family: 'Courier New', monospace;
  word-break: break-all;
  text-align: right;
}

.error-text {
  color: #f44336;
}

.modal-footer {
  padding: 16px 24px 20px 24px;
  border-top: 1px solid #e5e5e5;
  display: flex;
  justify-content: flex-end;
}

.btn {
  padding: 8px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-white);
  height: var(--button-height);
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: var(--spacing-sm);
    align-items: flex-start;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding-left: var(--block-padding-mobile);
    padding-right: var(--block-padding-mobile);
  }

  .btn-primary {
    width: 100%;
    height: var(--button-height-mobile);
  }
}
</style>
