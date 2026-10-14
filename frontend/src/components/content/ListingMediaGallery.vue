<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Галерея объявления: ≤10 фото + 1 видео ≤60 с / ≤80 MB.
  Обложка = photos[0], порядок меняется перетаскиванием.
-->
<template>
  <div class="listing-gallery">
    <p
      v-if="mediaDraft && photos.length > 0 && photos.length < draftPhotoTarget"
      class="listing-gallery__draft-badge"
      role="status"
    >
      {{ t('content.listingGallery.mediaDraft', { count: photos.length, target: draftPhotoTarget }) }}
    </p>

    <div class="listing-gallery__block">
      <div class="listing-gallery__label">
        {{ t('content.listingGallery.photos', { count: photos.length, max: LISTING_MAX_PHOTOS }) }}
      </div>
      <div class="listing-gallery__grid">
        <div
          v-for="(url, idx) in photos"
          :key="`p-${idx}-${url}`"
          class="listing-gallery__slot listing-gallery__slot--filled"
          :class="{
            'listing-gallery__slot--cover': idx === 0,
            'listing-gallery__slot--dragover': dragOverIndex === idx,
            'listing-gallery__slot--dragging': dragFromIndex === idx,
          }"
          draggable="true"
          :aria-label="idx === 0 ? t('content.listingGallery.coverAria') : t('content.listingGallery.photoAria', { n: idx + 1 })"
          @click="onPhotoClick(idx)"
          @dragstart="onDragStart(idx, $event)"
          @dragover.prevent="onDragOver(idx, $event)"
          @dragleave="onDragLeave(idx)"
          @drop.prevent="onDrop(idx)"
          @dragend="onDragEnd"
        >
          <img
            :src="absUrl(url)"
            alt=""
            draggable="false"
            @error="onPhotoImgError(url)"
          >
          <span v-if="idx === 0" class="listing-gallery__cover-badge">
            {{ t('content.listingGallery.coverBadge') }}
          </span>
          <span
            v-if="isShareImage(url) && idx !== 0"
            class="listing-gallery__share-badge"
          >
            {{ t('content.listingGallery.shareBadge') }}
          </span>
          <button
            type="button"
            class="listing-gallery__slot-x"
            :disabled="disabled || uploading"
            :aria-label="t('common.delete')"
            @click.stop="removePhoto(idx)"
          >×</button>
        </div>
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
      <div class="listing-gallery__grid">
        <div
          v-if="video"
          class="listing-gallery__slot listing-gallery__slot--filled"
          @click="toggleShareVideo"
        >
          <video
            :src="absUrl(video)"
            muted
            playsinline
            preload="metadata"
          />
          <span v-if="isShareVideo" class="listing-gallery__share-badge">
            {{ t('content.listingGallery.shareBadge') }}
          </span>
          <button
            type="button"
            class="listing-gallery__slot-x"
            :disabled="disabled || uploading"
            :aria-label="t('common.delete')"
            @click.stop="clearVideo"
          >×</button>
        </div>
        <button
          v-else
          type="button"
          class="listing-gallery__slot listing-gallery__slot--empty"
          :disabled="disabled || uploading"
          @click="pickVideo"
        >
          <span class="listing-gallery__slot-plus">+</span>
          <span class="listing-gallery__slot-caption">{{ t('content.listingGallery.addVideo') }}</span>
        </button>
      </div>
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
  sharePreview: {
    type: Object,
    default: null,
  },
  disabled: { type: Boolean, default: false },
  mediaDraft: { type: Boolean, default: false },
  draftPhotoTarget: { type: Number, default: 8 },
});

const emit = defineEmits(['update:modelValue', 'update:sharePreview']);

const { t } = useI18n();
const photoInputRef = ref(null);
const videoInputRef = ref(null);
const uploading = ref(false);
const error = ref('');
const dragFromIndex = ref(null);
const dragOverIndex = ref(null);
const suppressPhotoClick = ref(false);
const videoMime = ref('');

const LISTING_IMAGE_MIME = /^image\/(jpeg|jpg|pjpeg|png|gif|webp)$/i;
const LISTING_IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

const photos = computed(() => {
  const list = props.modelValue?.photos;
  return Array.isArray(list) ? list.filter(Boolean) : [];
});

const video = computed(() => props.modelValue?.video || null);

