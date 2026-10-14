<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div
    class="work"
    :class="{ 'work--preview': preview, 'work--embedded': showAiToggle || hideComposer }"
    @click="onShellClick"
  >
    <aside class="work__rail">
      <div class="work__brand">
        <span class="work__logo">{{ productName }}</span>
        <span class="work__brand-btns">
          <button
            v-if="showAiToggle"
            type="button"
            class="work__ai"
            :class="{ 'is-on': aiActive }"
            :title="t('chat.aiOrchestratorToggle')"
            @click="$emit('toggle-ai')"
          >
            AI
          </button>
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
      <button
        type="button"
        class="work__nav"
        :class="{ 'is-on': pane === 'jobs' }"
        @click="openJobs"
      >
        <UiGlyph name="file" :size="16" />
        {{ t('content.media.agent.jobs') }}
      </button>

      <button type="button" class="work__recent-toggle" @click="recentOpen = !recentOpen">
        {{ t('content.media.agent.recent') }}
        <span v-if="sessionsWithHistory.length" class="work__recent-count">{{ sessionsWithHistory.length }}</span>
        <UiGlyph :name="recentOpen ? 'chevron-down' : 'chevron-right'" :size="14" />
      </button>
      <div
        v-for="s in recentOpen ? sessionsWithHistory : []"
        :key="s.id"
        class="work__task"
        :class="{ 'is-on': s.id === activeId && pane === 'home' }"
        role="button"
        tabindex="0"
        @click="openSession(s.id)"
        @keydown.enter.prevent="openSession(s.id)"
      >
        <span class="work__task-title">{{ s.title }}</span>
        <button
          type="button"
          class="work__task-del"
          :title="t('content.media.agent.deleteTask')"
          @click.stop.prevent="deleteSession(s.id)"
        >
          <UiGlyph name="times" :size="12" />
        </button>
      </div>
    </aside>

    <section class="work__main">
      <template v-if="pane === 'home'">
        <div v-if="!hasThread" class="home">
          <MediaAgentComposer
            v-if="!hideComposer"
            v-model="draft"
            :sending="sending"
            :pending-files="pendingFiles"
            :pending-drive="pendingDrive"
            :pending-csv="pendingCsv"
            :owner-label="ownerLabel"
            :can-pick-owner="false"
            :plus-open="plusOpen"
            :skill-open="skillOpen"
            :installed-skills="installedSkills"
            hero
            @send="send"
            @plus="togglePlus"
            @skills-menu="toggleSkillMenu"
            @add-files="fileRef?.click()"
            @add-csv="csvRef?.click()"
            @drive="drivePicker = true"
            @open-skills="pane = 'skills'"
            @use-skill="applySkill"
            @remove-file="removeFile"
            @remove-drive="removeDrive"
            @remove-csv="pendingCsv = null"
            @skills-page="pane = 'skills'"
            @pick-owner="ownerOpen = true"
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
                <div v-if="m.filePreview?.columns?.length" class="preview">
                  <strong>{{ t('content.media.agent.filePreviewTitle') }}</strong>
                  <p class="preview__hint">{{ t('content.media.agent.filePreviewHint') }}</p>
                  <p v-if="m.filePreview.table_name" class="preview__name">{{ m.filePreview.table_name }}</p>
                  <div class="preview__table">
                    <table>
                      <thead>
                        <tr>
                          <th v-for="col in m.filePreview.columns" :key="col">
                            {{ col }}
                            <em
                              v-if="(m.filePreview.column_meta || []).find((c) => c.name === col)?.role === 'enrich'"
                              class="preview__enrich"
                            >{{ t('content.media.agent.filePreviewEnrich') }}</em>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(row, ri) in (m.filePreview.rows || []).slice(0, 12)" :key="ri">
                          <td v-for="col in m.filePreview.columns" :key="col">{{ row[col] }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <button
                    v-if="!m.tableWritten"
                    type="button"
                    class="brief__open"
                    :disabled="sending"
                    @click="openTableForm(m)"
                  >
                    {{ t('content.media.agent.filePreviewOpenEmpty') }}
                  </button>
                  <button
                    v-if="!m.tableWritten"
                    type="button"
                    class="preview__write"
                    :disabled="sending"
                    @click="commitFilePreview(m)"
                  >
                    {{ t('content.media.agent.filePreviewWrite') }}
                  </button>
                  <p v-else class="preview__done">{{ t('content.media.agent.filePreviewWritten') }}</p>
                  <button
                    v-if="m.tableWritten && m.tableId"
                    type="button"
                    class="brief__open"
                    @click="openTableForm(m)"
                  >
                    {{ t('content.media.agent.filePreviewOpenDraft') }}
                  </button>
                  <button
                    v-if="m.tableWritten && m.tableId && !m.enrichApplied"
                    type="button"
                    class="preview__write"
                    :disabled="sending"
                    @click="proposeTableEnrich(m)"
                  >
                    {{ t('content.media.agent.enrichSearch') }}
                  </button>
                </div>
                <div
                  v-if="m.tableId && !m.filePreview?.columns?.length && !m.enrichApplied"
                  class="preview"
                >
                  <button
                    type="button"
                    class="brief__open"
                    @click="openTableForm(m)"
                  >
                    {{ t('content.media.agent.filePreviewOpenDraft') }}
                  </button>
                  <button
                    type="button"
                    class="preview__write"
                    :disabled="sending"
                    @click="proposeTableEnrich(m)"
                  >
                    {{ t('content.media.agent.enrichSearch') }}
                  </button>
                </div>
                <div v-if="m.enrichDiff?.length" class="enrich">
                  <strong>{{ t('content.media.agent.enrichTitle') }}</strong>
                  <p class="preview__hint">{{ t('content.media.agent.enrichHint') }}</p>
                  <ul>
                    <li v-for="(d, i) in m.enrichDiff" :key="i">
                      {{ d.column }}: {{ d.after }}
                      <a
                        v-if="d.source?.url"
                        :href="d.source.url"
                        target="_blank"
                        rel="noreferrer"
                      >{{ d.source.title || d.source.url }}</a>
                    </li>
                  </ul>
                  <button
                    v-if="m.tableId && !m.enrichApplied && enrichWritable(m.enrichDiff)"
                    type="button"
                    class="preview__write"
                    :disabled="sending"
                    @click="applyTableEnrich(m)"
                  >
                    {{ t('content.media.agent.enrichWrite') }}
                  </button>
                  <p v-else-if="m.enrichApplied" class="preview__done">{{ t('content.media.agent.enrichWritten') }}</p>
                </div>
                <div v-if="(m.cardBrief?.kind === 'listing' || m.cardBrief?.kind === 'store') && !m.filePreview?.columns?.length" class="brief">
                  <strong>{{ t('content.media.agent.briefTitle') }}</strong>
                  <p class="brief__hint">{{ t('content.media.agent.briefHint') }}</p>
                  <label>
                    {{ t('content.media.agent.briefTitleField') }}
                    <input
                      :value="m.cardBrief.title"
                      :disabled="Boolean(m.cardDraftId) || sending"
                      @input="setBriefField(m, 'title', $event.target.value)"
                    >
                  </label>
                  <label>
                    {{ t('content.media.agent.briefExcerpt') }}
                    <textarea
                      :value="m.cardBrief.excerpt"
                      :disabled="Boolean(m.cardDraftId) || sending"
                      rows="2"
                      @input="setBriefField(m, 'excerpt', $event.target.value)"
                    />
                  </label>
                  <label>
                    {{ t('content.media.agent.briefDescription') }}
                    <textarea
                      :value="m.cardBrief.description"
                      :disabled="Boolean(m.cardDraftId) || sending"
                      rows="3"
                      @input="setBriefField(m, 'description', $event.target.value)"
                    />
                  </label>
                  <template v-if="m.cardBrief.kind === 'store'">
                    <label>
                      {{ t('content.media.agent.briefPrice') }}
                      <input
                        :value="m.cardBrief.store?.price_units"
                        :disabled="Boolean(m.cardDraftId) || sending"
                        @input="setBriefStoreField(m, 'price_units', $event.target.value)"
                      >
                    </label>
                    <label>
                      {{ t('content.media.agent.briefToken') }}
                      <input
                        :value="m.cardBrief.store?.pay_token_address"
                        :disabled="Boolean(m.cardDraftId) || sending"
                        @input="setBriefStoreField(m, 'pay_token_address', $event.target.value)"
                      >
                    </label>
                  </template>
                  <button
                    type="button"
                    class="brief__open"
                    :disabled="sending"
                    @click="openCardForm(m)"
                  >
                    {{ m.cardDraftId
                      ? t('content.media.agent.briefOpenDraft')
                      : t('content.media.agent.briefOpenEmpty') }}
                  </button>
                  <button
                    v-if="!m.cardDraftId"
                    type="button"
                    class="brief__write"
                    :disabled="sending"
                    @click="commitCardDraft(m)"
                  >
                    {{ t('content.media.agent.briefWrite') }}
                  </button>
                  <p v-else class="brief__done">
                    {{ t('content.media.agent.briefWritten', { id: m.cardDraftId }) }}
                  </p>
                  <button
                    v-if="m.cardDraftId && !m.cardPublished"
                    type="button"
                    class="brief__write"
                    :disabled="sending"
                    @click="publishCardDraft(m)"
                  >
                    {{ t('content.media.agent.briefPublish') }}
                  </button>
                  <p v-else-if="m.cardPublished" class="brief__done">
                    {{ t('content.media.agent.briefPublished', { status: m.cardPublishStatus }) }}
                  </p>
                </div>
                <div v-if="m.mediaPlan" class="media-plan">
                  <strong>{{ t('content.media.agent.mediaPlanTitle') }}</strong>
                  <p class="media-plan__hint">{{ t('content.media.agent.mediaPlanHint') }}</p>
                  <ul v-if="m.mediaPlan.slots?.length">
                    <li v-for="slot in m.mediaPlan.slots" :key="slot.id">
                      <span>{{ slot.id }}</span>
                      <em>{{ slot.status }}</em>
                      <p>{{ slot.prompt }}</p>
                    </li>
                  </ul>
                  <button
                    v-if="!m.mediaPlan.ready"
                    type="button"
                    class="media-plan__btn"
                    :disabled="sending"
                    @click="planCardMedia(m)"
                  >
                    {{ t('content.media.agent.mediaPlanAsk') }}
                  </button>
                </div>
                <div v-if="m.sources?.length" class="sources">
                  <strong>{{ t('content.media.agent.sourcesTitle') }}</strong>
                  <p class="sources__hint">{{ t('content.media.agent.sourcesHint') }}</p>
                  <ul>
                    <li v-for="(src, si) in m.sources" :key="src.url || si">
                      <span class="sources__sys">{{ src.system }}</span>
                      <a
                        v-if="src.url"
                        :href="src.url"
                        target="_blank"
                        rel="noopener noreferrer"
                      >{{ src.title || src.url }}</a>
                      <span v-else>{{ src.title || t('content.media.agent.sourcesKnowledge') }}</span>
                      <time v-if="src.fetched_at">{{ formatSourceDate(src.fetched_at) }}</time>
                    </li>
                  </ul>
                </div>
                <div v-if="m.options?.length" class="options">
                  <strong>{{ t('content.media.agent.optionsTitle') }}</strong>
                  <p class="options__hint">{{ t('content.media.agent.optionsHint') }}</p>
                  <button
                    v-for="opt in m.options"
                    :key="opt.id"
                    type="button"
                    class="options__card"
                    :class="{ 'is-on': m.selectedOptionId === opt.id }"
                    :disabled="m.optionsLocked || sending"
                    @click="choosePlanOption(m, opt)"
                  >
                    <span class="options__title">{{ opt.title }}</span>
                    <span class="options__sum">{{ opt.summary }}</span>
                    <span v-if="opt.cost_hint" class="options__cost">
                      {{ t('content.media.agent.optionCost', { hint: opt.cost_hint }) }}
                    </span>
                    <em>{{ t('content.media.agent.optionChoose') }}</em>
                  </button>
                </div>
                <div v-if="visibleQuestions(m).length" class="qcard">
                  <p v-if="m.questionsLocked" class="qcard__flag">{{ t('content.media.agent.answered') }}</p>
                  <div v-for="q in visibleQuestions(m)" :key="q.id" class="qcard__q">
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
                <MediaAgentBatchPanel
                  v-if="m.batch?.id"
                  :batch="m.batch"
                  @update:batch="(b) => onBatchUpdate(m.id, b)"
                  @preview="selectPreview"
                />
                <MediaAgentPoolGrid
                  v-else-if="m.pool?.photos?.length"
                  :pool="m.pool"
                  @update:pool="(p) => onPoolUpdate(m.id, p)"
                  @preview="selectPreview"
                />
                <p v-if="m.status === 'generating'" class="status">
                  {{ t('content.media.agent.generating') }}
                </p>
                <p v-if="m.status === 'error'" class="status status--err">{{ m.error }}</p>
              </div>
            </article>
          </div>
          <MediaAgentComposer
            v-if="!hideComposer"
            v-model="draft"
            :sending="sending"
            :pending-files="pendingFiles"
            :pending-drive="pendingDrive"
            :pending-csv="pendingCsv"
            :owner-label="ownerLabel"
            :can-pick-owner="false"
            :plus-open="plusOpen"
            :skill-open="skillOpen"
            :installed-skills="installedSkills"
            @send="send"
            @plus="togglePlus"
            @skills-menu="toggleSkillMenu"
            @add-files="fileRef?.click()"
            @add-csv="csvRef?.click()"
            @drive="drivePicker = true"
            @open-skills="pane = 'skills'"
            @use-skill="applySkill"
            @remove-file="removeFile"
            @remove-drive="removeDrive"
            @remove-csv="pendingCsv = null"
            @skills-page="pane = 'skills'"
            @pick-owner="ownerOpen = true"
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
      <div v-else-if="pane === 'jobs'" class="jobs">
        <h2>{{ t('content.media.agent.jobs') }}</h2>
        <p v-if="jobsError" class="jobs__error">{{ jobsError }}</p>
        <p v-else-if="!jobs.length">{{ t('content.media.agent.jobsEmpty') }}</p>
        <button
          v-for="job in jobs"
          :key="job.id"
          type="button"
          class="jobs__row"
        >
          <strong>{{ job.kind || job.id }}</strong>
          <span>{{ job.status }} · {{ job.run_mode || '—' }}</span>
        </button>
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
      accept="image/*,.csv,.tsv,.txt,.pdf,.xlsx,.xls"
      multiple
      class="work__hidden"
      @change="onFiles"
    >
    <input
      ref="csvRef"
      type="file"
      accept=".csv,text/csv,text/plain"
      class="work__hidden"
      @change="onCsv"
    >
    <div v-if="ownerOpen" class="owner-pick" @click.self="ownerOpen = false">
      <div class="owner-pick__card">
        <strong>{{ t('content.media.agent.ownerLabel') }}</strong>
        <input
          v-model="ownerQuery"
          type="search"
          :placeholder="t('content.media.agent.ownerSearch')"
          @input="searchOwners"
        >
        <button type="button" class="owner-pick__row" @click="pickOwner(sessionUserId)">
          {{ t('content.media.agent.ownerMe', { id: sessionUserId || '—' }) }}
        </button>
        <button
          v-for="hit in ownerHits"
          :key="hit.id"
          type="button"
          class="owner-pick__row"
          @click="pickOwner(hit.id)"
        >
          {{ hit.label }}
        </button>
      </div>
    </div>
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
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import UiGlyph from '@/components/UiGlyph.vue';
import ContentMediaGrid from '@/components/content/ContentMediaGrid.vue';
import ContentMediaPickerModal from '@/components/content/ContentMediaPickerModal.vue';
import MediaAgentSkillsPane from '@/components/content/MediaAgentSkillsPane.vue';
import MediaAgentComposer from '@/components/content/MediaAgentComposer.vue';
import MediaAgentPoolGrid from '@/components/content/MediaAgentPoolGrid.vue';
import MediaAgentBatchPanel from '@/components/content/MediaAgentBatchPanel.vue';
import { useAuthContext } from '@/composables/useAuth';
import contactsService from '@/services/contactsService';
import {
  cancelMediaAgentJob,
  createMediaAgentSession,
  startFreshMediaAgentSession,
  resumeMediaAgentSession,
  deleteMediaAgentSession,
  fetchListingBatches,
  fetchMediaAgentJob,
  fetchMediaAgentJobs,
  fetchMediaAgentSessions,
  fetchMediaAgentSkills,
  fetchMediaAgentStatus,
  postMediaAgentTurn,
  saveMediaAgentSession,
  chooseOrchestratorPlan,
  execOrchestratorTool,
} from '@/services/mediaAgentService';

function cardEditorPath(kind, id) {
  const draftId = id == null || id === '' ? '' : String(id);
  if (kind === 'store') {
    return draftId ? `/content/store/product/${draftId}` : '/content/store/product/new';
  }
  return draftId
    ? `/content/create?edit=${encodeURIComponent(draftId)}`
    : '/content/create?visibility=public&show_in_blog=1';
}

function tableEditorPath(id) {
  const draftId = id == null || id === '' ? '' : String(id);
  return draftId ? `/tables/${draftId}` : '/tables/create';
}

function openTableForm(message) {
  const path = message?.tableId
    ? tableEditorPath(message.tableId)
    : (message?.filePreview?.editor_path || tableEditorPath(null));
  router.push(path);
}

function openCardForm(message) {
  const kind = message?.cardBrief?.kind || message?.cardDraftKind || 'listing';
  const path = message?.cardDraftId
    ? cardEditorPath(kind, message.cardDraftId)
    : (message?.formPath || cardEditorPath(kind, null));
  router.push(path);
}

const props = defineProps({
  /** Contact user id — history scoped by contact in DB; empty = studio */
  storageNamespace: { type: String, default: '' },
  showAiToggle: { type: Boolean, default: false },
  aiActive: { type: Boolean, default: false },
  /** Скрыть свой композер — ввод идёт из ChatInterface контакта */
  hideComposer: { type: Boolean, default: false },
});
defineEmits(['toggle-ai']);

const LEGACY_STORAGE_BASE = 'media-agent-sessions-v2';

const contactId = computed(() => {
  const raw = String(props.storageNamespace || '').trim();
  if (!raw || raw.startsWith('guest_')) return '';
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? String(n) : '';
});

const { t } = useI18n();
const router = useRouter();
const { userId: sessionUserId } = useAuthContext();

const pane = ref('home');
const jobs = ref([]);
const jobsError = ref('');
const recentOpen = ref(true);
const plusOpen = ref(false);
const skillOpen = ref(false);
const drivePicker = ref(false);
const fileRef = ref(null);
const csvRef = ref(null);
const threadRef = ref(null);
const draft = ref('');
const sending = ref(false);
const pendingFiles = ref([]);
const pendingDrive = ref([]);
const pendingCsv = ref(null);
const ownerOpen = ref(false);
const ownerQuery = ref('');
const ownerHits = ref([]);
const targetOwnerUserId = ref(null);
let ownerSearchTimer = null;
const sessions = ref([]);
const activeId = ref('');
const preview = ref(null);
const qwenOk = ref(false);
const installedSkills = ref([]);
let pollTimer = null;
let persistTimer = null;
let persistSeq = 0;
/** Очередь turn'ов, пока идёт генерация / другой turn */
const turnQueue = [];
let activeJobId = null;
let activeAssistantId = null;
let interruptRequested = false;
let drainingQueue = false;

const productName = computed(() => t('content.media.agent.product'));
const SERVER_SESSION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isServerSessionId(id) {
  return SERVER_SESSION_RE.test(String(id || ''));
}

function mapServerSession(row) {
  return {
    id: row.id,
    title: row.title || t('content.media.agent.defaultTitle'),
    skillId: row.skillId || '',
    messages: sanitizeSessionMessages(row.messages || []),
    archived: Boolean(row.archived),
    updatedAt: row.updatedAt || Date.now(),
  };
}

function adoptServerId(localId, serverId) {
  if (!isServerSessionId(serverId) || String(localId) === String(serverId)) return;
  const row = sessions.value.find((item) => item.id === localId);
  if (row) row.id = serverId;
  if (activeId.value === localId) activeId.value = serverId;
}

const current = computed(() => (
  sessions.value.find((s) => s.id === activeId.value) || sessions.value[0] || {
    id: '',
    title: t('content.media.agent.defaultTitle'),
    skillId: '',
    messages: [],
    updatedAt: 0,
  }
));

const hasThread = computed(() => (current.value.messages || []).length > 0);

const sessionsWithHistory = computed(() =>
  sessions.value.filter((s) => (s.messages || []).length > 0)
);

const resolvedOwnerId = computed(() => {
  const mine = Number(sessionUserId.value);
  return Number.isInteger(mine) && mine > 0 ? mine : null;
});

const ownerLabel = computed(() => {
  const id = resolvedOwnerId.value;
  if (!id) return '';
  if (Number(id) === Number(sessionUserId.value)) {
    return t('content.media.agent.ownerMe', { id });
  }
  return t('content.media.agent.ownerPicked', { id });
});

function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void flushPersist();
  }, 400);
}

