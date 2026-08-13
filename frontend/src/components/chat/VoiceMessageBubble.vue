<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="voice" :class="{ 'voice--playing': isPlaying }" @click="toggle">
    <button type="button" class="voice__play" :aria-label="playLabel" @click.stop="toggle">
      <svg v-if="!isPlaying" class="voice__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
      <svg v-else class="voice__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
      </svg>
    </button>

    <div class="voice__body">
      <div
        ref="waveRef"
        class="voice__wave"
        role="slider"
        :aria-valuemin="0"
        :aria-valuemax="100"
        :aria-valuenow="Math.round(progress * 100)"
        tabindex="0"
        @click.stop="seek"
        @keydown.left.prevent="nudge(-2)"
        @keydown.right.prevent="nudge(2)"
      >
        <span
          v-for="(h, i) in bars"
          :key="i"
          class="voice__bar"
          :class="{ 'voice__bar--done': i / bars.length <= progress }"
          :style="{ height: `${h}%` }"
        />
      </div>
      <div class="voice__meta">
        <span>{{ timeLabel }}</span>
      </div>
    </div>

    <audio
      ref="audioRef"
      class="voice__el"
      :src="src"
      preload="metadata"
      @loadedmetadata="onMeta"
      @timeupdate="onTime"
      @ended="onEnded"
      @play="isPlaying = true"
      @pause="isPlaying = false"
    />
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue';

const props = defineProps({
  src: { type: String, required: true },
  playLabel: { type: String, default: 'Play' },
});

const audioRef = ref(null);
const waveRef = ref(null);
const isPlaying = ref(false);
const current = ref(0);
const duration = ref(0);

// Статичная «волна» как в TG — детерминированная по длине src
const bars = computed(() => {
  const seed = String(props.src || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const out = [];
  for (let i = 0; i < 28; i++) {
    const n = ((seed * (i + 3)) % 17) + ((i * 5) % 11);
    out.push(28 + (n % 55));
  }
  return out;
});

const progress = computed(() => {
  if (!duration.value) return 0;
  return Math.min(1, Math.max(0, current.value / duration.value));
});

const timeLabel = computed(() => {
  const total = duration.value || 0;
  const cur = current.value || 0;
  if (isPlaying.value || cur > 0) return `${fmt(cur)} / ${fmt(total)}`;
  return fmt(total);
});

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

async function toggle() {
  const el = audioRef.value;
  if (!el || !props.src) return;
  try {
    if (el.paused) await el.play();
    else el.pause();
  } catch (_) {
    isPlaying.value = false;
  }
}

function onMeta() {
  const el = audioRef.value;
  if (el && Number.isFinite(el.duration)) duration.value = el.duration;
}

function onTime() {
  const el = audioRef.value;
  if (el) current.value = el.currentTime || 0;
}

function onEnded() {
  isPlaying.value = false;
  current.value = 0;
}

function seek(event) {
  const el = audioRef.value;
  const wave = waveRef.value;
  if (!el || !wave || !duration.value) return;
  const rect = wave.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  el.currentTime = ratio * duration.value;
  current.value = el.currentTime;
}

function nudge(deltaSec) {
  const el = audioRef.value;
  if (!el || !duration.value) return;
  el.currentTime = Math.min(duration.value, Math.max(0, (el.currentTime || 0) + deltaSec));
}

onUnmounted(() => {
  const el = audioRef.value;
  if (el) {
    el.pause();
    el.removeAttribute('src');
    el.load();
  }
});
</script>

<style scoped>
.voice {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
  max-width: 280px;
  padding: 8px 12px 8px 8px;
  border-radius: 18px;
  background: rgba(45, 114, 217, 0.12);
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
}

.voice--playing {
  background: rgba(45, 114, 217, 0.18);
}

.voice__play {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: var(--color-primary, #2d72d9);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
}

.voice__icon {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.voice__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.voice__wave {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  width: 100%;
}

.voice__bar {
  flex: 1;
  min-width: 2px;
  max-width: 4px;
  border-radius: 2px;
  background: rgba(45, 114, 217, 0.35);
  align-self: center;
}

.voice__bar--done {
  background: var(--color-primary, #2d72d9);
}

.voice__meta {
  font-size: 0.75rem;
  color: #5c6b7a;
  line-height: 1;
}

.voice__el {
  display: none;
}
</style>
