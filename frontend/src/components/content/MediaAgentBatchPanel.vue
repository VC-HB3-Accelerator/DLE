<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="batch">
    <header class="batch__head">
      <div class="batch__title">
        <strong>{{ currentLabel }}</strong>
        <span class="batch__idx">{{ targetIndex }}/{{ targetTotal }}</span>
      </div>
      <div
        v-if="waiting"
        class="batch__timer"
        :class="{ 'is-urgent': secondsLeft <= 15 }"
      >
        {{ t('content.media.agent.softAskTimer', { sec: secondsLeft }) }}
      </div>
      <span v-else-if="searching" class="batch__run">
        {{ t('content.media.agent.batchSearching') }}
      </span>
      <span v-else-if="waitingVideo" class="batch__run">
        {{ t('content.media.agent.waitingVideo') }}
      </span>
      <span v-else-if="awaitingApproval" class="batch__run">
        {{ t('content.media.agent.planWaiting') }}
      </span>
      <span v-else-if="runningGen || batch.status === 'running'" class="batch__run">
        {{ t('content.media.agent.batchRunning') }}
      </span>
      <span v-else-if="batch.status === 'done'" class="batch__ok">
        {{ t('content.media.agent.batchDone') }}
      </span>
    </header>

    <section v-if="awaitingApproval" class="plan">
      <strong>{{ t('content.media.agent.planTitle') }}</strong>
      <p class="plan__summary">
        {{ t('content.media.agent.planSummary', {
          count: batch.plan?.target_count || targetTotal,
          owner: batch.plan?.target_owner_user_id || '—',
        }) }}
      </p>
      <ul class="plan__effects">
        <li v-for="effect in batch.plan?.side_effects || []" :key="effect">
          {{ t(`content.media.agent.planEffect.${effect}`) }}
        </li>
      </ul>
      <p class="plan__warning">{{ t('content.media.agent.planWarning') }}</p>
      <div class="batch__actions">
        <button type="button" class="batch__btn batch__btn--primary" :disabled="busy" @click="onPlanDecision('approve')">
          {{ t('content.media.agent.planApprove') }}
        </button>
        <button type="button" class="batch__btn" :disabled="busy" @click="onPlanDecision('reject')">
          {{ t('content.media.agent.planReject') }}
        </button>
      </div>
    </section>

    <section v-if="briefing" class="brief">
      <p class="brief__prompt">{{ briefPrompt }}</p>
      <div v-for="field in briefFields" :key="field.id" class="brief__field">
        <div class="brief__label">{{ field.label }}</div>
        <div class="brief__opts">
          <button
            v-for="opt in field.options"
            :key="opt.id"
            type="button"
            class="brief__opt"
            :class="{ 'is-on': answers[field.id] === opt.id }"
            :disabled="busy"
            @click="answers[field.id] = opt.id"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div class="batch__actions">
        <button type="button" class="batch__btn batch__btn--primary" :disabled="busy" @click="onBriefContinue">
          {{ t('content.media.agent.briefContinue') }}
        </button>
        <button type="button" class="batch__btn" :disabled="busy" @click="onCancel">
          {{ t('content.media.agent.softAskCancel') }}
        </button>
      </div>
    </section>

    <MediaAgentPoolGrid
      v-if="!briefing && batch.pool?.photos?.length"
      :pool="batch.pool"
      @update:pool="onPool"
      @refilling="onRefilling"
      @preview="$emit('preview', $event)"
    />

    <section v-if="waitingVideo" class="brief">
      <p class="brief__prompt">{{ t('content.media.agent.videoAsk') }}</p>
      <div class="batch__actions">
        <button type="button" class="batch__btn batch__btn--primary" :disabled="busy" @click="onVideo('generate')">
          {{ t('content.media.agent.videoGenerate') }}
        </button>
        <button type="button" class="batch__btn" :disabled="busy" @click="onVideo('skip')">
          {{ t('content.media.agent.videoSkip') }}
        </button>
        <button type="button" class="batch__btn" :disabled="busy" @click="onCancel">
          {{ t('content.media.agent.softAskCancel') }}
        </button>
      </div>
    </section>

    <section v-if="packageSlots.length" class="slots">
      <strong>{{ t('content.media.agent.slotsTitle') }}</strong>
      <div class="slots__grid">
        <span
          v-for="slot in packageSlots"
          :key="slot.id"
          class="slots__cell"
          :class="{ 'is-on': slot.filled }"
        >
          {{ slot.label }}
        </span>
      </div>
    </section>

    <div v-if="waitingKeep" class="batch__actions">
      <button type="button" class="batch__btn batch__btn--primary" :disabled="busy" @click="onContinue">
        {{ t('content.media.agent.softAskContinue') }}
      </button>
      <button type="button" class="batch__btn" :disabled="busy" @click="onCancel">
        {{ t('content.media.agent.softAskCancel') }}
      </button>
    </div>
    <p v-if="error" class="batch__err">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import MediaAgentPoolGrid from '@/components/content/MediaAgentPoolGrid.vue';
