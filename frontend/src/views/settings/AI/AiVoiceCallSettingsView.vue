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
        <div class="panel section-card">
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
          <p v-if="savedModelNotForCall" class="form-hint form-hint--warn">{{ $t('settings.ai.voiceCall.modelCallInvalid') }}</p>
          <p class="form-hint">{{ $t('settings.ai.voiceCall.modelCallHint') }}</p>

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
        </div>

        <div class="panel section-card">
          <label class="check-row">
            <input v-model="form.paid_enabled" type="checkbox">
            <span>{{ $t('settings.ai.voiceCall.paidEnabled') }}</span>
          </label>
          <p class="section-description">{{ $t('settings.ai.voiceCall.paidEnabledHint') }}</p>
        </div>

        <div class="panel section-card">
          <h3>{{ $t('settings.ai.voiceCall.packagesTitle') }}</h3>
          <p class="section-description">{{ $t('settings.ai.voiceCall.packagesHint') }}</p>
          <div v-for="(pkg, index) in form.packages" :key="pkg.id" class="pkg-row">
            <input v-model.number="pkg.minutes" type="number" min="1" class="form-control" :placeholder="$t('settings.ai.voiceCall.minutes')">
            <input v-model="pkg.price" class="form-control" :placeholder="$t('settings.ai.voiceCall.price')">
            <button type="button" class="btn btn-danger btn-sm" @click="form.packages.splice(index, 1)">{{ $t('common.delete') }}</button>
          </div>
          <button type="button" class="btn btn-outline btn-sm" @click="addPackage">{{ $t('settings.ai.voiceCall.addPackage') }}</button>
        </div>

        <div v-if="form.paid_enabled" class="panel section-card">
          <h3>{{ $t('settings.ai.voiceCall.payTitle') }}</h3>
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

        <div v-if="form.paid_enabled" class="panel section-card">
          <h3>{{ $t('settings.ai.voiceCall.rpcTitle') }}</h3>
          <p class="section-description">{{ $t('settings.ai.voiceCall.rpcHint') }}</p>
          <RpcProvidersSettings :rpcConfigs="rpcConfigs" @update="loadRpc" />
        </div>

        <div class="panel section-card">
          <h3>{{ $t('settings.ai.voiceCall.bookingTitle') }}</h3>
          <label class="form-label">{{ $t('settings.ai.voiceCall.editor') }}</label>
          <select v-model.number="form.booking_editor_user_id" class="form-control">
            <option :value="null">{{ $t('settings.ai.voiceCall.editorEmpty') }}</option>
            <option v-for="ed in editors" :key="ed.id" :value="ed.id">{{ ed.name }} (#{{ ed.id }})</option>
          </select>
          <p class="form-hint">{{ $t('settings.ai.voiceCall.scheduleHint') }}</p>
          <router-link class="btn btn-outline btn-sm" :to="{ name: 'hub-conference-schedule' }">
            {{ $t('settings.ai.voiceCall.openSchedule') }}
          </router-link>
        </div>

        <div class="panel section-card">
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
.check-row {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
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
