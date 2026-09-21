<template>
  <BaseLayout>
    <AdminPageShell
      :title="t('settings.ai.translation.pageTitle')"
      :show-close="true"
      fallback="/settings/ai"
      variant="panel"
    >
      <form class="translation-settings" @submit.prevent="save">
        <p class="translation-settings__description">
          {{ t('settings.ai.translation.description') }}
        </p>

        <div class="form-group">
          <label class="form-label">{{ t('settings.ai.translation.modelLabel') }}</label>
          <div class="translation-settings__model-row">
            <select
              v-model="selectedModel"
              class="form-control"
              :disabled="loadingModels || !models.length"
            >
              <option v-if="!models.length" value="">
                {{
                  loadingModels
                    ? t('settings.ai.translation.loading')
                    : t('settings.ai.translation.noModels')
                }}
              </option>
              <option v-for="model in models" :key="model.id" :value="model.id">
                {{ model.id }}
              </option>
            </select>
            <button
              type="button"
              class="btn btn-outline"
              :disabled="loadingModels"
              @click="loadModels"
            >
              {{ t('settings.ai.translation.refresh') }}
            </button>
          </div>
          <p class="form-hint">{{ t('settings.ai.translation.modelHint') }}</p>
        </div>

        <p v-if="error" class="translation-settings__message translation-settings__message--error">
          {{ error }}
        </p>
        <p
          v-if="saved"
          class="translation-settings__message translation-settings__message--success"
        >
          {{ t('settings.ai.translation.saved') }}
        </p>

        <button
          type="submit"
          class="btn btn-primary"
          :disabled="saving || loadingModels || !selectedModel"
        >
          {{ saving ? t('settings.ai.translation.saving') : t('common.save') }}
        </button>
      </form>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
  import { onMounted, ref } from 'vue';
  import { useI18n } from 'vue-i18n';
  import axios from 'axios';
  import BaseLayout from '@/components/BaseLayout.vue';
  import AdminPageShell from '@/components/admin/AdminPageShell.vue';

  const { t } = useI18n();
  const models = ref([]);
  const selectedModel = ref('');
  const loadingModels = ref(false);
  const saving = ref(false);
  const saved = ref(false);
  const error = ref('');

  async function loadModels() {
    loadingModels.value = true;
    error.value = '';
    saved.value = false;
    try {
      const { data } = await axios.get('/settings/ai-translation-settings/models');
      models.value = data.models || [];
      if (!models.value.some((model) => model.id === selectedModel.value)) {
        selectedModel.value = models.value[0]?.id || '';
      }
    } catch (e) {
      models.value = [];
      selectedModel.value = '';
      error.value = e.response?.data?.error || e.message;
    } finally {
      loadingModels.value = false;
    }
  }

  async function load() {
    error.value = '';
    try {
      const { data } = await axios.get('/settings/ai-translation-settings');
      selectedModel.value = data.settings?.selected_model || '';
      await loadModels();
    } catch (e) {
      error.value = e.response?.data?.error || e.message;
    }
  }

  async function save() {
    saving.value = true;
    saved.value = false;
    error.value = '';
    try {
      const { data } = await axios.put('/settings/ai-translation-settings', {
        selected_model: selectedModel.value,
      });
      selectedModel.value = data.settings?.selected_model || selectedModel.value;
      saved.value = true;
    } catch (e) {
      error.value = e.response?.data?.error || e.message;
    } finally {
      saving.value = false;
    }
  }

  onMounted(load);
</script>

<style scoped>
  .translation-settings {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    max-width: 720px;
  }

  .translation-settings__description {
    margin: 0;
    color: var(--theme-text-muted, var(--color-text-light));
  }

  .translation-settings__model-row {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .translation-settings__model-row .form-control {
    flex: 1;
  }

  .translation-settings__message {
    margin: 0;
  }

  .translation-settings__message--error {
    color: var(--color-danger);
  }

  .translation-settings__message--success {
    color: var(--color-success);
  }

  @media (max-width: 768px) {
    .translation-settings__model-row {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
