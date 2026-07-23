<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="join-page">
    <div class="join-card" v-loading="loading">
      <h1>{{ t('contacts.conference.join.title') }}</h1>
      <p v-if="!error">{{ t('contacts.conference.join.working') }}</p>
      <el-alert v-else type="error" :closable="false" show-icon>
        <template #title>{{ error }}</template>
      </el-alert>
      <el-button v-if="error" class="join-home" @click="goHome">
        {{ t('contacts.conference.join.home') }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import conferenceService from '@/services/conferenceService';
import { useAuthContext } from '@/composables/useAuth';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { updateAuth, checkAuth } = useAuthContext();

const loading = ref(true);
const error = ref('');

function goHome() {
  router.replace({ name: 'home' });
}

onMounted(async () => {
  const token = String(route.query.token || '').trim();
  if (!token) {
    error.value = t('contacts.conference.join.missingToken');
    loading.value = false;
    return;
  }

  try {
    const data = await conferenceService.consumeMagicLink(token);

    // Синхронизируем клиентский auth сразу после magic login
    if (data.authenticated && data.userId) {
      await updateAuth({
        authenticated: true,
        authType: data.authType || 'conference_magic',
        userId: data.userId,
        email: data.email || null,
        userAccessLevel: data.userAccessLevel || {
          level: 'user',
          tokenCount: 0,
          hasAccess: false
        }
      });
    } else {
      await checkAuth();
    }

    const redirect = data.redirect;
    if (redirect?.name) {
      await router.replace({
        name: redirect.name,
        params: redirect.params || {},
        query: redirect.query || {}
      });
      return;
    }
    await router.replace({ name: 'personal-messages' });
  } catch (e) {
    error.value = e?.response?.data?.error || t('contacts.conference.join.error');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.join-page {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.join-card {
  max-width: 420px;
  width: 100%;
  text-align: center;
}

.join-card h1 {
  margin: 0 0 10px;
  font-size: 1.35rem;
}

.join-card p {
  margin: 0 0 16px;
  color: var(--color-grey, #606266);
}

.join-home {
  margin-top: 16px;
}
</style>
