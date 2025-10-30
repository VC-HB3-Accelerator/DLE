<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<!--
  Network Switch Notification Component
  Компонент для уведомления о необходимости переключения сети
  
  Author: HB3 Accelerator
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <div v-if="showNotification" class="network-notification">
    <div class="notification-content">
      <div class="notification-icon">⚠️</div>
      <div class="notification-text">
        <h4>Требуется переключение сети</h4>
        <p>Для голосования по этому предложению необходимо переключиться на сеть <strong>{{ targetNetworkName }}</strong></p>
        <p>Текущая сеть: <strong>{{ currentNetworkName }}</strong></p>
      </div>
      <div class="notification-actions">
        <button @click="switchNetwork" class="btn btn-primary" :disabled="isSwitching">
          {{ isSwitching ? 'Переключение...' : 'Переключить сеть' }}
        </button>
        <button @click="dismiss" class="btn btn-secondary">Позже</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { switchNetwork, getCurrentNetwork } from '@/utils/networkSwitcher';

export default {
  name: 'NetworkSwitchNotification',
  props: {
    targetChainId: {
      type: Number,
      required: true
    },
    currentChainId: {
      type: Number,
      required: true
    },
    visible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['network-switched', 'dismissed'],
  setup(props, { emit }) {
    const isSwitching = ref(false);
    const showNotification = computed(() => props.visible && props.targetChainId !== props.currentChainId);

    const targetNetworkName = computed(() => {
      const networkNames = {
        1: 'Ethereum Mainnet',
        11155111: 'Sepolia',
        17000: 'Holesky',
        421614: 'Arbitrum Sepolia',
        84532: 'Base Sepolia',
        8453: 'Base'
      };
      return networkNames[props.targetChainId] || `Сеть ${props.targetChainId}`;
    });

    const currentNetworkName = computed(() => {
      const networkNames = {
        1: 'Ethereum Mainnet',
        11155111: 'Sepolia',
        17000: 'Holesky',
        421614: 'Arbitrum Sepolia',
        84532: 'Base Sepolia',
        8453: 'Base'
      };
      return networkNames[props.currentChainId] || `Сеть ${props.currentChainId}`;
    });

    const switchNetworkHandler = async () => {
      try {
        isSwitching.value = true;
        console.log(`🔄 [Network Switch] Переключаемся на сеть ${props.targetChainId}...`);
        
        const result = await switchNetwork(props.targetChainId);
        
        if (result.success) {
          console.log('✅ [Network Switch] Сеть переключена успешно');
          emit('network-switched', result);
        } else {
          console.error('❌ [Network Switch] Ошибка переключения:', result.error);
          alert(`Ошибка переключения сети: ${result.error}`);
        }
      } catch (error) {
        console.error('❌ [Network Switch] Ошибка:', error);
        alert(`Ошибка переключения сети: ${error.message}`);
      } finally {
        isSwitching.value = false;
      }
    };

    const dismiss = () => {
      emit('dismissed');
    };

    return {
      showNotification,
      targetNetworkName,
      currentNetworkName,
      isSwitching,
      switchNetwork: switchNetworkHandler,
      dismiss
    };
  }
};
</script>

<style scoped>
.network-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  max-width: 400px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border: 1px solid #ddd;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.notification-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.notification-icon {
  font-size: 24px;
  text-align: center;
}

.notification-text h4 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 16px;
  font-weight: bold;
}

.notification-text p {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 14px;
  line-height: 1.4;
}

.notification-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

@media (max-width: 768px) {
  .network-notification {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
  
  .notification-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>
