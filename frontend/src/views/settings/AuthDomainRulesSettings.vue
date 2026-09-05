<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="auth-domain-rules">
    <h4>{{ $t('settings.authDomains.title') }}</h4>
    <p class="section-hint">{{ $t('settings.authDomains.hint') }}</p>

    <div v-if="domainRules.length > 0" class="rules-list">
      <div class="rules-list-head" aria-hidden="true">
        <span>{{ $t('settings.authDomains.kind') }}</span>
        <span>{{ $t('settings.authDomains.value') }}</span>
        <span>{{ $t('settings.authDomains.role') }}</span>
        <span>{{ $t('settings.authDomains.domainAdmin') }}</span>
        <span></span>
      </div>
      <div
        v-for="rule in domainRules"
        :key="rule.id"
        class="rule-entry"
      >
        <span class="rule-cell">{{ kindLabel(rule.kind) }}</span>
        <span class="rule-cell rule-cell--mono" :title="rule.value">{{ rule.value }}</span>
        <span class="rule-cell">{{ roleLabel(rule.role) }}</span>
        <span class="rule-cell">{{ rule.domain_admin ? $t('common.yes') : $t('common.no') }}</span>
        <div class="rule-actions">
          <button
            type="button"
            class="btn btn-sm"
            :class="canManage ? 'btn-danger' : 'btn-outline'"
            :disabled="!canManage"
            @click="canManage ? removeRule(rule) : null"
          >
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
    <p v-else class="empty-hint">{{ $t('settings.authDomains.empty') }}</p>

    <div class="add-rule-form">
      <h5>{{ $t('settings.authDomains.addTitle') }}</h5>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.authDomains.kind') }}</label>
          <select v-model="newRule.kind" class="form-control" :disabled="!canManage">
            <option value="domain">{{ $t('settings.authDomains.kindDomain') }}</option>
            <option value="email">{{ $t('settings.authDomains.kindEmail') }}</option>
          </select>
        </div>
        <div class="form-group form-group--grow">
          <label class="form-label">{{ $t('settings.authDomains.value') }}</label>
          <input
            type="text"
            v-model="newRule.value"
            class="form-control"
            :placeholder="newRule.kind === 'domain' ? 'company.com' : 'boss@company.com'"
            :disabled="!canManage"
          >
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.authDomains.role') }}</label>
          <select v-model="newRule.role" class="form-control" :disabled="!canManage">
            <option value="user">{{ $t('settings.authDomains.roleUser') }}</option>
            <option value="readonly">{{ $t('settings.authDomains.roleReadonly') }}</option>
          </select>
        </div>
        <div v-if="newRule.kind === 'email'" class="form-group checkbox-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="newRule.domainAdmin"
              :disabled="!canManage || newRule.role !== 'readonly'"
            >
            {{ $t('settings.authDomains.domainAdminBoss') }}
          </label>
          <small class="form-text">{{ $t('settings.authDomains.domainAdminHelp') }}</small>
        </div>
      </div>
      <button
        type="button"
        class="btn"
        :class="canManage ? 'btn-primary' : 'btn-outline'"
        :disabled="!canManage"
        @click="canManage ? addRule() : null"
      >
        {{ $t('settings.authDomains.addButton') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/axios';
import eventBus from '@/utils/eventBus';

const { t } = useI18n();

const props = defineProps({
  domainRules: { type: Array, required: true },
  canManage: { type: Boolean, default: false },
});

const emit = defineEmits(['update']);

const newRule = reactive({
  kind: 'domain',
  value: '',
  role: 'user',
  domainAdmin: false,
});

watch(() => newRule.kind, (kind) => {
  if (kind === 'domain') {
    newRule.domainAdmin = false;
  }
});

watch(() => newRule.role, (role) => {
  if (role !== 'readonly') {
    newRule.domainAdmin = false;
  }
});

function kindLabel(kind) {
  return kind === 'email'
    ? t('settings.authDomains.kindEmail')
    : t('settings.authDomains.kindDomain');
}

function roleLabel(role) {
  return role === 'readonly'
    ? t('settings.authDomains.roleReadonly')
    : t('settings.authDomains.roleUser');
}

function resetForm() {
  newRule.kind = 'domain';
  newRule.value = '';
  newRule.role = 'user';
  newRule.domainAdmin = false;
}

async function addRule() {
  const value = String(newRule.value || '').trim();
  if (!value) {
    alert(t('settings.authDomains.valueRequired'));
    return;
  }

  try {
    await api.post('/settings/auth-domain-rules', {
      kind: newRule.kind,
      value,
      role: newRule.role,
      domain_admin: Boolean(newRule.domainAdmin),
    });
    eventBus.emit('auth-settings-saved');
    resetForm();
    emit('update');
  } catch (e) {
    alert(t('settings.authDomains.saveError', { error: e.response?.data?.error || e.message }));
  }
}

async function removeRule(rule) {
  if (!rule?.id) return;
  if (!confirm(t('settings.authDomains.confirmDelete', { value: rule.value }))) return;

  try {
    await api.delete(`/settings/auth-domain-rules/${rule.id}`);
    eventBus.emit('auth-settings-saved');
    emit('update');
  } catch (e) {
    alert(t('settings.authDomains.deleteError', { error: e.response?.data?.error || e.message }));
  }
}
</script>

<style scoped>
.auth-domain-rules {
  margin-top: var(--spacing-xl, 32px);
  padding-top: var(--spacing-lg, 20px);
  border-top: 1px solid var(--theme-border, #e9ecef);
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
}

.auth-domain-rules h4 {
  margin: 0 0 var(--spacing-sm, 8px);
}

.section-hint {
  margin: 0 0 var(--spacing-lg, 20px);
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--theme-text-muted, #666);
}

.rules-list {
  margin-bottom: var(--spacing-lg, 20px);
  min-width: 640px;
}

.rules-list-head,
.rule-entry {
  display: grid;
  grid-template-columns:
    minmax(88px, 0.6fr)
    minmax(160px, 1.4fr)
    minmax(88px, 0.6fr)
    minmax(72px, 0.5fr)
    96px;
  gap: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  align-items: center;
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
}

.rules-list-head {
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: 600;
  color: var(--theme-text-muted, #666);
  border-bottom: 1px solid var(--theme-border, #e9ecef);
}

.rule-entry {
  border-bottom: 1px solid var(--theme-border, #e9ecef);
}

.rule-cell {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-sm, 0.875rem);
}

.rule-cell--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.rule-actions {
  display: inline-flex;
  justify-self: stretch;
  justify-content: flex-end;
}

.empty-hint {
  margin: 0 0 var(--spacing-lg, 20px);
  color: var(--theme-text-muted, #666);
}

.add-rule-form {
  max-width: 720px;
}

.add-rule-form h5 {
  margin: 0 0 var(--spacing-md, 12px);
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md, 12px);
  margin-bottom: var(--spacing-md, 12px);
}

.form-group {
  flex: 1 1 180px;
  margin-bottom: 0;
}

.form-group--grow {
  flex: 2 1 260px;
}

.form-label {
  display: block;
  margin-bottom: var(--spacing-xs, 6px);
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  cursor: pointer;
  font-size: var(--font-size-sm, 0.875rem);
}

.form-text {
  display: block;
  margin-top: var(--spacing-xs, 6px);
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--theme-text-muted, #6c757d);
}

.form-control[disabled],
.form-control:disabled {
  background-color: #f8f9fa !important;
  color: #6c757d !important;
  cursor: not-allowed !important;
}
</style>
