<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="sidebar-text-tab">
    <p class="sidebar-text-tab__intro">{{ t('settings.sidebarNotice.intro') }}</p>

    <form class="sidebar-text-tab__form" @submit.prevent="handleSave">
      <label class="sidebar-text-tab__field">
        <span class="form-label">{{ t('settings.sidebarNotice.domainDescriptionLabel') }}</span>
        <textarea
          v-model="domainDescription"
          class="form-control"
          rows="6"
          :placeholder="t('settings.sidebarNotice.domainDescriptionPlaceholder')"
          :disabled="isSaving"
          maxlength="2000"
        />
        <span class="form-hint">{{ t('settings.sidebarNotice.domainDescriptionHint') }}</span>
      </label>

      <div class="sidebar-text-tab__field">
        <span class="form-label">{{ t('settings.sidebarNotice.ogImageLabel') }}</span>
        <span class="form-hint">{{ t('settings.sidebarNotice.ogImageHint') }}</span>

        <label class="sidebar-text-tab__check">
          <input
            v-model="hideOgImage"
            type="checkbox"
            :disabled="isSaving || isUploading"
          >
          <span>{{ t('settings.sidebarNotice.hideOgImage') }}</span>
        </label>

        <div v-if="!hideOgImage" class="sidebar-text-tab__og-actions">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="isSaving || isUploading"
            @click="triggerOgPick"
          >
            {{ isUploading
              ? t('settings.sidebarNotice.ogImageUploading')
              : t('settings.sidebarNotice.ogImagePick') }}
          </button>
          <button
            v-if="ogImageUrl"
            type="button"
            class="btn btn-outline"
            :disabled="isSaving || isUploading"
            @click="clearOgImage"
          >
            {{ t('settings.sidebarNotice.ogImageClear') }}
          </button>
        </div>

        <div v-if="!hideOgImage && ogPreviewUrl" class="sidebar-text-tab__og-preview">
          <img :src="ogPreviewUrl" :alt="t('settings.sidebarNotice.ogImageLabel')">
        </div>
        <p v-else-if="hideOgImage" class="form-hint">
          {{ t('settings.sidebarNotice.ogImageHiddenHint') }}
        </p>

        <input
          ref="ogFileRef"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          class="sidebar-text-tab__file"
          @change="onOgFileChange"
        >
      </div>

      <label class="sidebar-text-tab__field">
        <span class="form-label">{{ t('settings.sidebarNotice.headerDescriptionLabel') }}</span>
        <textarea
          v-model="headerDescription"
          class="form-control"
          rows="3"
          :placeholder="t('settings.sidebarNotice.headerDescriptionPlaceholder')"
          :disabled="isSaving"
          maxlength="500"
        />
        <span class="form-hint">{{ t('settings.sidebarNotice.headerDescriptionHint') }}</span>
      </label>

      <label class="sidebar-text-tab__field">
        <span class="form-label">{{ t('settings.sidebarNotice.textLabel') }}</span>
        <textarea
          v-model="body"
          class="form-control"
          rows="8"
          :placeholder="t('settings.sidebarNotice.textPlaceholder')"
          :disabled="isSaving"
          maxlength="4000"
        />
        <span class="form-hint">{{ t('settings.sidebarNotice.textHint') }}</span>
      </label>

      <div class="sidebar-text-tab__fixed-link">
        <span class="form-label">{{ t('settings.sidebarNotice.fixedLinkLabel') }}</span>
        <a
          class="sidebar-text-tab__privacy"
          :href="privacyDocsUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('settings.sidebarNotice.privacyLink') }}
        </a>
        <span class="form-hint">{{ t('settings.sidebarNotice.fixedLinkHint') }}</span>
      </div>

      <p v-if="saveError" class="alert alert-danger">{{ saveError }}</p>
      <p v-if="saveSuccess" class="alert alert-success">{{ saveSuccess }}</p>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="isSaving || isUploading">
          {{ isSaving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthContext } from '@/composables/useAuth';
import {
  fetchSidebarNotice,
  saveSidebarNotice,
  uploadSiteOgImage,
} from '@/services/sidebarNoticeService';
import { getPrivacyDocsUrl } from '@/constants/publishedDocs';
import { applySiteMetaState } from '@/utils/siteMetaDescription';
import { useSiteBrand } from '@/composables/useSiteBrand';

const DEFAULT_OG = '/og-default.png';

const { t } = useI18n();
const { checkAuth, checkUserAccessLevel, address, isAuthenticated } = useAuthContext();
const { setSiteBrandLocal } = useSiteBrand();

const body = ref('');
const domainDescription = ref('');
const headerDescription = ref('');
const ogImageUrl = ref('');
const hideOgImage = ref(false);
const isSaving = ref(false);
const isUploading = ref(false);
const saveError = ref('');
const saveSuccess = ref('');
const privacyDocsUrl = getPrivacyDocsUrl();
const ogFileRef = ref(null);

const ogPreviewUrl = computed(() => {
  if (hideOgImage.value) return '';
  const url = String(ogImageUrl.value || '').trim() || DEFAULT_OG;
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}/${url.replace(/^\/+/, '')}`;
});

function formatSaveError(error) {
  const data = error.response?.data;
  if (typeof data?.error === 'string') return data.error;
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  return error.message || t('settings.sidebarNotice.saveError');
}

function applyLoaded(data) {
  body.value = data.body || '';
  domainDescription.value = data.domainDescription || '';
  headerDescription.value = data.headerDescription || '';
  ogImageUrl.value = data.ogImageUrl || '';
  hideOgImage.value = Boolean(data.hideOgImage);
}

async function loadSettings() {
  try {
    const data = await fetchSidebarNotice();
    applyLoaded(data);
  } catch (error) {
    console.error('[SidebarTextTab] load failed:', error);
    saveError.value = t('settings.sidebarNotice.loadError');
  }
}

function triggerOgPick() {
  ogFileRef.value?.click();
}

function clearOgImage() {
  ogImageUrl.value = '';
  if (ogFileRef.value) ogFileRef.value.value = '';
}

async function onOgFileChange(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  isUploading.value = true;
  saveError.value = '';
  try {
    ogImageUrl.value = await uploadSiteOgImage(file);
    hideOgImage.value = false;
  } catch (error) {
    saveError.value = formatSaveError(error);
  } finally {
    isUploading.value = false;
    if (ogFileRef.value) ogFileRef.value.value = '';
  }
}

async function handleSave() {
  isSaving.value = true;
  saveError.value = '';
  saveSuccess.value = '';
  try {
    const data = await saveSidebarNotice({
      body: body.value,
      domainDescription: domainDescription.value,
      headerDescription: headerDescription.value,
      ogImageUrl: ogImageUrl.value,
      hideOgImage: hideOgImage.value,
    });
    applyLoaded(data);
    setSiteBrandLocal({
      headerDescription: headerDescription.value,
      ogImageUrl: ogImageUrl.value,
      hideOgImage: hideOgImage.value,
    });
    applySiteMetaState({
      domainDescription: domainDescription.value,
      ogImageUrl: ogImageUrl.value,
      hideOgImage: hideOgImage.value,
    });
    saveSuccess.value = t('settings.sidebarNotice.saved');
  } catch (error) {
    saveError.value = formatSaveError(error);
  } finally {
    isSaving.value = false;
  }
}

async function initPage() {
  await checkAuth();
  if (isAuthenticated.value && address.value) {
    await checkUserAccessLevel(address.value);
  }
  await loadSettings();
}

watch(
  () => isAuthenticated.value,
  (authenticated) => {
    if (authenticated) loadSettings();
  }
);

onMounted(initPage);
</script>

<style scoped>
.sidebar-text-tab__intro {
  margin: 0 0 var(--spacing-lg);
  color: var(--color-text-light);
  line-height: 1.5;
  max-width: 720px;
}

.sidebar-text-tab__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 720px;
}

.sidebar-text-tab__field,
.sidebar-text-tab__fixed-link {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.sidebar-text-tab__check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  cursor: pointer;
  width: fit-content;
}

.sidebar-text-tab__og-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.sidebar-text-tab__og-preview {
  max-width: 320px;
  border: 1px solid var(--color-border, #e9ecef);
  border-radius: var(--radius-sm, 6px);
  overflow: hidden;
  background: #f8f9fa;
}

.sidebar-text-tab__og-preview img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 200px;
  object-fit: contain;
}

.sidebar-text-tab__file {
  display: none;
}

.sidebar-text-tab__privacy {
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: underline;
  width: fit-content;
}

@media (max-width: 768px) {
  .sidebar-text-tab, .settings-panel {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
