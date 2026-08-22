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
  <BaseLayout>
    <AdminPageShell
      :title="$t('settings.ai.assistant.pageTitle')"
      :show-close="true"
      fallback="/settings/ai"
      variant="panel"
    >
      <div v-if="loadError" class="panel section-card">{{ loadError }}</div>
      <form v-else class="chat-ai-settings" @submit.prevent="saveSettings">
        <div class="panel section-card summary-card">
          <div class="summary-grid">
            <div class="summary-item">
              <span class="summary-label">{{ $t('settings.ai.assistant.summaryChannels') }}</span>
              <strong>{{ enabledChannelsSummary }}</strong>
            </div>
            <div class="summary-item">
              <span class="summary-label">{{ $t('settings.ai.assistant.summaryModel') }}</span>
              <strong>{{ settings.model || ollamaConfig.llmModel || '—' }}</strong>
            </div>
            <div class="summary-item">
              <span class="summary-label">{{ $t('settings.ai.assistant.summaryKnowledge') }}</span>
              <strong>{{ selectedTableLabel }}</strong>
            </div>
            <div class="summary-item">
              <span class="summary-label">{{ $t('settings.ai.assistant.summaryRules') }}</span>
              <strong>{{ selectedRuleLabel }}</strong>
            </div>
            <div class="summary-item">
              <span class="summary-label">{{ $t('settings.ai.assistant.summaryBehavior') }}</span>
              <strong>{{ behaviorSummaryLabel }}</strong>
            </div>
          </div>
          <div class="summary-actions">
            <router-link class="btn btn-outline btn-sm" to="/settings/ai/rag">
              {{ $t('settings.ai.rag.openPage') }}
            </router-link>
            <router-link class="btn btn-outline btn-sm" to="/settings/ai/voice-call">
              {{ $t('settings.ai.voiceCall.openPage') }}
            </router-link>
            <router-link class="btn btn-outline btn-sm" to="/settings/ai/agent-access">
              {{ $t('settings.ai.agentAccess.openPage') }}
            </router-link>
          </div>
          <p v-if="knowledgeWarning" class="form-hint form-hint--warn">{{ knowledgeWarning }}</p>
          <p v-if="channelWarning" class="form-hint form-hint--warn">{{ channelWarning }}</p>
        </div>

        <nav class="chat-ai-tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="chat-ai-tab"
            :class="{ active: activeTab === tab.id }"
            role="tab"
            :aria-selected="activeTab === tab.id"
            @click="activeTab = tab.id"
          >
            {{ $t(tab.labelKey) }}
          </button>
        </nav>

        <div v-if="activeTab === 'general'" class="panel section-card">
          <h3>{{ $t('settings.ai.assistant.tabGeneral') }}</h3>
          <p class="section-description">{{ $t('settings.ai.assistant.generalIntro') }}</p>

          <div class="channel-grid">
            <label v-for="channel in assistantChannels" :key="channel.key" class="toggle-card">
              <input v-model="settings.enabled_channels[channel.key]" type="checkbox">
              <div>
                <strong>{{ channel.label }}</strong>
                <div class="toggle-card__hint">
                  {{ settings.enabled_channels[channel.key] ? $t('settings.ai.assistant.enabled') : $t('settings.ai.assistant.disabled') }}
                </div>
              </div>
            </label>
          </div>

          <label class="form-label">{{ $t('settings.ai.assistant.llmForAssistant') }}</label>
          <select v-if="llmModels.length" v-model="settings.model" class="form-control">
            <option value="">{{ $t('settings.ai.assistant.useDefaultOllama') }}</option>
            <option v-for="m in llmModels" :key="m.id" :value="m.id">{{ m.id }} ({{ m.provider }})</option>
          </select>
          <input v-else v-model="settings.model" class="form-control" placeholder="qwen2.5" />
          <small v-if="!settings.model" class="form-hint">{{ $t('settings.ai.assistant.willUseLlm', { model: ollamaConfig.llmModel }) }}</small>

          <label class="form-label">{{ $t('settings.ai.assistant.ragTables') }}</label>
          <select v-model="settings.selected_rag_tables" class="form-control">
            <option value="">{{ $t('settings.ai.assistant.selectTable') }}</option>
            <option v-for="table in ragTables" :key="table.id" :value="table.id">
              {{ getTableDisplayName(table) }}
            </option>
          </select>
        </div>

        <div v-else-if="activeTab === 'behavior'" class="panel section-card">
          <h3>{{ $t('settings.ai.assistant.tabBehavior') }}</h3>
          <p class="section-description">{{ $t('settings.ai.assistant.behaviorIntro') }}</p>

          <div class="behavior-grid">
            <section class="behavior-card">
              <h4>{{ $t('settings.ai.assistant.behaviorSpeechTitle') }}</h4>
              <label class="form-label">{{ $t('settings.ai.assistant.tone') }}</label>
              <select v-model="settings.tone" class="form-control">
                <option value="neutral">{{ $t('settings.ai.assistant.toneNeutral') }}</option>
                <option value="business">{{ $t('settings.ai.assistant.toneBusiness') }}</option>
                <option value="warm">{{ $t('settings.ai.assistant.toneWarm') }}</option>
              </select>
              <label class="form-label">{{ $t('settings.ai.assistant.responseLength') }}</label>
              <select v-model="settings.response_length" class="form-control">
                <option value="short">{{ $t('settings.ai.assistant.responseLengthShort') }}</option>
                <option value="balanced">{{ $t('settings.ai.assistant.responseLengthBalanced') }}</option>
                <option value="detailed">{{ $t('settings.ai.assistant.responseLengthDetailed') }}</option>
              </select>
              <label class="form-label">{{ $t('settings.ai.assistant.formality') }}</label>
              <select v-model="settings.formality" class="form-control">
                <option value="strict">{{ $t('settings.ai.assistant.formalityStrict') }}</option>
                <option value="normal">{{ $t('settings.ai.assistant.formalityNormal') }}</option>
                <option value="soft">{{ $t('settings.ai.assistant.formalitySoft') }}</option>
              </select>
            </section>

            <section class="behavior-card">
              <h4>{{ $t('settings.ai.assistant.behaviorAdaptTitle') }}</h4>
              <label class="check-row">
                <input v-model="settings.adapt_to_user" type="checkbox">
                <span>{{ $t('settings.ai.assistant.adaptToUser') }}</span>
              </label>
              <label class="form-label">{{ $t('settings.ai.assistant.explanationLevelDefault') }}</label>
              <select v-model="settings.explanation_level_default" class="form-control">
                <option value="auto">{{ $t('settings.ai.assistant.explanationLevelAuto') }}</option>
                <option value="plain">{{ $t('settings.ai.assistant.explanationLevelPlain') }}</option>
                <option value="balanced">{{ $t('settings.ai.assistant.explanationLevelBalanced') }}</option>
                <option value="expert">{{ $t('settings.ai.assistant.explanationLevelExpert') }}</option>
              </select>
              <label class="check-row">
                <input v-model="settings.allow_gentle_rephrase_offer" type="checkbox">
                <span>{{ $t('settings.ai.assistant.allowGentleRephraseOffer') }}</span>
              </label>
              <label class="check-row">
                <input v-model="settings.avoid_jargon_by_default" type="checkbox">
                <span>{{ $t('settings.ai.assistant.avoidJargonByDefault') }}</span>
              </label>
            </section>

            <section class="behavior-card">
              <h4>{{ $t('settings.ai.assistant.behaviorQualityTitle') }}</h4>
              <label class="check-row">
                <input v-model="settings.quality_over_speed" type="checkbox">
                <span>{{ $t('settings.ai.assistant.qualityOverSpeed') }}</span>
              </label>
              <label class="form-label">{{ $t('settings.ai.assistant.fallbackIfNotConfident') }}</label>
              <select v-model="settings.fallback_if_not_confident" class="form-control">
                <option value="chat">{{ $t('settings.ai.assistant.fallbackChat') }}</option>
                <option value="staff">{{ $t('settings.ai.assistant.fallbackStaff') }}</option>
                <option value="chat_or_staff">{{ $t('settings.ai.assistant.fallbackChatOrStaff') }}</option>
              </select>
            </section>

            <section class="behavior-card">
              <h4>{{ $t('settings.ai.assistant.behaviorSafetyTitle') }}</h4>
              <label class="check-row">
                <input v-model="settings.forbid_vulgar_tone" type="checkbox">
                <span>{{ $t('settings.ai.assistant.forbidVulgarTone') }}</span>
              </label>
              <label class="check-row">
                <input v-model="settings.forbid_patronizing_tone" type="checkbox">
                <span>{{ $t('settings.ai.assistant.forbidPatronizingTone') }}</span>
              </label>
              <label class="check-row">
                <input v-model="settings.forbid_slang_mirroring" type="checkbox">
                <span>{{ $t('settings.ai.assistant.forbidSlangMirroring') }}</span>
              </label>
            </section>
          </div>

          <div class="preview-grid">
            <div class="preview-card">
              <h4>{{ $t('settings.ai.assistant.previewGreetingTitle') }}</h4>
              <p>{{ previewGreeting }}</p>
            </div>
            <div class="preview-card">
              <h4>{{ $t('settings.ai.assistant.previewPlainTitle') }}</h4>
              <p>{{ previewPlain }}</p>
            </div>
            <div class="preview-card">
              <h4>{{ $t('settings.ai.assistant.previewComplexTitle') }}</h4>
              <p>{{ previewComplex }}</p>
            </div>
            <div class="preview-card">
              <h4>{{ $t('settings.ai.assistant.previewEscalationTitle') }}</h4>
              <p>{{ previewEscalation }}</p>
            </div>
          </div>

          <details class="advanced-box" open>
            <summary>{{ $t('settings.ai.assistant.systemPrompt') }}</summary>
            <div class="prompt-actions">
              <button type="button" class="linkish" @click="applyRecommendedPrompt">
                {{ $t('settings.ai.assistant.applyRecommendedPrompt') }}
              </button>
            </div>
            <textarea
              v-model="settings.system_prompt"
              class="form-control prompt-area"
              rows="12"
              :placeholder="$t('settings.ai.assistant.systemPromptPlaceholder')"
            />
            <small class="form-hint">{{ $t('settings.ai.assistant.systemPromptHelp') }}</small>
          </details>
        </div>

        <div v-else-if="activeTab === 'knowledge'" class="panel section-card">
          <h3>{{ $t('settings.ai.assistant.tabKnowledge') }}</h3>
          <p class="section-description">{{ $t('settings.ai.assistant.knowledgeIntro') }}</p>

          <label class="form-label">{{ $t('settings.ai.assistant.rulesSet') }}</label>
          <div class="rules-row btn-row">
            <select v-model="settings.rules_id" class="form-control">
              <option value="">{{ $t('settings.ai.assistant.selectRules') }}</option>
              <option v-for="rule in rulesList" :key="rule.id" :value="rule.id">
                {{ getRuleDisplayName(rule) }}
              </option>
            </select>
            <button type="button" class="btn btn-primary btn-sm" @click="openRuleEditor()">{{ $t('common.create') }}</button>
            <button type="button" class="btn btn-outline btn-sm" :disabled="!settings.rules_id" @click="openRuleEditor(settings.rules_id)">{{ $t('common.edit') }}</button>
            <button type="button" class="btn btn-danger btn-sm" :disabled="!settings.rules_id" @click="deleteRule(settings.rules_id)">{{ $t('common.delete') }}</button>
          </div>
          <div v-if="selectedRule">
            <p><b>{{ $t('settings.ai.assistant.descriptionLabel') }}</b> {{ selectedRule.description }}</p>
            <p v-if="selectedRule.tag_ids?.length">
              <b>{{ $t('settings.ai.assistant.boundTags') }}</b> {{ selectedRule.tag_ids.join(', ') }}
            </p>
            <pre class="rules-json">{{ JSON.stringify(selectedRule.rules, null, 2) }}</pre>
          </div>

          <fieldset class="accept-input" :disabled="!settingsLoaded">
            <legend>{{ $t('settings.ai.assistant.acceptInputTitle') }}</legend>
            <label v-for="key in acceptInputKeys" :key="key" class="accept-input__row">
              <input v-model="settings.accept_input[key]" type="checkbox">
              <span>{{ $t(`settings.ai.assistant.acceptKeys.${key}`) }}</span>
            </label>
            <p class="form-hint">{{ $t('settings.ai.assistant.acceptInputHint') }}</p>
          </fieldset>

          <div class="placeholders-block">
            <h4>{{ $t('settings.ai.assistant.placeholdersTitle') }}</h4>
            <div v-if="placeholders.length === 0" class="empty-placeholder">{{ $t('settings.ai.assistant.noPlaceholders') }}</div>
            <table v-else class="placeholders-table">
              <thead>
                <tr>
                  <th>{{ $t('settings.ai.assistant.placeholderCol') }}</th>
                  <th>{{ $t('settings.ai.assistant.columnCol') }}</th>
                  <th>{{ $t('settings.ai.assistant.tableCol') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ph in placeholders" :key="ph.column_id">
                  <td><code>{ {{ ph.placeholder }} }</code></td>
                  <td>{{ ph.column_name }}</td>
                  <td>{{ ph.table_name }}</td>
                  <td><button type="button" class="btn btn-outline btn-sm" @click="openEditPlaceholder(ph)">{{ $t('common.edit') }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="activeTab === 'channels'" class="panel section-card">
          <h3>{{ $t('settings.ai.assistant.tabChannels') }}</h3>
          <p class="section-description">{{ $t('settings.ai.assistant.channelsIntro') }}</p>

          <div class="channel-grid">
            <label v-for="channel in assistantChannels" :key="channel.key" class="toggle-card">
              <input v-model="settings.enabled_channels[channel.key]" type="checkbox">
              <div>
                <strong>{{ channel.label }}</strong>
                <div class="toggle-card__hint">
                  {{ settings.enabled_channels[channel.key] ? $t('settings.ai.assistant.enabled') : $t('settings.ai.assistant.disabled') }}
                </div>
              </div>
            </label>
          </div>

          <label class="form-label">{{ $t('settings.ai.assistant.telegramBot') }}</label>
          <select v-model="settings.telegram_settings_id" class="form-control">
            <option :value="null">{{ $t('settings.ai.assistant.channelNotSelected') }}</option>
            <option v-for="tg in telegramBots" :key="tg.id" :value="tg.id">
              {{ tg.bot_username }}
            </option>
          </select>

          <label class="form-label">{{ $t('settings.ai.assistant.contactEmail') }}</label>
          <select v-model="settings.email_settings_id" class="form-control">
            <option :value="null">{{ $t('settings.ai.assistant.channelNotSelected') }}</option>
            <option v-for="em in emailList" :key="em.id" :value="em.id">
              {{ em.from_email }}
            </option>
          </select>
        </div>

        <div v-else-if="activeTab === 'models'" class="panel section-card">
          <h3>{{ $t('settings.ai.assistant.tabModels') }}</h3>
          <p class="section-description">{{ $t('settings.ai.assistant.modelSelectionDesc') }}</p>

          <label class="form-label">{{ $t('settings.ai.assistant.llmForAssistant') }}</label>
          <select v-if="llmModels.length" v-model="settings.model" class="form-control">
            <option value="">{{ $t('settings.ai.assistant.useDefaultOllama') }}</option>
            <option v-for="m in llmModels" :key="m.id" :value="m.id">{{ m.id }} ({{ m.provider }})</option>
          </select>
          <input v-else v-model="settings.model" class="form-control" placeholder="qwen2.5" />
          <small v-if="!settings.model" class="form-hint">{{ $t('settings.ai.assistant.willUseLlm', { model: ollamaConfig.llmModel }) }}</small>

          <div v-if="modelCapsLabel" class="model-caps">
            <span class="model-caps__badge">{{ $t('settings.ai.assistant.modelUnderstands', { caps: modelCapsLabel.input }) }}</span>
            <span class="model-caps__badge">{{ $t('settings.ai.assistant.modelReplies', { caps: modelCapsLabel.output }) }}</span>
            <p v-if="modelCapsLabel.textOnly" class="form-hint">{{ $t('settings.ai.assistant.modelTextOnlyHint') }}</p>
          </div>

          <label class="form-label">{{ $t('settings.ai.assistant.embeddingForAssistant') }}</label>
          <select v-if="embeddingModels.length" v-model="settings.embedding_model" class="form-control">
            <option value="">{{ $t('settings.ai.assistant.useDefaultOllama') }}</option>
            <option v-for="m in embeddingModels" :key="m.id" :value="m.id">{{ m.id }} ({{ m.provider }})</option>
          </select>
          <input v-else v-model="settings.embedding_model" class="form-control" placeholder="bge-base-zh" />
          <small v-if="!settings.embedding_model" class="form-hint">{{ $t('settings.ai.assistant.willUseEmbedding', { model: ollamaConfig.embeddingModel }) }}</small>

          <div class="related-grid">
            <div class="panel related-card">
              <h4>{{ $t('settings.ai.rag.linkFromAssistantTitle') }}</h4>
              <p class="section-description">{{ $t('settings.ai.rag.linkFromAssistantDesc') }}</p>
              <router-link class="btn btn-outline btn-sm" to="/settings/ai/rag">{{ $t('settings.ai.rag.openPage') }}</router-link>
            </div>
            <div class="panel related-card">
              <h4>{{ $t('settings.ai.agentAccess.linkFromAssistantTitle') }}</h4>
              <p class="section-description">{{ $t('settings.ai.agentAccess.linkFromAssistantDesc') }}</p>
              <router-link class="btn btn-outline btn-sm" to="/settings/ai/agent-access">{{ $t('settings.ai.agentAccess.openPage') }}</router-link>
            </div>
            <div class="panel related-card">
              <h4>{{ $t('settings.ai.voiceCall.linkFromAssistantTitle') }}</h4>
              <p class="section-description">{{ $t('settings.ai.voiceCall.linkFromAssistantDesc') }}</p>
              <router-link class="btn btn-outline btn-sm" to="/settings/ai/voice-call">{{ $t('settings.ai.voiceCall.openPage') }}</router-link>
            </div>
          </div>
        </div>

        <div class="btn-row">
          <button type="submit" class="btn btn-primary" :disabled="!settingsLoaded || saving">
            {{ saving ? $t('common.saving') : $t('common.save') }}
          </button>
          <router-link class="btn btn-outline" to="/settings/ai">{{ $t('settings.ai.assistant.backToAiHub') }}</router-link>
        </div>
      </form>

      <div v-if="editingPlaceholder" class="modal-bg">
        <div class="modal panel">
          <h4>{{ $t('settings.ai.assistant.editPlaceholder') }}</h4>
          <div><b>{{ $t('settings.ai.assistant.tableLabel') }}</b> {{ editingPlaceholder.table_name }}</div>
          <div><b>{{ $t('settings.ai.assistant.columnLabel') }}</b> {{ editingPlaceholder.column_name }}</div>
          <label class="form-label">{{ $t('settings.ai.assistant.placeholderCol') }}</label>
          <input v-model="editingPlaceholderValue" class="form-control">
          <div class="btn-row">
            <button type="button" class="btn btn-primary" @click="savePlaceholderEdit">{{ $t('common.save') }}</button>
            <button type="button" class="btn btn-ghost" @click="closeEditPlaceholder">{{ $t('common.cancel') }}</button>
          </div>
        </div>
      </div>

      <RuleEditor v-if="showRuleEditor" :rule="editingRule" @close="onRuleEditorClose" />
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import BaseLayout from '@/components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import RuleEditor from '@/components/ai-assistant/RuleEditor.vue';
import { resolveModelCapabilities, hasMultimodalInput, hasMultimodalOutput } from '@/shared/modelCapabilities.js';
import { ACCEPT_INPUT_KEYS, cloneDefaultAcceptInput, normalizeAcceptInput } from '@/shared/assistantAcceptInput.js';

const { t } = useI18n();
const router = useRouter();

const defaultEnabledChannels = { web: true, telegram: true, email: true };
const defaultSettings = () => ({
  system_prompt: '',
  model: '',
  embedding_model: '',
  selected_rag_tables: '',
  rules_id: null,
  telegram_settings_id: null,
  email_settings_id: null,
  enabled_channels: { ...defaultEnabledChannels },
  accept_input: cloneDefaultAcceptInput(),
  tone: 'business',
  response_length: 'balanced',
  formality: 'normal',
  adapt_to_user: true,
  explanation_level_default: 'auto',
  allow_gentle_rephrase_offer: true,
  avoid_jargon_by_default: true,
  quality_over_speed: true,
  fallback_if_not_confident: 'chat_or_staff',
  forbid_vulgar_tone: true,
  forbid_patronizing_tone: true,
  forbid_slang_mirroring: true
});

const settings = ref(defaultSettings());
const loadError = ref('');
const settingsLoaded = ref(false);
const saving = ref(false);
const activeTab = ref('general');
const acceptInputKeys = ACCEPT_INPUT_KEYS;
const userTables = ref([]);
const rulesList = ref([]);
const telegramBots = ref([]);
const emailList = ref([]);
const llmModels = ref([]);
const embeddingModels = ref([]);
const ollamaConfig = ref({
  llmModel: '',
  embeddingModel: 'mxbai-embed-large:latest'
});
const placeholders = ref([]);
const editingPlaceholder = ref(null);
const editingPlaceholderValue = ref('');
const showRuleEditor = ref(false);
const editingRule = ref(null);

const tabs = [
  { id: 'general', labelKey: 'settings.ai.assistant.tabGeneral' },
  { id: 'behavior', labelKey: 'settings.ai.assistant.tabBehavior' },
  { id: 'knowledge', labelKey: 'settings.ai.assistant.tabKnowledge' },
  { id: 'channels', labelKey: 'settings.ai.assistant.tabChannels' },
  { id: 'models', labelKey: 'settings.ai.assistant.tabModels' }
];

const assistantChannels = computed(() => [
  { key: 'web', label: t('settings.ai.assistant.channels.web') },
  { key: 'telegram', label: t('settings.ai.assistant.channels.telegram') },
  { key: 'email', label: t('settings.ai.assistant.channels.email') }
]);

const ragTables = computed(() => userTables.value.filter((table) => table.is_rag_source_id === 1));
const selectedRule = computed(() => rulesList.value.find((rule) => Number(rule.id) === Number(settings.value.rules_id)) || null);
const selectedTable = computed(() => ragTables.value.find((table) => Number(table.id) === Number(settings.value.selected_rag_tables)) || null);
const selectedTableLabel = computed(() => selectedTable.value ? getTableDisplayName(selectedTable.value) : t('settings.ai.assistant.selectTable'));
const selectedRuleLabel = computed(() => selectedRule.value ? getRuleDisplayName(selectedRule.value) : t('settings.ai.assistant.selectRules'));
const enabledChannelsSummary = computed(() => assistantChannels.value
  .filter((channel) => settings.value.enabled_channels?.[channel.key])
  .map((channel) => channel.label)
  .join(', ') || t('settings.ai.assistant.disabled'));

const behaviorSummaryLabel = computed(() => {
  const advancedPrompt = String(settings.value.system_prompt || '').trim() !== t('settings.ai.assistant.recommendedSystemPrompt').trim();
  const nonDefault = [
    settings.value.tone !== 'business',
    settings.value.response_length !== 'balanced',
    settings.value.formality !== 'normal',
    settings.value.adapt_to_user !== true,
    settings.value.explanation_level_default !== 'auto',
    settings.value.allow_gentle_rephrase_offer !== true,
    settings.value.avoid_jargon_by_default !== true,
    settings.value.quality_over_speed !== true,
    settings.value.fallback_if_not_confident !== 'chat_or_staff',
    settings.value.forbid_vulgar_tone !== true,
    settings.value.forbid_patronizing_tone !== true,
    settings.value.forbid_slang_mirroring !== true
  ].some(Boolean);
  if (advancedPrompt) return t('settings.ai.assistant.summaryBehaviorAdvanced');
  if (nonDefault) return t('settings.ai.assistant.summaryBehaviorConfigured');
  return t('settings.ai.assistant.summaryBehaviorBasic');
});

const knowledgeWarning = computed(() => {
  if (!settings.value.selected_rag_tables) return t('settings.ai.assistant.warningNoKnowledge');
  if (!settings.value.rules_id) return t('settings.ai.assistant.warningNoRules');
  return '';
});

const channelWarning = computed(() => {
  const anyEnabled = Object.values(settings.value.enabled_channels || {}).some(Boolean);
  return anyEnabled ? '' : t('settings.ai.assistant.warningNoChannels');
});

const modelCapsLabel = computed(() => {
  const modelId = settings.value.model || ollamaConfig.value.llmModel || '';
  if (!modelId) return null;
  const caps = resolveModelCapabilities(modelId);
  const input = ['text', caps.input.audio && 'audio', caps.input.video && 'video', caps.input.image && 'image'].filter(Boolean).join(' / ');
  const output = ['text', caps.output.audio && 'audio', caps.output.video && 'video'].filter(Boolean).join(' / ');
  return {
    input,
    output,
    textOnly: !hasMultimodalInput(caps) && !hasMultimodalOutput(caps)
  };
});

const previewGreeting = computed(() => t('settings.ai.assistant.previewGreetingBody', {
  tone: t(`settings.ai.assistant.previewTone_${settings.value.tone}`),
  formality: t(`settings.ai.assistant.previewFormality_${settings.value.formality}`)
}));

const previewPlain = computed(() => t('settings.ai.assistant.previewPlainBody', {
  length: t(`settings.ai.assistant.previewLength_${settings.value.response_length}`),
  explanation: t(`settings.ai.assistant.previewExplanation_${settings.value.explanation_level_default}`),
  jargon: settings.value.avoid_jargon_by_default
    ? t('settings.ai.assistant.previewJargonAvoid')
    : t('settings.ai.assistant.previewJargonAllowed')
}));

const previewComplex = computed(() => t('settings.ai.assistant.previewComplexBody', {
  quality: settings.value.quality_over_speed
    ? t('settings.ai.assistant.previewQualityCareful')
    : t('settings.ai.assistant.previewQualityFast')
}));

const previewEscalation = computed(() => t('settings.ai.assistant.previewEscalationBody', {
  fallback: t(`settings.ai.assistant.previewFallback_${settings.value.fallback_if_not_confident}`),
  safety: [
    settings.value.forbid_vulgar_tone ? t('settings.ai.assistant.previewSafetyNoVulgar') : null,
    settings.value.forbid_patronizing_tone ? t('settings.ai.assistant.previewSafetyNoPatronizing') : null,
    settings.value.forbid_slang_mirroring ? t('settings.ai.assistant.previewSafetyNoMirroring') : null
  ].filter(Boolean).join(', ')
}));

function normalizeEnabledChannels(channels) {
  if (!channels || typeof channels !== 'object') return { ...defaultEnabledChannels };
  return {
    ...defaultEnabledChannels,
    ...Object.keys(channels).reduce((acc, key) => {
      acc[key] = Boolean(channels[key]);
      return acc;
    }, {})
  };
}

async function loadSettings() {
  settingsLoaded.value = false;
  loadError.value = '';
  try {
    const { data } = await axios.get('/settings/ai-assistant', {
      headers: { 'Cache-Control': 'no-store' }
    });
    if (!data.success) throw new Error('load failed');
    const next = { ...defaultSettings(), ...(data.settings || {}) };
    next.selected_rag_tables = Array.isArray(next.selected_rag_tables) && next.selected_rag_tables.length
      ? next.selected_rag_tables[0]
      : '';
    next.enabled_channels = normalizeEnabledChannels(next.enabled_channels);
    next.accept_input = normalizeAcceptInput(next.accept_input);
    settings.value = next;
    settingsLoaded.value = true;
  } catch (error) {
    loadError.value = t('settings.ai.assistant.loadFailed');
  }
}

async function loadAiConfig() {
  try {
    const { data } = await axios.get('/settings/ai-config');
    if (data.success && data.config) {
      ollamaConfig.value = {
        llmModel: data.config.ollama_llm_model || ollamaConfig.value.llmModel,
        embeddingModel: data.config.ollama_embedding_model || ollamaConfig.value.embeddingModel
      };
    }
  } catch (_) {}
}

async function loadUserTables() {
  const { data } = await axios.get('/tables');
  userTables.value = Array.isArray(data) ? data : [];
}

async function loadRules() {
  const { data } = await axios.get('/settings/ai-assistant-rules');
  rulesList.value = data.rules || [];
}

async function loadTelegramBots() {
  try {
    const { data } = await axios.get('/settings/telegram-settings/list');
    telegramBots.value = data.items || [];
  } catch (_) {
    telegramBots.value = [];
  }
}

async function loadEmailList() {
  try {
    const { data } = await axios.get('/settings/email-settings/list');
    emailList.value = data.items || [];
  } catch (_) {
    emailList.value = [];
  }
}

async function loadLLMModels() {
  const { data } = await axios.get('/settings/llm-models');
  llmModels.value = data.models || [];
}

async function loadEmbeddingModels() {
  const { data } = await axios.get('/settings/embedding-models');
  embeddingModels.value = data.models || [];
}

async function loadPlaceholders() {
  try {
    const { data } = await axios.get('/tables/placeholders/all');
    placeholders.value = Array.isArray(data) ? data : [];
  } catch (_) {
    placeholders.value = [];
  }
}

function buildSettingsPayload() {
  const payload = {
    ...settings.value,
    enabled_channels: normalizeEnabledChannels(settings.value.enabled_channels),
    accept_input: normalizeAcceptInput(settings.value.accept_input),
    selected_rag_tables: settings.value.selected_rag_tables ? [Number(settings.value.selected_rag_tables)] : []
  };
  payload.rules_id = payload.rules_id ? Number(payload.rules_id) : null;
  payload.telegram_settings_id = payload.telegram_settings_id ? Number(payload.telegram_settings_id) : null;
  payload.email_settings_id = payload.email_settings_id ? Number(payload.email_settings_id) : null;
  return payload;
}

async function saveSettings() {
  if (!settingsLoaded.value || saving.value) return;
  saving.value = true;
  try {
    const { data } = await axios.put('/settings/ai-assistant', buildSettingsPayload());
    const next = { ...defaultSettings(), ...(data.settings || {}) };
    next.selected_rag_tables = Array.isArray(next.selected_rag_tables) && next.selected_rag_tables.length
      ? next.selected_rag_tables[0]
      : '';
    next.enabled_channels = normalizeEnabledChannels(next.enabled_channels);
    next.accept_input = normalizeAcceptInput(next.accept_input);
    settings.value = next;
    ElMessage.success(t('settings.ai.assistant.saved'));
    router.push('/settings/ai');
  } catch (error) {
    ElMessage.error(error.response?.data?.error || t('settings.ai.assistant.saveFailed'));
  } finally {
    saving.value = false;
  }
}

function applyRecommendedPrompt() {
  settings.value.system_prompt = t('settings.ai.assistant.recommendedSystemPrompt');
}

function openRuleEditor(ruleId = null) {
  editingRule.value = ruleId ? (rulesList.value.find((rule) => Number(rule.id) === Number(ruleId)) || null) : null;
  showRuleEditor.value = true;
}

async function deleteRule(ruleId) {
  if (!confirm(t('settings.ai.assistant.confirmDeleteRules'))) return;
  await axios.delete(`/settings/ai-assistant-rules/${ruleId}`);
  await loadRules();
  if (Number(settings.value.rules_id) === Number(ruleId)) settings.value.rules_id = null;
}

async function onRuleEditorClose(updated) {
  showRuleEditor.value = false;
  editingRule.value = null;
  if (updated) await loadRules();
}

function openEditPlaceholder(ph) {
  editingPlaceholder.value = { ...ph };
  editingPlaceholderValue.value = ph.placeholder;
}

function closeEditPlaceholder() {
  editingPlaceholder.value = null;
  editingPlaceholderValue.value = '';
}

async function savePlaceholderEdit() {
  if (!editingPlaceholder.value) return;
  await axios.patch(`/tables/column/${editingPlaceholder.value.column_id}`, { placeholder: editingPlaceholderValue.value });
  await loadPlaceholders();
  closeEditPlaceholder();
}

function getTableDisplayName(table) {
  return table?.name || t('settings.ai.assistant.tableFallback', { id: table?.id });
}

function getRuleDisplayName(rule) {
  return rule?.name || t('settings.ai.assistant.rulesFallback', { id: rule?.id });
}

onMounted(async () => {
  await Promise.all([
    loadSettings(),
    loadAiConfig(),
    loadUserTables(),
    loadRules(),
    loadTelegramBots(),
    loadEmailList(),
    loadLLMModels(),
    loadEmbeddingModels(),
    loadPlaceholders()
  ]);
  window.addEventListener('placeholders-updated', loadPlaceholders);
});

onBeforeUnmount(() => {
  window.removeEventListener('placeholders-updated', loadPlaceholders);
});
</script>

<style scoped>
.section-card {
  margin: var(--spacing-xl) 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-md);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  color: var(--color-grey);
  font-size: 0.9rem;
}

.summary-actions,
.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.chat-ai-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: var(--spacing-lg);
}

.chat-ai-tab {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--block-radius, 8px);
  border: 1px solid var(--color-border);
  background: var(--color-white);
  color: var(--color-grey);
  cursor: pointer;
}

