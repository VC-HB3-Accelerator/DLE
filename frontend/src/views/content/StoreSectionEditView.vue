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
    <div class="store-section-edit page-with-close">
      <PageCloseButton :fallback="{ name: 'content-store' }" />

      <div v-if="!isEditor" class="store-section-edit__forbidden">
        <h1>{{ pageTitle }}</h1>
        <p>{{ t('store.editor.forbidden') }}</p>
      </div>

      <div v-else class="store-section-edit__wrap">
        <header class="store-section-edit__header">
          <div>
            <router-link class="store-section-edit__back" :to="{ name: 'content-store-sections' }">
              ← {{ t('store.editor.sectionsManage') }}
            </router-link>
            <h1>{{ pageTitle }}</h1>
          </div>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="saving || loading"
            @click="onSave"
          >
            {{ saving ? t('store.common.saving') : t('store.common.save') }}
          </button>
        </header>

        <p v-if="loadError" class="store-section-edit__error">{{ loadError }}</p>
        <p v-else-if="loading" class="store-section-edit__muted">{{ t('store.common.loading') }}</p>

        <form v-else class="store-section-edit__form" @submit.prevent="onSave">
          <label>
            <span>{{ t('store.editor.fieldTitle') }}</span>
            <input v-model="form.title" required maxlength="120">
          </label>
          <label>
            <span>{{ t('store.editor.sectionSlug') }}</span>
            <input v-model="form.slug" maxlength="120" placeholder="catalog">
          </label>
          <label>
            <span>{{ t('store.editor.sectionParent') }}</span>
            <select v-model="form.parent_id">
              <option :value="null">{{ t('store.editor.sectionParentNone') }}</option>
              <option
                v-for="s in parentOptions"
                :key="s.id"
                :value="s.id"
              >{{ s.title }}</option>
            </select>
          </label>
          <label>
            <span>{{ t('store.editor.sectionDescription') }}</span>
            <textarea v-model="form.description" rows="4" />
          </label>
          <label class="store-section-edit__check">
            <input v-model="form.active" type="checkbox">
            <span>{{ t('store.editor.sectionActive') }}</span>
          </label>

          <p v-if="formError" class="store-section-edit__error">{{ formError }}</p>
          <p v-if="saveMsg" class="store-section-edit__msg">{{ saveMsg }}</p>

          <div class="store-section-edit__actions">
            <router-link class="btn btn-secondary" :to="{ name: 'content-store' }">
              {{ t('store.common.cancel') }}
            </router-link>
            <button
              v-if="editingId"
              type="button"
              class="btn btn-secondary"
              :disabled="saving"
              @click="onDelete"
            >
              {{ t('store.editor.sectionDelete') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? t('store.common.saving') : t('store.common.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import { usePermissions } from '../../composables/usePermissions';
import {
  createStoreSection,
  deleteStoreSection,
  fetchStoreSections,
  updateStoreSection,
} from '../../services/storeService';

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

const loading = ref(false);
const saving = ref(false);
const loadError = ref('');
const formError = ref('');
const saveMsg = ref('');
const sections = ref([]);
const editingId = ref(null);

const form = reactive({
  title: '',
  slug: '',
  parent_id: null,
  description: '',
  active: true,
});

const pageTitle = computed(() => (
  editingId.value ? t('store.editor.sectionEdit') : t('store.editor.sectionNewTitle')
));

const parentOptions = computed(() => sections.value.filter((s) => String(s.id) !== String(editingId.value)));

function resetForm() {
  form.title = '';
  form.slug = '';
  form.parent_id = null;
  form.description = '';
  form.active = true;
  formError.value = '';
  saveMsg.value = '';
}

async function loadPage() {
  loading.value = true;
  loadError.value = '';
  resetForm();
  editingId.value = route.name === 'content-store-section-edit' ? route.params.id : null;
  try {
    sections.value = await fetchStoreSections();
    if (editingId.value) {
      const found = sections.value.find((s) => String(s.id) === String(editingId.value));
      if (!found) throw new Error(t('store.common.loadError'));
      form.title = found.title || '';
      form.slug = found.slug || '';
      form.parent_id = found.parent_id || null;
      form.description = found.description || '';
      form.active = found.active !== false;
    }
  } catch (e) {
    loadError.value = e?.response?.data?.error || e?.message || t('store.common.loadError');
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  formError.value = '';
  saveMsg.value = '';
  try {
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      parent_id: form.parent_id || null,
      description: form.description,
      active: Boolean(form.active),
    };
    if (editingId.value) await updateStoreSection(editingId.value, payload);
    else await createStoreSection(payload);
    saveMsg.value = t('store.editor.sectionSaved');
    await router.push({ name: 'content-store' });
  } catch (e) {
    formError.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    saving.value = false;
  }
}

async function onDelete() {
  if (!editingId.value) return;
  if (!window.confirm(t('store.editor.sectionDeleteConfirm'))) return;
  saving.value = true;
  formError.value = '';
  try {
    await deleteStoreSection(editingId.value);
    await router.push({ name: 'content-store' });
  } catch (e) {
    formError.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (isEditor.value) loadPage();
});

watch(isEditor, (ok) => {
  if (ok) loadPage();
});

watch(() => route.fullPath, () => {
  if (isEditor.value) loadPage();
});
</script>

<style scoped>
.store-section-edit {
  max-width: 640px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 2.5rem;
}
.store-section-edit__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.store-section-edit__header h1 {
  margin: 0.35rem 0 0;
  font-size: 1.35rem;
}
.store-section-edit__back {
  font-size: 0.9rem;
  opacity: 0.8;
  text-decoration: none;
  color: inherit;
}
.store-section-edit__form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.store-section-edit label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
}
.store-section-edit input,
.store-section-edit textarea,
.store-section-edit select {
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  background: transparent;
  color: inherit;
  font: inherit;
}
.store-section-edit__check {
  flex-direction: row !important;
  align-items: center;
  gap: 0.5rem;
}
.store-section-edit__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.store-section-edit__error { color: #b42318; }
.store-section-edit__msg,
.store-section-edit__muted { opacity: 0.75; }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  border: 0;
  cursor: pointer;
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  font: inherit;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary { background: var(--color-primary, #1a5fff); color: #fff; }
.btn-secondary {
  background: color-mix(in srgb, currentColor 10%, transparent);
  color: inherit;
}
</style>
