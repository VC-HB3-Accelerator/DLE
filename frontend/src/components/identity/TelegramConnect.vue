<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <form class="tg-form-panel" @submit.prevent>
    <div class="tg-header">
      <div>
        <div class="tg-title">{{ t('identity.telegram.title') }}</div>
        <div class="tg-step">{{ t('identity.telegram.deeplinkStep') }}</div>
      </div>
    </div>

    <p class="tg-hint-main">{{ t('identity.telegram.deeplinkHint') }}</p>

    <label class="tg-consent">
      <input v-model="privacyAccepted" type="checkbox" :disabled="isLoading" />
      <span>
        {{ t('auth.consent.prefix') }}
        <a
          :href="privacyDocsUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click.stop
        >{{ t('auth.consent.link') }}</a>
      </span>
    </label>
    <p v-if="consentError" class="tg-error">{{ consentError }}</p>

    <button
      type="button"
      class="tg-open-btn"
      :disabled="!privacyAccepted || isLoading"
      @click="onOpenBot"
    >
      {{ isLoading ? t('common.loading') : t('identity.telegram.openBotButton') }}
    </button>

    <p v-if="botLink && waiting" class="tg-waiting">{{ t('identity.telegram.waitingStart') }}</p>
    <a
      v-if="botLink"
      class="tg-fallback-link"
      :href="botLink"
      target="_blank"
      rel="noopener noreferrer"
    >{{ botLink }}</a>
    <p v-if="error" class="tg-error">{{ error }}</p>

    <button type="button" class="tg-cancel-btn" :disabled="isLoading" @click="$emit('cancel')">
      {{ t('common.cancel') }}
    </button>
  </form>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getPrivacyDocsUrl } from '@/constants/publishedDocs';

const props = defineProps({
  botLink: { type: String, default: '' },
  error: { type: String, default: '' },
  isLoading: { type: Boolean, default: false },
});

const emit = defineEmits(['cancel', 'request-link']);

const { t } = useI18n();
const privacyDocsUrl = getPrivacyDocsUrl();
const privacyAccepted = ref(false);
const consentError = ref('');
const waiting = ref(false);
const awaitingLink = ref(false);
/** Окно, открытое в том же клике (иначе popup-blocker после async init). */
let pendingPopup = null;

function applyBotLink(link) {
  if (!link) return;
  waiting.value = true;
  awaitingLink.value = false;
  if (pendingPopup && !pendingPopup.closed) {
    try {
      pendingPopup.location.href = link;
      pendingPopup = null;
      return;
    } catch (_) {
      /* fall through */
    }
  }
  pendingPopup = null;
  window.open(link, '_blank', 'noopener,noreferrer');
}

watch(
  () => props.botLink,
  (link) => {
    if (link && awaitingLink.value) {
      applyBotLink(link);
    }
  }
);

async function onOpenBot() {
  if (!privacyAccepted.value) {
    consentError.value = t('auth.consent.required');
    return;
  }
  consentError.value = '';

  // Синхронно в gesture пользователя — иначе t.me откроется без ?start=…
  pendingPopup = window.open('about:blank', 'dle_tg_auth');
  if (!pendingPopup) {
    consentError.value = t('identity.telegram.popupBlocked');
  }

  awaitingLink.value = true;
  waiting.value = false;
  // Всегда новый pending (не переиспользуем старый botLink без payload-контекста)
  emit('request-link');
}
</script>

<style scoped>
.tg-form-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.tg-fallback-link {
  font-size: 0.75rem;
  word-break: break-all;
  color: var(--el-color-primary, #409eff);
}

.tg-title {
  font-weight: 600;
  font-size: 1rem;
}

.tg-step {
  font-size: 0.8rem;
  color: var(--color-text-light, #6c757d);
  margin-top: 0.15rem;
}

.tg-hint-main {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.tg-consent {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  font-size: 0.85rem;
  line-height: 1.35;
}

.tg-open-btn {
  border: none;
  cursor: pointer;
  padding: 0.55rem 0.9rem;
  border-radius: var(--radius-sm, 6px);
  background: var(--color-primary, #0d6efd);
  color: #fff;
  font-weight: 500;
}

.tg-open-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.tg-waiting {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-light, #6c757d);
  font-style: italic;
}

.tg-error {
  margin: 0;
  color: var(--color-danger, #dc3545);
  font-size: 0.85rem;
}

.tg-cancel-btn {
  align-self: flex-start;
  background: transparent;
  border: 1px solid var(--color-grey, #adb5bd);
  border-radius: var(--radius-sm, 6px);
  padding: 0.4rem 0.75rem;
  cursor: pointer;
}
</style>
