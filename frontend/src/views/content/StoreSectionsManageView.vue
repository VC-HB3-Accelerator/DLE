<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="store-sections page-with-close">
      <PageCloseButton :fallback="{ name: 'content-store' }" />

      <div v-if="!isEditor" class="store-sections__forbidden">
        <h1>{{ t('store.editor.sectionsManage') }}</h1>
        <p>{{ t('store.editor.forbidden') }}</p>
      </div>

      <div v-else class="store-sections__wrap">
        <header class="store-sections__header">
          <div>
            <router-link class="store-sections__back" :to="{ name: 'content-store' }">
              ← {{ t('store.editor.backToCatalog') }}
            </router-link>
            <h1>{{ t('store.editor.sectionsManage') }}</h1>
          </div>
          <router-link class="btn btn-primary" :to="{ name: 'content-store-section-new' }">
            {{ t('store.editor.sectionCreate') }}
          </router-link>
        </header>

        <p v-if="loadError" class="store-sections__error">{{ loadError }}</p>
        <p v-else-if="loading" class="store-sections__muted">{{ t('store.common.loading') }}</p>
        <p v-else-if="!sections.length" class="store-sections__empty">
          {{ t('store.editor.sectionsEmpty') }}
          <router-link class="btn btn-primary" :to="{ name: 'content-store-section-new' }">
            {{ t('store.editor.sectionCreate') }}
          </router-link>
        </p>
        <ul v-else class="store-sections__list">
          <li v-for="s in sections" :key="s.id" class="store-sections__row">
            <div>
              <strong>{{ s.title }}</strong>
              <span class="store-sections__meta">
                /store/s/{{ s.slug }}
                · {{ s.active ? t('store.editor.published') : t('store.editor.draft') }}
              </span>
            </div>
            <div class="store-sections__actions">
              <a
                class="btn btn-secondary"
                :href="`/store/s/${s.slug}`"
                target="_blank"
                rel="noopener"
              >{{ t('store.editor.sectionOpenStore') }}</a>
              <router-link
                class="btn btn-primary"
                :to="{ name: 'content-store-section-edit', params: { id: s.id } }"
              >{{ t('store.editor.sectionEdit') }}</router-link>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import { usePermissions } from '../../composables/usePermissions';
import { fetchStoreSections } from '../../services/storeService';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});
defineEmits(['auth-action-completed']);

const { t } = useI18n();
const { isEditor } = usePermissions();

const sections = ref([]);
const loading = ref(false);
const loadError = ref('');

async function loadPage() {
  loading.value = true;
  loadError.value = '';
  try {
    sections.value = await fetchStoreSections();
  } catch (e) {
    loadError.value = e?.response?.data?.error || e?.message || t('store.common.loadError');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (isEditor.value) loadPage();
});

watch(isEditor, (ok) => {
  if (ok) loadPage();
});
</script>

<style scoped>
.store-sections {
  max-width: 880px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 2.5rem;
}
.store-sections__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.store-sections__header h1 {
  margin: 0.35rem 0 0;
  font-size: 1.35rem;
}
.store-sections__back {
  font-size: 0.9rem;
  opacity: 0.8;
  text-decoration: none;
  color: inherit;
}
.store-sections__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
}
.store-sections__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
}
.store-sections__meta {
  display: block;
  margin-top: 0.2rem;
  opacity: 0.7;
  font-size: 0.88rem;
}
.store-sections__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.store-sections__empty {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  opacity: 0.85;
}
.store-sections__error { color: #b42318; }
.store-sections__muted { opacity: 0.75; }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  border: 0;
  cursor: pointer;
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  font: inherit;
}
.btn-primary { background: var(--color-primary, #1a5fff); color: #fff; }
.btn-secondary {
  background: color-mix(in srgb, currentColor 10%, transparent);
  color: inherit;
}
</style>
