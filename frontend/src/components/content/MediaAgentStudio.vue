<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="work" :class="{ 'work--preview': preview }" @click="onShellClick">
    <aside class="work__rail">
      <div class="work__brand">
        <span class="work__logo">{{ productName }}</span>
        <span class="work__brand-btns">
          <button type="button" :title="t('common.search')" @click="pane = 'skills'">
            <UiGlyph name="search" :size="16" />
          </button>
          <button type="button" :title="t('content.media.agent.newTask')" @click="newTask">
            <UiGlyph name="edit" :size="16" />
          </button>
        </span>
      </div>

      <button
        type="button"
        class="work__nav"
        :class="{ 'is-on': pane === 'home' && !hasThread }"
        @click="newTask"
      >
        <UiGlyph name="edit" :size="16" />
        {{ t('content.media.agent.newTask') }}
      </button>

      <button
        type="button"
        class="work__nav"
        :class="{ 'is-on': pane === 'skills' }"
        @click="pane = 'skills'"
      >
        <UiGlyph name="cube" :size="16" />
        {{ t('content.media.agent.skills') }}
      </button>
      <button
        type="button"
        class="work__nav"
        :class="{ 'is-on': pane === 'connectors' }"
        @click="openConnectors"
      >
        <UiGlyph name="settings" :size="16" />
        {{ t('content.media.agent.connectors') }}
      </button>
      <button
        type="button"
        class="work__nav"
        :class="{ 'is-on': pane === 'drive' }"
        @click="pane = 'drive'"
      >
        <UiGlyph name="folder" :size="16" />
        {{ t('content.media.agent.drive') }}
      </button>

      <button type="button" class="work__recent-toggle" @click="recentOpen = !recentOpen">
        {{ t('content.media.agent.recent') }}
        <UiGlyph :name="recentOpen ? 'chevron-down' : 'chevron-right'" :size="14" />
      </button>
      <button
        v-for="s in recentOpen ? sessions : []"
        :key="s.id"
        type="button"
        class="work__task"
        :class="{ 'is-on': s.id === activeId && pane === 'home' }"
        @click="openSession(s.id)"
      >
        {{ s.title }}
      </button>
    </aside>

    <section class="work__main">
      <template v-if="pane === 'home'">
        <div v-if="!hasThread" class="home">
          <div class="home__hero">
            <div class="home__mascot">
              <img v-if="headerLogoUrl" :src="headerLogoUrl" alt="">
              <span v-else class="home__blob" aria-hidden="true" />
            </div>
            <h1>{{ greeting }}, {{ orgName }}</h1>
            <p>{{ t('content.media.agent.whereStart') }}</p>
          </div>
          <MediaAgentComposer
            v-model="draft"
            :sending="sending"
            :pending-files="pendingFiles"
            :pending-drive="pendingDrive"
            :plus-open="plusOpen"
            :skill-open="skillOpen"
            :installed-skills="installedSkills"
            hero
            @send="send"
            @plus="togglePlus"
            @skills-menu="toggleSkillMenu"
            @add-files="fileRef?.click()"
            @drive="drivePicker = true"
            @open-skills="pane = 'skills'"
            @use-skill="applySkill"
            @remove-file="removeFile"
            @remove-drive="removeDrive"
            @skills-page="pane = 'skills'"
          />
        </div>

        <div v-else class="thread-wrap">
          <header class="thread-wrap__head">
            <h2>{{ current.title }}</h2>
          </header>
          <div ref="threadRef" class="thread">
            <article
              v-for="m in current.messages"
              :key="m.id"
              class="msg"
              :class="`msg--${m.role}`"
            >
              <div v-if="m.role === 'user'" class="msg__pill">{{ m.text }}</div>
              <div v-else class="msg__body">
                <p v-for="(para, i) in splitParas(m.text)" :key="i">{{ para }}</p>
                <p v-if="m.askLabel">{{ m.askLabel }}</p>
                <ul v-if="m.bullets?.length">
                  <li v-for="(b, i) in m.bullets" :key="i">{{ b }}</li>
                </ul>
                <p v-if="m.closing">{{ m.closing }}</p>
                <div v-if="m.actions?.length" class="msg__actions">
                  <span v-for="(a, i) in m.actions" :key="i" class="msg__action">
                    <UiGlyph :name="a.type === 'run_command' ? 'settings' : 'file'" :size="14" />
                    {{ a.label }}
                  </span>
                </div>
                <div v-if="m.questions?.length" class="qcard">
                  <p v-if="m.questionsLocked" class="qcard__flag">{{ t('content.media.agent.answered') }}</p>
                  <div v-for="q in m.questions" :key="q.id" class="qcard__q">
                    <p>{{ q.prompt }}</p>
                    <button
                      v-for="opt in q.options"
                      :key="opt.id"
                      type="button"
                      class="qcard__opt"
                      :class="{ 'is-on': (m.answers || {})[q.id] === opt.id }"
                      :disabled="m.questionsLocked"
                      @click="answerQuestion(m.id, q.id, opt)"
                    >
                      {{ opt.label }}
                      <em v-if="opt.recommended"> ({{ t('content.media.agent.recommended') }})</em>
                    </button>
                  </div>
                </div>
                <div v-if="m.previews?.length" class="thumbs">
                  <button
                    v-for="p in m.previews"
                    :key="p.url"
                    type="button"
                    class="thumb"
                    @click="selectPreview(p)"
                  >
                    <img v-if="p.kind !== 'video'" :src="p.url" alt="">
                    <span v-else><UiGlyph name="play" :size="18" /></span>
                  </button>
                </div>
                <p v-if="m.status === 'generating'" class="status">
                  {{ t('content.media.agent.generating') }}
                </p>
                <p v-if="m.status === 'error'" class="status status--err">{{ m.error }}</p>
              </div>
            </article>
          </div>
          <div class="dock">
            <button type="button" class="dock__files" @click="filesOpen = !filesOpen">
              <UiGlyph name="file" :size="14" />
              {{ t('content.media.agent.allFiles') }}
            </button>
            <div v-if="filesOpen" class="dock__list">
              <button
                v-for="f in sessionFiles"
                :key="f.url"
                type="button"
                @click="selectPreview(f)"
              >{{ f.name }}</button>
              <p v-if="!sessionFiles.length">{{ t('content.media.agent.noFiles') }}</p>
            </div>
          </div>
          <MediaAgentComposer
            v-model="draft"
            :sending="sending"
            :pending-files="pendingFiles"
            :pending-drive="pendingDrive"
            :plus-open="plusOpen"
            :skill-open="skillOpen"
            :installed-skills="installedSkills"
            @send="send"
            @plus="togglePlus"
            @skills-menu="toggleSkillMenu"
            @add-files="fileRef?.click()"
            @drive="drivePicker = true"
            @open-skills="pane = 'skills'"
            @use-skill="applySkill"
            @remove-file="removeFile"
            @remove-drive="removeDrive"
            @skills-page="pane = 'skills'"
          />
        </div>
      </template>

      <MediaAgentSkillsPane v-else-if="pane === 'skills'" @use-skill="applySkill" />

      <div v-else-if="pane === 'connectors'" class="stub">
        <h2>{{ t('content.media.agent.connectors') }}</h2>
        <p>{{ qwenOk
          ? t('content.media.agent.qwenOn')
          : t('content.media.agent.qwenOff') }}</p>
      </div>
      <div v-else-if="pane === 'drive'" class="drive">
        <h2>{{ t('content.media.agent.drive') }}</h2>
        <p>{{ t('content.media.agent.driveLead') }}</p>
        <ContentMediaGrid mode="pick" @select="onDriveSelect" />
      </div>
    </section>

    <aside v-if="preview" class="preview">
      <header>
        <UiGlyph name="file" :size="14" />
        <span>{{ preview.name }}</span>
        <a :href="preview.url" :download="preview.name" :title="t('content.media.agent.download')">
          <UiGlyph name="download" :size="16" />
        </a>
        <button type="button" :title="t('content.media.agent.expand')" @click="expandPreview">
          <UiGlyph name="expand" :size="16" />
        </button>
        <button type="button" :title="t('common.close')" @click="preview = null">
          <UiGlyph name="times" :size="16" />
        </button>
      </header>
      <video
        v-if="preview.kind === 'video'"
        :src="preview.url"
        controls
        playsinline
      />
      <img v-else :src="preview.url" :alt="preview.name">
    </aside>

    <input
      ref="fileRef"
      type="file"
      accept="image/*"
      multiple
      class="work__hidden"
      @change="onFiles"
    >
    <ContentMediaPickerModal
      :open="drivePicker"
      kind="any"
      @cancel="drivePicker = false"
      @select="onDriveSelect"
      @device="onDriveDevice"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import UiGlyph from '@/components/UiGlyph.vue';
