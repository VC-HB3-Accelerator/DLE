<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="blog-subscribe-form" @click.stop>
    <p class="blog-subscribe-form__scope">
      {{ t('blog.subscribe.scopeLabel') }}:
      <strong>{{ scopeLabel }}</strong>
    </p>

    <!-- Авторизован — один клик, без ввода идентификаторов -->
    <template v-if="authed">
      <p class="blog-subscribe-form__hint">{{ t('blog.subscribe.authedChannelsHint') }}</p>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="busy"
        @click="subscribeAuthed"
      >
        {{ busy ? t('blog.subscribe.working') : t('blog.subscribe.button') }}
      </button>
    </template>

    <!-- Гость — форма email (нужны контакты) + код -->
    <template v-else-if="!codeSent">
      <form class="blog-subscribe-form__row" @submit.prevent="sendCode">
        <input
          v-model="email"
          type="email"
          class="blog-subscribe-form__input"
          :placeholder="t('blog.subscribe.placeholder')"
          required
          autocomplete="email"
        />
        <button
          type="submit"
          class="btn btn-primary btn-sm"
          :disabled="busy || !privacyConsent"
        >
          {{ busy ? t('blog.subscribe.working') : t('blog.subscribe.sendCode') }}
        </button>
      </form>
      <label class="blog-subscribe-form__consent">
        <input v-model="privacyConsent" type="checkbox" required />
        <span>
          {{ t('blog.subscribe.consentPrefix') }}
          <a
            :href="privacyDocsUrl"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
          >{{ t('blog.subscribe.consentLink') }}</a>
        </span>
      </label>
    </template>

    <template v-else>
      <form class="blog-subscribe-form__row" @submit.prevent="verifyCode">
        <input
          v-model="code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          class="blog-subscribe-form__input"
          :placeholder="t('blog.subscribe.codePlaceholder')"
          required
        />
        <button type="submit" class="btn btn-primary btn-sm" :disabled="busy">
          {{ busy ? t('blog.subscribe.working') : t('blog.subscribe.confirm') }}
        </button>
        <button type="button" class="btn btn-outline btn-sm" :disabled="busy" @click="resetCode">
          {{ t('common.cancel') }}
        </button>
      </form>
      <p class="blog-subscribe-form__hint">{{ t('blog.subscribe.codeHint', { email }) }}</p>
    </template>

    <p v-if="message" class="blog-subscribe-form__msg">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import blogEngagementService from '../../services/blogEngagementService';
import { formatSubscribeFiltersLabel } from '../../services/catalogFiltersService';
import { getPrivacyDocsUrl } from '../../constants/publishedDocs';
import { isAuthenticated as authIsAuthenticated, checkAuth } from '../../composables/useAuth';

const props = defineProps({
  filters: { type: Object, default: () => ({ section: null, attrs: {} }) },
  sourcePageId: { type: [Number, String], default: null },
  /** Может прийти Ref из App — не доверяем, сверяем с singleton. */
  isAuthenticated: { type: [Boolean, Object], default: false },
});

const emit = defineEmits(['done', 'auth-changed']);

const { t } = useI18n();

const email = ref('');
const code = ref('');
const codeSent = ref(false);
const privacyConsent = ref(false);
const busy = ref(false);
const message = ref('');
const privacyDocsUrl = getPrivacyDocsUrl();

const scopeLabel = computed(() =>
  formatSubscribeFiltersLabel(props.filters, t('blog.subscribe.wholeFeed'))
);

/** Реальный флаг сессии, не Ref-объект из props. */
const authed = computed(() => Boolean(authIsAuthenticated.value));

watch(authed, () => {
  message.value = '';
  codeSent.value = false;
});

async function sendCode() {
  if (!email.value.trim()) return;
  if (!privacyConsent.value) {
    message.value = t('blog.subscribe.consentRequired');
    return;
  }
  busy.value = true;
  message.value = '';
  try {
    await blogEngagementService.requestSubscribeCode(email.value.trim(), {
      privacyConsent: true,
      privacyConsentUrl: privacyDocsUrl,
    });
    codeSent.value = true;
    message.value = t('blog.subscribe.codeSent');
  } catch (e) {
    message.value = e?.response?.data?.error || t('blog.subscribe.error');
  } finally {
    busy.value = false;
  }
}

async function verifyCode() {
  if (!code.value.trim()) return;
  busy.value = true;
  message.value = '';
  try {
    const result = await blogEngagementService.verifySubscribe({
      email: email.value.trim(),
      code: code.value.trim(),
      filters: props.filters,
      privacyConsent: true,
      privacyConsentUrl: privacyDocsUrl,
      sourcePageId: props.sourcePageId,
    });
    if (typeof checkAuth === 'function') {
      await checkAuth();
    }
    emit('auth-changed', result);
    message.value = result?.subscription?.already
      ? t('blog.subscribe.already')
      : t('blog.subscribe.success');
    emit('done', result);
    code.value = '';
    codeSent.value = false;
    privacyConsent.value = false;
  } catch (e) {
    message.value = e?.response?.data?.error || t('blog.subscribe.error');
  } finally {
    busy.value = false;
  }
}

async function subscribeAuthed() {
  busy.value = true;
  message.value = '';
  try {
    const result = await blogEngagementService.createSubscription(props.filters, {
      privacyConsentUrl: privacyDocsUrl,
      sourcePageId: props.sourcePageId,
    });
    message.value = result?.subscription?.already
      ? t('blog.subscribe.already')
      : t('blog.subscribe.success');
    emit('done', result);
  } catch (e) {
    const status = e?.response?.status;
    message.value = e?.response?.data?.error || t('blog.subscribe.error');
    if (status === 401) {
      // Сессия на UI «вошёл», API — нет: показать гостевую форму
      await checkAuth?.();
    }
  } finally {
    busy.value = false;
  }
}

function resetCode() {
  codeSent.value = false;
  code.value = '';
  message.value = '';
}
</script>

<style scoped>
.blog-subscribe-form {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.blog-subscribe-form__scope {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary, #555);
}

.blog-subscribe-form__scope strong {
  color: var(--text-primary, #111);
  font-weight: 600;
}

.blog-subscribe-form__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.blog-subscribe-form__input {
  flex: 1 1 10rem;
  min-width: 0;
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  background: var(--bg-primary, #fff);
  color: inherit;
  font-size: 0.9rem;
}

.blog-subscribe-form__consent {
  display: flex;
  gap: 0.45rem;
  align-items: flex-start;
  font-size: 0.8rem;
  color: var(--text-secondary, #555);
  cursor: pointer;
}

.blog-subscribe-form__consent input {
  margin-top: 0.15rem;
}

.blog-subscribe-form__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary, #666);
}

.blog-subscribe-form__msg {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-primary, #222);
}
</style>
