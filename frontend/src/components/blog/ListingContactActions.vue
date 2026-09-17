<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div
    v-if="visible"
    class="listing-contact"
    :class="{ 'listing-contact--icon': iconOnly }"
    @click.stop
  >
    <template v-if="iconOnly">
      <button
        type="button"
        class="listing-contact__icon-btn"
        :disabled="busy"
        :title="t('blog.listingContact.call')"
        :aria-label="t('blog.listingContact.call')"
        @click="onCall"
      >
        <span class="listing-contact__icon-wrap">
          <BlogGlyph name="phone" />
        </span>
        <span class="listing-contact__text">{{ t('blog.listingContact.call') }}</span>
      </button>
    </template>
    <template v-else>
      <button
        type="button"
        class="btn btn-outline btn-sm listing-contact__btn"
        :disabled="busy"
        @click="onCall"
      >
        {{ t('blog.listingContact.call') }}
      </button>
    </template>
    <p v-if="message && !iconOnly" class="listing-contact__msg">{{ message }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import eventBus from '../../utils/eventBus';
import { useAuthContext } from '../../composables/useAuth';
import listingContactService from '../../services/listingContactService';
import {
  saveListingIntent,
  loadListingIntent,
  clearListingIntent,
} from '../../utils/listingIntent';
import BlogGlyph from './BlogGlyph.vue';

const props = defineProps({
  pageId: { type: Number, required: true },
  pageSlug: { type: String, default: '' },
  ownerUserId: { type: [Number, String], default: null },
  isAuthenticated: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  /** Иконка телефона в стиле ряда лайк/шара/просмотры (карточка ленты) */
  iconOnly: { type: Boolean, default: false },
});

const emit = defineEmits(['visible']);

const { t } = useI18n();
const router = useRouter();
const auth = useAuthContext();

const editorConfigured = ref(false);
const statusLoaded = ref(false);
const busy = ref(false);
const message = ref('');
const intentHandled = ref(false);

const currentUserId = computed(() => {
  const id = Number(auth.userId?.value);
  return Number.isInteger(id) && id > 0 ? id : null;
});

const isOwnListing = computed(() => {
  const owner = Number(props.ownerUserId);
  if (!Number.isInteger(owner) || owner <= 0 || !currentUserId.value) return false;
  return owner === currentUserId.value;
});

const visible = computed(
  () => editorConfigured.value && props.pageId && !isOwnListing.value
);

async function loadStatus() {
  try {
    const data = await listingContactService.getStatus();
    editorConfigured.value = Boolean(data?.editor_configured);
  } catch {
    editorConfigured.value = false;
  } finally {
    statusLoaded.value = true;
  }
}

function bookCallUrl() {
  const q = { page: String(props.pageId) };
  return { path: '/book-call', query: q };
}

function goToBookCall() {
  router.push(bookCallUrl());
}

function onCall() {
  if (!props.isAuthenticated) {
    saveListingIntent({
      page_id: props.pageId,
      slug: props.pageSlug,
      action: 'call',
    });
  } else {
    clearListingIntent();
  }
  goToBookCall();
}

async function resumeIntent() {
  if (!props.isAuthenticated || intentHandled.value || !visible.value) return;
  const intent = loadListingIntent();
  if (!intent || Number(intent.page_id) !== Number(props.pageId)) return;
  intentHandled.value = true;
  clearListingIntent();
  // «Написать» с карточки убрано — старый intent write игнорируем
  if (intent.action === 'call') {
    goToBookCall();
  }
}

function onAuthSuccess() {
  resumeIntent();
}

let unsubAuth = null;

onMounted(() => {
  loadStatus();
  unsubAuth = eventBus.on('auth-success', onAuthSuccess);
});

onBeforeUnmount(() => {
  if (typeof unsubAuth === 'function') unsubAuth();
});

watch(
  () => [props.isAuthenticated, props.pageId, editorConfigured.value],
  () => {
    resumeIntent();
  }
);

watch(
  [visible, statusLoaded],
  () => {
    if (!statusLoaded.value) return;
    emit('visible', visible.value);
  }
);
</script>

<style scoped>
.listing-contact {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.listing-contact--icon {
  flex-wrap: nowrap;
  gap: 0;
}

.listing-contact__btn {
  flex: 0 0 auto;
}

.listing-contact__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  margin: 0;
  padding: 0.2rem 0.35rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  line-height: 1;
  opacity: 0.85;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.listing-contact__icon-btn:hover:not(:disabled) {
  opacity: 1;
  background: rgba(127, 127, 127, 0.12);
}

.listing-contact__icon-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.listing-contact__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25em;
  height: 1.25em;
}

.listing-contact__icon-btn :deep(.blog-glyph) {
  width: 100%;
  height: 100%;
}

.listing-contact--icon .listing-contact__text {
  display: none;
}

.listing-contact__msg {
  flex: 1 1 100%;
  margin: 0;
  font-size: 0.82rem;
  opacity: 0.9;
}
</style>