import ContentMediaGrid from '@/components/content/ContentMediaGrid.vue';
import ContentMediaPickerModal from '@/components/content/ContentMediaPickerModal.vue';
import MediaAgentSkillsPane from '@/components/content/MediaAgentSkillsPane.vue';
import MediaAgentComposer from '@/components/content/MediaAgentComposer.vue';
import { useSiteBrand } from '@/composables/useSiteBrand';
import {
  fetchMediaAgentJob,
  fetchMediaAgentSkills,
  fetchMediaAgentStatus,
  postMediaAgentTurn,
} from '@/services/mediaAgentService';

const STORAGE_KEY = 'media-agent-sessions-v2';
const { t } = useI18n();
const { headerDescription, headerLogoUrl } = useSiteBrand();

const pane = ref('home');
const recentOpen = ref(true);
const plusOpen = ref(false);
const skillOpen = ref(false);
const filesOpen = ref(false);
const drivePicker = ref(false);
const fileRef = ref(null);
const threadRef = ref(null);
const draft = ref('');
const sending = ref(false);
const pendingFiles = ref([]);
const pendingDrive = ref([]);
const sessions = ref([]);
const activeId = ref('');
const preview = ref(null);
const qwenOk = ref(false);
const installedSkills = ref([]);
let pollTimer = null;

