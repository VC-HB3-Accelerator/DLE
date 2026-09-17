<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Галерея объявления: ≤10 фото + 1 видео ≤60 с / ≤80 MB.
-->
<template>
  <div class="listing-gallery">
    <p class="listing-gallery__hint">
      {{ t('content.listingGallery.hint', { photos: LISTING_MAX_PHOTOS, seconds: LISTING_MAX_VIDEO_SECONDS }) }}
    </p>

    <div class="listing-gallery__block">
      <div class="listing-gallery__label">
        {{ t('content.listingGallery.photos', { count: photos.length, max: LISTING_MAX_PHOTOS }) }}
      </div>
      <div class="listing-gallery__grid">
        <button
          v-for="(url, idx) in photos"
          :key="`p-${idx}-${url}`"
          type="button"
          class="listing-gallery__slot listing-gallery__slot--filled"
          :disabled="disabled || uploading"
          @click="removePhoto(idx)"
        >
          <img :src="absUrl(url)" alt="">
          <span class="listing-gallery__slot-x" aria-hidden="true">×</span>
        </button>
        <button
          v-if="photos.length < LISTING_MAX_PHOTOS"
          type="button"
          class="listing-gallery__slot listing-gallery__slot--empty"
          :disabled="disabled || uploading"
          @click="pickPhotos"
        >
          <span class="listing-gallery__slot-plus">+</span>
          <span class="listing-gallery__slot-caption">{{ t('content.listingGallery.addPhotos') }}</span>
        </button>
      </div>
      <input
        ref="photoInputRef"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        class="listing-gallery__file"
        @change="onPhotosPicked"
      >
    </div>

    <div class="listing-gallery__block">
      <div class="listing-gallery__label">{{ t('content.listingGallery.video') }}</div>
      <div v-if="video" class="listing-gallery__video-wrap">
        <video :src="absUrl(video)" controls preload="metadata" />
        <button
          type="button"
          class="listing-gallery__video-remove"
          :disabled="disabled || uploading"
          @click="clearVideo"
        >
          {{ t('common.delete') }}
        </button>
      </div>
      <button
        v-else
        type="button"
        class="listing-gallery__slot listing-gallery__slot--video listing-gallery__slot--empty"
        :disabled="disabled || uploading"
        @click="pickVideo"
      >
        <span class="listing-gallery__slot-plus">+</span>
        <span class="listing-gallery__slot-caption">{{ t('content.listingGallery.addVideo') }}</span>
      </button>
      <input
        ref="videoInputRef"
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        class="listing-gallery__file"
        @change="onVideoPicked"
      >
    </div>

    <p v-if="error" class="listing-gallery__error" role="alert">{{ error }}</p>
    <p v-if="uploading" class="listing-gallery__muted">{{ t('content.listingGallery.uploading') }}</p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { uploadContentMedia } from '@/composables/useChunkedMediaUpload';
import {
  LISTING_MAX_PHOTOS,
  LISTING_MAX_VIDEO_SECONDS,
  LISTING_MAX_VIDEO_BYTES,
  MAX_IMAGE_BYTES,
  classifyMime,
} from '@/shared/contentMediaLimits';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ photos: [], video: null }),
  },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const photoInputRef = ref(null);
const videoInputRef = ref(null);
const uploading = ref(false);
const error = ref('');

const photos = computed(() => {
  const list = props.modelValue?.photos;
  return Array.isArray(list) ? list.filter(Boolean) : [];
});

const video = computed(() => props.modelValue?.video || null);

