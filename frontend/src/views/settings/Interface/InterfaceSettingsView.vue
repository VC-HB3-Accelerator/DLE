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
  <AdminPageShell
    :title="$t('settings.interface.web3Hosting')"
    :show-close="true"
    fallback="/settings"
  >
    <div class="web3-service-block">
      <div class="service-header">
        <h3>Akash Network</h3>
        <span class="service-badge">{{ $t('settings.interface.akash.badge') }}</span>
      </div>
      <p>{{ $t('settings.interface.akash.description') }}</p>
      <div class="service-features">
        <span class="feature">{{ $t('settings.interface.akash.feature1') }}</span>
        <span class="feature">{{ $t('settings.interface.akash.feature2') }}</span>
        <span class="feature">{{ $t('settings.interface.akash.feature3') }}</span>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!canManageSettings"
        @click="canManageSettings ? goToAkashDetails() : null"
      >
        {{ $t('common.details') }}
      </button>
    </div>

    <div class="web3-service-block">
      <div class="service-header">
        <h3>Flux</h3>
        <span class="service-badge">Web3 Cloud Infrastructure</span>
      </div>
      <p>{{ $t('settings.interface.flux.description') }}</p>
      <div class="service-features">
        <span class="feature">Web3 Infrastructure</span>
        <span class="feature">{{ $t('settings.interface.flux.feature2') }}</span>
        <span class="feature">{{ $t('settings.interface.flux.feature3') }}</span>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!canManageSettings"
        @click="canManageSettings ? goToFluxDetails() : null"
      >
        {{ $t('common.details') }}
      </button>
    </div>

    <div class="web3-service-block">
      <div class="service-header">
        <h3>{{ $t('settings.interface.vds.title') }}</h3>
        <span class="service-badge">{{ $t('settings.interface.vds.badge') }}</span>
      </div>
      <p>{{ $t('settings.interface.vds.description') }}</p>
      <div class="service-features">
        <span class="feature">{{ $t('settings.interface.vds.feature1') }}</span>
        <span class="feature">{{ $t('settings.interface.vds.feature2') }}</span>
        <span class="feature">{{ $t('settings.interface.vds.feature3') }}</span>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!canManageSettings"
        @click="canManageSettings ? goToWebSsh() : null"
      >
        {{ $t('common.details') }}
      </button>
    </div>

    <NoAccessModal v-if="showWebSsh" @close="showWebSsh = false">
      <div class="webssh-modal-body">
        <h3>{{ $t('settings.interface.websshModalTitle') }}</h3>
        <div class="webssh-modal-hint">{{ $t('settings.interface.websshModalPlaceholder') }}</div>
        <button type="button" class="btn btn-outline" @click="showWebSsh = false">
          {{ $t('common.close') }}
        </button>
      </div>
    </NoAccessModal>
  </AdminPageShell>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { usePermissions } from '@/composables/usePermissions';
import NoAccessModal from '@/components/NoAccessModal.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';

const router = useRouter();
const { canManageSettings } = usePermissions();
const showWebSsh = ref(false);

const goToAkashDetails = () => window.open('https://akash.network/', '_blank');
const goToFluxDetails = () => window.open('https://runonflux.io/', '_blank');
const goToWebSsh = () => router.push('/settings/interface/webssh');
</script>

<style scoped>
.web3-service-block {
  margin-top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-start;
  padding: 1.5rem;
  border: 1px solid var(--color-border, #e9ecef);
  border-radius: var(--radius-md);
  background: var(--color-white);
}

.service-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.service-header h3 {
  margin: 0;
  color: var(--color-dark);
}

.service-badge {
  font-size: 0.75rem;
  color: var(--theme-text-muted);
}

.service-features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.feature {
  font-size: 0.85rem;
  color: var(--theme-text-muted);
}

.webssh-modal-body {
  padding: 2rem;
  max-width: 600px;
}

.webssh-modal-hint {
  color: var(--theme-text-muted);
  margin: 0.75rem 0 1.5rem;
}
</style>
