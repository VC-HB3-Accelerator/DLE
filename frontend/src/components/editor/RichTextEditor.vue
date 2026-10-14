<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Редактор HTML CMS: TipTap (MIT). v-model — HTML в content.
-->
<template>
  <div ref="rootRef" class="rich-text-editor">
    <div v-if="uploadProgress" class="rte-progress-row">
      <p class="rte-progress">{{ uploadProgress }}</p>
      <button type="button" class="rte-cancel" @click="onCancelUpload">
        {{ t('editor.uploadCancel') }}
      </button>
    </div>

    <div class="rte-shell">
      <div class="rte-toolbar" role="toolbar" :aria-label="t('editor.toolbar')">
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('bold') }" :title="t('editor.bold')" :disabled="!editor" @click="run((ed) => ed.chain().focus().toggleBold().run())">
          <RteToolbarIcon name="bold" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('italic') }" :title="t('editor.italic')" :disabled="!editor" @click="run((ed) => ed.chain().focus().toggleItalic().run())">
          <RteToolbarIcon name="italic" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('underline') }" :title="t('editor.underline')" :disabled="!editor" @click="run((ed) => ed.chain().focus().toggleUnderline().run())">
          <RteToolbarIcon name="underline" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('strike') }" :title="t('editor.strike')" :disabled="!editor" @click="run((ed) => ed.chain().focus().toggleStrike().run())">
          <RteToolbarIcon name="strike" />
        </button>
        <span class="rte-sep" />
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('heading', { level: 2 }) }" :title="t('editor.heading2')" :disabled="!editor" @click="run((ed) => ed.chain().focus().toggleHeading({ level: 2 }).run())">
          <RteToolbarIcon name="h2" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('heading', { level: 3 }) }" :title="t('editor.heading3')" :disabled="!editor" @click="run((ed) => ed.chain().focus().toggleHeading({ level: 3 }).run())">
          <RteToolbarIcon name="h3" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('bulletList') }" :title="t('editor.bulletList')" :disabled="!editor" @click="run((ed) => ed.chain().focus().toggleBulletList().run())">
          <RteToolbarIcon name="ul" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('orderedList') }" :title="t('editor.orderedList')" :disabled="!editor" @click="run((ed) => ed.chain().focus().toggleOrderedList().run())">
          <RteToolbarIcon name="ol" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('blockquote') }" :title="t('editor.blockquote')" :disabled="!editor" @click="run((ed) => ed.chain().focus().toggleBlockquote().run())">
          <RteToolbarIcon name="quote" />
        </button>
        <span class="rte-sep" />
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn({ textAlign: 'left' }) }" :title="t('editor.alignLeft')" :disabled="!editor" @click="run((ed) => ed.chain().focus().setTextAlign('left').run())">
          <RteToolbarIcon name="alignLeft" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn({ textAlign: 'center' }) }" :title="t('editor.alignCenter')" :disabled="!editor" @click="run((ed) => ed.chain().focus().setTextAlign('center').run())">
          <RteToolbarIcon name="alignCenter" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn({ textAlign: 'right' }) }" :title="t('editor.alignRight')" :disabled="!editor" @click="run((ed) => ed.chain().focus().setTextAlign('right').run())">
          <RteToolbarIcon name="alignRight" />
        </button>
        <span class="rte-sep" />
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('link') }" :title="t('editor.link')" :disabled="!editor" @click="onLink">
          <RteToolbarIcon name="link" />
        </button>
        <button type="button" class="rte-btn" :title="t('editor.image')" :disabled="!editor" @click="handleImageClick">
          <RteToolbarIcon name="image" />
        </button>
        <button type="button" class="rte-btn" :title="t('editor.video')" :disabled="!editor" @click="handleVideoClick">
          <RteToolbarIcon name="video" />
        </button>
        <button type="button" class="rte-btn" :title="t('editor.clear')" :disabled="!editor" @click="run((ed) => ed.chain().focus().unsetAllMarks().clearNodes().run())">
          <RteToolbarIcon name="clear" />
        </button>
      </div>

      <editor-content v-if="editor" :editor="editor" class="rte-surface" />
      <bubble-menu
        v-if="editor"
        class="rte-bubble"
        :editor="editor"
        :append-to="appendBubbleTo"
      >
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('bold') }" :title="t('editor.bold')" @click="run((ed) => ed.chain().focus().toggleBold().run())">
          <RteToolbarIcon name="bold" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('italic') }" :title="t('editor.italic')" @click="run((ed) => ed.chain().focus().toggleItalic().run())">
          <RteToolbarIcon name="italic" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('link') }" :title="t('editor.link')" @click="onLink">
          <RteToolbarIcon name="link" />
        </button>
        <button type="button" class="rte-btn" :class="{ 'is-on': isOn('heading', { level: 2 }) }" :title="t('editor.heading2')" @click="run((ed) => ed.chain().focus().toggleHeading({ level: 2 }).run())">
          <RteToolbarIcon name="h2" />
        </button>
      </bubble-menu>
    </div>

    <ContentMediaPickerModal
      :open="pickerKind !== null"
      :kind="pickerKind || 'image'"
      @cancel="closePicker"
      @device="onPickerDevice"
      @select="onPickerSelect"
      @url="onPickerUrl"
    />
    <input
      ref="hiddenFileInput"
      type="file"
      class="rte-hidden-file"
      :accept="pickerAccept"
      @change="onHiddenFile"
    >
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import { BubbleMenu } from '@tiptap/vue-3/menus';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Youtube from '@tiptap/extension-youtube';
import { Placeholder } from '@tiptap/extensions';
import ContentMediaPickerModal from '../content/ContentMediaPickerModal.vue';
import { uploadContentMedia, abortContentMediaUpload, isAbortError } from '../../composables/useChunkedMediaUpload';
import { isLocalCmsMediaUrl, toRelativeCmsMediaUrl } from '../../utils/cmsMediaUrl';
import { TiptapVideo, isYoutubeUrl } from './tiptapVideo';
import RteToolbarIcon from './RteToolbarIcon.vue';

