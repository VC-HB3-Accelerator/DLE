<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <section id="store-reviews" class="store-reviews">
    <h2>{{ t('store.reviews.title') }}</h2>
    <p v-if="loading" class="store-reviews__muted">{{ t('store.common.loading') }}</p>
    <p v-else-if="error" class="store-reviews__error">{{ error }}</p>
    <p v-else-if="!reviews.length" class="store-reviews__muted">{{ t('store.reviews.empty') }}</p>
    <ul v-else class="store-reviews__list">
      <li v-for="r in reviews" :key="r.id" class="store-reviews__item">
        <p class="store-reviews__meta">
          <span class="store-reviews__stars">{{ '★'.repeat(r.stars) }}{{ '☆'.repeat(5 - r.stars) }}</span>
          <span>{{ r.author }}</span>
        </p>
        <p class="store-reviews__body">{{ r.body }}</p>
        <ul v-if="r.replies?.length" class="store-reviews__replies">
          <li v-for="rep in r.replies" :key="rep.id">
            <strong>{{ t('store.reviews.editorReply') }}</strong>
            {{ rep.body }}
          </li>
        </ul>
        <form v-if="canReply" class="store-reviews__reply" @submit.prevent="onReply(r)">
          <textarea v-model="replyDraft[r.id]" rows="2" :placeholder="t('store.reviews.replyPlaceholder')" />
          <button type="submit" class="btn btn-secondary" :disabled="busyId === r.id">
            {{ t('store.reviews.reply') }}
          </button>
        </form>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchStoreProductReviews, replyStoreReview } from '@/services/storeService';

const props = defineProps({
  productId: { type: String, required: true },
  canReply: { type: Boolean, default: false },
});

const { t } = useI18n();
const reviews = ref([]);
const loading = ref(false);
const error = ref('');
const busyId = ref('');
const replyDraft = reactive({});

async function load() {
  if (!props.productId) return;
  loading.value = true;
  error.value = '';
  try {
    reviews.value = await fetchStoreProductReviews(props.productId);
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.loadError');
  } finally {
    loading.value = false;
  }
}

async function onReply(review) {
  const body = String(replyDraft[review.id] || '').trim();
  if (!body) return;
  busyId.value = review.id;
  try {
    await replyStoreReview(review.id, body);
    replyDraft[review.id] = '';
    await load();
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busyId.value = '';
  }
}

onMounted(load);
watch(() => props.productId, load);
</script>

<style scoped>
.store-reviews {
  margin-top: 1.5rem;
}
.store-reviews__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.store-reviews__item {
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 10px;
  padding: 0.75rem 0.9rem;
}
.store-reviews__meta {
  display: flex;
  gap: 0.6rem;
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
  opacity: 0.85;
}
.store-reviews__stars {
  color: #c9a227;
}
.store-reviews__body {
  margin: 0;
  white-space: pre-wrap;
}
.store-reviews__replies {
  margin: 0.5rem 0 0;
  padding-left: 1rem;
  opacity: 0.9;
}
.store-reviews__reply {
  margin-top: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.store-reviews__reply textarea {
  width: 100%;
  resize: vertical;
}
.store-reviews__muted,
.store-reviews__error {
  margin: 0.5rem 0 0;
}
.store-reviews__error {
  color: #b42318;
}
</style>
