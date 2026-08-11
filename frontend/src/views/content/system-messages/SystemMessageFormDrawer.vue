<!--
  Форма создания/редактирования системного сообщения (drawer)
-->
<template>
  <div v-if="open" class="sm-drawer-overlay" @click.self="emitClose">
    <aside class="sm-drawer" role="dialog" aria-modal="true">
      <header class="sm-drawer__header">
        <h2>{{ isEdit ? t('content.systemMessages.form.editTitle') : t('content.systemMessages.form.createTitle') }}</h2>
        <button type="button" class="sm-drawer__x" @click="emitClose">×</button>
      </header>

      <div class="sm-drawer__body">
        <p v-if="formError" class="sm-error">{{ formError }}</p>

        <!-- Audience -->
        <fieldset class="sm-block">
          <legend>{{ t('content.systemMessages.form.audienceLegend') }}</legend>
          <p class="sm-hint">{{ t('content.systemMessages.form.audienceHint') }}</p>
          <label class="sm-field">
            <span>{{ t('content.systemMessages.form.preset') }}</span>
            <select v-model="form.audience.preset" @change="onPresetChange">
              <option value="guests_and_new_users">{{ t('content.systemMessages.form.presetGuestsNew') }}</option>
              <option value="guests_only">{{ t('content.systemMessages.form.presetGuestsOnly') }}</option>
              <option value="users_by_tags">{{ t('content.systemMessages.form.presetTags') }}</option>
              <option value="users_by_roles">{{ t('content.systemMessages.form.presetRoles') }}</option>
              <option value="users_by_tags_and_roles">{{ t('content.systemMessages.form.presetTagsRoles') }}</option>
              <option value="custom">{{ t('content.systemMessages.form.presetCustom') }}</option>
            </select>
          </label>

          <label class="sm-check">
            <input v-model="form.audience.include_guests" type="checkbox" />
            {{ t('content.systemMessages.form.includeGuests') }}
          </label>
          <label class="sm-check">
            <input v-model="form.audience.include_authenticated" type="checkbox" />
            {{ t('content.systemMessages.form.includeAuth') }}
          </label>
          <label class="sm-check">
            <input v-model="form.audience.use_max_age" type="checkbox" />
            {{ t('content.systemMessages.form.useMaxAge') }}
          </label>
          <label v-if="form.audience.use_max_age" class="sm-field">
            <span>{{ t('content.systemMessages.form.maxAgeHours') }}</span>
            <input v-model.number="maxAgeHours" type="number" min="0" step="0.25" />
          </label>

          <label v-if="showRoles" class="sm-field">
            <span>{{ t('content.systemMessages.form.roles') }}</span>
            <select v-model="form.audience.roles" multiple class="sm-multi">
              <option value="user">{{ t('content.editor.roleUser') }}</option>
              <option value="readonly">{{ t('content.editor.roleReader') }}</option>
              <option value="editor">{{ t('content.editor.roleEditor') }}</option>
            </select>
          </label>

          <label v-if="showTags" class="sm-field">
            <span>{{ t('content.systemMessages.form.tags') }}</span>
            <select v-model="form.audience.tag_ids" multiple class="sm-multi">
              <option v-for="tag in availableTags" :key="tag.id" :value="tag.id">
                {{ tag.name || tag.title || tag.id }}
              </option>
            </select>
          </label>

          <label v-if="showTagMatch" class="sm-field">
            <span>{{ t('content.systemMessages.form.tagMatch') }}</span>
            <select v-model="form.audience.tag_match">
              <option value="any">{{ t('content.systemMessages.form.tagMatchAny') }}</option>
              <option value="all">{{ t('content.systemMessages.form.tagMatchAll') }}</option>
            </select>
          </label>

          <label v-if="showRoleTagLogic" class="sm-field">
            <span>{{ t('content.systemMessages.form.roleTagLogic') }}</span>
            <select v-model="form.audience.role_tag_logic">
              <option value="and">{{ t('content.systemMessages.form.logicAnd') }}</option>
              <option value="or">{{ t('content.systemMessages.form.logicOr') }}</option>
            </select>
          </label>
        </fieldset>

        <!-- Meta -->
        <fieldset class="sm-block">
          <legend>{{ t('content.systemMessages.form.metaLegend') }}</legend>
          <label class="sm-field">
            <span>{{ t('content.systemMessages.form.slug') }}</span>
            <input v-model="form.slug" type="text" required />
            <span class="sm-field-hint">{{ t('content.systemMessages.form.slugHint') }}</span>
          </label>
          <label class="sm-field">
            <span>{{ t('content.systemMessages.form.kind') }}</span>
            <select v-model="form.kind">
              <option value="welcome">{{ t('content.systemMessages.form.kindWelcome') }}</option>
              <option value="generic">{{ t('content.systemMessages.form.kindGeneric') }}</option>
            </select>
          </label>
          <div class="sm-channels">
            <span class="sm-channels-label">{{ t('content.systemMessages.form.channels') }}</span>
            <label class="sm-check">
              <input v-model="form.channels" type="checkbox" value="web" />
              {{ t('content.systemMessages.form.channelWeb') }}
            </label>
            <label class="sm-check">
              <input v-model="form.channels" type="checkbox" value="telegram" />
              {{ t('content.systemMessages.form.channelTelegram') }}
            </label>
            <label class="sm-check">
              <input v-model="form.channels" type="checkbox" value="email" />
              {{ t('content.systemMessages.form.channelEmail') }}
            </label>
          </div>
          <label class="sm-field">
            <span>{{ t('content.systemMessages.form.status') }}</span>
            <select v-model="form.status">
              <option value="draft">{{ t('common.status.draft') }}</option>
              <option value="published">{{ t('common.status.published') }}</option>
            </select>
          </label>
        </fieldset>

        <!-- Locale tabs = язык ТЕКСТА сообщения (не UI — UI в сайдбаре) -->
        <fieldset class="sm-block">
          <legend>{{ t('content.systemMessages.form.contentLegend') }}</legend>
          <p class="sm-hint">{{ t('content.systemMessages.form.contentLangHint') }}</p>
          <div class="sm-tabs">
            <button
              type="button"
              :class="['sm-tab', { active: activeLocale === 'ru' }]"
              @click="activeLocale = 'ru'"
            >
              {{ t('content.systemMessages.form.langRu') }}
            </button>
            <button
              type="button"
              :class="['sm-tab', { active: activeLocale === 'en' }]"
              @click="activeLocale = 'en'"
            >
              {{ t('content.systemMessages.form.langEn') }}
            </button>
          </div>

          <label class="sm-field">
            <span>{{ t('content.systemMessages.form.fieldTitle') }}</span>
            <input v-model="currentI18n.title" type="text" />
          </label>
          <label class="sm-field">
            <span>{{ t('content.systemMessages.form.fieldSummary') }}</span>
            <input v-model="currentI18n.summary" type="text" />
          </label>
          <label class="sm-field">
            <span>{{ t('content.systemMessages.form.fieldContent') }}</span>
            <textarea v-model="currentI18n.content" rows="6" />
          </label>

          <div class="sm-branches">
            <div class="sm-branches__head">
              <strong>{{ t('content.systemMessages.form.branches') }}</strong>
              <button type="button" class="btn outline sm" @click="addBranch">
                {{ t('content.systemMessages.form.addBranch') }}
              </button>
            </div>
            <div
              v-for="(branch, idx) in currentI18n.branches"
              :key="branch._key || branch.id || idx"
              class="sm-branch"
            >
              <label class="sm-branch-field">
                <span>{{ t('content.systemMessages.form.branchUi') }}</span>
                <select v-model="branch.ui">
                  <option value="button">{{ t('content.systemMessages.form.branchUiButton') }}</option>
                  <option value="text">{{ t('content.systemMessages.form.branchUiText') }}</option>
                </select>
              </label>
              <label class="sm-branch-field">
                <span>{{ t('content.systemMessages.form.branchLabel') }}</span>
                <input v-model="branch.label" type="text" />
              </label>
              <label class="sm-branch-field">
                <span>{{ t('content.systemMessages.form.branchPayload') }}</span>
                <input v-model="branch.payload" type="text" />
              </label>
              <label class="sm-branch-field">
                <span>{{ t('content.systemMessages.form.branchAssignTags') }}</span>
                <input
                  :value="(branch.assign_tags || []).join(', ')"
                  type="text"
                  :placeholder="t('content.systemMessages.form.branchAssignTagsHint')"
                  @input="onAssignTagsInput(branch, $event.target.value)"
                />
              </label>
              <label class="sm-branch-field">
                <span>{{ t('content.systemMessages.form.branchAction') }}</span>
                <select v-model="branch.action">
                  <option value="send_user_message">{{ t('content.systemMessages.form.actionSendUser') }}</option>
                  <option value="inline">{{ t('content.systemMessages.form.actionInline') }}</option>
                  <option value="assistant_reply">{{ t('content.systemMessages.form.actionAssistant') }}</option>
                </select>
              </label>
              <button type="button" class="btn text sm sm-branch-remove" @click="removeBranch(idx)">
                {{ t('common.delete') }}
              </button>
            </div>
          </div>
        </fieldset>
      </div>

      <footer class="sm-drawer__footer">
        <button type="button" class="btn outline" :disabled="saving" @click="emitClose">
          {{ t('common.cancel') }}
        </button>
        <button
          v-if="isEdit"
          type="button"
          class="btn destructive"
          :disabled="saving"
          @click="onDelete"
        >
          {{ t('common.delete') }}
        </button>
        <button type="button" class="btn primary" :disabled="saving" @click="onSave">
          {{ saving ? '…' : t('common.save') }}
        </button>
      </footer>
    </aside>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import systemMessagesService from '../../../services/systemMessagesService';
