<template>
  <BaseLayout>
    <AdminPageShell
      :title="$t('settings.ai.voiceCall.pageTitle')"
      :show-close="true"
      fallback="/settings/ai/assistant"
      variant="panel"
    >
      <div v-if="loadError" class="panel section-card">{{ loadError }}</div>
      <form v-else class="voice-call-settings" @submit.prevent="save">
        <div class="panel section-card voice-call-summary">
          <div class="voice-call-summary__grid">
            <div class="voice-call-summary__item">
              <span class="voice-call-summary__label">{{ $t('settings.ai.voiceCall.summaryEnabled') }}</span>
              <strong>{{ form.enabled ? $t('common.enabled') : $t('common.disabled') }}</strong>
            </div>
            <div class="voice-call-summary__item">
              <span class="voice-call-summary__label">{{ $t('settings.ai.voiceCall.summaryModel') }}</span>
              <strong>{{ form.model_call || $t('settings.ai.voiceCall.modelCallEmpty') }}</strong>
            </div>
            <div class="voice-call-summary__item">
              <span class="voice-call-summary__label">{{ $t('settings.ai.voiceCall.summaryPayment') }}</span>
              <strong>{{ form.paid_enabled ? $t('settings.ai.voiceCall.summaryPaid') : $t('settings.ai.voiceCall.summaryFree') }}</strong>
            </div>
            <div class="voice-call-summary__item">
              <span class="voice-call-summary__label">{{ $t('settings.ai.voiceCall.summaryBooking') }}</span>
              <strong>{{ selectedEditorLabel }}</strong>
            </div>
            <div class="voice-call-summary__item">
              <span class="voice-call-summary__label">{{ $t('settings.ai.voiceCall.summaryBehavior') }}</span>
              <strong>{{ behaviorSummaryLabel }}</strong>
            </div>
          </div>
          <div class="voice-call-summary__actions">
            <router-link class="btn btn-outline btn-sm" :to="{ name: 'voice-call-booking' }">
              {{ $t('settings.ai.voiceCall.openBookCall') }}
            </router-link>
            <router-link class="btn btn-outline btn-sm" :to="{ name: 'hub-conference-schedule' }">
              {{ $t('settings.ai.voiceCall.openSchedule') }}
            </router-link>
          </div>
          <p v-if="savedModelNotForCall" class="form-hint form-hint--warn">{{ $t('settings.ai.voiceCall.modelCallInvalid') }}</p>
          <p v-if="paymentWarning" class="form-hint form-hint--warn">{{ paymentWarning }}</p>
          <p v-if="bookingWarning" class="form-hint form-hint--warn">{{ bookingWarning }}</p>
        </div>

        <nav class="voice-call-tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="voice-call-tab"
            :class="{ active: activeTab === tab.id }"
            role="tab"
            :aria-selected="activeTab === tab.id"
            @click="activeTab = tab.id"
          >
            {{ $t(tab.labelKey) }}
          </button>
        </nav>

        <div v-if="activeTab === 'general'" class="panel section-card">
          <h3>{{ $t('settings.ai.voiceCall.tabGeneral') }}</h3>
          <label class="check-row">
            <input v-model="form.enabled" type="checkbox">
            <span>{{ $t('settings.ai.voiceCall.enabled') }}</span>
          </label>
          <p class="section-description">{{ $t('settings.ai.voiceCall.enabledHint') }}</p>

          <label class="form-label">{{ $t('settings.ai.voiceCall.modelCall') }}</label>
          <select v-model="form.model_call" class="form-control">
            <option value="">{{ $t('settings.ai.voiceCall.modelCallEmpty') }}</option>
            <option v-for="m in realtimeModels" :key="m.id" :value="m.id">{{ m.id }} ({{ m.provider }})</option>
          </select>
          <p class="form-hint">{{ $t('settings.ai.voiceCall.modelCallHint') }}</p>

          <label class="check-row">
            <input v-model="form.hard_stop" type="checkbox">
            <span>{{ $t('settings.ai.voiceCall.hardStop') }}</span>
          </label>
          <p class="section-description">{{ $t('settings.ai.voiceCall.hardStopHint') }}</p>

          <label class="check-row">
            <input v-model="form.write_call_stub_to_chat" type="checkbox">
            <span>{{ $t('settings.ai.voiceCall.writeStub') }}</span>
          </label>
        </div>

        <div v-else-if="activeTab === 'behavior'" class="panel section-card">
          <h3>{{ $t('settings.ai.voiceCall.tabBehavior') }}</h3>
          <p class="section-description">{{ $t('settings.ai.voiceCall.behaviorIntro') }}</p>

          <div class="behavior-sections">
            <section class="behavior-card">
              <h4>{{ $t('settings.ai.voiceCall.behaviorSpeechTitle') }}</h4>
              <div class="behavior-fields">
                <label class="form-label">{{ $t('settings.ai.voiceCall.tone') }}</label>
                <select v-model="form.tone" class="form-control">
                  <option value="neutral">{{ $t('settings.ai.voiceCall.toneNeutral') }}</option>
                  <option value="business">{{ $t('settings.ai.voiceCall.toneBusiness') }}</option>
                  <option value="warm">{{ $t('settings.ai.voiceCall.toneWarm') }}</option>
                </select>
                <label class="form-label">{{ $t('settings.ai.voiceCall.responseLength') }}</label>
                <select v-model="form.response_length" class="form-control">
                  <option value="short">{{ $t('settings.ai.voiceCall.responseLengthShort') }}</option>
                  <option value="balanced">{{ $t('settings.ai.voiceCall.responseLengthBalanced') }}</option>
                  <option value="detailed">{{ $t('settings.ai.voiceCall.responseLengthDetailed') }}</option>
                </select>
                <label class="form-label">{{ $t('settings.ai.voiceCall.formality') }}</label>
                <select v-model="form.formality" class="form-control">
                  <option value="strict">{{ $t('settings.ai.voiceCall.formalityStrict') }}</option>
                  <option value="normal">{{ $t('settings.ai.voiceCall.formalityNormal') }}</option>
                  <option value="soft">{{ $t('settings.ai.voiceCall.formalitySoft') }}</option>
                </select>
              </div>
            </section>

            <section class="behavior-card">
              <h4>{{ $t('settings.ai.voiceCall.behaviorAdaptTitle') }}</h4>
              <label class="check-row">
                <input v-model="form.adapt_to_caller" type="checkbox">
                <span>{{ $t('settings.ai.voiceCall.adaptToCaller') }}</span>
              </label>
              <label class="form-label">{{ $t('settings.ai.voiceCall.explanationLevelDefault') }}</label>
              <select v-model="form.explanation_level_default" class="form-control">
                <option value="auto">{{ $t('settings.ai.voiceCall.explanationLevelAuto') }}</option>
                <option value="plain">{{ $t('settings.ai.voiceCall.explanationLevelPlain') }}</option>
                <option value="balanced">{{ $t('settings.ai.voiceCall.explanationLevelBalanced') }}</option>
                <option value="expert">{{ $t('settings.ai.voiceCall.explanationLevelExpert') }}</option>
              </select>
              <label class="check-row">
                <input v-model="form.allow_gentle_rephrase_offer" type="checkbox">
                <span>{{ $t('settings.ai.voiceCall.allowGentleRephraseOffer') }}</span>
              </label>
              <label class="check-row">
                <input v-model="form.avoid_jargon_by_default" type="checkbox">
                <span>{{ $t('settings.ai.voiceCall.avoidJargonByDefault') }}</span>
              </label>
            </section>

            <section class="behavior-card">
              <h4>{{ $t('settings.ai.voiceCall.behaviorTermsTitle') }}</h4>
              <label class="check-row">
                <input v-model="form.forbid_abbreviations_in_voice" type="checkbox">
                <span>{{ $t('settings.ai.voiceCall.forbidAbbreviationsInVoice') }}</span>
              </label>
              <label class="form-label">{{ $t('settings.ai.voiceCall.allowProfessionalTerms') }}</label>
              <select v-model="form.allow_professional_terms" class="form-control">
                <option value="minimal">{{ $t('settings.ai.voiceCall.allowProfessionalTermsMinimal') }}</option>
                <option value="balanced">{{ $t('settings.ai.voiceCall.allowProfessionalTermsBalanced') }}</option>
                <option value="free">{{ $t('settings.ai.voiceCall.allowProfessionalTermsFree') }}</option>
              </select>
              <label class="check-row">
                <input v-model="form.explain_terms_if_needed" type="checkbox">
                <span>{{ $t('settings.ai.voiceCall.explainTermsIfNeeded') }}</span>
              </label>
            </section>

            <section class="behavior-card">
              <h4>{{ $t('settings.ai.voiceCall.behaviorQualityTitle') }}</h4>
              <label class="check-row">
                <input v-model="form.quality_over_speed" type="checkbox">
                <span>{{ $t('settings.ai.voiceCall.qualityOverSpeed') }}</span>
              </label>
              <label class="check-row">
                <input v-model="form.allow_check_kb_phrase" type="checkbox">
                <span>{{ $t('settings.ai.voiceCall.allowCheckKbPhrase') }}</span>
              </label>
              <label class="form-label">{{ $t('settings.ai.voiceCall.fallbackIfNotConfident') }}</label>
              <select v-model="form.fallback_if_not_confident" class="form-control">
                <option value="chat">{{ $t('settings.ai.voiceCall.fallbackChat') }}</option>
                <option value="staff">{{ $t('settings.ai.voiceCall.fallbackStaff') }}</option>
                <option value="chat_or_staff">{{ $t('settings.ai.voiceCall.fallbackChatOrStaff') }}</option>
              </select>
            </section>

            <section class="behavior-card">
              <h4>{{ $t('settings.ai.voiceCall.behaviorSafetyTitle') }}</h4>
              <label class="check-row">
                <input v-model="form.forbid_flirty_tone" type="checkbox">
                <span>{{ $t('settings.ai.voiceCall.forbidFlirtyTone') }}</span>
              </label>
              <label class="check-row">
                <input v-model="form.forbid_vulgar_tone" type="checkbox">
                <span>{{ $t('settings.ai.voiceCall.forbidVulgarTone') }}</span>
              </label>
              <label class="check-row">
                <input v-model="form.forbid_patronizing_tone" type="checkbox">
                <span>{{ $t('settings.ai.voiceCall.forbidPatronizingTone') }}</span>
              </label>
              <label class="check-row">
                <input v-model="form.forbid_slang_mirroring" type="checkbox">
                <span>{{ $t('settings.ai.voiceCall.forbidSlangMirroring') }}</span>
              </label>
            </section>
          </div>

          <div class="behavior-preview-grid">
            <div class="preview-card">
              <h4>{{ $t('settings.ai.voiceCall.previewGreetingTitle') }}</h4>
              <p>{{ previewGreeting }}</p>
            </div>
            <div class="preview-card">
              <h4>{{ $t('settings.ai.voiceCall.previewPlainTitle') }}</h4>
              <p>{{ previewPlain }}</p>
            </div>
            <div class="preview-card">
              <h4>{{ $t('settings.ai.voiceCall.previewComplexTitle') }}</h4>
              <p>{{ previewComplex }}</p>
            </div>
            <div class="preview-card">
              <h4>{{ $t('settings.ai.voiceCall.previewEscalationTitle') }}</h4>
              <p>{{ previewEscalation }}</p>
            </div>
          </div>

          <details class="advanced-box" open>
            <summary>{{ $t('settings.ai.voiceCall.systemPrompt') }}</summary>
            <label class="form-label">{{ $t('settings.ai.voiceCall.systemPrompt') }}</label>
            <textarea
              v-model="form.system_prompt"
              class="form-control prompt-area"
              rows="8"
              :placeholder="$t('settings.ai.voiceCall.systemPromptPlaceholder')"
            />
            <p class="form-hint">{{ $t('settings.ai.voiceCall.systemPromptHint') }}</p>
            <button type="button" class="btn btn-outline btn-sm" @click="resetPrompt">
              {{ $t('settings.ai.voiceCall.systemPromptReset') }}
            </button>
          </details>
        </div>

        <div v-else-if="activeTab === 'payment'" class="panel section-card">
          <h3>{{ $t('settings.ai.voiceCall.tabPayment') }}</h3>
          <label class="check-row">
            <input v-model="form.paid_enabled" type="checkbox">
            <span>{{ $t('settings.ai.voiceCall.paidEnabled') }}</span>
          </label>
          <p class="section-description">{{ $t('settings.ai.voiceCall.paidEnabledHint') }}</p>

          <h4>{{ $t('settings.ai.voiceCall.packagesTitle') }}</h4>
          <p class="section-description">{{ $t('settings.ai.voiceCall.packagesHint') }}</p>
          <div v-for="(pkg, index) in form.packages" :key="pkg.id" class="pkg-row">
            <input v-model.number="pkg.minutes" type="number" min="1" class="form-control" :placeholder="$t('settings.ai.voiceCall.minutes')">
            <input v-model="pkg.price" class="form-control" :placeholder="$t('settings.ai.voiceCall.price')">
            <button type="button" class="btn btn-danger btn-sm" @click="form.packages.splice(index, 1)">{{ $t('common.delete') }}</button>
          </div>
          <button type="button" class="btn btn-outline btn-sm" @click="addPackage">{{ $t('settings.ai.voiceCall.addPackage') }}</button>

          <div v-if="form.paid_enabled" class="subsection">
            <h4>{{ $t('settings.ai.voiceCall.payTitle') }}</h4>
            <p class="section-description">{{ $t('settings.ai.voiceCall.payHint') }}</p>
            <label class="form-label">{{ $t('settings.ai.voiceCall.payMode') }}</label>
            <select v-model="form.pay_mode" class="form-control">
              <option value="wallet">{{ $t('settings.ai.voiceCall.payWallet') }}</option>
              <option value="treasury">{{ $t('settings.ai.voiceCall.payTreasury') }}</option>
            </select>
            <label class="form-label">{{ $t('settings.ai.voiceCall.payTo') }}</label>
            <input v-model="form.pay_to_address" class="form-control" :placeholder="$t('settings.ai.voiceCall.payToPlaceholder')">
            <label class="form-label">{{ $t('settings.ai.voiceCall.chainId') }}</label>
            <input v-model.number="form.chain_id" type="number" class="form-control">
            <label class="form-label">{{ $t('settings.ai.voiceCall.tokenSymbol') }}</label>
            <input v-model="form.token_symbol" class="form-control" placeholder="USDT">
            <label class="form-label">{{ $t('settings.ai.voiceCall.tokenAddress') }}</label>
            <input v-model="form.token_address" class="form-control" :placeholder="$t('settings.ai.voiceCall.tokenAddressPlaceholder')">
            <label class="form-label">{{ $t('settings.ai.voiceCall.tokenDecimals') }}</label>
            <input v-model.number="form.token_decimals" type="number" min="0" max="18" class="form-control">
            <label class="form-label">{{ $t('settings.ai.voiceCall.confirmations') }}</label>
            <input v-model.number="form.confirmations" type="number" min="1" class="form-control">
          </div>
        </div>

        <div v-else-if="activeTab === 'booking'" class="panel section-card">
          <h3>{{ $t('settings.ai.voiceCall.tabBooking') }}</h3>
          <p class="section-description">{{ $t('settings.ai.voiceCall.bookingTabHint') }}</p>
          <label class="form-label">{{ $t('settings.ai.voiceCall.editor') }}</label>
          <select v-model.number="form.booking_editor_user_id" class="form-control">
            <option :value="null">{{ $t('settings.ai.voiceCall.editorEmpty') }}</option>
            <option v-for="ed in editors" :key="ed.id" :value="ed.id">{{ ed.name }} (#{{ ed.id }})</option>
          </select>
          <label class="form-label">{{ $t('settings.ai.voiceCall.slotMinutes') }}</label>
          <input v-model.number="form.booking_slot_minutes" type="number" min="10" max="180" class="form-control">
          <p class="form-hint">{{ $t('settings.ai.voiceCall.scheduleHint') }}</p>
          <router-link class="btn btn-outline btn-sm" :to="{ name: 'hub-conference-schedule' }">
            {{ $t('settings.ai.voiceCall.openSchedule') }}
          </router-link>
        </div>

        <div v-else-if="activeTab === 'rpc'" class="panel section-card">
          <h3>{{ $t('settings.ai.voiceCall.tabRpc') }}</h3>
          <p class="section-description">{{ $t('settings.ai.voiceCall.rpcHint') }}</p>
          <RpcProvidersSettings :rpcConfigs="rpcConfigs" @update="loadRpc" />
        </div>

        <div class="btn-row">
          <button type="submit" class="btn btn-primary" :disabled="saving">{{ $t('common.save') }}</button>
          <router-link class="btn btn-outline" to="/settings/ai/assistant">{{ $t('settings.ai.voiceCall.backToAssistant') }}</router-link>
        </div>
      </form>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import api from '@/api/axios';
import BaseLayout from '@/components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import RpcProvidersSettings from '@/views/settings/RpcProvidersSettings.vue';

const { t } = useI18n();
const loadError = ref('');
const saving = ref(false);
const editors = ref([]);
const rpcConfigs = ref([]);
const llmModels = ref([]);
const activeTab = ref('general');
const form = ref({
  enabled: true,
  paid_enabled: false,
  model_call: '',
  packages: [],
  pay_mode: 'wallet',
  pay_to_address: '',
  chain_id: null,
  token_symbol: 'USDT',
  token_address: '',
  token_decimals: 6,
  confirmations: 3,
  booking_editor_user_id: null,
  booking_slot_minutes: 30,
  hard_stop: true,
  write_call_stub_to_chat: false,
  tone: 'business',
  response_length: 'balanced',
  formality: 'normal',
  adapt_to_caller: true,
  explanation_level_default: 'auto',
  allow_gentle_rephrase_offer: true,
  avoid_jargon_by_default: true,
  forbid_abbreviations_in_voice: true,
  allow_professional_terms: 'minimal',
  explain_terms_if_needed: true,
  quality_over_speed: true,
  allow_check_kb_phrase: true,
  fallback_if_not_confident: 'chat_or_staff',
  forbid_flirty_tone: true,
  forbid_vulgar_tone: true,
  forbid_patronizing_tone: true,
  forbid_slang_mirroring: true,
  system_prompt: ''
});

const CANONICAL_CALL_MODELS = [
  { id: 'qwen3.5-omni-flash-realtime', provider: 'qwencloud' },
  { id: 'qwen3.5-omni-plus-realtime', provider: 'qwencloud' }
];

function isCallRealtimeModel(id) {
  const n = String(id || '').toLowerCase();
  return n.includes('omni') && n.includes('realtime')
    && !n.includes('livetranslate')
    && !n.includes('asr')
    && !n.includes('tts');
}

const realtimeModels = computed(() => {
  const map = new Map();
  for (const m of CANONICAL_CALL_MODELS) map.set(m.id, m);
  for (const m of llmModels.value || []) {
    if (isCallRealtimeModel(m.id)) map.set(m.id, { id: m.id, provider: m.provider || 'qwencloud' });
  }
  const current = String(form.value.model_call || '').trim();
  if (current && !map.has(current)) {
    map.set(current, { id: current, provider: 'saved' });
  }
  return [...map.values()];
});

const savedModelNotForCall = computed(() => {
  const current = String(form.value.model_call || '').trim();
  return Boolean(current && !isCallRealtimeModel(current));
});

const tabs = [
  { id: 'general', labelKey: 'settings.ai.voiceCall.tabGeneral' },
  { id: 'behavior', labelKey: 'settings.ai.voiceCall.tabBehavior' },
  { id: 'payment', labelKey: 'settings.ai.voiceCall.tabPayment' },
  { id: 'booking', labelKey: 'settings.ai.voiceCall.tabBooking' },
  { id: 'rpc', labelKey: 'settings.ai.voiceCall.tabRpc' }
];

const selectedEditorLabel = computed(() => {
  const id = Number(form.value.booking_editor_user_id || 0);
  const editor = (editors.value || []).find((item) => Number(item.id) === id);
  return editor ? `${editor.name} (#${editor.id})` : t('settings.ai.voiceCall.editorEmpty');
});

const paymentWarning = computed(() => {
  if (!form.value.paid_enabled) return '';
  if (!String(form.value.pay_to_address || '').trim()) return t('settings.ai.voiceCall.paymentWarningAddress');
  if (!Number(form.value.chain_id)) return t('settings.ai.voiceCall.paymentWarningChain');
  return '';
});

const bookingWarning = computed(() => (
  form.value.booking_editor_user_id ? '' : t('settings.ai.voiceCall.bookingWarning')
));

const behaviorSummaryLabel = computed(() => {
  const advancedPrompt = String(form.value.system_prompt || '').trim() !== t('settings.ai.voiceCall.systemPromptDefault').trim();
  const nonDefaultBehavior = [
    form.value.tone !== 'business',
    form.value.response_length !== 'balanced',
    form.value.formality !== 'normal',
    form.value.explanation_level_default !== 'auto',
    form.value.allow_professional_terms !== 'minimal',
    form.value.fallback_if_not_confident !== 'chat_or_staff',
    form.value.adapt_to_caller !== true,
    form.value.allow_gentle_rephrase_offer !== true,
    form.value.avoid_jargon_by_default !== true,
    form.value.forbid_abbreviations_in_voice !== true,
    form.value.explain_terms_if_needed !== true,
    form.value.quality_over_speed !== true,
    form.value.allow_check_kb_phrase !== true,
    form.value.forbid_flirty_tone !== true,
    form.value.forbid_vulgar_tone !== true,
    form.value.forbid_patronizing_tone !== true,
    form.value.forbid_slang_mirroring !== true
  ].some(Boolean);
  if (advancedPrompt) return t('settings.ai.voiceCall.summaryBehaviorAdvanced');
  if (nonDefaultBehavior) return t('settings.ai.voiceCall.summaryBehaviorConfigured');
  return t('settings.ai.voiceCall.summaryBehaviorBasic');
});

const previewGreeting = computed(() => t('settings.ai.voiceCall.previewGreetingBody', {
  tone: t(`settings.ai.voiceCall.previewTone_${form.value.tone}`),
  formality: t(`settings.ai.voiceCall.previewFormality_${form.value.formality}`)
}));

const previewPlain = computed(() => t('settings.ai.voiceCall.previewPlainBody', {
  length: t(`settings.ai.voiceCall.previewLength_${form.value.response_length}`),
  explanation: t(`settings.ai.voiceCall.previewExplanation_${form.value.explanation_level_default}`),
  jargon: form.value.avoid_jargon_by_default
    ? t('settings.ai.voiceCall.previewJargonAvoid')
    : t('settings.ai.voiceCall.previewJargonAllowed')
}));

const previewComplex = computed(() => t('settings.ai.voiceCall.previewComplexBody', {
  quality: form.value.quality_over_speed
    ? t('settings.ai.voiceCall.previewQualityCareful')
    : t('settings.ai.voiceCall.previewQualityFast'),
  check: form.value.allow_check_kb_phrase
    ? t('settings.ai.voiceCall.previewCheckAllowed')
    : t('settings.ai.voiceCall.previewCheckHidden')
}));

const previewEscalation = computed(() => t('settings.ai.voiceCall.previewEscalationBody', {
  fallback: t(`settings.ai.voiceCall.previewFallback_${form.value.fallback_if_not_confident}`),
  safety: [
    form.value.forbid_flirty_tone ? t('settings.ai.voiceCall.previewSafetyNoFlirty') : null,
    form.value.forbid_vulgar_tone ? t('settings.ai.voiceCall.previewSafetyNoVulgar') : null,
    form.value.forbid_slang_mirroring ? t('settings.ai.voiceCall.previewSafetyNoMirroring') : null
  ].filter(Boolean).join(', ')
}));

function addPackage() {
  const minutes = 10;
  form.value.packages.push({ id: `p${Date.now()}`, minutes, price: '0' });
}

function resetPrompt() {
  form.value.system_prompt = t('settings.ai.voiceCall.systemPromptDefault');
}

async function loadRpc() {
  const rpcResponse = await api.get('/settings/rpc');
  rpcConfigs.value = (rpcResponse.data?.data || []).map((rpc) => ({
    networkId: rpc.network_id,
    rpcUrl: rpc.rpc_url,
    rpcUrlDisplay: rpc.rpc_url_display || rpc.rpc_url,
    chainId: rpc.chain_id
  }));
}

async function load() {
  loadError.value = '';
  try {
    const [{ data }, models] = await Promise.all([
      api.get('/ai-calls/admin/settings'),
      api.get('/settings/llm-models').catch(() => ({ data: [] }))
    ]);
    form.value = { ...form.value, ...(data.data?.settings || {}) };
    if (!Array.isArray(form.value.packages) || !form.value.packages.length) {
      form.value.packages = [
        { id: 'p5', minutes: 5, price: '0' },
        { id: 'p15', minutes: 15, price: '0' },
        { id: 'p30', minutes: 30, price: '0' }
      ];
    }
    editors.value = data.data?.editors || [];
    rpcConfigs.value = data.data?.rpc || [];
    llmModels.value = Array.isArray(models.data?.models) ? models.data.models : [];
    if (!rpcConfigs.value.length) await loadRpc();
  } catch (error) {
    loadError.value = error.response?.data?.error || t('settings.ai.voiceCall.loadFailed');
  }
}

async function save() {
  saving.value = true;
  try {
    const { data } = await api.put('/ai-calls/admin/settings', form.value);
    form.value = { ...form.value, ...(data.data?.settings || {}) };
    ElMessage.success(t('settings.ai.voiceCall.saved'));
  } catch (error) {
    ElMessage.error(error.response?.data?.error || t('settings.ai.voiceCall.saveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.section-card {
  margin: var(--spacing-xl) 0;
}

.voice-call-summary__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-md);
}

.voice-call-summary__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.voice-call-summary__label {
  color: var(--color-grey);
  font-size: 0.9rem;
}

.voice-call-summary__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.voice-call-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: var(--spacing-lg);
}

.voice-call-tab {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--block-radius, 8px);
  border: 1px solid var(--color-border);
  background: var(--color-white);
  color: var(--color-grey);
  cursor: pointer;
}

.voice-call-tab.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}

.check-row {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  font-weight: 600;
}

.behavior-sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.behavior-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 12px);
  padding: var(--spacing-md);
  background: var(--color-white);
}

.behavior-list {
  margin: var(--spacing-sm) 0 0;
  padding-left: 18px;
}

.behavior-fields {
  display: grid;
  gap: var(--spacing-sm);
}

.behavior-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}

.preview-card {
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md, 12px);
  padding: var(--spacing-md);
  background: var(--color-background-soft, #fafafa);
}

.subsection {
  margin-top: var(--spacing-lg);
}

.advanced-box {
  margin-top: var(--spacing-lg);
}

.advanced-box summary {
  cursor: pointer;
  font-weight: 600;
}
.pkg-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}
.form-label {
  display: block;
  margin-top: var(--spacing-md);
}
.form-hint--warn {
  color: var(--color-danger, #b42318);
}
.prompt-area {
  min-height: 10rem;
  resize: vertical;
}
</style>
