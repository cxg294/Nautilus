<script setup lang="ts">
/**
 * AudioPlayer — 统一音频播放 & 下载组件
 */
import { ref, watch, onBeforeUnmount } from 'vue';

const props = defineProps<{
  src: string;
  filename?: string;
}>();

const audioRef = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const progress = ref(0);

watch(() => props.src, () => {
  isPlaying.value = false;
  currentTime.value = 0;
  progress.value = 0;
});

function togglePlay() {
  if (!audioRef.value) return;
  if (isPlaying.value) {
    audioRef.value.pause();
  } else {
    audioRef.value.play();
  }
}

function onTimeUpdate() {
  if (!audioRef.value) return;
  currentTime.value = audioRef.value.currentTime;
  if (duration.value > 0) {
    progress.value = (currentTime.value / duration.value) * 100;
  }
}

function onLoaded() {
  if (audioRef.value) {
    duration.value = audioRef.value.duration;
  }
}

function onEnded() {
  isPlaying.value = false;
  progress.value = 0;
  currentTime.value = 0;
}

function onSeek(val: number) {
  if (!audioRef.value) return;
  const seekTime = (val / 100) * duration.value;
  audioRef.value.currentTime = seekTime;
  currentTime.value = seekTime;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function download() {
  const a = document.createElement('a');
  a.href = props.src;
  a.download = props.filename || 'tts_output.wav';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

onBeforeUnmount(() => {
  if (audioRef.value) {
    audioRef.value.pause();
  }
});
</script>

<template>
  <div class="audio-player">
    <audio
      ref="audioRef"
      :src="src"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoaded"
      @ended="onEnded"
      @play="isPlaying = true"
      @pause="isPlaying = false"
    />

    <div class="player-controls">
      <!-- 播放/暂停 -->
      <NButton
        circle
        type="primary"
        size="small"
        @click="togglePlay"
      >
        <template #icon>
          <span :class="isPlaying ? 'i-mdi-pause' : 'i-mdi-play'" />
        </template>
      </NButton>

      <!-- 进度条 -->
      <div class="progress-area">
        <NSlider
          :value="progress"
          :step="0.1"
          :tooltip="false"
          @update:value="onSeek"
        />
        <div class="time-display">
          <span>{{ formatTime(currentTime) }}</span>
          <span>{{ formatTime(duration) }}</span>
        </div>
      </div>

      <!-- 下载 -->
      <NButton quaternary size="small" @click="download">
        <template #icon>
          <span class="i-mdi-download" />
        </template>
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.audio-player {
  background: rgba(128, 128, 128, 0.06);
  border: 1px solid rgba(128, 128, 128, 0.12);
  border-radius: 12px;
  padding: 12px 16px;
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.time-display {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(128, 128, 128, 0.6);
  font-family: monospace;
  padding: 0 2px;
}
</style>
