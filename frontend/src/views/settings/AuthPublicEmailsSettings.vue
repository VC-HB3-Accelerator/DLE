<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="auth-public-emails">
    <h4>{{ $t('settings.authDomains.publicTitle') }}</h4>
    <p class="section-hint">{{ $t('settings.authDomains.publicHint', { count: publicTotal }) }}</p>
    <input
      v-model="publicSearch"
      type="search"
      class="form-control list-search"
      :placeholder="$t('settings.authDomains.publicSearch')"
    >
    <div class="public-chips">
      <span
        v-for="domain in visiblePublicDomains"
        :key="domain"
        class="public-chip"
      >{{ domain }}</span>
    </div>
    <p v-if="hiddenPublicCount > 0" class="public-more">
      {{ $t('settings.authDomains.publicMore', { count: hiddenPublicCount }) }}
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  publicEmails: { type: Object, default: () => ({ notable: [], total: 0 }) },
});

const publicSearch = ref('');

const notablePublicDomains = computed(() => (
  Array.isArray(props.publicEmails?.notable) ? props.publicEmails.notable : []
));
const publicTotal = computed(() => Number(props.publicEmails?.total || notablePublicDomains.value.length));
const filteredPublicDomains = computed(() => {
  const q = String(publicSearch.value || '').trim().toLowerCase();
  const list = notablePublicDomains.value;
  if (!q) return list;
  return list.filter((domain) => domain.includes(q));
});
const visiblePublicDomains = computed(() => filteredPublicDomains.value.slice(0, 80));
const hiddenPublicCount = computed(() => Math.max(0, filteredPublicDomains.value.length - visiblePublicDomains.value.length));
</script>

<style scoped>
.auth-public-emails {
  max-width: 100%;
  box-sizing: border-box;
}

.auth-public-emails h4 {
  margin: 0 0 var(--spacing-sm, 8px);
}

.section-hint {
  margin: 0 0 var(--spacing-md, 12px);
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--theme-text-muted, #666);
}

.list-search {
  max-width: 420px;
  margin: 0 0 var(--spacing-md, 12px);
}

.public-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
}

.public-chip {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--theme-surface, #fff);
  border: 1px solid var(--theme-border, #e9ecef);
  color: var(--theme-text, #333);
}

.public-more {
  margin: 8px 0 0;
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--theme-text-muted, #666);
}
</style>
