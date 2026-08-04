<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="sidebar-auth-tab">
    <p class="sidebar-auth-tab__intro">{{ t('settings.sidebar.auth.intro') }}</p>

    <form class="sidebar-auth-tab__form" @submit.prevent="handleSave">
      <label class="sidebar-auth-tab__check is-disabled">
        <input type="checkbox" checked disabled />
        <span>
          <strong>{{ t('settings.sidebar.auth.wallet') }}</strong>
          <small>{{ t('settings.sidebar.auth.walletHint') }}</small>
        </span>
      </label>

      <label class="sidebar-auth-tab__check">
        <input v-model="methods.telegram" type="checkbox" :disabled="isSaving" />
        <span>
          <strong>{{ t('settings.sidebar.auth.telegram') }}</strong>
          <small>{{ t('settings.sidebar.auth.telegramHint') }}</small>
        </span>
      </label>

      <label class="sidebar-auth-tab__check">
        <input v-model="methods.email" type="checkbox" :disabled="isSaving" />
        <span>
          <strong>{{ t('settings.sidebar.auth.email') }}</strong>
          <small>{{ t('settings.sidebar.auth.emailHint') }}</small>
        </span>
      </label>

      <label class="sidebar-auth-tab__check">
        <input v-model="methods.password" type="checkbox" :disabled="isSaving" />
        <span>
          <strong>{{ t('settings.sidebar.auth.password') }}</strong>
          <small>{{ t('settings.sidebar.auth.passwordHint') }}</small>
        </span>
      </label>

      <p v-if="saveError" class="alert alert-danger">{{ saveError }}</p>
      <p v-if="saveSuccess" class="alert alert-success">{{ saveSuccess }}</p>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="isSaving">
          {{ isSaving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchSidebarNav, saveSidebarAuthMethods } from '@/services/sidebarNavService';

const { t } = useI18n();

const methods = ref({
  wallet: true,
  telegram: false,
  email: false,
  password: false,
});
const isSaving = ref(false);
const saveError = ref('');
const saveSuccess = ref('');

async function loadSettings() {
  try {
    const data = await fetchSidebarNav();
    methods.value = {
      wallet: true,
      telegram: Boolean(data.authMethods?.telegram),
      email: Boolean(data.authMethods?.email),
      password: Boolean(data.authMethods?.password),
    };
  } catch (error) {
    console.error('[SidebarAuthTab] load failed:', error);
    saveError.value = t('settings.sidebar.auth.loadError');
  }
}

async function handleSave() {
  isSaving.value = true;
  saveError.value = '';
  saveSuccess.value = '';
  try {
    const data = await saveSidebarAuthMethods({
      wallet: true,
      telegram: methods.value.telegram,
      email: methods.value.email,
      password: methods.value.password,
    });
    methods.value = {
      wallet: true,
      telegram: Boolean(data.authMethods?.telegram),
      email: Boolean(data.authMethods?.email),
      password: Boolean(data.authMethods?.password),
    };
    saveSuccess.value = t('settings.sidebar.auth.saved');
  } catch (error) {
    saveError.value = error.response?.data?.error || error.message || t('settings.sidebar.auth.saveError');
  } finally {
    isSaving.value = false;
  }
}

onMounted(loadSettings);
</script>

<style scoped>
.sidebar-auth-tab__intro {
  margin: 0 0 1rem;
  color: #6c757d;
  line-height: 1.5;
  max-width: 720px;
}

.sidebar-auth-tab__form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  max-width: 560px;
}

.sidebar-auth-tab__check {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.65rem 0.75rem;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.sidebar-auth-tab__check.is-disabled {
  opacity: 0.75;
}

.sidebar-auth-tab__check input {
  margin-top: 0.2rem;
}

.sidebar-auth-tab__check span {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.sidebar-auth-tab__check small {
  color: #6c757d;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .sidebar-auth-tab {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
