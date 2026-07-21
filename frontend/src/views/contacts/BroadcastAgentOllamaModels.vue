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
  <section class="agent-ollama-models">
    <div class="section-heading">
      <h2>{{ t('contacts.broadcast.agent.models.title') }}</h2>
      <el-button :loading="loadingInstalled" @click="refreshInstalled">
        {{ t('common.refresh') }}
      </el-button>
    </div>
    <p class="section-hint">{{ t('contacts.broadcast.agent.models.hint') }}</p>

    <el-alert
      :type="connected ? 'success' : 'warning'"
      :closable="false"
      show-icon
      class="status-alert"
    >
      <template #title>
        {{ connected
          ? t('contacts.broadcast.agent.models.connected')
          : t('contacts.broadcast.agent.models.disconnected') }}
      </template>
    </el-alert>

    <div class="catalog">
      <h3>{{ t('contacts.broadcast.agent.models.recommended') }}</h3>
      <div
        v-for="item in recommendedModels"
        :key="item.name"
        class="catalog-item"
        :class="{ installed: isInstalled(item.name), active: item.name === selectedModel }"
      >
        <div class="catalog-main">
          <div class="catalog-name">{{ item.name }}</div>
          <div class="catalog-meta">
            <span>{{ item.ram }}</span>
            <span>{{ item.speed }}</span>
            <span>{{ item.russian }}</span>
          </div>
          <p class="catalog-desc">{{ item.description }}</p>
          <a
            class="catalog-link"
            :href="item.libraryUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('contacts.broadcast.agent.models.openOnOllama') }}
          </a>
        </div>
        <div class="catalog-actions">
          <el-button
            v-if="!isInstalled(item.name)"
            type="primary"
            :loading="installing === item.name"
            :disabled="!!installing"
            @click="installModel(item.name)"
          >
            {{ t('contacts.broadcast.agent.models.install') }}
          </el-button>
          <el-tag v-else type="success" effect="plain">
            {{ t('contacts.broadcast.agent.models.installed') }}
          </el-tag>
          <el-button
            :disabled="!isInstalled(item.name)"
            type="success"
            plain
            @click="useModel(item.name)"
          >
            {{ t('contacts.broadcast.agent.models.useForAgent') }}
          </el-button>
        </div>
      </div>
    </div>

    <div class="custom-install">
      <h3>{{ t('contacts.broadcast.agent.models.customTitle') }}</h3>
      <p class="section-hint">{{ t('contacts.broadcast.agent.models.customHint') }}</p>
      <div class="custom-row">
        <el-input
          v-model="customModel"
          :placeholder="t('contacts.broadcast.agent.models.customPlaceholder')"
          clearable
        />
        <a
          class="catalog-link"
          href="https://ollama.com/library"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('contacts.broadcast.agent.models.library') }}
        </a>
        <el-button
          type="primary"
          :disabled="!customModel.trim() || !!installing"
          :loading="installing === customModel.trim()"
          @click="installModel(customModel.trim())"
        >
          {{ t('contacts.broadcast.agent.models.install') }}
        </el-button>
      </div>
    </div>

    <div class="installed-block">
      <h3>{{ t('contacts.broadcast.agent.models.installedTitle') }}</h3>
      <p v-if="!installedModels.length" class="empty">
        {{ t('contacts.broadcast.agent.models.noInstalled') }}
      </p>
      <div v-else class="installed-list">
        <div
          v-for="model in installedModels"
          :key="model.name"
          class="installed-item"
          :class="{ active: model.name === selectedModel }"
        >
          <div>
            <div class="installed-name">{{ model.name }}</div>
            <div class="installed-size">{{ formatSize(model.size) }}</div>
          </div>
          <el-button
            size="small"
            type="success"
            plain
            @click="useModel(model.name)"
          >
            {{ t('contacts.broadcast.agent.models.useForAgent') }}
          </el-button>
        </div>
      </div>
    </div>

    <el-alert
      v-if="installing"
      type="info"
      :closable="false"
      show-icon
      class="status-alert"
    >
      <template #title>
        {{ t('contacts.broadcast.agent.models.installing', { model: installing }) }}
      </template>
    </el-alert>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import axios from 'axios';

