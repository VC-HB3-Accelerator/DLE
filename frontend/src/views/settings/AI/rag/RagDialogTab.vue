<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="rag-dialog-tab">
    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.rag.dialogTitle') }}</h3>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.rag.historyTurns') }}</label>
          <input type="number" v-model.number="dialog.historyTurns" class="form-control form-control--narrow" min="1" max="32" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.rag.ragSnippetLength') }}</label>
          <input type="number" v-model.number="dialog.ragSnippetLength" class="form-control form-control--narrow" min="50" max="2000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.rag.docSnippetLength') }}</label>
          <input type="number" v-model.number="dialog.docSnippetLength" class="form-control form-control--narrow" min="50" max="2000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.rag.memoryMaxChars') }}</label>
          <input type="number" v-model.number="dialog.memoryMaxChars" class="form-control form-control--narrow" min="100" max="5000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.rag.compressEvery') }}</label>
          <input type="number" v-model.number="dialog.compressEvery" class="form-control form-control--narrow" min="1" max="50" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.rag.minCyrillicPercent') }}</label>
          <input type="number" v-model.number="dialog.minCyrillicPercent" class="form-control form-control--narrow" min="0" max="100" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.rag.maxMessageLength') }}</label>
          <input type="number" v-model.number="dialog.maxMessageLength" class="form-control form-control--narrow" min="100" max="100000" />
        </div>
      </div>
    </div>

    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.rag.chunkingTitle') }}</h3>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.rag.maxChunkSize') }}</label>
          <input type="number" v-model.number="chunking.maxChunkSize" class="form-control form-control--narrow" min="200" max="8000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.rag.overlap') }}</label>
          <input type="number" v-model.number="chunking.overlap" class="form-control form-control--narrow" min="0" max="2000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.rag.llmThreshold') }}</label>
          <input type="number" v-model.number="chunking.llmThreshold" class="form-control form-control--narrow" min="500" max="50000" />
        </div>
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="onSave">{{ $t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue';

const props = defineProps({
  dialogSettings: { type: Object, required: true },
  chunkingSettings: { type: Object, required: true },
  saving: { type: Boolean, default: false }
});
const emit = defineEmits(['save']);

const dialog = reactive({
  historyTurns: 4,
  ragSnippetLength: 300,
  docSnippetLength: 350,
  memoryMaxChars: 900,
  compressEvery: 4,
  minCyrillicPercent: 10,
  maxMessageLength: 10000,
  languages: ['ru']
});
const chunking = reactive({
  maxChunkSize: 1500,
  overlap: 200,
  llmThreshold: 8000
});

watch(() => props.dialogSettings, (v) => { if (v) Object.assign(dialog, v); }, { immediate: true, deep: true });
watch(() => props.chunkingSettings, (v) => { if (v) Object.assign(chunking, v); }, { immediate: true, deep: true });

function onSave() {
  emit('save', {
    dialog_settings: { ...dialog },
    chunking_settings: { ...props.chunkingSettings, ...chunking }
  });
}
</script>

<style scoped>
.settings-section { padding: 1rem; margin-bottom: 1rem; }
.form-label { display: block; margin-top: 0.5rem; font-weight: 600; }
.form-control--narrow { max-width: 12rem; }
.form-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.75rem; }
</style>
