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
    <div class="media-library-page page-with-close">
      <PageCloseButton :fallback="{ name: 'content-list' }" />

      <div v-if="!isEditor" class="media-library-page__wrap">
        <div class="media-library-page__forbidden">
          <UiGlyph name="lock" :size="40" />
          <h1>{{ t('content.media.title') }}</h1>
          <p>{{ t('content.media.forbidden') }}</p>
        </div>
      </div>

      <div
        v-else
        class="media-library-page__wrap"
        :class="{ 'media-library-page__wrap--agent': tab === 'agent' }"
      >
        <div v-if="tab === 'library'" class="media-library-page__header">
          <h1>{{ t('content.media.title') }}</h1>
          <button
            type="button"
            class="media-library-page__upload"
            :disabled="uploading"
            @click="onUploadClick"
          >
            {{ t('content.media.upload') }}
          </button>
        </div>

        <nav
          class="media-library-page__tabs"
          :class="{ 'media-library-page__tabs--agent': tab === 'agent' }"
          :aria-label="t('content.media.title')"
        >
          <button
            type="button"
            class="media-library-page__tab"
            :class="{ 'is-active': tab === 'library' }"
            @click="setTab('library')"
          >
            {{ t('content.media.tabLibrary') }}
          </button>
          <button
            type="button"
            class="media-library-page__tab"
            :class="{ 'is-active': tab === 'agent' }"
            @click="setTab('agent')"
          >
            {{ t('content.media.tabAgent') }}
          </button>
        </nav>

        <template v-if="tab === 'library'">
          <div v-if="progressText" class="media-library-page__progress-row">
            <p class="media-library-page__progress">{{ progressText }}</p>
            <button
              type="button"
              class="media-library-page__cancel"
              @click="onCancelUpload"
            >
              {{ t('content.media.uploadCancel') }}
            </button>
          </div>
          <input
            ref="fileInput"
            type="file"
            class="media-library-page__file"
            :accept="acceptAttr"
            @change="onFilePicked"
          >
          <ContentMediaGrid ref="gridRef" mode="manage" />
        </template>
        <MediaAgentStudio v-else />
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import UiGlyph from '../../components/UiGlyph.vue';
import ContentMediaGrid from '../../components/content/ContentMediaGrid.vue';
import MediaAgentStudio from '../../components/content/MediaAgentStudio.vue';
import {
  uploadContentMedia,
  abortContentMediaUpload,
  isAbortError,
} from '../../composables/useChunkedMediaUpload';
import { usePermissions } from '../../composables/usePermissions';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

defineEmits(['auth-action-completed']);

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { isEditor } = usePermissions();
const fileInput = ref(null);
const gridRef = ref(null);
const progressText = ref('');
const uploading = ref(false);
const activeFile = ref(null);
const abortController = ref(null);

const acceptAttr = computed(() => 'image/*,video/*,audio/*');
const tab = computed(() => (route.query.tab === 'agent' ? 'agent' : 'library'));

function setTab(next) {
  const query = { ...route.query };
  if (next === 'agent') query.tab = 'agent';
  else delete query.tab;
  router.replace({ query });
}

function onUploadClick() {
  if (uploading.value) return;
  if (fileInput.value) fileInput.value.click();
}

async function onCancelUpload() {
  const file = activeFile.value;
  if (abortController.value) abortController.value.abort();
  if (file) await abortContentMediaUpload(file);
  progressText.value = '';
  uploading.value = false;
  activeFile.value = null;
  abortController.value = null;
}

async function onFilePicked(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file || uploading.value) return;
  const controller = new AbortController();
  abortController.value = controller;
  activeFile.value = file;
  uploading.value = true;
  try {
    await uploadContentMedia(file, {
      signal: controller.signal,
      onProgress: ({ percent, phase, part, totalParts }) => {
        if (phase === 'parts') {
          progressText.value = t('editor.chunkedProgress', {
            percent,
            part: part || 0,
            total: totalParts || 0,
          });
        } else {
          progressText.value = t('content.media.uploadProgress', { percent });
        }
      },
    });
    progressText.value = '';
    if (gridRef.value && gridRef.value.reload) gridRef.value.reload();
  } catch (err) {
    progressText.value = '';
    if (isAbortError(err)) {
      return;
    }
    const code = err.code || (err.response && err.response.data && err.response.data.code);
    alert(code === 'MEDIA_TOO_LARGE'
      ? t('content.media.tooLarge')
      : t('content.media.uploadFailed'));
  } finally {
    uploading.value = false;
    activeFile.value = null;
    abortController.value = null;
  }
}
</script>

<style scoped>
.media-library-page {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 40px);
  background: transparent;
}

.media-library-page__wrap {
  padding: 8px 24px 32px;
  max-width: 1100px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
}

.media-library-page__wrap--agent {
  max-width: none;
  padding: 0 12px 12px;
}

.media-library-page__tabs--agent {
  margin: 8px 12px 8px;
}

.media-library-page__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.media-library-page__tab {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--block-radius, 8px);
  border: 1px solid var(--color-border, #d1d5db);
  background: var(--color-white, #fff);
  color: var(--color-grey, #6b7280);
  cursor: pointer;
  font-size: 1rem;
}

.media-library-page__tab:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.media-library-page__tab.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.media-library-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.media-library-page__header h1 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.6rem;
}

.media-library-page__upload {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1.2rem;
  cursor: pointer;
  font-weight: 600;
}

.media-library-page__upload:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.media-library-page__file {
  display: none;
}

.media-library-page__progress-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 12px;
}

.media-library-page__progress {
  margin: 0;
  color: #495057;
  font-size: 0.9rem;
}

.media-library-page__cancel {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  border-radius: 8px;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.media-library-page__forbidden {
  text-align: center;
  padding: 64px 16px;
  color: #6c757d;
}

.media-library-page__forbidden h1 {
  margin: 12px 0 8px;
  color: var(--color-primary);
  font-size: 1.6rem;
}
</style>