const { t } = useI18n();

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:modelValue']);

const rootRef = ref(null);
const hiddenFileInput = ref(null);
const pickerKind = ref(null);
const pendingKind = ref('image');
const pickerAccept = ref('image/*');
const uploadProgress = ref('');
const activeUploadFile = ref(null);
const uploadAbortController = ref(null);
let savedSelection = null;

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    Underline,
    TextStyle,
    Color,
    Highlight,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    }),
    Image.configure({ inline: false, allowBase64: false }),
    Youtube.configure({
      HTMLAttributes: { class: 'rte-video' },
    }),
    TiptapVideo,
    Placeholder.configure({
      placeholder: () => props.placeholder || t('editor.placeholder'),
    }),
  ],
  editorProps: {
    attributes: {
      class: 'rte-prose',
    },
  },
  onUpdate: ({ editor: ed }) => {
    emit('update:modelValue', ed.getHTML());
  },
});

function appendBubbleTo() {
  return rootRef.value || document.body;
}

function isOn(name, attrs) {
  if (!editor.value) return false;
  if (name && typeof name === 'object') {
    return editor.value.isActive(name);
  }
  return editor.value.isActive(name, attrs);
}

function run(fn) {
  if (!editor.value) return;
  fn(editor.value);
}

function rememberRange() {
  if (!editor.value) return;
  const { from, to } = editor.value.state.selection;
  savedSelection = { from, to };
}

function restoreFocus() {
  if (!editor.value) return;
  const chain = editor.value.chain().focus();
  if (savedSelection) chain.setTextSelection(savedSelection);
  chain.run();
}

function closePicker() {
  pickerKind.value = null;
}

watch(() => props.modelValue, (value) => {
  const ed = editor.value;
  if (!ed) return;
  const next = value || '';
  if (ed.getHTML() === next) return;
  ed.commands.setContent(next, { emitUpdate: false });
});