const productName = computed(() => t('content.media.agent.product'));

const orgName = computed(() => {
  const value = String(headerDescription.value || '').trim();
  const part = value.split(/\s+[—–-]\s+/)[0].trim();
  return (part || value || t('content.media.agent.orgFallback')).slice(0, 80);
});

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6 || h >= 22) return t('content.media.agent.goodNight');
  if (h < 12) return t('content.media.agent.goodMorning');
  if (h < 18) return t('content.media.agent.goodAfternoon');
  return t('content.media.agent.goodEvening');
});

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptySession() {
  return {
    id: uid(),
    title: t('content.media.agent.defaultTitle'),
    skillId: '',
    messages: [],
    updatedAt: Date.now(),
  };
}

const current = computed(() => (
  sessions.value.find((s) => s.id === activeId.value) || sessions.value[0] || emptySession()
));

const hasThread = computed(() => (current.value.messages || []).length > 0);

const sessionFiles = computed(() => {
  const out = [];
  for (const m of current.value.messages || []) {
    for (const p of m.previews || []) out.push(p);
  }
  return out;
});

function persist() {
  const slim = sessions.value
    .filter((s) => (s.messages || []).length)
    .map((s) => ({ ...s, messages: (s.messages || []).slice(-40) }))
    .slice(0, 24);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
}

function loadSessions() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(raw) && raw.length) {
      sessions.value = raw;
      activeId.value = raw[0].id;
      return;
    }
  } catch { /* ignore */ }
  const s = emptySession();
  sessions.value = [s];
  activeId.value = s.id;
}

function ensureSession() {
  let s = sessions.value.find((x) => x.id === activeId.value);
  if (!s) {
    s = emptySession();
    sessions.value = [s, ...sessions.value];
    activeId.value = s.id;
  }
  return s;
}

function newTask() {
  const s = emptySession();
  sessions.value = [s, ...sessions.value.filter((x) => (x.messages || []).length)];
  activeId.value = s.id;
  pane.value = 'home';
  preview.value = null;
  draft.value = '';
  pendingFiles.value = [];
  pendingDrive.value = [];
}

function openSession(id) {
  activeId.value = id;
  pane.value = 'home';
  const last = [...(current.value.messages || [])].reverse().find((m) => m.previews?.length);
  preview.value = last?.previews?.[0] || null;
}

