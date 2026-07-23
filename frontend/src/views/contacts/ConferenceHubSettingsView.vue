<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Настройки multi-конференции на отдельной странице хаба.
-->

<template>
  <div class="hub-settings" v-loading="loading">
    <template v-if="session">
      <el-form class="hub-form" label-position="top" @submit.prevent>
        <el-form-item :label="t('contacts.conference.settings.titleField')">
          <el-input v-model="form.title" maxlength="200" show-word-limit />
        </el-form-item>

        <div class="settings-grid">
          <el-form-item :label="t('contacts.conference.settings.guestLanguage')" required>
            <el-select v-model="form.guest_language" style="width: 100%">
              <el-option
                v-for="lang in languageOptions"
                :key="`g-${lang.value}`"
                :label="lang.label"
                :value="lang.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('contacts.conference.settings.hostLanguage')" required>
            <el-select v-model="form.host_language" style="width: 100%">
              <el-option
                v-for="lang in languageOptions"
                :key="`h-${lang.value}`"
                :label="lang.label"
                :value="lang.value"
              />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item :label="t('contacts.conference.settings.presentationOutline')">
          <el-input v-model="form.presentation_outline" type="textarea" :rows="5" />
        </el-form-item>

        <el-form-item :label="t('contacts.conference.settings.notes')">
          <el-input v-model="form.notes" type="textarea" :rows="2" maxlength="2000" show-word-limit />
        </el-form-item>

        <div class="notify-row">
          <el-checkbox v-model="form.notify_email">
            {{ t('contacts.conference.settings.notifyEmail') }}
          </el-checkbox>
          <el-checkbox v-model="form.notify_telegram">
            {{ t('contacts.conference.settings.notifyTelegram') }}
          </el-checkbox>
        </div>

        <section class="participants-block">
          <h3>{{ t('contacts.conference.participants.title') }}</h3>
          <p class="list-hint">{{ t('contacts.conference.hub.participantsHint') }}</p>
          <ul class="participants-list">
            <li v-for="p in participants" :key="p.user_id" class="participant-row">
              <div class="participant-main">
                <strong>{{ p.name || p.email || `#${p.user_id}` }}</strong>
                <span class="participant-meta">
                  {{ p.role }}
                  <el-tag v-if="p.is_primary" size="small" type="info">
                    {{ t('contacts.conference.hub.realtimeOwner') }}
                  </el-tag>
                </span>
                <span v-if="p.email" class="participant-email">{{ p.email }}</span>
              </div>
              <el-button
                v-if="p.role === 'participant'"
                size="small"
                :loading="inviteUserId === p.user_id"
                @click="inviteParticipant(p.user_id)"
              >
                {{ t('contacts.conference.participants.invite') }}
              </el-button>
            </li>
          </ul>
        </section>

        <el-alert
          v-if="lastMagicLinkUrl"
          type="warning"
          :closable="true"
          show-icon
          class="hub-alert"
          @close="lastMagicLinkUrl = ''"
        >
          <template #title>{{ t('contacts.conference.actions.magicLinkManual') }}</template>
          <code>{{ lastMagicLinkUrl }}</code>
        </el-alert>

        <div class="form-actions">
          <el-button type="primary" :loading="saving" @click="save">
            {{ t('contacts.conference.settings.save') }}
          </el-button>
          <el-button type="success" :loading="connecting" @click="connect">
            {{ t('contacts.conference.actions.connect') }}
          </el-button>
        </div>
      </el-form>
    </template>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import conferenceService from '@/services/conferenceService';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const connecting = ref(false);
const session = ref(null);
const participants = ref([]);
const inviteUserId = ref(null);
const lastMagicLinkUrl = ref('');

const form = reactive({
  title: '',
  guest_language: 'en',
  host_language: 'ru',
  presentation_outline: '',
  notes: '',
  notify_email: true,
  notify_telegram: false
});

const languageOptions = [
  { value: 'ru', label: 'Русский (ru)' },
  { value: 'en', label: 'English (en)' },
  { value: 'de', label: 'Deutsch (de)' },
  { value: 'fr', label: 'Français (fr)' },
  { value: 'es', label: 'Español (es)' },
  { value: 'zh', label: '中文 (zh)' }
];

function applySession(s) {
  session.value = s;
  form.title = s.title || '';
  form.guest_language = s.guest_language || 'en';
  form.host_language = s.host_language || 'ru';
  form.presentation_outline = s.presentation_outline || '';
  form.notes = s.notes || '';
  form.notify_email = Boolean(s.notify_email);
  form.notify_telegram = Boolean(s.notify_telegram);
}

async function load() {
  const id = route.params.sessionId;
  if (!id) return;
  loading.value = true;
  try {
    const data = await conferenceService.getSession(id);
    if (!data.session?.is_multi) {
      ElMessage.warning(t('contacts.conference.hub.notMulti'));
    }
    applySession(data.session);
    const parts = await conferenceService.listParticipants(id);
    participants.value = parts.participants || [];
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.settings.loadError'));
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const data = await conferenceService.updateSessionSettings(route.params.sessionId, {
      title: form.title,
      guest_language: form.guest_language,
      host_language: form.host_language,
      presentation_outline: form.presentation_outline,
      notes: form.notes,
      notify_email: form.notify_email,
      notify_telegram: form.notify_telegram
    });
    applySession(data.session);
    ElMessage.success(t('contacts.conference.settings.saved'));
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.settings.saveError'));
  } finally {
    saving.value = false;
  }
}

async function inviteParticipant(userId) {
  inviteUserId.value = userId;
  lastMagicLinkUrl.value = '';
  try {
    const data = await conferenceService.sendMagicLink(route.params.sessionId, {
      send: true,
      userId,
      email: Boolean(form.notify_email),
      telegram: Boolean(form.notify_telegram)
    });
    if (data.emailed || data.telegramSent) {
      ElMessage.success(t('contacts.conference.actions.magicLinkSent'));
    } else if (data.linkUrl) {
      lastMagicLinkUrl.value = data.linkUrl;
      ElMessage.warning(t('contacts.conference.actions.magicLinkCreated'));
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.actions.magicLinkError'));
  } finally {
    inviteUserId.value = null;
  }
}

async function connect() {
  connecting.value = true;
  try {
    const data = await conferenceService.startSession(route.params.sessionId);
    ElMessage.success(t('contacts.conference.actions.connected'));
    router.push({
      name: 'hub-conference-live',
      params: { sessionId: String(data.session.id) }
    });
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.actions.connectError'));
  } finally {
    connecting.value = false;
  }
}

watch(() => route.params.sessionId, load);
onMounted(load);
</script>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.notify-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 14px;
}

.participants-block {
  margin: 12px 0 16px;
  padding: 12px;
  border: 1px solid var(--color-border, #dcdfe6);
  border-radius: var(--block-radius, 8px);
}

.participants-block h3 {
  margin: 0 0 6px;
}

.list-hint {
  margin: 0 0 10px;
  color: var(--color-grey, #606266);
  font-size: 0.9rem;
}

.participants-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.participant-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border, #ebeef5);
}

.participant-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.participant-meta,
.participant-email {
  font-size: 0.85rem;
  color: var(--color-grey, #606266);
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hub-alert {
  margin-bottom: 12px;
}

@media (max-width: 700px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