import { loadClientTagsList } from '@/utils/clientTagsTable';

const props = defineProps({
  open: { type: Boolean, default: false },
  messageId: { type: String, default: null },
});

const emit = defineEmits(['close', 'saved', 'deleted']);

const { t } = useI18n();
const saving = ref(false);
const formError = ref('');
const availableTags = ref([]);
const activeLocale = ref('ru');
const locales = ['ru', 'en'];

function emptyI18nBlock() {
  return { title: '', summary: '', content: '', assistant_reply_content: null, branches: [] };
}

function emptyForm() {
  return {
    slug: 'welcome-default',
    kind: 'welcome',
    channels: ['web', 'telegram', 'email'],
    reply_type: 'inline',
    importance: 'info',
    status: 'draft',
    audience: {
      preset: 'guests_and_new_users',
      include_guests: true,
      include_authenticated: true,
      use_max_age: true,
      max_user_age_seconds: 3600,
      roles: [],
      tag_ids: [],
      tag_match: 'any',
      role_tag_logic: 'and',
    },
    max_user_age_seconds: 3600,
    i18n: {
      ru: emptyI18nBlock(),
      en: emptyI18nBlock(),
    },
  };
}

const form = reactive(emptyForm());

const maxAgeHours = computed({
  get() {
    return (form.audience.max_user_age_seconds || 0) / 3600;
  },
  set(v) {
    const hours = Number(v) || 0;
    form.audience.max_user_age_seconds = Math.round(hours * 3600);
    form.max_user_age_seconds = form.audience.max_user_age_seconds;
  },
});