async function flushPersist() {
  const seq = ++persistSeq;
  const slim = sessions.value
    .filter((s) => (s.messages || []).length)
    .map((s) => ({
      ...s,
      messages: (s.messages || []).slice(-40),
    }))
    .slice(0, 24);
  const cid = contactId.value || null;
  for (const s of slim) {
    if (seq !== persistSeq) return;
    try {
      let id = s.id;
      if (!isServerSessionId(id)) {
        const opened = await openLiveSession();
        adoptServerId(id, opened.id);
        id = opened.id;
      }
      const data = await saveMediaAgentSession({ ...s, id }, cid);
      const serverId = data?.session?.id;
      if (isServerSessionId(serverId)) adoptServerId(id, serverId);
    } catch {
      /* keep UI; next persist retries */
    }
  }
}

/** Старая история только в localStorage — больше не поднимаем, только чистим. */
function wipeLegacyLocalHistory() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LEGACY_STORAGE_BASE)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

async function openLiveSession() {
  const data = await createMediaAgentSession(contactId.value || undefined);
  const row = data?.session;
  if (!row || !isServerSessionId(row.id)) {
    throw new Error('SESSION_ID');
  }
  return mapServerSession(row);
}

async function loadSessions() {
  wipeLegacyLocalHistory();
  try {
    const data = await fetchMediaAgentSessions(contactId.value || undefined);
    const list = (Array.isArray(data?.sessions) ? data.sessions : [])
      .filter((s) => isServerSessionId(s.id));
    if (list.length) {
      sessions.value = list.map(mapServerSession);
      const live = sessions.value.find((s) => !s.archived) || sessions.value[0];
      activeId.value = live.id;
      return;
    }
  } catch { /* открыть через POST */ }
  try {
    const s = await openLiveSession();
    sessions.value = [s];
    activeId.value = s.id;
  } catch {
    sessions.value = [];
    activeId.value = '';
  }
}