function insertImageAtRange(url) {
  const rel = toRelativeCmsMediaUrl(url);
  restoreFocus();
  editor.value?.chain().focus().setImage({ src: rel }).run();
}

function insertVideoAtRange(url) {
  const rel = toRelativeCmsMediaUrl(url);
  restoreFocus();
  if (isYoutubeUrl(rel) && editor.value?.commands.setYoutubeVideo) {
    editor.value.chain().focus().setYoutubeVideo({ src: rel }).run();
    return;
  }
  editor.value?.chain().focus().setVideo({
    src: rel,
    embed: !isLocalCmsMediaUrl(rel) && /^https?:/i.test(rel) && !/\.(mp4|webm|ogg|ogv|mov)(\?|#|$)/i.test(rel),
  }).run();
}

function handleImageClick() {
  rememberRange();
  pendingKind.value = 'image';
  pickerAccept.value = 'image/*';
  pickerKind.value = 'image';
}

function handleVideoClick() {
  rememberRange();
  pendingKind.value = 'video';
  pickerAccept.value = 'video/*';
  pickerKind.value = 'video';
}

function onLink() {
  const ed = editor.value;
  if (!ed) return;
  if (ed.isActive('link')) {
    ed.chain().focus().unsetLink().run();
    return;
  }
  const prev = ed.getAttributes('link').href || 'https://';
  const href = window.prompt(t('editor.linkPrompt'), prev);
  if (!href) return;
  ed.chain().focus().setLink({ href, target: '_blank' }).run();
}

function onPickerDevice() {
  closePicker();
  nextTick(() => {
    hiddenFileInput.value?.click();
  });
}

function onPickerSelect(item) {
  closePicker();
  if (!item || !item.url) return;
  if (pendingKind.value === 'video') insertVideoAtRange(item.url);
  else insertImageAtRange(item.url);
}

function onPickerUrl() {
  closePicker();
  const url = prompt(t('editor.videoUrlPrompt'));
  if (url) insertVideoAtRange(url);
}

async function onCancelUpload() {
  const file = activeUploadFile.value;
  if (uploadAbortController.value) uploadAbortController.value.abort();
  if (file) await abortContentMediaUpload(file);
  uploadProgress.value = '';
  activeUploadFile.value = null;
  uploadAbortController.value = null;
}

function getUploadErrorMessage(error) {
  const extractMessage = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'object') {
      if (obj.message) return String(obj.message);
      if (obj.error && typeof obj.error === 'string') return obj.error;
      if (obj.error && typeof obj.error === 'object' && obj.error.message) return String(obj.error.message);
      if (obj.detail) return String(obj.detail);
      if (obj.msg) return String(obj.msg);
      return null;
    }
    return String(obj);
  };

  if (error.response?.status === 503) {
    return error.response?.data?.message || t('editor.serverUnavailable');
  }
  if (error.response?.data?.success === false && error.response?.data?.message) {
    const msg = extractMessage(error.response.data.message);
    return msg || (typeof error.response.data.message === 'string' ? error.response.data.message : t('editor.serverError'));
  }
  if (error.response?.data?.error?.message) {
    return String(error.response.data.error.message);
  }
  if (error.response?.data?.message) {
    const msg = extractMessage(error.response.data.message);
    return msg || (typeof error.response.data.message === 'string' ? error.response.data.message : t('editor.serverError'));
  }
  if (error.response?.data?.error) {
    const err = error.response.data.error;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      return err.message || err.detail || err.msg || t('editor.serverError');
    }
    return String(err);
  }
  if (error.response?.data) {
    const msg = extractMessage(error.response.data);
    if (msg) return msg;
    if (typeof error.response.data === 'string') return error.response.data;
  }
  if (error.message) return error.message;
  return t('common.unknownError');
}