const isEdit = computed(() => Boolean(props.messageId));

const currentI18n = computed(() => {
  if (!form.i18n[activeLocale.value]) {
    form.i18n[activeLocale.value] = emptyI18nBlock();
  }
  return form.i18n[activeLocale.value];
});

const showTags = computed(() =>
  ['users_by_tags', 'users_by_tags_and_roles', 'custom'].includes(form.audience.preset)
);
const showRoles = computed(() =>
  ['users_by_roles', 'users_by_tags_and_roles', 'custom'].includes(form.audience.preset)
);
const showTagMatch = computed(() => showTags.value);
const showRoleTagLogic = computed(() =>
  form.audience.preset === 'users_by_tags_and_roles' || form.audience.preset === 'custom'
);

const PRESET_MAP = {
  guests_only: {
    include_guests: true,
    include_authenticated: false,
    use_max_age: false,
    roles: [],
    tag_ids: [],
  },
  guests_and_new_users: {
    include_guests: true,
    include_authenticated: true,
    use_max_age: true,
    max_user_age_seconds: 3600,
    roles: [],
    tag_ids: [],
  },
  users_by_tags: {
    include_guests: false,
    include_authenticated: true,
    use_max_age: false,
  },
  users_by_roles: {
    include_guests: false,
    include_authenticated: true,
    use_max_age: false,
  },
  users_by_tags_and_roles: {
    include_guests: false,
    include_authenticated: true,
    use_max_age: false,
    role_tag_logic: 'and',
  },
  custom: {},
};

