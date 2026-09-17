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
    <div class="my-subs page-with-close">
      <PageCloseButton :fallback="{ name: 'blog' }" />

      <div class="my-subs__panel">
        <h2>{{ t('blog.mySubscriptions.title') }}</h2>
        <p class="my-subs__intro">{{ t('blog.mySubscriptions.intro') }}</p>

        <div v-if="!isAuthenticated" class="my-subs__denied">
          <p>{{ t('blog.mySubscriptions.loginRequired') }}</p>
          <button type="button" class="btn btn-primary btn-sm" @click="requestLogin">
            {{ t('blog.feed.login') }}
          </button>
        </div>

        <div v-else-if="isLoading" class="my-subs__loading">
          {{ t('common.loading') }}
        </div>

        <div v-else-if="loadError" class="my-subs__error">{{ loadError }}</div>

        <template v-else>
          <p v-if="unsubscribedFlash" class="my-subs__success">{{ t('blog.mySubscriptions.unsubscribedFlash') }}</p>

          <div v-if="!items.length" class="my-subs__empty">
            {{ t('blog.mySubscriptions.empty') }}
          </div>

          <ul v-else class="my-subs__list">
            <li v-for="item in items" :key="item.id" class="my-subs__item">
              <div class="my-subs__item-body">
                <strong>{{ item.label || t('blog.subscribe.wholeFeed') }}</strong>
                <span class="my-subs__meta">{{ formatDate(item.created_at) }}</span>
              </div>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                :disabled="busyId === item.id"
                @click="removeOne(item.id)"
              >
                {{ t('blog.mySubscriptions.unsubscribe') }}
              </button>
            </li>
          </ul>

          <div v-if="items.length" class="my-subs__actions">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              :disabled="busyId === 'all'"
              @click="removeAll"
            >
              {{ t('blog.mySubscriptions.unsubscribeAll') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import blogEngagementService from '../services/blogEngagementService';
import eventBus from '../utils/eventBus';

const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

defineEmits(['auth-action-completed']);

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const items = ref([]);
const isLoading = ref(false);
const loadError = ref('');
const busyId = ref(null);
const unsubscribedFlash = ref(false);

function requestLogin() {
  eventBus.emit('open-auth-sidebar');
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

async function load() {
  if (!props.isAuthenticated) {
    items.value = [];
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  loadError.value = '';
  try {
    const data = await blogEngagementService.listMySubscriptions();
    items.value = data?.items || [];
  } catch (e) {
    if (e?.response?.status === 401) {
      items.value = [];
    } else {
      loadError.value = e?.response?.data?.error || t('blog.mySubscriptions.loadError');
    }
  } finally {
    isLoading.value = false;
  }
}

async function removeOne(id) {
  busyId.value = id;
  try {
    await blogEngagementService.deleteSubscription(id);
    items.value = items.value.filter((x) => x.id !== id);
  } catch (e) {
    loadError.value = e?.response?.data?.error || t('blog.mySubscriptions.deleteError');
  } finally {
    busyId.value = null;
  }
}

async function removeAll() {
  if (!window.confirm(t('blog.mySubscriptions.confirmAll'))) return;
  busyId.value = 'all';
  try {
    await blogEngagementService.deleteAllSubscriptions();
    items.value = [];
  } catch (e) {
    loadError.value = e?.response?.data?.error || t('blog.mySubscriptions.deleteError');
  } finally {
    busyId.value = null;
  }
}

onMounted(() => {
  if (route.query.unsubscribed === '1') {
    unsubscribedFlash.value = true;
    const query = { ...route.query };
    delete query.unsubscribed;
    router.replace({ name: 'blog-my-subscriptions', query }).catch(() => {});
  }
});

watch(
  () => props.isAuthenticated,
  () => { load(); },
  { immediate: true }
);
</script>

<style scoped>
.my-subs {
  max-width: 40rem;
  margin: 0 auto;
  padding: 1rem 1rem 2.5rem;
}

.my-subs__panel {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.my-subs__panel h2 {
  margin: 0;
  font-size: 1.35rem;
}

.my-subs__intro,
.my-subs__loading,
.my-subs__empty,
.my-subs__denied,
.my-subs__error,
.my-subs__success {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-secondary, #555);
}

.my-subs__error {
  color: var(--danger, #b00020);
}

.my-subs__success {
  color: var(--success, #1b7a3d);
}

.my-subs__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.my-subs__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--border-color, #e2e2e2);
}

.my-subs__item-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.my-subs__meta {
  font-size: 0.8rem;
  color: var(--text-secondary, #777);
}

.my-subs__actions {
  margin-top: 0.5rem;
}
</style>
