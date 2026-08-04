<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
      <div class="notification-text">
        <h4>{{ t('network.switchRequired') }}</h4>
        <p>{{ t('network.switchForVote', { network: targetNetworkName }) }}</p>
        <p>{{ t('network.currentNetwork', { network: currentNetworkName }) }}</p>
      </div>
      <div class="notification-actions">
        <button type="button" @click="switchNetwork" class="btn btn-primary" :disabled="isSwitching">
          {{ isSwitching ? t('network.switching') : t('network.switchNetwork') }}
        </button>
        <button type="button" @click="dismiss" class="btn btn-outline">{{ t('network.later') }}</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
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
    const { t } = useI18n();
    const isSwitching = ref(false);
    const showNotification = computed(() => props.visible && props.targetChainId !== props.currentChainId);

    const getNetworkName = (chainId) => {
      const networkNames = {
        1: 'Ethereum Mainnet',
        11155111: 'Sepolia',
        17000: 'Holesky',
        421614: 'Arbitrum Sepolia',
        84532: 'Base Sepolia',
        8453: 'Base'
      };
      return networkNames[chainId] || t('network.networkFallback', { chainId });
    };

    const targetNetworkName = computed(() => getNetworkName(props.targetChainId));
    const currentNetworkName = computed(() => getNetworkName(props.currentChainId));

    const switchNetworkHandler = async () => {
      try {
        isSwitching.value = true;
        
        const result = await switchNetwork(props.targetChainId);
        
        if (result.success) {
          emit('network-switched', result);
        } else {
          console.error('❌ [Network Switch] Ошибка переключения:', result.error);
          alert(t('network.switchError', { error: result.error }));
        }
      } catch (error) {
        console.error('❌ [Network Switch] Ошибка:', error);
        alert(t('network.switchError', { error: error.message }));
      } finally {
        isSwitching.value = false;
      }
    };

    const dismiss = () => {
      emit('dismissed');
    };

    return {
      t,
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
  background: var(--color-white);
  border-radius: var(--block-radius);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  animation: slideIn 0.3s ease-out;
  box-sizing: border-box;
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
  padding: var(--block-padding);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.notification-text h4 {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-dark);
  font-size: var(--font-size-lg);
  font-weight: bold;
}

.notification-text p {
  margin: 0 0 var(--spacing-xs) 0;
  color: var(--color-text-light);
  font-size: var(--font-size-md);
  line-height: 1.4;
}

.notification-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--button-gap);
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .network-notification {
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    left: var(--spacing-sm);
    max-width: none;
  }

  .notification-actions {
    flex-direction: column;
  }

  .notification-actions .btn {
    width: 100%;
  }
}

/* TZ package G/SC: reviewed */
</style>
