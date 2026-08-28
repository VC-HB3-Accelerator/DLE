<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="store-import" role="dialog" aria-modal="true">
    <div class="store-import__panel">
      <header class="store-import__head">
        <h2>{{ t('store.import.title') }}</h2>
        <button type="button" class="btn btn-secondary" @click="emit('close')">
          {{ t('store.common.cancel') }}
        </button>
      </header>

      <p class="store-import__hint">{{ t('store.import.hint') }}</p>
      <p class="store-import__cols">{{ t('store.import.columns') }}</p>

      <template v-if="step === 1">
        <label class="store-import__file">
          <span>{{ t('store.import.pickFile') }}</span>
          <input type="file" accept=".csv,text/csv" @change="onFile">
        </label>
        <p v-if="parseError" class="store-import__error">{{ parseError }}</p>
      </template>

      <template v-else-if="step === 2">
        <p class="store-import__meta">
          {{ t('store.import.preview', { count: rows.length }) }}
        </p>
        <div class="store-import__table-wrap">
          <table class="store-import__table">
            <thead>
              <tr>
                <th>#</th>
                <th>title</th>
                <th>kind</th>
                <th>price</th>
                <th>pay</th>
                <th>receipt</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in preview" :key="i">
                <td>{{ i + 1 }}</td>
                <td>{{ r.title }}</td>
                <td>{{ r.kind || 'product' }}</td>
                <td>{{ r.price_human || r.price_units }}</td>
                <td class="store-import__mono">{{ shortAddr(r.pay_token_address) }}</td>
                <td>{{ r.receipt_enabled || r.license_token_address ? 'yes' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="store-import__actions">
          <button type="button" class="btn btn-secondary" @click="step = 1">
            {{ t('store.import.back') }}
          </button>
          <button type="button" class="btn btn-primary" :disabled="loading" @click="submit">
            {{ loading ? t('store.common.saving') : t('store.import.submit') }}
          </button>
        </div>
        <p v-if="submitError" class="store-import__error">{{ submitError }}</p>
      </template>

      <template v-else>
        <p class="store-import__ok">
          {{ t('store.import.done', { created: result.created || 0, failed: result.failed || 0 }) }}
        </p>
        <ul v-if="result.errors?.length" class="store-import__errors">
          <li v-for="e in result.errors" :key="e.row">
            {{ t('store.import.rowError', { row: e.row, error: e.error }) }}
          </li>
        </ul>
        <button type="button" class="btn btn-primary" @click="finish">
          OK
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Papa from 'papaparse';
import { importStoreProducts } from '../services/storeService';

const emit = defineEmits(['close', 'imported']);
const { t } = useI18n();

const step = ref(1);
const rows = ref([]);
const parseError = ref('');
const submitError = ref('');
const loading = ref(false);
const result = ref({});

const preview = computed(() => rows.value.slice(0, 12));

function shortAddr(a) {
  const s = String(a || '');
  if (s.length < 12) return s || '—';
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function onFile(ev) {
  parseError.value = '';
  const file = ev.target?.files?.[0];
  if (!file) return;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (parsed) => {
      const data = (parsed.data || []).filter((r) => Object.values(r || {}).some((v) => String(v || '').trim()));
      if (!data.length) {
        parseError.value = t('store.import.empty');
        return;
      }
      rows.value = data.map((r) => {
        const out = {};
        for (const [k, v] of Object.entries(r)) {
          const key = String(k || '').trim().toLowerCase().replace(/\s+/g, '_');
          out[key] = typeof v === 'string' ? v.trim() : v;
        }
        if (out.price && !out.price_human) out.price_human = out.price;
        if (out.pay_token && !out.pay_token_address) out.pay_token_address = out.pay_token;
        if (out.receipt_token && !out.license_token_address) out.license_token_address = out.receipt_token;
        return out;
      });
      step.value = 2;
    },
    error: (err) => {
      parseError.value = err?.message || t('store.import.parseFail');
    },
  });
}

async function submit() {
  loading.value = true;
  submitError.value = '';
  try {
    result.value = await importStoreProducts(rows.value);
    step.value = 3;
  } catch (e) {
    submitError.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    loading.value = false;
  }
}

function finish() {
  emit('imported');
  emit('close');
}
</script>

<style scoped>
.store-import {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: color-mix(in srgb, #000 45%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.store-import__panel {
  width: min(720px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: var(--color-surface, #111);
  color: inherit;
  border-radius: 12px;
  padding: 1.1rem 1.25rem 1.35rem;
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
}
.store-import__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.store-import__head h2 {
  margin: 0;
  font-size: 1.15rem;
}
.store-import__hint,
.store-import__cols,
.store-import__meta {
  margin: 0 0 0.65rem;
  opacity: 0.85;
  font-size: 0.9rem;
}
.store-import__cols {
  font-family: ui-monospace, monospace;
  font-size: 0.78rem;
  word-break: break-word;
}
.store-import__file {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.store-import__table-wrap {
  overflow: auto;
  margin-bottom: 0.85rem;
}
.store-import__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.store-import__table th,
.store-import__table td {
  border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  padding: 0.35rem 0.4rem;
  text-align: left;
}
.store-import__mono {
  font-family: ui-monospace, monospace;
}
.store-import__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.store-import__error,
.store-import__errors {
  color: #b42318;
}
.store-import__ok {
  color: #067647;
}
.store-import__errors {
  max-height: 160px;
  overflow: auto;
  padding-left: 1.1rem;
}
.btn {
  display: inline-flex;
  align-items: center;
  border: 0;
  cursor: pointer;
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  font: inherit;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary { background: var(--color-primary, #1a5fff); color: #fff; }
.btn-secondary {
  background: color-mix(in srgb, currentColor 12%, transparent);
  color: inherit;
}
</style>