import {
  tickListingBatch,
  respondListingBatch,
  fetchListingBatch,
  decideListingBatchPlan,
  cancelListingBatch,
} from '@/services/mediaAgentService';

const props = defineProps({
  batch: { type: Object, required: true },
});
const emit = defineEmits(['update:batch', 'preview']);
const { t } = useI18n();
const busy = ref(false);
const error = ref('');
const now = ref(Date.now());
const refilling = ref(false);
const answers = reactive({ generation: null, color: null });
let tickTimer = null;
let clockTimer = null;

const awaitingApproval = computed(
  () =>
    props.batch?.status === 'waiting_human' &&
    props.batch?.cursor?.phase === 'approve_plan'
);
const waiting = computed(
  () =>
    props.batch?.status === 'waiting_human' &&
    ['soft_ask_brief', 'soft_ask_keep'].includes(props.batch?.cursor?.phase)
);
const briefing = computed(
  () => waiting.value && props.batch?.cursor?.phase === 'soft_ask_brief'
);
const waitingKeep = computed(
  () => waiting.value && props.batch?.cursor?.phase === 'soft_ask_keep'
);
const waitingVideo = computed(
  () =>
    props.batch?.status === 'waiting_human' &&
    props.batch?.cursor?.phase === 'ask_video'
);
const packageSlots = computed(() => {
  const target = (props.batch?.targets || [])[props.batch?.cursor?.target_index || 0] || {};
  const files = target.album_manifest?.slots || target.gen_files || [];
  const slots = Array.from({ length: 8 }, (_, i) => {
    const file = files[i];
    const name = typeof file === 'string' ? file : file?.file;
    return {
      id: `p${i + 1}`,
      filled: Boolean(name),
      label: name || t('content.media.agent.slotEmpty', { n: i + 1 }),
    };
  });
  const videoFile = target.album_manifest?.video?.file || target.video_summary?.file;
  slots.push({
    id: 'video',
    filled: Boolean(videoFile) || target.video_decision === 'skip',
    label: videoFile || t('content.media.agent.slotVideo'),
  });
  return files.length || videoFile || waitingVideo.value ? slots : [];
});
const searching = computed(
  () =>
    props.batch?.status === 'running' &&
    (props.batch?.cursor?.phase === 'search_pool' ||
      props.batch?.targets?.[props.batch?.cursor?.target_index || 0]?.status === 'searching')
);
const runningGen = computed(
  () =>
    props.batch?.status === 'running' &&
    (props.batch?.cursor?.phase === 'generate' ||
      props.batch?.targets?.[props.batch?.cursor?.target_index || 0]?.status === 'generating')
);
const targetTotal = computed(() => (props.batch?.targets || []).length || 1);
const targetIndex = computed(() => (props.batch?.cursor?.target_index || 0) + 1);
const currentLabel = computed(() => {
  const tgs = props.batch?.targets || [];
  const cur = tgs[props.batch?.cursor?.target_index || 0];
  return cur ? `${cur.brand} ${cur.model}` : '—';
});
const secondsLeft = computed(() => {
  const d = props.batch?.soft_ask?.deadline_at;
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.parse(d) - now.value) / 1000));
});
const briefFields = computed(() => props.batch?.ask?.brief?.fields || []);
const briefPrompt = computed(
  () => props.batch?.ask?.brief?.prompt || props.batch?.ask?.prompt || t('content.media.agent.briefPrompt')
);

watch(
  () => props.batch?.ask?.brief,
  (brief) => {
    if (!brief?.fields) return;
    for (const f of brief.fields) {
      if (f.selected && !answers[f.id]) answers[f.id] = f.selected;
    }
  },
  { immediate: true }
);

function onPool(pool) {
  emit('update:batch', { ...props.batch, pool });
}

function onRefilling(v) {
  refilling.value = !!v;
}

async function refreshTick() {
  if (!props.batch?.id) return;
  if (refilling.value || busy.value) return;
  if (!waiting.value && !waitingVideo.value && !searching.value && !runningGen.value && props.batch?.status !== 'running') {
    return;
  }
  try {
    const data = waiting.value
      ? await tickListingBatch(props.batch.id)
      : await fetchListingBatch(props.batch.id);
    if (refilling.value) return;
    if (data?.batch) {
      const local = props.batch?.pool;
      const remote = data.batch.pool;
      const merged =
        local?.updatedAt && remote?.updatedAt && local.updatedAt > remote.updatedAt
          ? { ...data.batch, pool: local }
          : data.batch;
      emit('update:batch', merged);
    }
  } catch (e) {
    error.value = e.response?.data?.error || e.message || '';
  }
}

async function onBriefContinue() {
  if (busy.value || !props.batch?.id) return;
  busy.value = true;
  error.value = '';
  try {
    const data = await respondListingBatch(props.batch.id, {
      type: 'brief',
      answers: {
        generation: answers.generation || 'any',
        color: answers.color || 'any',
      },
    });
    if (data?.batch) emit('update:batch', data.batch);
  } catch (e) {
    error.value = e.response?.data?.error || e.message || t('content.media.agent.softAskFailed');
  } finally {
    busy.value = false;
  }
}

