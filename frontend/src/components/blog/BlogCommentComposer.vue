<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <form class="blog-comment-composer" @submit.prevent="onSubmit" @click.stop>
    <div
      class="blog-comment-composer__shell"
      :class="{ 'blog-comment-composer__shell--multiline': isMultiline }"
    >
      <textarea
        ref="inputRef"
        class="blog-comment-composer__input"
        rows="1"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :maxlength="maxLength"
        @input="onInput"
        @keydown.enter="onEnter"
      />
      <button
        type="submit"
        class="blog-comment-composer__send"
        :disabled="!String(modelValue || '').trim() || disabled"
        :title="sendTitle"
        :aria-label="sendTitle"
      >
        <BlogGlyph name="share" />
      </button>
    </div>
  </form>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import BlogGlyph from './BlogGlyph.vue';

const LINE_HEIGHT = 36;
const MAX_HEIGHT = 280;
const MAX_HEIGHT_MOBILE = 96;

function maxGrowHeight() {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
    return MAX_HEIGHT_MOBILE;
  }
  return MAX_HEIGHT;
}

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  sendTitle: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  maxLength: { type: Number, default: 500 },
});

const emit = defineEmits(['update:modelValue', 'submit']);

const inputRef = ref(null);
const isMultiline = ref(false);

function onInput(event) {
  let value = String(event.target?.value || '');
  if (value.length > props.maxLength) {
    value = value.slice(0, props.maxLength);
  }
  emit('update:modelValue', value);
  nextTick(adjustHeight);
}

function adjustHeight() {
  const el = inputRef.value;
  if (!el) return;
  const value = String(props.modelValue || '');
  el.style.height = 'auto';
  const measured = Math.max(el.scrollHeight, LINE_HEIGHT);
  const shouldExpand =
    measured > LINE_HEIGHT + 2
    || value.includes('\n');
  isMultiline.value = shouldExpand;
  nextTick(() => {
    const field = inputRef.value;
    if (!field) return;
    if (!shouldExpand) {
      field.style.height = `${LINE_HEIGHT}px`;
      return;
    }
    field.style.height = 'auto';
    field.style.height = `${Math.min(Math.max(field.scrollHeight, LINE_HEIGHT), maxGrowHeight())}px`;
  });
}

function onEnter(event) {
  if (event.shiftKey) return;
  event.preventDefault();
  onSubmit();
}

function onSubmit() {
  if (!String(props.modelValue || '').trim() || props.disabled) return;
  emit('submit');
}

watch(
  () => props.modelValue,
  () => nextTick(adjustHeight)
);
</script>

<style scoped>
.blog-comment-composer {
  width: 100%;
  margin: 8px 0 4px;
  padding: 0;
  border: none;
  background: transparent;
  box-sizing: border-box;
}

.blog-comment-composer__shell {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 44px;
  padding: 4px 6px 4px 14px;
  border: 1px solid #dde3ea;
  border-radius: 24px;
  background: #fff;
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.blog-comment-composer__shell:focus-within {
  border-color: #b8c0cc;
  box-shadow: 0 0 0 3px rgba(51, 65, 85, 0.08);
}

.blog-comment-composer__shell--multiline {
  align-items: flex-end;
}

.blog-comment-composer__input {
  flex: 1 1 auto;
  min-width: 0;
  height: 36px;
  min-height: 36px;
  max-height: 280px;
  padding: 0 4px;
  margin: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 36px;
  color: var(--theme-text);
  resize: none;
  overflow-y: hidden;
  box-sizing: border-box;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.blog-comment-composer__shell--multiline .blog-comment-composer__input {
  line-height: 20px;
  padding: 8px 4px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.blog-comment-composer__input::placeholder {
  color: var(--theme-text-muted);
}

.blog-comment-composer__input:focus {
  outline: none;
}

.blog-comment-composer__input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.blog-comment-composer__send {
  flex-shrink: 0;
  align-self: flex-end;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.blog-comment-composer__send :deep(.blog-glyph) {
  width: 22px;
  height: 22px;
  margin-left: 1px;
}

.blog-comment-composer__send:disabled {
  background: transparent;
  color: #c5ccd3;
  cursor: not-allowed;
}

.blog-comment-composer__send:not(:disabled):hover {
  background: transparent;
  color: var(--color-primary-dark);
}

@media (max-width: 768px) {
  .blog-comment-composer__input {
    font-size: 16px;
    max-height: min(96px, 30dvh);
  }

  .blog-comment-composer__shell--multiline .blog-comment-composer__input {
    max-height: min(96px, 30dvh);
  }
}
</style>