const props = defineProps({
  selectedModel: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['use-model', 'installed-change']);

const { t } = useI18n();

const connected = ref(false);
const loadingInstalled = ref(false);
const installedModels = ref([]);
const installing = ref('');
const customModel = ref('');
let pollTimer = null;

const recommendedModels = computed(() => ([
  {
    name: 'qwen2.5:1.5b',
    ram: t('contacts.broadcast.agent.models.ram15'),
    speed: t('contacts.broadcast.agent.models.speedFast'),
    russian: t('contacts.broadcast.agent.models.russianGood'),
    description: t('contacts.broadcast.agent.models.desc15'),
    libraryUrl: 'https://ollama.com/library/qwen2.5:1.5b'
  },
  {
    name: 'qwen2.5:3b',
    ram: t('contacts.broadcast.agent.models.ram3'),
    speed: t('contacts.broadcast.agent.models.speedMedium'),
    russian: t('contacts.broadcast.agent.models.russianBetter'),
    description: t('contacts.broadcast.agent.models.desc3'),
    libraryUrl: 'https://ollama.com/library/qwen2.5:3b'
  },
  {
    name: 'qwen2.5:0.5b',
    ram: t('contacts.broadcast.agent.models.ram05'),
    speed: t('contacts.broadcast.agent.models.speedVeryFast'),
    russian: t('contacts.broadcast.agent.models.russianWeak'),
    description: t('contacts.broadcast.agent.models.desc05'),
    libraryUrl: 'https://ollama.com/library/qwen2.5:0.5b'
  },
  {
    name: 'llama3.2:3b',
    ram: t('contacts.broadcast.agent.models.ram3'),
    speed: t('contacts.broadcast.agent.models.speedMedium'),
    russian: t('contacts.broadcast.agent.models.russianOk'),
    description: t('contacts.broadcast.agent.models.descLlama'),
    libraryUrl: 'https://ollama.com/library/llama3.2:3b'
  }
]));

function isInstalled(name) {
  const target = String(name || '').trim();
  if (!target) return false;
  return installedModels.value.some((m) => {
    const current = String(m.name || '');
    return current === target
      || current === `${target}:latest`
      || (current.endsWith(':latest') && current.slice(0, -7) === target);
  });
}

function formatSize(bytes) {
  const value = Number(bytes) || 0;
  if (!value) return '—';
  const gb = value / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = value / (1024 ** 2);
  return `${mb.toFixed(0)} MB`;
}

function libraryBase(modelName) {
  const base = String(modelName || '').split(':')[0];
  return `https://ollama.com/library/${encodeURIComponent(base)}`;
}

async function checkConnection() {
  try {
    const { data } = await axios.get('/ollama/status', { withCredentials: true });
    connected.value = Boolean(data?.connected);
  } catch (error) {
    connected.value = false;
  }
}

async function refreshInstalled() {
  loadingInstalled.value = true;
  try {
    await checkConnection();
    if (!connected.value) {
      installedModels.value = [];
      emit('installed-change', []);
      return;
    }
    const { data } = await axios.get('/ollama/models', { withCredentials: true });
    installedModels.value = data?.models || [];
    emit('installed-change', installedModels.value);
  } catch (error) {
    installedModels.value = [];
    emit('installed-change', []);
  } finally {
    loadingInstalled.value = false;
  }
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPoll(modelName) {
  stopPoll();
  let ticks = 0;
  const maxTicks = 150; // ~10 мин при интервале 4с
  pollTimer = setInterval(async () => {
    ticks += 1;
    await refreshInstalled();
    if (isInstalled(modelName)) {
      installing.value = '';
      stopPoll();
      ElMessage.success(t('contacts.broadcast.agent.models.installDone', { model: modelName }));
      useModel(modelName);
      return;
    }
    if (ticks >= maxTicks) {
      installing.value = '';
      stopPoll();
      ElMessage.warning(t('contacts.broadcast.agent.models.installTimeout', { model: modelName }));
    }
  }, 4000);
}

async function installModel(modelName) {
  const name = String(modelName || '').trim();
  if (!name) return;
  if (!/^[a-zA-Z0-9._:-]+$/.test(name)) {
    ElMessage.error(t('contacts.broadcast.agent.models.invalidName'));
    return;
  }
  if (!connected.value) {
    ElMessage.warning(t('contacts.broadcast.agent.models.disconnected'));
    return;
  }

  installing.value = name;
  try {
    await axios.post('/ollama/install', { model: name }, { withCredentials: true });
    ElMessage.info(t('contacts.broadcast.agent.models.installStarted', { model: name }));
    startPoll(name);
  } catch (error) {
    installing.value = '';
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.agent.models.installError'));
  }
}

function useModel(modelName) {
  emit('use-model', {
    provider: 'ollama',
    model: modelName,
    libraryUrl: libraryBase(modelName)
  });
  ElMessage.success(t('contacts.broadcast.agent.models.selected', { model: modelName }));
}

onMounted(refreshInstalled);

watch(() => props.selectedModel, () => {}, { immediate: true });

onBeforeUnmount(stopPoll);
</script>

<style scoped>
.agent-ollama-models {
  max-width: 920px;
  margin: 24px 0;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.section-heading h2,
.catalog h3,
.custom-install h3,
.installed-block h3 {
  margin: 0 0 8px;
  font-size: 1.2rem;
}

.section-hint {
  margin: 0 0 12px;
  color: #606266;
}

.status-alert {
  margin-bottom: 16px;
}

.catalog-item,
.installed-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 14px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 10px;
  background: #fff;
}

.catalog-item.active,
.installed-item.active {
  border-color: #67c23a;
  background: #f0f9eb;
}

.catalog-name,
.installed-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.catalog-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: #909399;
  font-size: 0.9rem;
  margin-bottom: 6px;
}

.catalog-desc {
  margin: 0 0 8px;
  color: #606266;
  font-size: 0.95rem;
}

.catalog-link {
  color: #409eff;
  text-decoration: none;
  font-size: 0.95rem;
}

.catalog-link:hover {
  text-decoration: underline;
}

.catalog-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 160px;
}

.custom-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.custom-row .el-input {
  flex: 1 1 240px;
}

.installed-size,
.empty {
  color: #909399;
  font-size: 0.9rem;
}

@media (max-width: 720px) {
  .catalog-item,
  .installed-item {
    flex-direction: column;
  }

  .catalog-actions {
    width: 100%;
  }
}
</style>