function onPresetChange() {
  const patch = PRESET_MAP[form.audience.preset] || {};
  Object.assign(form.audience, patch, { preset: form.audience.preset });
}

function addBranch() {
  const id = `b${Date.now().toString(36)}`;
  for (const loc of locales) {
    if (!form.i18n[loc]) form.i18n[loc] = emptyI18nBlock();
    form.i18n[loc].branches.push({
      id,
      ui: 'button',
      label: '',
      action: 'send_user_message',
      payload: '',
      assign_tags: [],
      _key: `${id}-${loc}`,
    });
  }
}

function onAssignTagsInput(branch, value) {
  const tags = String(value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  branch.assign_tags = tags;
}

function removeBranch(idx) {
  const id = currentI18n.value.branches[idx]?.id;
  for (const loc of locales) {
    if (!form.i18n[loc]?.branches) continue;
    const i = form.i18n[loc].branches.findIndex((b) => b.id === id);
    if (i >= 0) form.i18n[loc].branches.splice(i, 1);
    else if (loc === activeLocale.value) form.i18n[loc].branches.splice(idx, 1);
  }
}

function emitClose() {
  emit('close');
}

function applyMessage(msg) {
  Object.assign(form, emptyForm());
  form.slug = msg.slug;
  form.kind = msg.kind;
  form.channels = [...(msg.channels || [])];
  form.reply_type = msg.reply_type || 'inline';
  form.importance = msg.importance || 'info';
  form.status = msg.status || 'draft';
  form.audience = {
    ...emptyForm().audience,
    ...(msg.audience || {}),
    roles: [...(msg.audience?.roles || [])],
    tag_ids: [...(msg.audience?.tag_ids || [])],
  };
  form.max_user_age_seconds = msg.max_user_age_seconds || 3600;
  form.i18n = {
    ru: { ...emptyI18nBlock(), ...(msg.i18n?.ru || {}), branches: [...(msg.i18n?.ru?.branches || [])] },
    en: { ...emptyI18nBlock(), ...(msg.i18n?.en || {}), branches: [...(msg.i18n?.en?.branches || [])] },
  };
}

async function load() {
  formError.value = '';
  try {
    availableTags.value = await loadClientTagsList();
  } catch (_) {
    availableTags.value = [];
  }
  if (props.messageId) {
    const msg = await systemMessagesService.getSystemMessage(props.messageId);
    applyMessage(msg);
  } else {
    Object.assign(form, emptyForm());
    form.slug = `msg-${Date.now().toString(36)}`;
  }
}

watch(
  () => [props.open, props.messageId],
  ([open]) => {
    if (open) load();
  }
);

async function onSave() {
  saving.value = true;
  formError.value = '';
  try {
    form.max_user_age_seconds = form.audience.max_user_age_seconds;
    const payload = {
      slug: form.slug,
      kind: form.kind,
      channels: form.channels,
      reply_type: form.reply_type,
      importance: form.importance,
      status: form.status,
      audience: {
        ...form.audience,
        tag_ids: (form.audience.tag_ids || [])
          .map((id) => parseInt(id, 10))
          .filter((n) => Number.isInteger(n) && n > 0),
        roles: (form.audience.roles || []).map(String),
        max_user_age_seconds: form.audience.max_user_age_seconds,
      },
      max_user_age_seconds: form.max_user_age_seconds,
      persist_to_history: false,
      i18n: form.i18n,
    };
    if (isEdit.value) {
      await systemMessagesService.updateSystemMessage(props.messageId, payload);
    } else {
      await systemMessagesService.createSystemMessage(payload);
    }
    emit('saved');
    emitClose();
  } catch (error) {
    formError.value = error?.response?.data?.error || error.message || 'Error';
  } finally {
    saving.value = false;
  }
}

async function onDelete() {
  if (!isEdit.value) return;
  if (!window.confirm(t('content.systemMessages.form.confirmDelete'))) return;
  saving.value = true;
  try {
    await systemMessagesService.deleteSystemMessage(props.messageId);
    emit('deleted');
    emitClose();
  } catch (error) {
    formError.value = error?.response?.data?.error || error.message || 'Error';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.sm-drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 80;
  display: flex;
  justify-content: flex-end;
}
.sm-drawer {
  width: min(520px, 100%);
  height: 100%;
  background: var(--color-surface, #fff);
  color: var(--color-text, #111);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}
.sm-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border, #e5e5e5);
}
.sm-drawer__header h2 {
  margin: 0;
  font-size: 1.1rem;
}
.sm-drawer__x {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
}
.sm-drawer__body {
  flex: 1;
  overflow: auto;
  padding: 1rem 1.25rem 2rem;
}
.sm-drawer__footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--color-border, #e5e5e5);
}
.sm-block {
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 8px;
  padding: 0.75rem 1rem 1rem;
  margin: 0 0 1rem;
}
.sm-block legend {
  padding: 0 0.35rem;
  font-weight: 600;
}
.sm-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.65rem;
}
.sm-field input,
.sm-field select,
.sm-field textarea,
.sm-multi {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 6px;
  font: inherit;
}
.sm-multi {
  min-height: 5rem;
}
.sm-check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}
.sm-hint {
  font-size: 0.85rem;
  opacity: 0.8;
  margin: 0 0 0.75rem;
}
.sm-channels {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 0.75rem;
}
.sm-channels-label {
  width: 100%;
  font-size: 0.9rem;
  margin-bottom: 0.15rem;
}
.sm-field-hint {
  font-size: 0.8rem;
  opacity: 0.75;
}
.sm-tabs {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}
.sm-tab {
  border: 1px solid var(--color-border, #ccc);
  background: transparent;
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
}
.sm-tab.active {
  background: var(--color-primary, #1a1a1a);
  color: #fff;
  border-color: transparent;
}
.sm-branches__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0.75rem 0 0.5rem;
  gap: 0.5rem;
}
.sm-branch {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
  padding: 0.65rem;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 8px;
}
.sm-branch-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
}
.sm-branch-field input,
.sm-branch-field select {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 6px;
  font: inherit;
}
.sm-branch-remove {
  align-self: flex-end;
}
.sm-error {
  color: #b00020;
  margin-bottom: 0.75rem;
}
.btn {
  border-radius: 6px;
  padding: 0.4rem 0.85rem;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
}
.btn.primary {
  background: var(--color-primary, #1a1a1a);
  color: #fff;
}
.btn.outline {
  background: transparent;
  border-color: var(--color-border, #ccc);
}
.btn.destructive {
  background: #b00020;
  color: #fff;
}
.btn.text {
  background: transparent;
  border: none;
}
.btn.sm {
  padding: 0.2rem 0.45rem;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
@media (max-width: 480px) {
  .sm-drawer {
    width: 100%;
  }
}
</style>
