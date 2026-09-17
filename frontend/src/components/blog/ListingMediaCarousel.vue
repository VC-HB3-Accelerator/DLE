<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Карусель: свайп на мобилке, клик по фото на десктопе, по кругу. Без стрелок.
-->
<template>
  <div
    v-if="slides.length"
    class="listing-carousel"
    @click.stop
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <div
      class="listing-carousel__viewport"
      :class="{ 'listing-carousel__viewport--clickable': canAdvance && current?.type === 'image' }"
      @click="onViewportClick"
    >
      <img
        v-if="current.type === 'image'"
        :src="absUrl(current.url)"
        :alt="alt"
        class="listing-carousel__media"
        draggable="false"
        loading="lazy"
      >
      <video
        v-else
        :key="current.url"
        :src="absUrl(current.url)"
        class="listing-carousel__media"
        controls
        playsinline
        preload="metadata"
        @click.stop
      />
      <img
        v-if="showOverlayWm"
        :src="watermarkUrl"
        alt=""
        class="listing-carousel__wm"
        draggable="false"
      >
    </div>

    <div v-if="slides.length > 1" class="listing-carousel__dots" role="tablist">
      <button
        v-for="(slide, idx) in slides"
        :key="`${idx}-${slide.url}`"
        type="button"
        class="listing-carousel__dot"
        :class="{ 'listing-carousel__dot--active': idx === index }"
        :aria-label="t('content.listingGallery.carouselSlide', { n: idx + 1 })"
        @click.stop="index = idx"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSiteBrand } from '@/composables/useSiteBrand';

const props = defineProps({
  media: {
    type: Object,
    default: null,
  },
  photos: {
    type: Array,
    default: null,
  },
  video: {
    type: String,
    default: null,
  },
  alt: {
    type: String,
    default: '',
  },
});

const { t } = useI18n();
const { headerLogoUrl, hideBrandImage } = useSiteBrand();
const index = ref(0);
const touchStartX = ref(null);
const touchStartY = ref(null);
const suppressClick = ref(false);

const watermarkUrl = computed(() => {
  if (hideBrandImage?.value) return '';
  return headerLogoUrl?.value || '';
});

const slides = computed(() => {
  const photos = Array.isArray(props.media?.photos)
    ? props.media.photos
    : (Array.isArray(props.photos) ? props.photos : []);
  const video = props.media?.video ?? props.video ?? null;
  const out = [];
  for (const url of photos) {
    if (url) out.push({ type: 'image', url: String(url) });
  }
  if (video) out.push({ type: 'video', url: String(video) });
  return out;
});

const current = computed(() => slides.value[index.value] || slides.value[0] || null);
const canAdvance = computed(() => slides.value.length > 1);

/** Видео и картинки без ?wm=1 (svg/uploads) — оверлей; JPEG /v/?wm=1 уже вшит на сервере. */
const showOverlayWm = computed(() => {
  if (!watermarkUrl.value || !current.value) return false;
  if (current.value.type === 'video') return true;
  if (current.value.type !== 'image') return false;
  return !/[?&]wm=/.test(String(current.value.url || ''));
});

watch(slides, (list) => {
  if (index.value >= list.length) index.value = Math.max(0, list.length - 1);
}, { deep: true });

function absUrl(url) {
  if (!url) return '';
  if (String(url).startsWith('http') || String(url).startsWith('data:') || String(url).startsWith('blob:')) {
    return url;
  }
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${String(url).startsWith('/') ? '' : '/'}${url}`;
}

function prev() {
  const n = slides.value.length;
  if (n < 2) return;
  index.value = (index.value - 1 + n) % n;
}

function next() {
  const n = slides.value.length;
  if (n < 2) return;
  index.value = (index.value + 1) % n;
}

function onViewportClick() {
  if (suppressClick.value) {
    suppressClick.value = false;
    return;
  }
  // Клик по фото на десктопе → следующий слайд по кругу
  if (!canAdvance.value) return;
  if (current.value?.type !== 'image') return;
  next();
}

function onTouchStart(e) {
  const t0 = e.changedTouches?.[0] || e.touches?.[0];
  if (!t0) return;
  touchStartX.value = t0.clientX;
  touchStartY.value = t0.clientY;
}

function onTouchEnd(e) {
  if (touchStartX.value == null || !canAdvance.value) {
    touchStartX.value = null;
    touchStartY.value = null;
    return;
  }
  const t0 = e.changedTouches?.[0];
  if (!t0) return;
  const dx = t0.clientX - touchStartX.value;
  const dy = t0.clientY - touchStartY.value;
  touchStartX.value = null;
  touchStartY.value = null;

  // Горизонтальный свайп сильнее вертикального
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
  suppressClick.value = true;
  if (dx < 0) next(); // влево → следующее
  else prev(); // вправо → предыдущее
}
</script>

<style scoped>
.listing-carousel {
  position: relative;
  width: 100%;
  background: #111;
  overflow: hidden;
  touch-action: pan-y;
  user-select: none;
}

.listing-carousel__viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.listing-carousel__viewport--clickable {
  cursor: pointer;
}

.listing-carousel__media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.listing-carousel__viewport video.listing-carousel__media {
  pointer-events: auto;
}

.listing-carousel__wm {
  position: absolute;
  left: 50%;
  top: 50%;
  right: auto;
  bottom: auto;
  transform: translate(-50%, -50%);
  width: 20%;
  max-width: 120px;
  min-width: 48px;
  height: auto;
  opacity: 0.02;
  pointer-events: none;
  z-index: 3;
  object-fit: contain;
}

.listing-carousel__dots {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 10px;
  display: flex;
  justify-content: center;
  gap: 6px;
  z-index: 2;
}

.listing-carousel__dot {
  width: 7px;
  height: 7px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);
  cursor: pointer;
}

.listing-carousel__dot--active {
  background: #fff;
}

@media (max-width: 768px) {
  .listing-carousel__viewport {
    width: 100%;
    aspect-ratio: 4 / 3;
  }
}
</style>