async function ensureServerSession() {
  const currentRow = sessions.value.find((x) => x.id === activeId.value && isServerSessionId(x.id));
  if (currentRow) return currentRow;
  const any = sessions.value.find((x) => isServerSessionId(x.id));
  if (any) {
    activeId.value = any.id;
    return any;
  }
  const s = await openLiveSession();
  sessions.value = [s];
  activeId.value = s.id;
  return sessions.value[0];
}

async function newTask() {
  try {
    const data = await startFreshMediaAgentSession(contactId.value || undefined);
    const fresh = mapServerSession(data?.session || {});
    if (!isServerSessionId(fresh.id)) return;
    const kept = sessions.value
      .filter((s) => s.id !== fresh.id && (s.messages || []).length)
      .map((s) => ({ ...s, archived: true }));
    sessions.value = [fresh, ...kept];
    activeId.value = fresh.id;
    pane.value = 'home';
    preview.value = null;
    draft.value = '';
    pendingFiles.value = [];
    pendingDrive.value = [];
  } catch {
    /* кнопка не затирает текущий чат, если сервер не выдал новый id */
  }
}

async function openSession(id) {
  const s = sessions.value.find((x) => x.id === id);
  if (s?.archived) {
    try {
      const data = await resumeMediaAgentSession(id);
      const live = mapServerSession(data?.session || s);
      sessions.value = sessions.value.map((row) => {
        if (row.id === live.id) return { ...row, ...live, archived: false };
        return { ...row, archived: true };
      });
    } catch {
      return;
    }
  }
  const opened = sessions.value.find((x) => x.id === id);
  if (opened) opened.messages = sanitizeSessionMessages(opened.messages || []);
  activeId.value = id;
  pane.value = 'home';
  preview.value = null;
  nextTick(() => scrollBottom());
}

