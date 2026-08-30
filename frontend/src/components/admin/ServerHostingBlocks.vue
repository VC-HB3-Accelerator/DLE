<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Хостинг на панели сервера: Akash, Flux, WebSSH.
-->

<template>
  <section class="server-hosting">
    <h2 v-if="!hideTitle" class="server-hosting__title">{{ t('settings.interface.web3Hosting') }}</h2>
    <div class="server-hosting__grid">
      <article class="server-hosting__block">
        <div class="server-hosting__head">
          <h3>Akash Network</h3>
          <span class="server-hosting__badge">{{ t('settings.interface.akash.badge') }}</span>
        </div>
        <p>{{ t('settings.interface.akash.description') }}</p>
        <div class="server-hosting__features">
          <span>{{ t('settings.interface.akash.feature1') }}</span>
          <span>{{ t('settings.interface.akash.feature2') }}</span>
          <span>{{ t('settings.interface.akash.feature3') }}</span>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!canManageSettings"
          @click="canManageSettings ? openAkash() : null"
        >
          {{ t('common.details') }}
        </button>
      </article>

      <article class="server-hosting__block">
        <div class="server-hosting__head">
          <h3>Flux</h3>
          <span class="server-hosting__badge">Web3 Cloud Infrastructure</span>
        </div>
        <p>{{ t('settings.interface.flux.description') }}</p>
        <div class="server-hosting__features">
          <span>Web3 Infrastructure</span>
          <span>{{ t('settings.interface.flux.feature2') }}</span>
          <span>{{ t('settings.interface.flux.feature3') }}</span>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!canManageSettings"
          @click="canManageSettings ? openFlux() : null"
        >
          {{ t('common.details') }}
        </button>
      </article>

      <article v-if="canAccessPath('/settings/interface/webssh')" class="server-hosting__block">
        <div class="server-hosting__head">
          <h3>{{ t('settings.interface.vds.title') }}</h3>
          <span class="server-hosting__badge">{{ t('settings.interface.vds.badge') }}</span>
        </div>
        <p>{{ t('settings.interface.vds.description') }}</p>
        <div class="server-hosting__features">
          <span>{{ t('settings.interface.vds.feature1') }}</span>
          <span>{{ t('settings.interface.vds.feature2') }}</span>
          <span>{{ t('settings.interface.vds.feature3') }}</span>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!canManageSettings"
          @click="canManageSettings ? openWebSsh() : null"
        >
          {{ t('common.details') }}
        </button>
      </article>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { usePermissions } from '@/composables/usePermissions';
import { canAccessPath } from '@/composables/useScreenAccess.js';

defineProps({
  hideTitle: { type: Boolean, default: false },
});

const { t } = useI18n();
const router = useRouter();
const { canManageSettings } = usePermissions();

function openAkash() {
  window.open('https://akash.network/', '_blank');
}

function openFlux() {
  window.open('https://runonflux.io/', '_blank');
}

function openWebSsh() {
  router.push({ path: '/settings/interface/webssh' });
}
</script>

<style scoped>
.server-hosting {
  margin: 0 0 1.5rem;
}

.server-hosting__title {
  margin: 0 0 1rem;
  font-size: 1.15rem;
  color: var(--color-dark);
}

.server-hosting__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.server-hosting__block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1.25rem;
  border: 1px solid var(--color-border, #e9ecef);
  border-radius: var(--radius-md, 8px);
  background: var(--color-white, #fff);
}

.server-hosting__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.server-hosting__head h3 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--color-dark);
}

.server-hosting__badge {
  font-size: 0.75rem;
  color: var(--theme-text-muted, #666);
}

.server-hosting__block p {
  margin: 0;
  flex-grow: 1;
  color: var(--theme-text-muted, #666);
  line-height: 1.45;
}

.server-hosting__features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.server-hosting__features span {
  font-size: 0.85rem;
  color: var(--theme-text-muted, #666);
}

@media (max-width: 1024px) {
  .server-hosting__grid {
    grid-template-columns: 1fr;
  }
}
</style>