.chat-ai-tab.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}

.section-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-light);
  margin-bottom: var(--spacing-md);
}

.channel-grid,
.behavior-grid,
.preview-grid,
.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--spacing-md);
}

.toggle-card,
.behavior-card,
.preview-card,
.related-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 12px);
  padding: var(--spacing-md);
  background: var(--color-white);
}

.toggle-card {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
}

.toggle-card__hint {
  margin-top: 4px;
  color: var(--color-text-light);
  font-size: var(--font-size-sm);
}

.check-row {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  margin-top: var(--spacing-md);
}

.prompt-actions {
  margin: var(--spacing-xs) 0 var(--spacing-sm);
}

.linkish {
  background: transparent;
  border: none;
  color: var(--color-primary);
  padding: 0;
  cursor: pointer;
  font-size: var(--font-size-sm);
  text-decoration: underline;
}

.prompt-area {
  min-height: 14rem;
  resize: vertical;
}

.advanced-box {
  margin-top: var(--spacing-lg);
}

.advanced-box summary {
  cursor: pointer;
  font-weight: 600;
}

.accept-input {
  margin-top: var(--spacing-lg);
  padding: 0.85rem 1rem 0.5rem;
  border: 1px solid var(--color-border, #e9ecef);
  border-radius: var(--radius-sm, 8px);
  background: var(--color-surface, #fff);
}

.accept-input__row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0.45rem 0;
}

.rules-row .form-control {
  flex: 1;
  min-width: 200px;
}

.rules-json {
  background: var(--theme-bg, #fff);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  font-size: var(--font-size-sm);
  margin-top: var(--spacing-sm);
  white-space: pre-wrap;
}

.placeholders-block {
  margin-top: var(--spacing-lg);
}

.placeholders-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--spacing-sm);
  background: var(--color-white);
}

.placeholders-table th,
.placeholders-table td {
  border: 1px solid var(--color-border);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-md);
}

.placeholders-table th {
  background: var(--color-light);
  font-weight: 600;
}

.empty-placeholder {
  color: var(--color-text-light);
}

.modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(31, 41, 55, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  min-width: 320px;
  max-width: 420px;
}

.model-caps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.model-caps__badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-sm, 6px);
  background: var(--color-surface-muted, #f1f5f9);
  font-size: var(--font-size-sm, 13px);
}

.form-hint--warn {
  color: var(--color-danger, #b42318);
}

@media (max-width: 768px) {
  .placeholders-table {
    display: block;
    overflow-x: auto;
  }
}
</style>