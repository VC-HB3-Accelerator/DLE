<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <button
    type="button"
    class="video-note"
    :class="{ 'video-note--playing': isPlaying }"
    :style="sizeStyle"
    :aria-label="playLabel"
    @click="toggle"
  >
    <video
      ref="videoRef"
      class="video-note__media"
      :src="src"
      playsinline
      webkit-playsinline
      preload="metadata"
      muted
      @ended="onEnded"
    />
    <span class="video-note__ring" aria-hidden="true" />
    <span v-if="!isPlaying" class="video-note__play" aria-hidden="true">
      <svg viewBox="0 0 24 24" class="video-note__play-icon"><path d="M8 5v14l11-7z" /></svg>
    </span>
  </button>
</template>

<script setup>
import { computed, ref, onUnmounted, watch } from 'vue';

const props = defineProps({
  src: { type: String, required: true },
  playLabel: { type: String, default: 'Play' },
  /** Диаметр кружка в px (превью композера меньше истории). */
  size: { type: Number, default: 176 }
});

const videoRef = ref(null);
const isPlaying = ref(false);

const sizeStyle = computed(() => {
  const px = Math.max(48, Number(props.size) || 176);
  return { width: `${px}px`, height: `${px}px` };
});

watch(() => props.src, () => {
  isPlaying.value = false;
  const el = videoRef.value;
  if (el) {
    el.pause();
    el.currentTime = 0;
  }
});

async function toggle() {
  const el = videoRef.value;
  if (!el || !props.src) return;
  try {
    if (el.paused) {
      el.muted = false;
      await el.play();
      isPlaying.value = true;
    } else {
      el.pause();
      isPlaying.value = false;
    }
  } catch (_) {
    isPlaying.value = false;
  }
}

function onEnded() {
  isPlaying.value = false;
}

onUnmounted(() => {
  const el = videoRef.value;
  if (el) {
    el.pause();
    el.removeAttribute('src');
    el.load();
  }
});
</script>

<style scoped>
.video-note {
  position: relative;
  width: 176px;
  height: 176px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  background: #111;
  flex-shrink: 0;
  isolation: isolate;
  /* clip-path надёжнее border-radius для <video> в Chromium/WebKit */
  clip-path: circle(50% at 50% 50%);
  -webkit-clip-path: circle(50% at 50% 50%);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  -webkit-mask-image: -webkit-radial-gradient(white, black);
  mask-image: radial-gradient(circle, #000 99%, transparent 100%);
}

.video-note__media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
  pointer-events: none;
  border-radius: 50%;
  transform: translateZ(0);
}

.video-note__ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.video-note__play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.22);
  border-radius: 50%;
}

.video-note__play-icon {
  width: 24%;
  height: 24%;
  min-width: 18px;
  min-height: 18px;
  max-width: 42px;
  max-height: 42px;
  fill: #fff;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
}

.video-note--playing .video-note__play {
  display: none;
}
</style>