function splitParas(text) {
  return String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

function togglePlus() {
  plusOpen.value = !plusOpen.value;
  skillOpen.value = false;
}

function toggleSkillMenu() {
  skillOpen.value = !skillOpen.value;
  plusOpen.value = false;
}

function onShellClick() {
  plusOpen.value = false;
  skillOpen.value = false;
}

function onFiles(ev) {
  const list = Array.from(ev.target.files || []).filter((f) => f.type.startsWith('image/'));
  pendingFiles.value = [...pendingFiles.value, ...list].slice(0, 4);
  plusOpen.value = false;
  ev.target.value = '';
}

function removeFile(i) {
  pendingFiles.value = pendingFiles.value.filter((_, idx) => idx !== i);
}

function removeDrive(i) {
  pendingDrive.value = pendingDrive.value.filter((_, idx) => idx !== i);
}

function onDriveSelect(item) {
  drivePicker.value = false;
  if (!item) return;
  const id = item.id;
  const name = item.file_name || item.filename || 'drive';
  const url = item.url;
  const kind = item.media_type === 'video' ? 'video' : 'image';
  if (kind === 'image' && id) {
    pendingDrive.value = [...pendingDrive.value, { id, name, url }].slice(0, 4);
  } else if (url) {
    draft.value = `${draft.value} ${t('content.media.agent.driveFile', { name })}`.trim();
  }
  pane.value = 'home';
  plusOpen.value = false;
}

function onDriveDevice() {
  drivePicker.value = false;
  fileRef.value?.click();
}

function selectPreview(p) {
  preview.value = p;
}

function expandPreview() {
  if (preview.value?.url) window.open(preview.value.url, '_blank', 'noopener');
}

function skillIntro(skill) {
  if (skill?.id === 'listing-photo' || skill?.name === 'listing-photo') {
    return {
      text: t('content.media.agent.introLead'),
      bullets: [
        t('content.media.agent.intro1'),
        t('content.media.agent.intro2'),
        t('content.media.agent.intro3'),
        t('content.media.agent.intro4'),
      ],
      closing: t('content.media.agent.introClose'),
      askLabel: t('content.media.agent.introAsk'),
    };
  }
  return {
    text: skill?.description || t('content.media.agent.introLead'),
    bullets: [],
  };
}

function applySkill(skill) {
  const s = emptySession();
  s.title = skill.title || skill.name || s.title;
  s.skillId = skill.id || skill.name || '';
  const intro = skillIntro(skill);
  s.messages = [{
    id: uid(),
    role: 'assistant',
    text: intro.text,
    bullets: intro.bullets,
    closing: intro.closing || '',
    askLabel: intro.askLabel || '',
  }];
  sessions.value = [s, ...sessions.value.filter((x) => (x.messages || []).length)];
  activeId.value = s.id;
  pane.value = 'home';
  plusOpen.value = false;
  skillOpen.value = false;
  persist();
}

function historyForApi() {
  return (current.value.messages || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .filter((m) => m.text)
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.text }));
}

function patchMessage(id, patch) {
  const s = sessions.value.find((x) => x.id === activeId.value);
  if (!s) return;
  s.messages = s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
  persist();
}