function absUrl(url) {
  if (!url) return '';
  if (String(url).startsWith('http') || String(url).startsWith('data:')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${String(url).startsWith('/') ? '' : '/'}${url}`;
}

function emitValue(next) {
  emit('update:modelValue', {
    photos: Array.isArray(next.photos) ? next.photos : [],
    video: next.video || null,
  });
}

function pickPhotos() {
  error.value = '';
  photoInputRef.value?.click();
}

function pickVideo() {
  error.value = '';
  videoInputRef.value?.click();
}

function removePhoto(idx) {
  const next = photos.value.filter((_, i) => i !== idx);
  emitValue({ photos: next, video: video.value });
}

function clearVideo() {
  emitValue({ photos: photos.value, video: null });
}

function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    const url = URL.createObjectURL(file);
    el.onloadedmetadata = () => {
      const d = Number(el.duration);
      URL.revokeObjectURL(url);
      if (!Number.isFinite(d) || d <= 0) reject(new Error('duration'));
      else resolve(d);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('metadata'));
    };
    el.src = url;
  });
}

async function onPhotosPicked(e) {
  const files = Array.from(e.target?.files || []);
  e.target.value = '';
  if (!files.length) return;

  const room = LISTING_MAX_PHOTOS - photos.value.length;
  if (room <= 0) {
    error.value = t('content.listingGallery.photosLimit', { max: LISTING_MAX_PHOTOS });
    return;
  }

  const batch = files.slice(0, room);
  uploading.value = true;
  error.value = '';
  const uploaded = [...photos.value];
  try {
    for (const file of batch) {
      if (classifyMime(file.type) !== 'image' && !/\.(png|jpe?g|gif|webp)$/i.test(file.name || '')) {
        error.value = t('content.listingGallery.photoInvalid');
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        error.value = t('content.listingGallery.photoTooLarge');
        continue;
      }
      const data = await uploadContentMedia(file, { purpose: 'listing' });
      if (data?.url) uploaded.push(data.url);
    }
    emitValue({ photos: uploaded, video: video.value });
  } catch (err) {
    error.value = err?.response?.data?.error || err?.message || t('content.listingGallery.uploadError');
  } finally {
    uploading.value = false;
  }
}

async function onVideoPicked(e) {
  const file = e.target?.files?.[0];
  e.target.value = '';
  if (!file) return;

  uploading.value = true;
  error.value = '';
  try {
    if (classifyMime(file.type) !== 'video' && !/\.(mp4|webm|ogg|mov)$/i.test(file.name || '')) {
      error.value = t('content.listingGallery.videoInvalid');
      return;
    }
    if (file.size > LISTING_MAX_VIDEO_BYTES) {
      error.value = t('content.listingGallery.videoTooLarge');
      return;
    }
    const duration = await readVideoDuration(file);
    if (duration > LISTING_MAX_VIDEO_SECONDS) {
      error.value = t('content.listingGallery.videoTooLong', { seconds: LISTING_MAX_VIDEO_SECONDS });
      return;
    }
    const data = await uploadContentMedia(file, { purpose: 'listing' });
    if (!data?.url) throw new Error(t('content.listingGallery.uploadError'));
    emitValue({ photos: photos.value, video: data.url });
  } catch (err) {
    if (err?.message === 'duration' || err?.message === 'metadata') {
      error.value = t('content.listingGallery.videoMetaError');
    } else {
      error.value = err?.response?.data?.error || err?.message || t('content.listingGallery.uploadError');
    }
  } finally {
    uploading.value = false;
  }
}
</script>

<style scoped>
.listing-gallery {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 16px);
}

.listing-gallery__hint,
.listing-gallery__muted {
  margin: 0;
  color: var(--color-grey);
  font-size: var(--font-size-sm);
}

.listing-gallery__error {
  margin: 0;
  color: var(--color-danger, #c0392b);
  font-size: var(--font-size-sm);
}

.listing-gallery__block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.listing-gallery__label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-dark);
}

.listing-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 10px;
}

.listing-gallery__slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  aspect-ratio: 1;
  margin: 0;
  padding: 8px;
  border: 1px dashed var(--color-border, #c5cdd6);
  border-radius: var(--radius-md, 8px);
  background: var(--color-light, #f4f6f8);
  color: var(--color-grey);
  cursor: pointer;
  box-sizing: border-box;
}

.listing-gallery__slot--empty:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.listing-gallery__slot--filled {
  border-style: solid;
  padding: 0;
  overflow: hidden;
  background: #111;
}

.listing-gallery__slot--filled img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.listing-gallery__slot--video {
  aspect-ratio: 16 / 9;
  width: 100%;
  min-height: 140px;
}

.listing-gallery__slot-plus {
  font-size: 1.75rem;
  line-height: 1;
  font-weight: 500;
}

.listing-gallery__slot-caption {
  font-size: var(--font-size-sm);
  text-align: center;
}

.listing-gallery__slot-x {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 16px;
  line-height: 1;
}

.listing-gallery__slot:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.listing-gallery__video-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.listing-gallery__video-wrap video {
  width: 100%;
  max-height: 280px;
  border-radius: var(--radius-md, 8px);
  background: #000;
}

.listing-gallery__video-remove {
  align-self: flex-start;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border, #c5cdd6);
  border-radius: var(--radius-md, 8px);
  background: transparent;
  cursor: pointer;
}

.listing-gallery__file {
  display: none;
}
</style>