async function deleteSession(id) {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistSeq += 1;

  preview.value = null;
  pane.value = 'home';

  try {
    const data = await deleteMediaAgentSession(id);
    const row = data?.session;
    const rest = sessions.value.filter((s) => s.id !== id);
    if (row && isServerSessionId(row.id) && !rest.some((s) => s.id === row.id)) {
      sessions.value = [mapServerSession(row), ...rest];
    } else {
      sessions.value = rest;
    }
    if (activeId.value === id) {
      const live = sessions.value.find((s) => !s.archived) || sessions.value[0];
      activeId.value = live?.id || '';
    }
    return;
  } catch {
    /* при ошибке сети оставляем список и пробуем открыть живую беседу */
  }
  const rest = sessions.value.filter((s) => s.id !== id && isServerSessionId(s.id));
  if (rest.length) {
    sessions.value = rest;
    if (activeId.value === id) activeId.value = rest[0].id;
    return;
  }
  try {
    const s = await openLiveSession();
    sessions.value = [s];
    activeId.value = s.id;
  } catch {
    sessions.value = sessions.value.filter((s) => s.id !== id);
    if (activeId.value === id) activeId.value = sessions.value[0]?.id || '';
  }
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
  const list = Array.from(ev.target.files || []);
  pendingFiles.value = [...pendingFiles.value, ...list].slice(0, 6);
  plusOpen.value = false;
  ev.target.value = '';
}

function onCsv(ev) {
  const file = ev.target.files?.[0];
  if (file) pendingCsv.value = file;
  plusOpen.value = false;
  ev.target.value = '';
}

function pickOwner(id) {
  const n = Number(id);
  targetOwnerUserId.value = Number.isInteger(n) && n > 0 ? n : null;
  ownerOpen.value = false;
  ownerQuery.value = '';
  ownerHits.value = [];
}

