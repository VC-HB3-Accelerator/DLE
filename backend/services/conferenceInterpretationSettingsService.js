/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const aiProviderSettingsService = require('./aiProviderSettingsService');
const {
  QWEN_INTERPRET_REALTIME_MODEL,
  QWEN_INTERPRET_REALTIME_MODELS,
  getAvailableInterpretationRealtimeModels,
  isInterpretationRealtimeModel,
  checkInterpretationRealtimeModel
} = require('./qwenRealtimeService');

const SETTINGS_PROVIDER = 'qwencloud_interpretation';

async function getSettings() {
  const row = await aiProviderSettingsService.getProviderSettings(SETTINGS_PROVIDER);
  return {
    selected_model: String(row?.selected_model || QWEN_INTERPRET_REALTIME_MODEL).trim()
  };
}

async function getAvailableModels() {
  const provider = await aiProviderSettingsService.getProviderSettings('qwencloud');
  if (!provider?.api_key) {
    const err = new Error('Сначала настройте ключ Qwen Cloud');
    err.code = 'QWENCLOUD_KEY_MISSING';
    err.status = 400;
    throw err;
  }
  const providerModels = await aiProviderSettingsService.getProviderModels('qwencloud', provider);
  const candidates = [
    ...providerModels,
    ...QWEN_INTERPRET_REALTIME_MODELS
  ];
  return getAvailableInterpretationRealtimeModels(provider, candidates);
}

async function saveSettings(payload = {}) {
  const selectedModel = String(payload.selected_model || '').trim();
  if (!isInterpretationRealtimeModel(selectedModel)) {
    const err = new Error('Выбрана неподходящая модель лайв-перевода');
    err.code = 'INTERPRETATION_MODEL_INVALID';
    err.status = 400;
    throw err;
  }

  const provider = await aiProviderSettingsService.getProviderSettings('qwencloud');
  if (!provider?.api_key) {
    const err = new Error('Сначала настройте ключ Qwen Cloud');
    err.code = 'QWENCLOUD_KEY_MISSING';
    err.status = 400;
    throw err;
  }
  if (!(await checkInterpretationRealtimeModel(provider, selectedModel))) {
    const err = new Error('Эта модель недоступна по сохранённому ключу Qwen Cloud');
    err.code = 'INTERPRETATION_MODEL_UNAVAILABLE';
    err.status = 400;
    throw err;
  }

  await aiProviderSettingsService.upsertProviderSettings({
    provider: SETTINGS_PROVIDER,
    selected_model: selectedModel
  });
  return { selected_model: selectedModel };
}

module.exports = {
  SETTINGS_PROVIDER,
  getSettings,
  getAvailableModels,
  saveSettings
};
