<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <div v-if="show" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ isSuccess ? 'Тест RPC соединения' : 'Ошибка RPC соединения' }}</h3>
        <button class="close-btn" @click="closeModal">&times;</button>
      </div>
      
      <div class="modal-body">
        <div v-if="isSuccess" class="success-content">
          <div class="success-icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <h4>Соединение успешно установлено!</h4>
          <div class="connection-details">
            <div class="detail-row">
              <span class="label">Сеть:</span>
              <span class="value">{{ result.networkId }}</span>
            </div>
            <div class="detail-row" v-if="result.blockNumber">
              <span class="label">Номер блока:</span>
              <span class="value">{{ result.blockNumber }}</span>
            </div>
            <div class="detail-row" v-if="result.message">
              <span class="label">Сообщение:</span>
              <span class="value">{{ result.message }}</span>
            </div>
          </div>
        </div>
        
        <div v-else class="error-content">
          <div class="error-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h4>Не удалось подключиться к RPC</h4>
          <div class="error-details">
            <div class="detail-row">
              <span class="label">Сеть:</span>
              <span class="value">{{ result.networkId }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Ошибка:</span>
              <span class="value error-text">{{ result.error }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-primary" @click="closeModal">OK</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

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
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  min-width: 400px;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
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
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}
</style> 