function searchOwners() {
  if (ownerSearchTimer) clearTimeout(ownerSearchTimer);
  ownerSearchTimer = setTimeout(async () => {
    const q = String(ownerQuery.value || '').trim();
    if (!q) {
      ownerHits.value = [];
      return;
    }
    try {
      const data = await contactsService.getContacts({ q, limit: 8 });
      ownerHits.value = (data.contacts || []).map((c) => ({
        id: c.id,
        label: `${c.display_name || c.name || c.email || '—'} #${c.id}`,
      }));
    } catch {
      ownerHits.value = [];
    }
  }, 250);
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

async function applySkill(skill) {
  let s;
  try {
    s = await ensureServerSession();
  } catch {
    return;
  }
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
  sessions.value = [s];
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

function onPoolUpdate(messageId, pool) {
  patchMessage(messageId, {
    pool,
    text: pool.ready
      ? t('content.media.agent.poolReadyMsg', {
        brand: pool.brand,
        model: pool.model,
        n: pool.count,
      })
      : t('content.media.agent.poolProgressMsg', {
        brand: pool.brand,
        model: pool.model,
        count: pool.count,
        target: pool.target,
      }),
  });
}

function onBatchUpdate(messageId, batch) {
  patchMessage(messageId, {
    batch,
    pool: batch?.pool || null,
    text: batch?.reply_hint || t('content.media.agent.batchRunning'),
    status: batch?.status === 'done' || batch?.status === 'partial' || batch?.status === 'cancelled'
      ? 'done'
      : batch?.status === 'waiting_human'
        ? 'done'
        : 'generating',
  });
}

async function scrollBottom() {
  await nextTick();
  const el = threadRef.value;
  if (el) el.scrollTop = el.scrollHeight;
}

function visibleQuestions(message) {
  const text = String(message?.text || '').trim();
  return (message?.questions || []).filter((q) => {
    const prompt = String(q?.prompt || q?.text || '').trim();
    return prompt && prompt !== text;
  });
}

function isMediaRunning(data) {
  if (!data) return false;
  if (data.kind === 'plan_options' || data.kind === 'ask' || data.kind === 'card_brief'
    || data.kind === 'file_preview' || data.kind === 'plan_selected' || data.kind === 'table_enrich') {
    return false;
  }
  if (data.batch && data.batch.status === 'running') return true;
  const status = String(data.job?.status || '');
  return Boolean(data.job?.id && (status === 'running' || status === 'leased' || status === 'generating'));
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function requestInterrupt(reason = '') {
  interruptRequested = true;
  stopPoll();
  const jobId = activeJobId;
  if (jobId) {
    activeJobId = null;
    try {
      await cancelMediaAgentJob(jobId);
    } catch { /* job мог уже завершиться */ }
  }
  if (activeAssistantId) {
    patchMessage(activeAssistantId, {
      status: 'done',
      text: reason || t('content.media.agent.turnInterrupted'),
    });
    activeAssistantId = null;
  }
}

async function pollJob(jobId, assistantId) {
  stopPoll();
  activeJobId = jobId;
  activeAssistantId = assistantId;
  const tick = async () => {
    if (interruptRequested) {
      stopPoll();
      return;
    }
    try {
      const data = await fetchMediaAgentJob(jobId);
      const job = data?.job;
      if (!job) return;
      if (job.status === 'cancelled') {
        stopPoll();
        if (activeJobId === jobId) activeJobId = null;
        patchMessage(assistantId, {
          status: 'done',
          text: t('content.media.agent.turnInterrupted'),
        });
        return;
      }
      if (job.status === 'done' && job.media) {
        stopPoll();
        if (activeJobId === jobId) activeJobId = null;
        const kind = String(job.media.type || job.kind) === 'video' ? 'video' : 'image';
        const item = {
          url: job.media.url,
          kind,
          name: job.media.filename || job.media.originalName || 'ai-media',
        };
        patchMessage(assistantId, { status: 'done', previews: [item] });
        persist();
        scrollBottom();
      } else if (job.status === 'error') {
        stopPoll();
        if (activeJobId === jobId) activeJobId = null;
        patchMessage(assistantId, {
          status: 'error',
          error: job.error || t('content.media.agent.genFailed'),
        });
      }
    } catch { /* keep polling */ }
  };
  await tick();
  if (!interruptRequested && activeJobId === jobId) {
    pollTimer = setInterval(tick, 2500);
    await new Promise((resolve) => {
      const watch = setInterval(() => {
        if (!pollTimer || interruptRequested || activeJobId !== jobId) {
          clearInterval(watch);
          resolve();
        }
      }, 200);
    });
  }
}

async function drainTurnQueue() {
  if (drainingQueue || sending.value) return;
  const next = turnQueue.shift();
  if (!next) return;
  drainingQueue = true;
  try {
    await executeTurn(next);
  } finally {
    drainingQueue = false;
    if (turnQueue.length && !sending.value) {
      void drainTurnQueue();
    }
  }
}

/**
 * @param {{ text: string, files: File[], driveIds: string[], silent?: boolean, userAlreadyPushed?: boolean }} payload
 */
async function executeTurn(payload) {
  const text = String(payload.text || '').trim();
  const files = Array.isArray(payload.files) ? payload.files.filter(Boolean) : [];
  const driveIds = Array.isArray(payload.driveIds) ? payload.driveIds.filter(Boolean) : [];
  const csvText = String(payload.csvText || '');
  const csvName = String(payload.csvName || '');
  const silent = Boolean(payload.silent);
  const userAlreadyPushed = Boolean(payload.userAlreadyPushed);

  if (sending.value) {
    turnQueue.push({
      text,
      files,
      driveIds,
      silent: true,
      userAlreadyPushed: true,
    });
    return;
  }

  sending.value = true;
  interruptRequested = false;
  let s;
  try {
    s = await ensureServerSession();
  } catch {
    sending.value = false;
    return;
  }
  pane.value = 'home';

  if (!userAlreadyPushed && !silent) {
    if (!(s.messages || []).some((m) => m.role === 'user') && text) {
      s.title = text.slice(0, 48);
    }
    s.messages.push({
      id: uid(),
      role: 'user',
      text: text || t('content.media.agent.examplesOnly'),
    });
  }

  recentOpen.value = true;
  sessions.value = [s, ...sessions.value.filter((x) => x.id !== s.id)];
  activeId.value = s.id;
  persist();
  await scrollBottom();

  const assistantId = uid();
  activeAssistantId = assistantId;
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
      history: historyForApi().slice(0, -1),
      files,
      driveIds,
      skillId: s.skillId || '',
      sessionId: s.id,
      targetOwnerUserId: resolvedOwnerId.value,
      csvText,
      csvName,
    });

    if (interruptRequested) {
      if (data?.job?.id) {
        try { await cancelMediaAgentJob(data.job.id); } catch { /* ignore */ }
      }
      patchMessage(assistantId, {
        status: 'done',
        text: t('content.media.agent.turnInterrupted'),
      });
      return;
    }

    patchMessage(assistantId, {
      text: data.reply || t('content.media.agent.working'),
      status: isMediaRunning(data) ? 'generating' : 'done',
      questions: data.questions || [],
      answers: {},
      questionsLocked: false,
      options: data.options || [],
      optionsLocked: false,
      selectedOptionId: null,
      planJobId: data.job?.id || null,
      filePreview: data.file_preview || null,
      enrichDiff: data.enrich_diff || null,
      enrichCanApply: Boolean(data.can_apply),
      enrichApplied: false,
      tableId: data.table_id || null,
      tableWritten: Boolean(data.table_id),
      cardBrief: data.card_brief || null,
      cardDraftId: null,
      cardDraftKind: null,
      cardPublished: false,
      cardPublishStatus: '',
      mediaPlan: data.media_plan || null,
      formPath: data.form_path || null,
      sources: data.sources || [],
      actions: data.actions || [],
      pool: data.pool || null,
      batch: data.batch || null,
    });
    if (isMediaRunning(data) && data.job?.id) await pollJob(data.job.id, assistantId);
  } catch (e) {
    if (!interruptRequested) {
      const msg = e.response?.data?.error || e.message || t('content.media.agent.genFailed');
      patchMessage(assistantId, { text: '', status: 'error', error: msg });
    }
  } finally {
    sending.value = false;
    activeJobId = null;
    activeAssistantId = null;
    persist();
    await scrollBottom();
    if (turnQueue.length) void drainTurnQueue();
  }
}

