<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div v-if="open" class="modal-overlay" @click="onCancel">
    <div class="modal-content picker-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ title }}</h3>
        <button type="button" class="picker-modal__close" @click="onCancel">×</button>
      </div>
      <div class="modal-body">
        <div class="picker-modal__actions">
          <button type="button" class="btn btn-primary" @click="onDevice">
            {{ t('editor.pickDevice') }}
          </button>
          <button v-if="kind === 'video'" type="button" class="btn btn-secondary" @click="onUrl">
            {{ t('editor.pickUrl') }}
          </button>
        </div>
        <ContentMediaGrid
          mode="pick"
          :forced-type="kind"
          @select="onSelect"
        />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" @click="onCancel">
          {{ t('editor.pickCancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ContentMediaGrid from './ContentMediaGrid.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  kind: { type: String, default: 'image' },
});

const emit = defineEmits(['cancel', 'device', 'select', 'url']);

const { t } = useI18n();

const title = computed(() => (
  props.kind === 'video' ? t('editor.pickTitleVideo') : t('editor.pickTitleImage')
));

function onCancel() {
  emit('cancel');
}
function onDevice() {
  emit('device');
}
function onSelect(item) {
  emit('select', item);
}
function onUrl() {
  emit('url');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 16px;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  width: min(860px, 100%);
  max-height: 90vh;
  overflow: auto;
}

.modal-header,
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
}

.modal-footer {
  border-bottom: none;
  border-top: 1px solid #e9ecef;
  justify-content: flex-end;
}

.modal-header h3 {
  margin: 0;
}

.modal-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.picker-modal__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.picker-modal__close {
  border: none;
  background: transparent;
  font-size: 1.4rem;
  cursor: pointer;
  line-height: 1;
  color: #868e96;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  font: inherit;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-secondary {
  background: #f1f3f5;
  color: #495057;
}
</style>
