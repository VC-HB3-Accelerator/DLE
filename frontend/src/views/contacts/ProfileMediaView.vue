<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Медиаресурсы профиля: /contacts/:id/media
-->
<template>
  <div class="profile-media page-with-close">
    <PageCloseButton :fallback="closeFallback" />
    <div class="profile-media__wrap">
      <div class="profile-media__header">
        <h1>{{ t('personalSidebar.media') }}</h1>
        <button
          v-if="canUpload"
          type="button"
          class="profile-media__upload"
          :disabled="uploading"
          @click="onUploadClick"
        >
          {{ t('content.media.upload') }}
        </button>
      </div>
      <p v-if="hintText" class="profile-media__hint">{{ hintText }}</p>
      <div v-if="progressText" class="profile-media__progress-row">
        <p class="profile-media__progress">{{ progressText }}</p>
        <button type="button" class="profile-media__cancel" @click="onCancelUpload">
          {{ t('content.media.uploadCancel') }}
        </button>
      </div>
      <input
        ref="fileInput"
        type="file"
        class="profile-media__file"
        :accept="acceptAttr"
        @change="onFilePicked"
      >
      <ContentMediaGrid
        ref="gridRef"
        mode="profile"
        :owner-user-id="ownerId"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import PageCloseButton from '@/components/PageCloseButton.vue';
import ContentMediaGrid from '@/components/content/ContentMediaGrid.vue';
import {
  uploadContentMedia,
  abortContentMediaUpload,
  isAbortError,
} from '@/composables/useChunkedMediaUpload';
import { useAuthContext } from '@/composables/useAuth';

const { t } = useI18n();
const route = useRoute();
const { userId, userAccessLevel } = useAuthContext();

const fileInput = ref(null);
const gridRef = ref(null);
const uploading = ref(false);
const progressText = ref('');
const currentFile = ref(null);

const ownerId = computed(() => {
  const n = Number(route.params.id);
  return Number.isInteger(n) && n > 0 ? n : null;
});

const isOwn = computed(() => (
  ownerId.value != null
  && Number(userId.value) === Number(ownerId.value)
));

const isEditor = computed(() => userAccessLevel.value?.level === 'editor');

const canUpload = computed(() => isOwn.value);

const closeFallback = computed(() => ({
  name: 'contact-profile',
  params: { id: String(ownerId.value || 'me') },
}));

const hintText = computed(() => {
  if (isOwn.value) return t('content.media.profileOwnHint');
  if (isEditor.value) return t('content.media.profileEditorHint');
  return '';
});

const acceptAttr = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/ogg,audio/*';

function onUploadClick() {
  fileInput.value?.click();
}

async function onCancelUpload() {
  if (currentFile.value) {
    await abortContentMediaUpload(currentFile.value);
  }
  uploading.value = false;
  progressText.value = '';
  currentFile.value = null;
}

async function onFilePicked(e) {
  const file = e.target?.files?.[0];
  e.target.value = '';
  if (!file || !canUpload.value) return;
  uploading.value = true;
  currentFile.value = file;
  progressText.value = t('content.media.uploading');
  try {
    await uploadContentMedia(file, {
      onProgress: ({ percent }) => {
        progressText.value = t('content.media.uploadProgress', { percent: percent || 0 });
      },
    });
    gridRef.value?.reload?.();
  } catch (err) {
    if (!isAbortError(err)) {
      progressText.value = err?.response?.data?.message || err?.message || t('content.media.uploadError');
      return;
    }
  } finally {
    uploading.value = false;
    currentFile.value = null;
    if (!progressText.value.includes('%')) {
      setTimeout(() => { progressText.value = ''; }, 1200);
    } else {
      progressText.value = '';
    }
  }
}
</script>

<style scoped>
.profile-media__wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
}

.profile-media__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.profile-media__header h1 {
  margin: 0;
  font-size: 1.4rem;
}

.profile-media__hint {
  margin: 0 0 12px;
  color: var(--color-grey);
  font-size: var(--font-size-sm);
}

.profile-media__upload,
.profile-media__cancel {
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border, #c5cdd6);
  background: var(--color-primary, #1a1a2e);
  color: #fff;
  cursor: pointer;
}

.profile-media__cancel {
  background: transparent;
  color: var(--color-dark);
}

.profile-media__progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.profile-media__progress {
  margin: 0;
  font-size: var(--font-size-sm);
}

.profile-media__file {
  display: none;
}
</style>