async function send(opts) {
  const silent = Boolean(opts && opts.silent);
  const text = String((opts && opts.forcedText) ?? draft.value).trim();
  const forcedFiles = Array.isArray(opts?.forcedFiles) ? opts.forcedFiles.filter(Boolean) : null;
  const files = silent ? [] : (forcedFiles || pendingFiles.value.slice());
  const driveIds = silent || forcedFiles ? [] : pendingDrive.value.map((d) => d.id).filter(Boolean);
  const csvFile = silent || forcedFiles ? null : pendingCsv.value;
  if (!text && !files.length && !driveIds.length && !csvFile) return;
  let csvText = '';
  let csvName = '';
  if (csvFile) {
    csvText = await csvFile.text();
    csvName = csvFile.name || 'upload.csv';
  }

  let s;
  try {
    s = await ensureServerSession();
  } catch {
    return;
  }
  let userAlreadyPushed = false;

  if (!silent) {
    if (!(s.messages || []).some((m) => m.role === 'user') && text) {
      s.title = text.slice(0, 48);
    }
    s.messages.push({
      id: uid(),
      role: 'user',
      text: text || t('content.media.agent.examplesOnly'),
    });
    userAlreadyPushed = true;
    if (!forcedFiles) {
      pendingFiles.value = [];
      pendingDrive.value = [];
      pendingCsv.value = null;
    }
    draft.value = '';
    recentOpen.value = true;
    sessions.value = [s, ...sessions.value.filter((x) => x.id !== s.id)];
    activeId.value = s.id;
    persist();
    await scrollBottom();
  }

  const payload = {
    text,
    files,
    driveIds,
    csvText,
    csvName,
    silent,
    userAlreadyPushed: userAlreadyPushed || silent,
  };

  if (sending.value) {
    // Оркестратор: остановиться и пересмотреть задачу по новому сообщению
    turnQueue.push(payload);
    await requestInterrupt(t('content.media.agent.turnInterrupted'));
    // Текущий executeTurn выйдет в finally и вызовет drainTurnQueue
    // Если sending уже false (гонка) — дренируем сами
    if (!sending.value) void drainTurnQueue();
    return;
  }

  await executeTurn(payload);
}

function formatSourceDate(raw) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw || '');
  return d.toLocaleString();
}

async function answerQuestion(messageId, questionId, opt) {
  const s = sessions.value.find((x) => x.id === activeId.value);
  const m = s?.messages.find((x) => x.id === messageId);
  if (!m || m.questionsLocked) return;
  const qid = String(questionId || '');
  if (!qid || !opt?.id) return;

  const answers = { ...(m.answers || {}), [qid]: opt.id };
  const questions = m.questions || [];
  const complete = questions.length > 0 && questions.every((q) => answers[String(q.id)]);

  // Обновляем через patchMessage — иначе Vue может не увидеть nested mutation
  patchMessage(messageId, {
    answers,
    questionsLocked: complete,
  });

  if (!complete) return;

  const lines = questions.map((q) => {
    const chosen = (q.options || []).find((o) => o.id === answers[String(q.id)]);
    return `${q.prompt} ${chosen?.label || ''}`.trim();
  });
  await send({ silent: true, forcedText: lines.join('\n') });
}

async function planCardMedia(message) {
  const brief = message?.cardBrief;
  if (!brief || sending.value) return;
  sending.value = true;
  try {
    const planned = await execOrchestratorTool({
      tool: 'card.plan_media',
      args: { brief, text: message.text || '' },
      jobId: message.planJobId,
    });
    patchMessage(message.id, {
      mediaPlan: planned,
      questions: planned.questions?.length ? planned.questions : message.questions || [],
    });
  } catch (e) {
    patchMessage(message.id, {
      status: 'error',
      error: e.response?.data?.error || e.message || t('content.media.agent.mediaPlanFailed'),
    });
  } finally {
    sending.value = false;
    persist();
  }
}

function setBriefField(message, field, value) {
  if (!message?.cardBrief || message.cardDraftId) return;
  patchMessage(message.id, {
    cardBrief: { ...message.cardBrief, [field]: value },
  });
}

function setBriefStoreField(message, field, value) {
  if (!message?.cardBrief || message.cardDraftId) return;
  patchMessage(message.id, {
    cardBrief: {
      ...message.cardBrief,
      store: { ...(message.cardBrief.store || {}), [field]: value },
    },
  });
}

async function commitCardDraft(message) {
  const brief = message?.cardBrief;
  if (!brief || message.cardDraftId || sending.value) return;
  const tool = brief.kind === 'store' ? 'store.create_draft' : 'listing.create_draft';
  sending.value = true;
  try {
    const created = await execOrchestratorTool({
      tool,
      args: {
        brief,
        idempotency_key: `${message.planJobId || 'card'}:${tool}`,
      },
      jobId: message.planJobId,
      decision: 'choose',
    });
    const id = created.page_id || created.product_id;
    const editorPath = created.editor_path || cardEditorPath(brief.kind, id);
    const planned = await execOrchestratorTool({
      tool: 'card.plan_media',
      args: { brief, text: message.text || '' },
      jobId: message.planJobId,
    });
    const linked = created.media_attached?.attached?.length || 0;
    patchMessage(message.id, {
      cardDraftId: id,
      cardDraftKind: brief.kind,
      cardPublished: false,
      formPath: editorPath,
      mediaPlan: planned,
      questions: planned.questions?.length ? planned.questions : message.questions || [],
      text: linked
        ? `${t('content.media.agent.briefWritten', { id })} К странице привязано кадров: ${linked}.`
        : t('content.media.agent.briefWritten', { id }),
    });
    if (id) router.push(editorPath);
  } catch (e) {
    const questions = e.response?.data?.questions;
    patchMessage(message.id, {
      status: questions ? 'done' : 'error',
      questions: questions || message.questions || [],
      error: e.response?.data?.error || e.message || t('content.media.agent.briefWriteFailed'),
    });
  } finally {
    sending.value = false;
    persist();
  }
}

