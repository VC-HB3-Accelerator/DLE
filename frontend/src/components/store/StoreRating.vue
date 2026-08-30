<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <component
    :is="starsOnly ? 'span' : 'p'"
    class="store-rating"
    :class="{
      'store-rating--compact': compact,
      'store-rating--stars': starsOnly,
    }"
    :title="label"
  >
    <span class="store-rating__stars" aria-hidden="true">
      <svg
        v-for="n in 5"
        :key="n"
        class="store-rating__star"
        :class="{ 'is-on': filled >= n }"
        viewBox="0 0 24 24"
      >
        <path d="M12 2.4l2.47 6.64 7.03.37-5.4 4.46 1.72 6.83L12 16.9l-5.82 3.8 1.72-6.83-5.4-4.46 7.03-.37L12 2.4z" />
      </svg>
    </span>
    <span v-if="!starsOnly && (!compact || count)" class="store-rating__num">{{ avgText }}</span>
    <span v-if="!starsOnly" class="store-rating__count">{{ countText }}</span>
  </component>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  ratingAvg: { type: [Number, String], default: null },
  reviewCount: { type: [Number, String], default: 0 },
  compact: { type: Boolean, default: false },
  starsOnly: { type: Boolean, default: false },
});

const { t } = useI18n();

const count = computed(() => Math.max(0, Number(props.reviewCount) || 0));
const avg = computed(() => {
  const n = Number(props.ratingAvg);
  return Number.isFinite(n) ? n : 0;
});
const filled = computed(() => {
  if (!count.value) return 0;
  return Math.round(avg.value);
});
const avgText = computed(() => (count.value ? avg.value.toFixed(1) : '—'));
const countText = computed(() => t('store.storefront.reviewCount', { count: count.value }));
const label = computed(() => t('store.storefront.ratingLabel', {
  avg: avgText.value,
  count: count.value,
}));
</script>

<style scoped>
.store-rating {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.55rem;
  margin: 0.35rem 0;
  font-size: 0.9rem;
}
.store-rating--compact,
.store-rating--stars {
  margin: 0;
  flex-wrap: nowrap;
}
.store-rating__stars {
  display: inline-flex;
  align-items: center;
  gap: 0.08rem;
}
.store-rating__star {
  width: 1.15rem;
  height: 1.15rem;
  fill: #d9c48a;
  opacity: 0.55;
}
.store-rating__star.is-on {
  fill: #f5c518;
  opacity: 1;
  filter: drop-shadow(0 1px 3px rgba(245, 197, 24, 0.5));
}
.store-rating--stars .store-rating__star {
  width: 1.35rem;
  height: 1.35rem;
}
.store-rating__num {
  font-weight: 600;
}
.store-rating__count {
  opacity: 0.75;
}
</style>