async function scrollBottom() {
  await nextTick();
  const el = threadRef.value;
  if (el) el.scrollTop = el.scrollHeight;
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollJob(jobId, assistantId) {
  stopPoll();
  const tick = async () => {
    try {
      const data = await fetchMediaAgentJob(jobId);
      const job = data?.job;
      if (!job) return;
      if (job.status === 'done' && job.media) {
        stopPoll();
        const kind = String(job.media.type || job.kind) === 'video' ? 'video' : 'image';
        const item = {
          url: job.media.url,
          kind,
          name: job.media.filename || job.media.originalName || 'ai-media',
        };
        patchMessage(assistantId, { status: 'done', previews: [item] });
        preview.value = item;
        persist();
        scrollBottom();
      } else if (job.status === 'error') {
        stopPoll();
        patchMessage(assistantId, {
          status: 'error',
          error: job.error || t('content.media.agent.genFailed'),
        });
      }
    } catch { /* keep polling */ }
  };
  await tick();
  pollTimer = setInterval(tick, 2500);
}

async function send(opts) {
  const silent = Boolean(opts && opts.silent);
  const text = String((opts && opts.forcedText) ?? draft.value).trim();
  const files = silent ? [] : pendingFiles.value.slice();
  const driveIds = silent ? [] : pendingDrive.value.map((d) => d.id).filter(Boolean);
  if (sending.value || (!text && !files.length && !driveIds.length)) return;
  sending.value = true;
  const s = ensureSession();
  pane.value = 'home';
  if (!silent && !(s.messages || []).some((m) => m.role === 'user') && text) {
    s.title = text.slice(0, 48);
  }
  if (!silent) {
    s.messages.push({
      id: uid(),
      role: 'user',
      text: text || t('content.media.agent.examplesOnly'),
    });
    pendingFiles.value = [];
    pendingDrive.value = [];
  }
  draft.value = '';
  persist();
  await scrollBottom();

  const assistantId = uid();
  s.messages.push({
    id: assistantId,
    role: 'assistant',
    text: '',
    status: 'generating',
  });
  persist();
  await scrollBottom();

  try {
    const data = await postMediaAgentTurn({
      message: text,
      history: silent ? historyForApi() : historyForApi().slice(0, -1),
      files,
      driveIds,
      skillId: s.skillId || '',
    });
    patchMessage(assistantId, {
      text: data.reply || t('content.media.agent.working'),
      status: data.job ? 'generating' : 'done',
      questions: data.questions || [],
      answers: {},
      questionsLocked: false,
      actions: data.actions || [],
    });
    if (data.job?.id) await pollJob(data.job.id, assistantId);
  } catch (e) {
    const msg = e.response?.data?.error || e.message || t('content.media.agent.genFailed');
    patchMessage(assistantId, { text: '', status: 'error', error: msg });
  } finally {
    sending.value = false;
    persist();
    await scrollBottom();
  }
}

async function answerQuestion(messageId, questionId, opt) {
  const s = sessions.value.find((x) => x.id === activeId.value);
  const m = s?.messages.find((x) => x.id === messageId);
  if (!m || m.questionsLocked) return;
  m.answers = { ...(m.answers || {}), [questionId]: opt.id };
  persist();
  const unanswered = (m.questions || []).filter((q) => !m.answers[q.id]);
  if (unanswered.length) return;
  m.questionsLocked = true;
  persist();
  const lines = (m.questions || []).map((q) => {
    const chosen = q.options.find((o) => o.id === m.answers[q.id]);
    return `${q.prompt} ${chosen?.label || ''}`;
  });
  await send({ silent: true, forcedText: lines.join('\n') });
}

async function openConnectors() {
  pane.value = 'connectors';
  try {
    const data = await fetchMediaAgentStatus();
    qwenOk.value = Boolean(data.qwenConfigured);
  } catch {
    qwenOk.value = false;
  }
}

async function loadInstalled() {
  try {
    const data = await fetchMediaAgentSkills();
    installedSkills.value = data.mine || [];
  } catch {
    installedSkills.value = [];
  }
}

watch(activeId, () => scrollBottom());
onMounted(() => {
  loadSessions();
  loadInstalled();
  scrollBottom();
});

onBeforeUnmount(() => stopPoll());
</script>

<style scoped>
.work {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: calc(100vh - 72px);
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.work--preview {
  grid-template-columns: 248px minmax(0, 1fr) minmax(280px, 42%);
}

.work__rail {
  background: #f7f8fa;
  border-right: 1px solid #eef0f3;
  padding: 14px 10px 24px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.work__brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 14px;
}

.work__logo {
  font-weight: 750;
  font-size: 1.05rem;
  color: #111827;
}

.work__brand-btns {
  display: flex;
  gap: 4px;
}

.work__brand-btns button,
.work__nav,
.work__task,
.work__recent-toggle {
  border: 0;
  background: transparent;
  color: #374151;
  cursor: pointer;
  text-align: left;
}

.work__brand-btns button {
  padding: 4px;
  border-radius: 8px;
  color: #6b7280;
}

.work__nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 0.95rem;
}

.work__nav--sub {
  padding-left: 34px;
}

.work__nav.is-on,
.work__task.is-on {
  background: #eceef2;
  font-weight: 600;
}

.work__nav:hover,
.work__task:hover,
.work__recent-toggle:hover {
  background: #eceef2;
}

.work__sub {
  display: flex;
  flex-direction: column;
}

.work__recent-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding: 8px 10px;
  color: #6b7280;
  font-size: 0.9rem;
}