function stripWm(url) {
  return String(url || '')
    .replace(/[?&]wm=1\b/g, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

function sameUrl(a, b) {
  return stripWm(a) === stripWm(b) && Boolean(stripWm(a));
}

function guessVideoMime(url, fileType) {
  if (fileType && String(fileType).startsWith('video/')) return fileType;
  const p = stripWm(url).split('?')[0].toLowerCase();
  if (p.endsWith('.webm')) return 'video/webm';
  if (p.endsWith('.ogg') || p.endsWith('.ogv')) return 'video/ogg';
  if (p.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

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

function emitShare(next) {
  emit('update:sharePreview', next);
}

const isShareVideo = computed(() => (
  props.sharePreview?.type === 'video' && sameUrl(props.sharePreview?.url, video.value)
));

function isShareImage(url) {
  return props.sharePreview?.type === 'image' && sameUrl(props.sharePreview?.url, url);
}

function toggleShareImage(url) {
  if (isShareImage(url)) {
    emitShare(null);
    return;
  }
  emitShare({ type: 'image', url });
}

function onPhotoClick(idx) {
  if (suppressPhotoClick.value) {
    suppressPhotoClick.value = false;
    return;
  }
  if (props.disabled || uploading.value) return;
  const url = photos.value[idx];
  if (!url) return;
  toggleShareImage(url);
}

function onPhotoImgError(url) {
  const broken = String(url || '');
  if (!broken) return;
  const next = photos.value.filter((item) => item !== broken);
  if (next.length === photos.value.length) return;
  emitValue({ photos: next, video: video.value });
  if (isShareImage(broken)) emitShare(null);
  error.value = t('content.listingGallery.photoBroken');
}

function isListingPhotoFile(file) {
  const mime = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '');
  if (LISTING_IMAGE_MIME.test(mime)) return true;
  return LISTING_IMAGE_EXT.test(name) && (!mime || mime.startsWith('image/'));
}

async function sniffListingImage(file) {
  const buf = await file.slice(0, 16).arrayBuffer();
  const u8 = new Uint8Array(buf);
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'jpeg';
  if (u8.length >= 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return 'png';
  if (u8.length >= 6 && u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return 'gif';
  if (
    u8.length >= 12
    && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46
    && u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

function decodeListingImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const finish = (ok) => {
      URL.revokeObjectURL(url);
      img.onload = null;
      img.onerror = null;
      img.src = '';
      if (ok) resolve();
      else reject(new Error('decode'));
    };
    img.onload = () => finish(img.naturalWidth > 0 && img.naturalHeight > 0);
    img.onerror = () => finish(false);
    img.src = url;
  });
}

function loadRemoteImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) resolve();
      else reject(new Error('empty'));
    };
    img.onerror = () => reject(new Error('load'));
    img.src = absUrl(url);
  });
}

function toggleShareVideo() {
  if (isShareVideo.value) {
    emitShare(null);
    return;
  }
  const url = video.value;
  if (!url) return;
  emitShare({
    type: 'video',
    url,
    mime: guessVideoMime(url, videoMime.value),
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
  const removed = photos.value[idx];
  const next = photos.value.filter((_, i) => i !== idx);
  emitValue({ photos: next, video: video.value });
  if (removed && isShareImage(removed)) emitShare(null);
}

function clearVideo() {
  emitValue({ photos: photos.value, video: null });
  videoMime.value = '';
  if (props.sharePreview?.type === 'video') emitShare(null);
}

function onDragStart(idx, e) {
  if (props.disabled || uploading.value) {
    e.preventDefault();
    return;
  }
  suppressPhotoClick.value = true;
  dragFromIndex.value = idx;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }
}

function onDragOver(idx, e) {
  if (dragFromIndex.value == null) return;
  e.dataTransfer.dropEffect = 'move';
  dragOverIndex.value = idx;
}

function onDragLeave(idx) {
  if (dragOverIndex.value === idx) dragOverIndex.value = null;
}

function onDrop(idx) {
  const from = dragFromIndex.value;
  dragFromIndex.value = null;
  dragOverIndex.value = null;
  if (from == null || from === idx) return;
  const next = [...photos.value];
  const [item] = next.splice(from, 1);
  next.splice(idx, 0, item);
  emitValue({ photos: next, video: video.value });
}

function onDragEnd() {
  dragFromIndex.value = null;
  dragOverIndex.value = null;
  requestAnimationFrame(() => {
    suppressPhotoClick.value = false;
  });
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
      if (!isListingPhotoFile(file)) {
        error.value = t('content.listingGallery.photoInvalid');
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        error.value = t('content.listingGallery.photoTooLarge');
        continue;
      }
      if (file.size < 32 || !(await sniffListingImage(file))) {
        error.value = t('content.listingGallery.photoBroken');
        continue;
      }
      try {
        await decodeListingImage(file);
      } catch {
        error.value = t('content.listingGallery.photoBroken');
        continue;
      }
      const data = await uploadContentMedia(file, { purpose: 'listing' });
      if (!data?.url) {
        error.value = t('content.listingGallery.uploadError');
        continue;
      }
      try {
        await loadRemoteImage(data.url);
      } catch {
        error.value = t('content.listingGallery.photoBroken');
        continue;
      }
      uploaded.push(data.url);
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
    videoMime.value = file.type || '';
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

.listing-gallery__draft-badge {
  margin: 0;
  padding: 8px 12px;
  border-radius: var(--radius-md, 8px);
  background: #fff3e0;
  color: #e65100;
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

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
  cursor: grab;
}

.listing-gallery__slot--filled:active {
  cursor: grabbing;
}

.listing-gallery__slot--cover {
  outline: 2px solid var(--color-primary, #1f2a37);
  outline-offset: 0;
}

.listing-gallery__slot--dragover {
  outline: 2px dashed var(--color-primary, #1f2a37);
}

.listing-gallery__slot--dragging {
  opacity: 0.55;
}

.listing-gallery__slot--filled img,
.listing-gallery__slot--filled video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.listing-gallery__cover-badge {
  position: absolute;
  left: 6px;
  bottom: 6px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
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
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.listing-gallery__share-badge {
  position: absolute;
  left: 6px;
  bottom: 6px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  pointer-events: none;
}

.listing-gallery__slot:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.listing-gallery__file {
  display: none;
}
</style>
