/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Реестр multimodal capabilities. SoT = имя модели на ассистенте + ключ провайдера.
 * docs.ru/back-docs/TZ_CHAT_AUDIO_VIDEO_MULTIMODAL.ru.md §3.4
 */

const TEXT_ONLY = {
  input: { text: true, audio: false, video: false, image: false },
  output: { text: true, audio: false, video: false }
};

function cloneCaps(caps) {
  return {
    input: { ...TEXT_ONLY.input, ...(caps.input || {}) },
    output: { ...TEXT_ONLY.output, ...(caps.output || {}) }
  };
}

function resolveModelCapabilities(modelName) {
  const n = String(modelName || '').trim().toLowerCase();
  if (!n) return cloneCaps(TEXT_ONLY);

  if (n.includes('gpt-4o-audio') || n.includes('gpt-4o-mini-audio') || n.includes('gpt-4o-realtime')) {
    return cloneCaps({
      input: { text: true, audio: true, image: true },
      output: { text: true, audio: true }
    });
  }

  if (n.includes('omni') || n.includes('qwen2.5-omni') || n.includes('qwen-omni')) {
    return cloneCaps({
      input: { text: true, audio: true, video: true, image: true },
      output: { text: true, audio: true }
    });
  }

  if (n.includes('gpt-4o') || n.includes('gpt-4.1') || n.includes('gpt-4-turbo') || n.includes('gpt-4o-mini')) {
    return cloneCaps({
      input: { text: true, image: true },
      output: { text: true }
    });
  }

  if (n.includes('gemini') && (n.includes('flash') || n.includes('pro') || n.includes('1.5') || n.includes('2.'))) {
    return cloneCaps({
      input: { text: true, audio: true, video: true, image: true },
      output: { text: true, audio: n.includes('native-audio') }
    });
  }

  if (n.includes('claude') && (n.includes('sonnet') || n.includes('opus') || n.includes('haiku'))) {
    return cloneCaps({
      input: { text: true, image: true },
      output: { text: true }
    });
  }

  return cloneCaps(TEXT_ONLY);
}

function hasMultimodalInput(caps) {
  if (!caps?.input) return false;
  return Boolean(caps.input.audio || caps.input.video || caps.input.image);
}

function hasMultimodalOutput(caps) {
  if (!caps?.output) return false;
  return Boolean(caps.output.audio || caps.output.video);
}

module.exports = {
  TEXT_ONLY,
  resolveModelCapabilities,
  hasMultimodalInput,
  hasMultimodalOutput
};
