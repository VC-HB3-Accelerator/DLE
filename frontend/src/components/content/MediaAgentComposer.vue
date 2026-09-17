<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <form class="composer" :class="{ 'composer--hero': hero }" @submit.prevent="$emit('send')" @click.stop>
    <div v-if="pendingFiles.length || pendingDrive.length" class="composer__chips">
      <span v-for="(f, i) in pendingFiles" :key="`f-${i}`" class="chip">
        {{ f.name }}
        <button type="button" @click="$emit('remove-file', i)">×</button>
      </span>
      <span v-for="(d, i) in pendingDrive" :key="`d-${i}`" class="chip">
        {{ d.name }}
        <button type="button" @click="$emit('remove-drive', i)">×</button>
      </span>
    </div>
    <div class="composer__box">
      <textarea
        :value="modelValue"
        :rows="hero ? 3 : 2"
        :placeholder="t('content.media.agent.placeholder')"
        :disabled="sending"
        @input="$emit('update:modelValue', $event.target.value)"
        @keydown.enter.exact.prevent="$emit('send')"
      />
      <div class="composer__bar">
        <button
          type="button"
          class="icon-btn"
          :title="t('content.media.agent.attach')"
          @click="$emit('plus')"
        >
          <UiGlyph name="plus" :size="18" />
        </button>
        <button
          type="button"
          class="icon-btn"
          :title="t('content.media.agent.skills')"
          @click="$emit('skills-menu')"
        >
          <UiGlyph name="settings" :size="16" />
        </button>
        <span class="composer__grow" />
        <button
          type="submit"
          class="send"
          :disabled="sending || (!modelValue.trim() && !pendingFiles.length && !pendingDrive.length)"
        >
          <UiGlyph name="arrow-right" :size="16" />
        </button>
      </div>
    </div>
    <div v-if="plusOpen" class="menu">
      <button type="button" @click="$emit('add-files')">
        <UiGlyph name="paperclip" :size="16" />
        {{ t('content.media.agent.addFiles') }}
      </button>
      <button type="button" @click="$emit('drive')">
        <UiGlyph name="folder" :size="16" />
        {{ t('content.media.agent.chooseDrive') }}
      </button>
      <button type="button" @click="$emit('open-skills')">
        <UiGlyph name="cube" :size="16" />
        {{ t('content.media.agent.skills') }}
        <UiGlyph name="chevron-right" :size="14" />
      </button>
    </div>
    <div v-if="skillOpen" class="menu menu--skills">
      <button
        v-for="s in installedSkills"
        :key="s.id"
        type="button"
        @click="$emit('use-skill', s)"
      >{{ s.title }}</button>
      <p v-if="!installedSkills.length">{{ t('content.media.agent.noInstalledSkills') }}</p>
      <button type="button" @click="$emit('skills-page')">
        {{ t('content.media.agent.openMarketplace') }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import UiGlyph from '@/components/UiGlyph.vue';

defineProps({
  modelValue: { type: String, default: '' },
  sending: Boolean,
  pendingFiles: { type: Array, default: () => [] },
  pendingDrive: { type: Array, default: () => [] },
  plusOpen: Boolean,
  skillOpen: Boolean,
  installedSkills: { type: Array, default: () => [] },
  hero: Boolean,
});

defineEmits([
  'update:modelValue', 'send', 'plus', 'skills-menu', 'add-files', 'drive',
  'open-skills', 'use-skill', 'remove-file', 'remove-drive', 'skills-page',
]);

const { t } = useI18n();
</script>

<style scoped>
.composer {
  width: min(720px, calc(100% - 32px));
  margin: 0 auto 20px;
  position: relative;
}

.composer--hero {
  width: min(680px, calc(100% - 32px));
}

.composer__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 0.8rem;
}

.chip button {
  border: 0;
  background: none;
  cursor: pointer;
}

.composer__box {
  border: 1px solid #ececec;
  border-radius: 24px;
  padding: 14px 14px 10px;
  background: #fff;
  box-shadow: 0 10px 40px rgba(17, 24, 39, 0.06);
}

.composer__box textarea {
  width: 100%;
  border: 0;
  resize: none;
  outline: none;
  font: inherit;
  min-height: 52px;
  box-sizing: border-box;
}

.composer__bar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.composer__grow {
  flex: 1;
}

.pro-mini {
  font-size: 0.7rem;
  font-weight: 700;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 1px 6px;
  color: #6b7280;
  margin-right: 4px;
}

.icon-btn,
.send {
  border: 0;
  background: #f3f4f6;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #374151;
}

.send {
  transform: rotate(-90deg);
}

.send:disabled,
.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.menu {
  position: absolute;
  left: 12px;
  bottom: 58px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  padding: 8px;
  min-width: 220px;
  z-index: 8;
}

.menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 0;
  background: none;
  padding: 10px;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.menu button:hover {
  background: #f3f4f6;
}

.menu p {
  margin: 8px 10px;
  color: #9ca3af;
  font-size: 0.85rem;
}
</style>