.work__task {
  padding: 7px 10px 7px 12px;
  border-radius: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
  color: #4b5563;
}

.work__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #fff;
}

.home {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px 64px;
}

.home__hero {
  text-align: center;
  margin-bottom: 28px;
}

.home__hero h1 {
  margin: 12px 0 0;
  font-size: 1.7rem;
  font-weight: 750;
  color: #111827;
}

.home__hero p {
  margin: 6px 0 0;
  font-size: 1.7rem;
  font-weight: 750;
  color: #111827;
}

.home__mascot {
  width: 64px;
  height: 64px;
  margin: 0 auto 8px;
}

.home__mascot img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 50%;
}

.home__blob {
  display: block;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #b9f36a, #3ecf4c 62%, #1faa3a);
}

.thread-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.thread-wrap__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 28px 0;
}

.thread-wrap__head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
}

.pro-pill,
.pro-mini {
  font-size: 0.7rem;
  font-weight: 700;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 1px 6px;
  color: #6b7280;
}

.thread {
  flex: 1;
  overflow: auto;
  padding: 12px 24px 8px;
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
}

.msg {
  margin: 14px 0;
}

.msg--user {
  display: flex;
  justify-content: flex-end;
}

.msg__pill {
  background: #f3f4f6;
  border-radius: 18px;
  padding: 10px 16px;
  max-width: 70%;
  color: #111827;
  line-height: 1.45;
}

.msg__body {
  color: #1f2937;
  line-height: 1.55;
}

.msg__body p {
  margin: 0 0 8px;
  white-space: pre-wrap;
}

.msg__body ul {
  margin: 4px 0 8px;
  padding-left: 1.2em;
}

.msg__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 8px 0 12px;
  color: #9ca3af;
  font-size: 0.85rem;
}

.msg__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.qcard {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px 14px;
  margin: 10px 0;
  background: #fff;
}

.qcard__flag {
  margin: 0 0 8px;
  font-size: 0.8rem;
  color: #9ca3af;
}

.qcard__q {
  padding: 8px 0;
  border-top: 1px solid #f3f4f6;
}

.qcard__q p {
  margin: 0 0 6px;
  color: #9ca3af;
  font-size: 0.9rem;
}

.qcard__opt {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: none;
  padding: 4px 0;
  cursor: pointer;
  color: #111827;
  font-weight: 650;
}

.qcard__opt em {
  font-style: normal;
  font-weight: 650;
}

.qcard__opt.is-on {
  color: #111827;
}

.qcard__opt:disabled {
  cursor: default;
}

.thumbs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.thumb {
  width: 72px;
  height: 72px;
  border: 0;
  padding: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #111;
  cursor: pointer;
  color: #fff;
}

.thumb img,
.thumb span {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status {
  color: #6b7280;
  font-size: 0.9rem;
}

.status--err {
  color: #b42318;
}

.dock {
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
  padding: 0 24px 8px;
  position: relative;
}

.dock__files {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.85rem;
}

.dock__list {
  position: absolute;
  bottom: 40px;
  left: 24px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 8px;
  min-width: 220px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  z-index: 5;
}

.dock__list button {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: none;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 8px;
}

.dock__list button:hover {
  background: #f3f4f6;
}

.stub,
.drive {
  padding: 32px 36px;
}

.stub h2,
.drive h2 {
  margin: 0 0 8px;
}

.stub p,
.drive p {
  color: #6b7280;
}

.preview {
  background: #0b0c0f;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.preview header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: #e5e7eb;
  font-size: 0.82rem;
  background: #111827;
}

.preview header span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview header a,
.preview header button {
  color: #d1d5db;
  background: none;
  border: 0;
  cursor: pointer;
  padding: 4px;
}

.preview video,
.preview img {
  width: 100%;
  flex: 1;
  object-fit: contain;
  background: #000;
  max-height: calc(100vh - 140px);
}

.work__hidden {
  display: none;
}

@media (max-width: 900px) {
  .work,
  .work--preview {
    grid-template-columns: 1fr;
  }
  .work__rail {
    border-right: 0;
    border-bottom: 1px solid #eef0f3;
  }
}
</style>
