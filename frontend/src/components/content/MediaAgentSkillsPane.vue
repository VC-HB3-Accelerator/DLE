<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="skills-pane">
    <header class="skills-pane__head">
      <div>
        <h2>{{ t('content.media.agent.skillsTitle') }}</h2>
        <p>{{ t('content.media.agent.skillsLead') }}</p>
      </div>
      <div class="skills-pane__tools">
        <label class="skills-pane__search">
          <UiGlyph name="search" :size="16" />
          <input
            v-model="query"
            type="search"
            :placeholder="t('content.media.agent.searchSkills')"
          >
        </label>
        <button type="button" class="skills-pane__add" @click="uploadOpen = true">
          + {{ t('content.media.agent.addSkill') }}
        </button>
      </div>
    </header>

    <div class="skills-pane__tabs">
      <button
        type="button"
        :class="{ 'is-on': tab === 'market' }"
        @click="tab = 'market'"
      >{{ t('content.media.agent.marketplace') }}</button>
      <button
        type="button"
        :class="{ 'is-on': tab === 'mine' }"
        @click="tab = 'mine'"
      >{{ t('content.media.agent.mySkills') }}</button>
    </div>

    <div class="skills-pane__cats">
      <button
        v-for="c in categoryChips"
        :key="c.id"
        type="button"
        class="skills-pane__chip"
        :class="{ 'is-on': category === c.id }"
        @click="category = c.id"
      >{{ c.label }}</button>
    </div>

    <p v-if="error" class="skills-pane__err">{{ error }}</p>

    <div class="skills-pane__grid">
      <article v-for="s in visible" :key="s.id" class="skill-card">
        <div class="skill-card__top">
          <span class="skill-card__badge">{{ s.initials }}</span>
          <div class="skill-card__meta">
            <strong>{{ s.title }}</strong>
            <span>{{ s.author }}</span>
          </div>
          <button
            v-if="tab === 'market'"
            type="button"
            class="skill-card__plus"
            :title="t('content.media.agent.useSkill')"
            @click="onUse(s)"
          >+</button>
          <button
            v-else
            type="button"
            class="skill-card__plus"
            :title="t('content.media.agent.useSkill')"
            @click="emit('use-skill', s)"
          >+</button>
        </div>
        <p>{{ s.description }}</p>
        <button
          v-if="tab === 'mine' && s.source === 'user'"
          type="button"
          class="skill-card__del"
          @click="onDelete(s)"
        >{{ t('common.delete') }}</button>
      </article>
    </div>

    <p v-if="!visible.length && !loading" class="skills-pane__empty">
      {{ t('content.media.agent.skillsEmpty') }}
    </p>

    <div v-if="uploadOpen" class="skills-modal" @click.self="uploadOpen = false">
      <div class="skills-modal__box" role="dialog">
        <header>
          <h3>{{ t('content.media.agent.uploadTitle') }}</h3>
          <button type="button" @click="uploadOpen = false">
            <UiGlyph name="times" :size="16" />
          </button>
        </header>
        <label class="skills-modal__drop">
          <UiGlyph name="file" :size="28" />
          <span>{{ t('content.media.agent.uploadDrop') }}</span>
          <input
            type="file"
            accept=".zip,.md,text/markdown,application/zip"
            @change="onPick"
          >
        </label>
        <div class="skills-modal__req">
          <p>{{ t('content.media.agent.uploadReqTitle') }}</p>
          <ul>
            <li>{{ t('content.media.agent.uploadReq1') }}</li>
            <li>{{ t('content.media.agent.uploadReq2') }}</li>
          </ul>
        </div>
        <footer>
          <button type="button" @click="uploadOpen = false">{{ t('common.cancel') }}</button>
          <button
            type="button"
            class="is-primary"
            :disabled="!pendingFile || uploading"
            @click="onUpload"
          >{{ t('content.media.agent.install') }}</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import UiGlyph from '@/components/UiGlyph.vue';
import {
  deleteMediaAgentSkill,
  fetchMediaAgentSkills,
  installMediaAgentSkill,
  uploadMediaAgentSkill,
} from '@/services/mediaAgentService';

const emit = defineEmits(['use-skill']);
const { t } = useI18n();

const tab = ref('market');
const category = ref('all');
const query = ref('');
const loading = ref(false);
const error = ref('');
const marketplace = ref([]);
const mine = ref([]);
const uploadOpen = ref(false);
const pendingFile = ref(null);
const uploading = ref(false);

const categoryChips = computed(() => ([
  { id: 'all', label: t('common.all') },
  { id: 'content', label: t('content.media.agent.catContent') },
  { id: 'visual', label: t('content.media.agent.catVisual') },
  { id: 'data', label: t('content.media.agent.catData') },
  { id: 'research', label: t('content.media.agent.catResearch') },
  { id: 'productivity', label: t('content.media.agent.catProductivity') },
]));

const source = computed(() => (tab.value === 'mine' ? mine.value : marketplace.value));

const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return source.value.filter((s) => {
    if (category.value !== 'all' && s.category !== category.value) return false;
    if (!q) return true;
    return `${s.title} ${s.name} ${s.description} ${s.author}`.toLowerCase().includes(q);
  });
});