async function onHiddenFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const controller = new AbortController();
  uploadAbortController.value = controller;
  activeUploadFile.value = file;
  try {
    const data = await uploadContentMedia(file, {
      signal: controller.signal,
      onProgress: ({ percent, phase, part, totalParts }) => {
        if (phase === 'parts') {
          uploadProgress.value = t('editor.chunkedProgress', {
            percent,
            part: part || 0,
            total: totalParts || 0,
          });
        } else if (percent < 100) {
          uploadProgress.value = t('content.media.uploadProgress', { percent });
        } else {
          uploadProgress.value = '';
        }
      },
    });
    uploadProgress.value = '';
    if (!data || !data.url) {
      alert(t('editor.invalidResponse'));
      return;
    }
    if (pendingKind.value === 'video' || data.type === 'video') insertVideoAtRange(data.url);
    else insertImageAtRange(data.url);
  } catch (error) {
    uploadProgress.value = '';
    if (isAbortError(error)) return;
    const errorMessage = getUploadErrorMessage(error);
    const key = pendingKind.value === 'video' ? 'editor.videoUploadError' : 'editor.imageUploadError';
    alert(t(key, { message: errorMessage }));
  } finally {
    activeUploadFile.value = null;
    uploadAbortController.value = null;
  }
}

function getHTML() {
  return editor.value ? editor.value.getHTML() : '';
}

function setHTML(html) {
  if (!editor.value) return;
  editor.value.commands.setContent(html || '', { emitUpdate: false });
}

defineExpose({
  getHTML,
  setHTML,
});
</script>

<style scoped>
.rich-text-editor {
  width: 100%;
}

.rte-hidden-file {
  display: none;
}

.rte-progress-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px;
}

.rte-progress {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-grey, #6b7280);
}

.rte-cancel {
  border: 1px solid var(--color-border, #d1d5db);
  background: #fff;
  color: var(--color-dark, #374151);
  border-radius: 8px;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.rte-shell {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.rte-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-border, #eef0f3);
  background: #fbfcfd;
}

.rte-sep {
  width: 1px;
  height: 18px;
  margin: 0 6px;
  background: var(--color-border, #e5e7eb);
}

.rte-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  min-width: 34px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  cursor: pointer;
}

.rte-btn:hover:not(:disabled) {
  background: #eef2f6;
}

.rte-btn.is-on {
  background: #e8eef5;
  color: var(--color-primary, #1f2a37);
}

.rte-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.rte-surface {
  min-height: 280px;
}

.rte-bubble {
  display: flex;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

:deep(.rte-prose) {
  min-height: 280px;
  padding: 16px 18px 24px;
  outline: none;
  font-size: 1.05rem;
  line-height: 1.65;
  color: var(--color-dark, #1f2937);
}

:deep(.rte-prose p) {
  margin: 0.45em 0;
}

:deep(.rte-prose h1),
:deep(.rte-prose h2),
:deep(.rte-prose h3) {
  margin: 1.1em 0 0.4em;
  line-height: 1.25;
  font-weight: 650;
}

:deep(.rte-prose img),
:deep(.rte-prose .rte-video),
:deep(.rte-prose iframe),
:deep(.rte-prose video) {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  margin: 1rem 0;
  border-radius: 10px;
}

:deep(.rte-prose video),
:deep(.rte-prose iframe.rte-video) {
  min-height: 280px;
  background: #111;
}

:deep(.rte-prose blockquote) {
  margin: 0.8em 0;
  padding: 0 0 0 14px;
  border-left: 3px solid var(--color-border, #d1d5db);
  color: #4b5563;
}

:deep(.rte-prose a) {
  color: var(--color-primary, #1f2a37);
}

:deep(.rte-prose p.is-editor-empty:first-child::before),
:deep(.rte-prose .is-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: #94a3b8;
  pointer-events: none;
}

@media (max-width: 768px) {
  .rte-toolbar {
    gap: 0;
  }

  .rte-btn {
    min-width: 36px;
    height: 36px;
  }
}
</style>
