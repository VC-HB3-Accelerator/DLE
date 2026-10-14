'use strict';

const ADAPTERS = Object.freeze({
  chat_completions: Object.freeze({
    id: 'chat_completions',
    endpoint: 'compatible:/chat/completions',
    transport: 'sync',
  }),
  images_generations: Object.freeze({
    id: 'images_generations',
    endpoint: 'compatible:/images/generations',
    transport: 'sync',
  }),
  multimodal_image: Object.freeze({
    id: 'multimodal_image',
    endpoint: 'native:/services/aigc/multimodal-generation/generation',
    transport: 'sync',
  }),
  async_t2i: Object.freeze({
    id: 'async_t2i',
    endpoint: 'native:/services/aigc/text2image/image-synthesis',
    transport: 'async_task',
  }),
  video_synthesis: Object.freeze({
    id: 'video_synthesis',
    endpoint: 'native:/services/aigc/video-generation/video-synthesis',
    transport: 'async_task',
  }),
});

function adapterError(role, model) {
  const error = new Error(`Нет adapter для role=${role}, model=${model}`);
  error.code = 'ADAPTER_UNAVAILABLE';
  error.status = 400;
  return error;
}

function resolveAdapter({ role, model }) {
  const id = String(model || '').toLowerCase();
  if (role === 'brief_chat' || role === 'critic_vision') {
    return ADAPTERS.chat_completions;
  }
  if (role === 'video_gen') {
    return ADAPTERS.video_synthesis;
  }
  if (role !== 'image_gen') throw adapterError(role, model);

  if (/^qwen-image-3(?:[.-]|$)/.test(id)) return ADAPTERS.images_generations;
  if (/t2i|wanx/.test(id)) return ADAPTERS.async_t2i;
  if (/wan.*image|i2i|image/.test(id)) return ADAPTERS.multimodal_image;
  throw adapterError(role, model);
}

module.exports = {
  ADAPTERS,
  resolveAdapter,
};