async function reload() {
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchMediaAgentSkills();
    marketplace.value = data.marketplace || [];
    mine.value = data.mine || [];
  } catch (e) {
    error.value = e.response?.data?.error || e.message || t('content.media.agent.skillsLoadError');
  } finally {
    loading.value = false;
  }
}

async function onUse(skill) {
  try {
    if (!skill.installed) await installMediaAgentSkill(skill.id);
    emit('use-skill', skill);
    await reload();
  } catch (e) {
    error.value = e.response?.data?.error || e.message;
  }
}

async function onDelete(skill) {
  try {
    await deleteMediaAgentSkill(skill.id);
    await reload();
  } catch (e) {
    error.value = e.response?.data?.error || e.message;
  }
}

function onPick(ev) {
  pendingFile.value = ev.target.files?.[0] || null;
  ev.target.value = '';
}

async function onUpload() {
  if (!pendingFile.value) return;
  uploading.value = true;
  error.value = '';
  try {
    await uploadMediaAgentSkill(pendingFile.value);
    pendingFile.value = null;
    uploadOpen.value = false;
    tab.value = 'mine';
    await reload();
  } catch (e) {
    error.value = e.response?.data?.error || e.message || t('content.media.agent.uploadFailed');
  } finally {
    uploading.value = false;
  }
}

onMounted(reload);
</script>

<style scoped>
.skills-pane {
  padding: 28px 36px 48px;
  max-width: 1100px;
}

.skills-pane__head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.skills-pane__head h2 {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 700;
  color: #111827;
}

.skills-pane__head p {
  margin: 6px 0 0;
  color: #6b7280;
}

.skills-pane__tools {
  display: flex;
  gap: 10px;
  align-items: center;
}

.skills-pane__search {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 8px 14px;
  background: #fff;
  color: #9ca3af;
}

.skills-pane__search input {
  border: 0;
  outline: none;
  font: inherit;
  min-width: 180px;
}

.skills-pane__add {
  border: 0;
  background: #111827;
  color: #fff;
  border-radius: 999px;
  padding: 9px 16px;
  font-weight: 600;
  cursor: pointer;
}

.skills-pane__tabs {
  display: flex;
  gap: 18px;
  margin: 22px 0 14px;
  font-weight: 650;
}

.skills-pane__tabs button {
  border: 0;
  background: none;
  padding: 0 0 8px;
  cursor: pointer;
  color: #9ca3af;
  box-shadow: inset 0 -2px 0 transparent;
}

.skills-pane__tabs .is-on {
  color: #111827;
  box-shadow: inset 0 -2px 0 #111827;
}

.skills-pane__cats {
  display: flex;
  gap: 8px;
  overflow: auto;
  padding-bottom: 8px;
}

.skills-pane__chip {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
  white-space: nowrap;
  color: #374151;
}

.skills-pane__chip.is-on {
  background: #f3f4f6;
  border-color: #d1d5db;
  font-weight: 600;
}

.skills-pane__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.skill-card {
  border: 1px solid #ececec;
  border-radius: 16px;
  padding: 16px;
  background: #fff;
}

.skill-card__top {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.skill-card__badge {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #374151;
}

.skill-card__meta {
  flex: 1;
  min-width: 0;
}

.skill-card__meta strong {
  display: block;
  color: #111827;
}

.skill-card__meta span {
  font-size: 0.8rem;
  color: #9ca3af;
}

.skill-card__plus {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
}

.skill-card p {
  margin: 10px 0 0;
  color: #6b7280;
  font-size: 0.9rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.skill-card__del {
  margin-top: 10px;
  border: 0;
  background: none;
  color: #b42318;
  cursor: pointer;
  font-size: 0.8rem;
}

.skills-pane__empty,
.skills-pane__err {
  color: #6b7280;
  margin-top: 24px;
}

.skills-pane__err {
  color: #b42318;
}

.skills-modal {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
}

.skills-modal__box {
  width: min(480px, calc(100vw - 32px));
  background: #fff;
  border-radius: 16px;
  padding: 18px 18px 16px;
}

.skills-modal__box header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skills-modal__box h3 {
  margin: 0;
  font-size: 1.05rem;
}

.skills-modal__box header button {
  border: 0;
  background: none;
  cursor: pointer;
}

.skills-modal__drop {
  margin-top: 14px;
  border: 1px dashed #d1d5db;
  border-radius: 12px;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #6b7280;
  cursor: pointer;
}

.skills-modal__drop input {
  display: none;
}

.skills-modal__req {
  margin-top: 14px;
  font-size: 0.9rem;
}

.skills-modal__req p {
  margin: 0 0 6px;
  font-weight: 650;
}

.skills-modal__req ul {
  margin: 0;
  padding-left: 18px;
  color: #6b7280;
}

.skills-modal__box footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.skills-modal__box footer button {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
}

.skills-modal__box footer .is-primary {
  background: #f3f4f6;
  border-color: #e5e7eb;
  color: #9ca3af;
}

.skills-modal__box footer .is-primary:not(:disabled) {
  background: #111827;
  border-color: #111827;
  color: #fff;
}
</style>
