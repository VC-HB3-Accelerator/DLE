<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="pool">
    <header class="pool__head">
      <strong>{{ pool.brand }} {{ pool.model }}</strong>
      <span>{{ visiblePhotos.length }} / {{ pool.target }}</span>
      <span v-if="pool.ready && !pendingFiles.size && !flushing" class="pool__ok">
        {{ t('content.media.agent.poolReady') }}
      </span>
      <span v-else-if="flushing || pendingFiles.size" class="pool__busy">
        {{ t('content.media.agent.poolRefilling') }}
      </span>
      <button
        type="button"
        class="pool__sel"
        @click="selectMode = !selectMode"
      >
        {{ selectMode
          ? t('content.media.agent.poolSelectOff')
          : t('content.media.agent.poolSelectOn') }}
      </button>
      <button
        v-if="selectMode && selected.size"
        type="button"
        class="pool__drop-many"
        @click="onDropSelected"
      >
        {{ t('content.media.agent.poolDropSelected', { n: selected.size }) }}
      </button>
    </header>
    <div class="pool__grid">
      <figure
        v-for="p in visiblePhotos"
        :key="`${p.file}:${p.bytes || 0}:${p.url}`"
        class="pool__card"
        :class="{ 'is-selected': selected.has(p.file), 'is-dropping': pendingFiles.has(p.file) }"
      >
        <button
          type="button"
          class="pool__img"
          @click="onCardClick(p)"
        >
          <img :src="p.url" :alt="p.file">
        </button>
        <button
          v-if="!selectMode"
          type="button"
          class="pool__x"
          :title="t('content.media.agent.poolDrop')"
          @click.stop="onDropOne(p.file)"
        >
          <UiGlyph name="times" :size="14" />
        </button>
        <label v-else class="pool__check">
          <input
            type="checkbox"
            :checked="selected.has(p.file)"
            @change="toggle(p.file)"
          >
        </label>
        <figcaption>
          {{ p.file }}
          <span v-if="p.angle" class="pool__angle">{{ p.angle }}</span>
        </figcaption>
      </figure>
    </div>
    <p v-if="error" class="pool__err">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import UiGlyph from '@/components/UiGlyph.vue';
import { dropListingPoolPhotos } from '@/services/mediaAgentService';

const props = defineProps({
  pool: { type: Object, required: true },
});
const emit = defineEmits(['update:pool', 'preview', 'refilling']);
const { t } = useI18n();

/** Локально скрытые до ответа API — ✕ сразу, без ожидания refill */
const pendingFiles = ref(new Set());
const flushing = ref(false);
const error = ref('');
const selectMode = ref(false);
const selected = ref(new Set());
let flushTimer = null;

const visiblePhotos = computed(() =>
  (props.pool?.photos || []).filter((p) => !pendingFiles.value.has(p.file))
);

watch(
  () => props.pool?.id,
  () => {
    error.value = '';
    selected.value = new Set();
    selectMode.value = false;
    pendingFiles.value = new Set();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }
);

watch(
  () => flushing.value || pendingFiles.value.size > 0,
  (v) => emit('refilling', Boolean(v)),
  { immediate: true }
);

function toggle(file) {
  const next = new Set(selected.value);
  if (next.has(file)) next.delete(file);
  else next.add(file);
  selected.value = next;
}

function onCardClick(p) {
  if (selectMode.value) {
    toggle(p.file);
    return;
  }
  emit('preview', { url: p.url, name: p.file, kind: 'image' });
}

function queueDrop(files) {
  const list = (files || []).map(String).filter(Boolean);
  if (!list.length || !props.pool?.id) return;
  const next = new Set(pendingFiles.value);
  for (const f of list) next.add(f);
  pendingFiles.value = next;
  const sel = new Set(selected.value);
  for (const f of list) sel.delete(f);
  selected.value = sel;
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  // Короткий debounce: несколько ✕ подряд = один dropMany + один refill
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPending();
  }, 280);
}

async function flushPending() {
  if (flushing.value || !props.pool?.id) return;
  const batch = [...pendingFiles.value];
  if (!batch.length) return;
  flushing.value = true;
  error.value = '';
  try {
    const data = await dropListingPoolPhotos(props.pool.id, batch);
    if (data?.pool) emit('update:pool', data.pool);
    const still = new Set(pendingFiles.value);
    for (const f of batch) still.delete(f);
    pendingFiles.value = still;
  } catch (e) {
    error.value = e.response?.data?.error || e.message || t('content.media.agent.poolDropFailed');
    // Откат: показать карточки снова
    pendingFiles.value = new Set();
  } finally {
    flushing.value = false;
    if (pendingFiles.value.size) scheduleFlush();
  }
}

function onDropOne(file) {
  queueDrop([file]);
}

function onDropSelected() {
  queueDrop([...selected.value]);
}
</script>

<style scoped>
.pool {
  margin-top: 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 8px;
  padding: 0.75rem;
  background: var(--color-surface, #fafafa);
}
.pool__head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: baseline;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
}
.pool__ok {
  color: var(--color-success, #1a7f37);
}
.pool__busy {
  opacity: 0.7;
}
.pool__sel,
.pool__drop-many {
  margin-left: auto;
  border: 1px solid var(--color-border, #ccc);
  background: #fff;
  border-radius: 6px;
  padding: 0.2rem 0.55rem;
  font-size: 0.8rem;
  cursor: pointer;
}
.pool__drop-many {
  margin-left: 0;
  background: #b00020;
  color: #fff;
  border-color: #b00020;
}
.pool__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}
.pool__card {
  position: relative;
  margin: 0;
}
.pool__card.is-selected .pool__img {
  outline: 2px solid #b00020;
  outline-offset: 2px;
}
.pool__card.is-dropping {
  opacity: 0.35;
  pointer-events: none;
}
.pool__img {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: #111;
  border-radius: 6px;
  overflow: hidden;
  cursor: zoom-in;
  aspect-ratio: 4 / 3;
}
.pool__img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.pool__x {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 2;
}
.pool__x:hover {
  background: #b00020;
}
.pool__check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.65);
  display: grid;
  place-items: center;
  z-index: 2;
}
.pool__check input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
figcaption {
  font-size: 0.7rem;
  opacity: 0.65;
  margin-top: 0.25rem;
}
.pool__angle {
  display: block;
  opacity: 0.85;
  font-size: 0.65rem;
}
.pool__err {
  color: #b00020;
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
}
</style>