async function onVideo(decision) {
  if (busy.value || !props.batch?.id) return;
  busy.value = true;
  error.value = '';
  try {
    const data = await respondListingBatch(props.batch.id, {
      type: decision,
      answers: { video: decision },
    });
    if (data?.batch) emit('update:batch', data.batch);
  } catch (e) {
    error.value = e.response?.data?.error || e.message || t('content.media.agent.softAskFailed');
  } finally {
    busy.value = false;
  }
}

async function onContinue() {
  if (busy.value || !props.batch?.id) return;
  busy.value = true;
  error.value = '';
  try {
    const files = (props.batch.pool?.photos || []).map((p) => p.file).filter(Boolean);
    const data = await respondListingBatch(props.batch.id, {
      type: 'continue',
      files,
    });
    if (data?.batch) emit('update:batch', data.batch);
  } catch (e) {
    error.value = e.response?.data?.error || e.message || t('content.media.agent.softAskFailed');
  } finally {
    busy.value = false;
  }
}

async function onCancel() {
  if (busy.value || !props.batch?.id) return;
  busy.value = true;
  try {
    const data = await cancelListingBatch(props.batch.id);
    if (data?.batch) emit('update:batch', data.batch);
  } catch (e) {
    error.value = e.response?.data?.error || e.message || '';
  } finally {
    busy.value = false;
  }
}

async function onPlanDecision(decision) {
  if (busy.value || !props.batch?.id) return;
  busy.value = true;
  error.value = '';
  try {
    const data = await decideListingBatchPlan(props.batch.id, decision);
    if (data?.batch) emit('update:batch', data.batch);
  } catch (e) {
    error.value = e.response?.data?.error || e.message || t('content.media.agent.planFailed');
  } finally {
    busy.value = false;
  }
}

function startTimers() {
  stopTimers();
  clockTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
  tickTimer = setInterval(() => {
    if (waiting.value || waitingVideo.value || searching.value || runningGen.value || props.batch?.status === 'running') {
      refreshTick();
    }
  }, 4000);
}

function stopTimers() {
  if (tickTimer) clearInterval(tickTimer);
  if (clockTimer) clearInterval(clockTimer);
  tickTimer = null;
  clockTimer = null;
}

watch(
  () => props.batch?.id,
  () => {
    error.value = '';
    now.value = Date.now();
    answers.generation = null;
    answers.color = null;
  }
);

watch(waiting, (v) => {
  if (v) startTimers();
});

onMounted(() => {
  if (waiting.value || waitingVideo.value || searching.value || runningGen.value || props.batch?.status === 'running') {
    startTimers();
    refreshTick();
  }
});
onBeforeUnmount(stopTimers);
</script>

<style scoped>
.batch {
  margin-top: 0.75rem;
}
.batch__head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: baseline;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}
.batch__title {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
}
.batch__idx {
  opacity: 0.55;
  font-size: 0.8rem;
}
.batch__timer {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
.batch__timer.is-urgent {
  color: #b00020;
  opacity: 1;
}
.batch__run {
  opacity: 0.7;
}
.batch__ok {
  color: var(--color-success, #1a7f37);
}
.batch__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.batch__btn {
  border: 1px solid var(--color-border, #ccc);
  background: #fff;
  border-radius: 6px;
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  font-size: 0.9rem;
}
.batch__btn--primary {
  background: var(--color-primary, #1a5f9e);
  border-color: var(--color-primary, #1a5f9e);
  color: #fff;
}
.batch__btn:disabled {
  opacity: 0.5;
  cursor: wait;
}
.batch__err {
  color: #b00020;
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
}
.plan {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 8px;
  background: var(--color-surface, #fafafa);
}
.plan__summary,
.plan__warning {
  margin: 0.5rem 0;
}
.plan__effects {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}
.plan__warning {
  color: #8a4b00;
  font-size: 0.85rem;
}
.brief {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 8px;
  background: var(--color-surface, #fafafa);
}
.brief__prompt {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
}
.brief__field + .brief__field {
  margin-top: 0.75rem;
}
.brief__label {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-bottom: 0.35rem;
}
.brief__opts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.brief__opt {
  border: 1px solid var(--color-border, #ccc);
  background: #fff;
  border-radius: 999px;
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
  cursor: pointer;
}
.brief__opt.is-on {
  background: var(--color-primary, #1a5f9e);
  border-color: var(--color-primary, #1a5f9e);
  color: #fff;
}
.brief__opt:disabled {
  opacity: 0.5;
  cursor: wait;
}
.slots {
  margin-top: 0.75rem;
}
.slots__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 0.4rem;
  margin-top: 0.4rem;
}
.slots__cell {
  border: 1px dashed var(--color-border, #ccc);
  border-radius: 6px;
  padding: 0.35rem 0.4rem;
  font-size: 0.72rem;
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.slots__cell.is-on {
  border-style: solid;
  opacity: 1;
}
</style>