async function publishCardDraft(message) {
  const brief = message?.cardBrief;
  const id = message?.cardDraftId;
  if (!brief || !id || message.cardPublished || sending.value) return;
  sending.value = true;
  try {
    const published = await execOrchestratorTool({
      tool: 'card.publish',
      args: {
        brief,
        page_id: brief.kind === 'store' ? undefined : id,
        product_id: brief.kind === 'store' ? id : undefined,
        idempotency_key: `${message.planJobId || 'card'}:card.publish`,
      },
      jobId: message.planJobId,
      decision: 'approve',
      text: '',
    });
    patchMessage(message.id, {
      cardPublished: true,
      cardPublishStatus: published.status || (published.published ? 'published' : 'pending'),
      text: t('content.media.agent.briefPublished', {
        status: published.status || (published.published ? 'published' : 'pending'),
      }),
    });
  } catch (e) {
    const questions = e.response?.data?.questions;
    patchMessage(message.id, {
      status: questions ? 'done' : 'error',
      questions: questions || message.questions || [],
      error: e.response?.data?.error || e.message || t('content.media.agent.briefPublishFailed'),
    });
  } finally {
    sending.value = false;
    persist();
  }
}

async function commitFilePreview(message) {
  const preview = message?.filePreview;
  if (!preview?.columns?.length || message.tableWritten || sending.value) return;
  sending.value = true;
  try {
    const created = await execOrchestratorTool({
      tool: 'tables.create',
      args: {
        name: preview.table_name || preview.filename || t('content.media.agent.filePreviewDefaultName'),
        description: preview.description || '',
        rag_source: false,
        idempotency_key: `${message.planJobId || 'preview'}:tables.create`,
      },
      jobId: message.planJobId,
      decision: 'choose',
    });
    const cols = await execOrchestratorTool({
      tool: 'tables.add_columns',
      args: {
        table_id: created.table_id,
        columns: (preview.column_meta || preview.columns).map((col) => (
          typeof col === 'string' ? { name: col, type: 'text' } : col
        )),
        idempotency_key: `${message.planJobId || 'preview'}:tables.add_columns`,
      },
      jobId: message.planJobId,
      decision: 'choose',
    });
    await execOrchestratorTool({
      tool: 'tables.add_rows',
      args: {
        table_id: created.table_id,
        columns: cols.columns,
        rows: preview.rows,
        idempotency_key: `${message.planJobId || 'preview'}:tables.add_rows`,
      },
      jobId: message.planJobId,
      decision: 'choose',
    });
    const editorPath = created.editor_path || tableEditorPath(created.table_id);
    patchMessage(message.id, {
      tableWritten: true,
      tableId: created.table_id,
      formPath: editorPath,
      text: t('content.media.agent.filePreviewWrittenId', { id: created.table_id }),
    });
    if (created.table_id) router.push(editorPath);
  } catch (e) {
    patchMessage(message.id, {
      status: 'error',
      error: e.response?.data?.error || e.message || t('content.media.agent.filePreviewWriteFailed'),
    });
  } finally {
    sending.value = false;
    persist();
  }
}

function enrichWritable(diff) {
  return (Array.isArray(diff) ? diff : []).some((item) => (
    item?.row_id && item?.column_id && String(item.after || '').trim()
  ));
}

async function proposeTableEnrich(message) {
  if (!message?.tableId || sending.value) return;
  sending.value = true;
  try {
    const data = await execOrchestratorTool({
      tool: 'tables.enrich',
      args: {
        table_id: message.tableId,
        apply: false,
        message: '',
      },
      jobId: message.planJobId,
    });
    const diff = data.diff || data.enrich_diff || [];
    patchMessage(message.id, {
      enrichDiff: diff,
      enrichCanApply: Boolean(data.can_apply) || enrichWritable(diff),
      enrichApplied: false,
      tableId: data.table_id || message.tableId,
      tableWritten: true,
      text: data.reply || message.text,
      questions: data.questions || [],
      status: 'done',
    });
  } catch (e) {
    patchMessage(message.id, {
      status: 'error',
      error: e.response?.data?.error || e.message || t('content.media.agent.enrichFailed'),
    });
  } finally {
    sending.value = false;
    persist();
  }
}

async function applyTableEnrich(message) {
  const patches = (message.enrichDiff || []).filter((item) => (
    item?.row_id && item?.column_id && String(item.after || '').trim()
  ));
  if (!message?.tableId || !patches.length || message.enrichApplied || sending.value) return;
  sending.value = true;
  try {
    const stamp = patches.map((item) => `${item.row_id}:${item.column_id}`).join(',');
    const data = await execOrchestratorTool({
      tool: 'tables.enrich',
      args: {
        table_id: message.tableId,
        apply: true,
        patches,
        idempotency_key: `${message.planJobId || 'enrich'}:tables.enrich:${message.tableId}:${stamp}`,
      },
      jobId: message.planJobId,
      decision: 'choose',
    });
    patchMessage(message.id, {
      enrichApplied: true,
      formPath: data.editor_path || message.formPath || tableEditorPath(message.tableId),
      text: data.reply || t('content.media.agent.enrichWritten'),
    });
  } catch (e) {
    patchMessage(message.id, {
      status: 'error',
      error: e.response?.data?.error || e.message || t('content.media.agent.enrichFailed'),
    });
  } finally {
    sending.value = false;
    persist();
  }
}

async function choosePlanOption(message, opt) {
  if (!message?.planJobId || !opt?.id || message.optionsLocked || sending.value) return;
  sending.value = true;
  try {
    const data = await chooseOrchestratorPlan(message.planJobId, {
      optionId: opt.id,
      decision: 'choose',
    });
    patchMessage(message.id, {
      selectedOptionId: opt.id,
      optionsLocked: true,
      text: data.reply || message.text,
      batch: data.batch || message.batch || null,
      pool: data.pool || message.pool || null,
      filePreview: data.file_preview || message.filePreview || null,
      enrichDiff: data.enrich_diff || message.enrichDiff || null,
      enrichCanApply: data.can_apply != null ? Boolean(data.can_apply) : message.enrichCanApply,
      tableId: data.table_id || message.tableId || null,
      tableWritten: Boolean(data.table_id || message.tableWritten),
      cardBrief: data.card_brief || message.cardBrief || null,
      mediaPlan: data.media_plan || message.mediaPlan || null,
      formPath: data.form_path || data.editor_path || message.formPath || null,
      sources: data.sources || message.sources || [],
      questions: data.questions || message.questions || [],
      status: isMediaRunning(data) ? 'generating' : 'done',
    });
    if (isMediaRunning(data) && data.job?.id) {
      await pollJob(data.job.id, message.id);
    }
  } catch (e) {
    patchMessage(message.id, {
      status: 'error',
      error: e.response?.data?.error || e.message || t('content.media.agent.optionsFailed'),
    });
  } finally {
    sending.value = false;
  }
}

function sanitizeSessionMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((m) => {
    if (!m || !Array.isArray(m.questions) || !m.questions.length) return m;
    const answers = m.answers && typeof m.answers === 'object' ? m.answers : {};
    const complete = m.questions.every((q) => answers[String(q?.id)]);
    // Не держим «Ответ отправлен», если выбраны не все варианты
    if (m.questionsLocked && !complete) {
      return { ...m, answers, questionsLocked: false };
    }
    return m;
  });
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

async function openJobs() {
  pane.value = 'jobs';
  jobsError.value = '';
  try {
    const [orch, listing] = await Promise.all([
      fetchMediaAgentJobs(),
      fetchListingBatches().catch(() => ({ jobs: [] })),
    ]);
    const orchJobs = Array.isArray(orch.jobs) ? orch.jobs : [];
    const listingJobs = Array.isArray(listing.jobs) ? listing.jobs : [];
    const seen = new Set();
    jobs.value = [...listingJobs, ...orchJobs].filter((job) => {
      if (!job?.id || seen.has(job.id)) return false;
      seen.add(job.id);
      return true;
    });
  } catch (e) {
    jobsError.value = e.response?.data?.error || e.message || t('content.media.agent.jobsFailed');
    jobs.value = [];
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
watch(
  () => props.storageNamespace,
  async () => {
    stopPoll();
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    await loadSessions();
    scrollBottom();
  }
);
onMounted(async () => {
  await loadSessions();
  loadInstalled();
  scrollBottom();
});

onBeforeUnmount(() => {
  stopPoll();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
    void flushPersist();
  }
});

defineExpose({ send });
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

.work--embedded {
  min-height: 0;
  height: 100%;
  border-radius: 0;
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
  gap: 0.35rem;
  margin-top: 14px;
  padding: 8px 10px;
  color: #6b7280;
  font-size: 0.9rem;
}
.work__recent-count {
  margin-left: auto;
  margin-right: 4px;
  min-width: 1.1rem;
  padding: 0 5px;
  border-radius: 999px;
  background: #e5e7eb;
  color: #374151;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
}

.work__task {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 7px 6px 7px 12px;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #4b5563;
  text-align: left;
  width: 100%;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.work__task-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.work__task-del {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #9ca3af;
  display: grid;
  place-items: center;
  cursor: pointer;
  opacity: 0.55;
}
.work__task:hover .work__task-del,
.work__task.is-on .work__task-del {
  opacity: 1;
}
.work__task-del:hover {
  color: #b00020;
  background: rgba(176, 0, 32, 0.08);
}
.work__ai {
  min-width: 32px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.work__ai.is-on {
  background: #1a5f9e;
  border-color: #1a5f9e;
  color: #fff;
}

.work__main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #fff;
  overflow: hidden;
}

.home {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px 64px;
  min-height: 0;
}

.thread-wrap {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.thread-wrap__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 28px 0;
  flex: 0 0 auto;
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
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 12px 24px 16px;
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
  touch-action: pan-y;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.thread::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
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
  pointer-events: auto;
  position: relative;
  z-index: 2;
}

.qcard__opt em {
  font-style: normal;
  font-weight: 650;
}

.qcard__opt.is-on {
  color: #1a5f9e;
}

.qcard__opt:disabled {
  cursor: default;
  opacity: 0.55;
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

.stub,
.drive,
.jobs {
  padding: 32px 36px;
}

.stub h2,
.drive h2,
.jobs h2 {
  margin: 0 0 8px;
}

.stub p,
.drive p,
.jobs p {
  color: #6b7280;
}

.jobs__error {
  color: #b42318;
}

.jobs__row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  margin: 8px 0 0;
  padding: 10px 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: #fff;
  font: inherit;
  text-align: left;
  cursor: default;
}

.jobs__row span {
  color: #6b7280;
  font-size: 0.85rem;
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

.preview {
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.preview__hint,
.preview__done,
.preview__name {
  margin: 6px 0;
  color: #6b7280;
  font-size: 0.82rem;
}

.preview__name {
  color: #111;
  font-weight: 600;
}

.preview__enrich {
  display: block;
  font-style: normal;
  color: #6b7280;
  font-size: 0.7rem;
  font-weight: 400;
}

.preview__table {
  overflow: auto;
  max-height: 240px;
  margin: 8px 0;
}

.preview__table table {
  border-collapse: collapse;
  font-size: 0.78rem;
}

.preview__table th,
.preview__table td {
  border: 1px solid #e5e7eb;
  padding: 4px 6px;
  text-align: left;
}

.preview__write {
  border: 1px solid #111;
  background: #111;
  color: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font: inherit;
  cursor: pointer;
}

.enrich {
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
  display: grid;
  gap: 8px;
}

.enrich ul {
  margin: 0;
  padding-left: 18px;
  font-size: 0.82rem;
}

.enrich a {
  margin-left: 6px;
  color: #2563eb;
}

.brief {
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
  display: grid;
  gap: 8px;
}

.brief__hint,
.brief__done {
  margin: 0;
  color: #6b7280;
  font-size: 0.82rem;
}

.brief label {
  display: grid;
  gap: 4px;
  font-size: 0.82rem;
  color: #374151;
}

.brief input,
.brief textarea {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 6px 8px;
  font: inherit;
  background: #fff;
}

.media-plan {
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.media-plan__hint {
  margin: 6px 0;
  color: #6b7280;
  font-size: 0.82rem;
}

.media-plan ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.media-plan li p {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: #374151;
}

.media-plan__btn {
  border: 1px solid #111;
  background: #111;
  color: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font: inherit;
  cursor: pointer;
}

.brief__write,
.brief__open {
  border: 1px solid #111;
  background: #111;
  color: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font: inherit;
  cursor: pointer;
  justify-self: start;
}

.brief__open {
  background: #fff;
  color: #111;
}

.sources {
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.sources__hint {
  margin: 6px 0;
  color: #6b7280;
  font-size: 0.82rem;
}

.sources ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.sources li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: baseline;
  font-size: 0.82rem;
}

.sources__sys {
  color: #6b7280;
  text-transform: lowercase;
}

.sources a {
  color: #111;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sources time {
  color: #9ca3af;
  font-size: 0.75rem;
  white-space: nowrap;
}

.options {
  display: grid;
  gap: 8px;
  margin: 10px 0;
}

.options__hint {
  margin: 0;
  color: #6b7280;
  font-size: 0.82rem;
}

.options__card {
  display: grid;
  gap: 4px;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
}

.options__card.is-on,
.options__card:hover:not(:disabled) {
  border-color: #111827;
}

.options__card:disabled {
  opacity: 0.7;
  cursor: default;
}

.options__title {
  font-weight: 600;
}

.options__sum,
.options__cost {
  color: #6b7280;
  font-size: 0.82rem;
}

.owner-pick {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.35);
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.owner-pick__card {
  width: min(420px, 100%);
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.owner-pick__card input {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
}

.owner-pick__row {
  border: 0;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.owner-pick__row:hover {
  background: #e5e7eb;
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
