<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';
import type { VoiceAlignment, VoiceSentenceAlignment } from '@/service/api/voice-lab';

const props = defineProps<{
  src: string;
  text: string;
  alignment?: VoiceAlignment;
}>();

interface SubtitleToken {
  text: string;
  beginTimeMs?: number;
  endTimeMs?: number;
}

const audio = ref<HTMLAudioElement | null>(null);
const transcript = ref<HTMLElement | null>(null);
const currentTimeMs = ref(0);
let frameId: number | null = null;

function sentenceTokens(sentence: VoiceSentenceAlignment): SubtitleToken[] {
  const chars = Array.from(sentence.text);
  const tokens: SubtitleToken[] = [];
  let cursor = 0;
  for (const word of sentence.words) {
    const { beginIndex, endIndex, beginTimeMs, endTimeMs } = word;
    if (!Number.isFinite(beginTimeMs) || !Number.isFinite(endTimeMs) || beginTimeMs < 0 || endTimeMs <= beginTimeMs) continue;
    if (!chars.length) {
      tokens.push({ text: word.text, beginTimeMs, endTimeMs });
      continue;
    }
    // 按原句索引保留标点、空格和数字；忽略供应商在原文以外自动补入的标点。
    if (!Number.isInteger(beginIndex) || !Number.isInteger(endIndex) || beginIndex < cursor || endIndex <= beginIndex || endIndex > chars.length) continue;
    if (beginIndex > cursor) tokens.push({ text: chars.slice(cursor, beginIndex).join('') });
    tokens.push({ text: chars.slice(beginIndex, endIndex).join(''), beginTimeMs, endTimeMs });
    cursor = endIndex;
  }
  if (cursor < chars.length) tokens.push({ text: chars.slice(cursor).join('') });
  return tokens;
}

const sentences = computed(() => props.alignment?.available ? props.alignment.sentences.map(sentenceTokens) : []);
const timedTokens = computed(() => sentences.value.flatMap((tokens, sentenceIndex) => tokens.flatMap((token, tokenIndex) => (
  token.beginTimeMs === undefined ? [] : [{ ...token, id: `${sentenceIndex}-${tokenIndex}` }]
))));
const hasTimestamps = computed(() => timedTokens.value.length > 0);
const followedToken = computed(() => {
  let id = timedTokens.value[0]?.id;
  for (const token of timedTokens.value) {
    if (token.beginTimeMs! <= currentTimeMs.value) id = token.id;
  }
  return id;
});

function progress(token: SubtitleToken) {
  if (token.beginTimeMs === undefined || token.endTimeMs === undefined) return 0;
  return Math.max(0, Math.min(1, (currentTimeMs.value - token.beginTimeMs) / (token.endTimeMs - token.beginTimeMs)));
}

function isActive(token: SubtitleToken) {
  return token.beginTimeMs !== undefined && token.endTimeMs !== undefined &&
    currentTimeMs.value >= token.beginTimeMs && currentTimeMs.value < token.endTimeMs;
}

function syncTime() {
  currentTimeMs.value = (audio.value?.currentTime || 0) * 1000;
}

function stopFrames() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  syncTime();
}

function startFrames() {
  stopFrames();
  // 每帧读取音频时钟，暂停、跳转、倍速和缓冲都不会积累字幕计时误差。
  const tick = () => {
    syncTime();
    if (audio.value && !audio.value.paused && !audio.value.ended) {
      frameId = requestAnimationFrame(tick);
    } else {
      frameId = null;
    }
  };
  tick();
}

function followCurrentWord() {
  const container = transcript.value;
  const word = container?.querySelector<HTMLElement>(`[data-token="${followedToken.value}"]`);
  if (!container || !word) return;
  const bounds = container.getBoundingClientRect();
  const target = word.getBoundingClientRect();
  if (target.top < bounds.top + 12 || target.bottom > bounds.bottom - 12) {
    // 只滚动字幕区域，避免把整张工具页带走；跳转时立即跟随。
    container.scrollTop += target.top - bounds.top - container.clientHeight / 2 + target.height / 2;
  }
}

watch(followedToken, followCurrentWord, { flush: 'post' });
watch(() => props.src, () => {
  stopFrames();
  currentTimeMs.value = 0;
  if (transcript.value) transcript.value.scrollTop = 0;
});

function stopPlayback() {
  audio.value?.pause();
  stopFrames();
}

onDeactivated(stopPlayback);
onBeforeUnmount(stopPlayback);
</script>

<template>
  <div class="synthesis-preview">
    <audio
      ref="audio"
      controls
      preload="metadata"
      :src="src"
      aria-label="合成语音预览"
      @playing="startFrames"
      @pause="stopFrames"
      @ended="stopFrames"
      @waiting="stopFrames"
      @error="stopFrames"
      @emptied="stopFrames"
      @timeupdate="syncTime"
      @seeking="syncTime"
      @seeked="syncTime"
      @ratechange="syncTime"
      @loadedmetadata="syncTime"
    />
    <section v-if="text || sentences.length" class="subtitle-preview" aria-label="跟读字幕">
      <div class="subtitle-heading">
        <span>跟读字幕</span>
        <span class="subtitle-hint">{{ hasTimestamps ? '随音频同步高亮' : '暂无时间戳，显示合成原文' }}</span>
      </div>
      <div ref="transcript" class="subtitle-transcript" tabindex="0" aria-label="合成文本">
        <template v-if="hasTimestamps">
          <p v-for="(tokens, sentenceIndex) in sentences" :key="sentenceIndex">
            <span
              v-for="(token, tokenIndex) in tokens"
              :key="tokenIndex"
              :data-token="`${sentenceIndex}-${tokenIndex}`"
              :class="{ 'subtitle-word': token.beginTimeMs !== undefined, 'is-active': isActive(token) }"
              :style="{ '--word-progress': `${progress(token) * 100}%` }"
            >{{ token.text }}</span>
          </p>
        </template>
        <p v-else>{{ text }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.synthesis-preview {
  min-width: 0;
}

audio {
  display: block;
  width: 100%;
}

.subtitle-preview {
  --subtitle-pending: #606774;
  margin-top: 18px;
}

.subtitle-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}

.subtitle-hint {
  color: var(--subtitle-pending);
  font-size: 12px;
  font-weight: 400;
}

.subtitle-transcript {
  max-height: 248px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgb(128 128 128 / 0.06);
  color: var(--subtitle-pending);
  font-size: 20px;
  font-weight: 500;
  line-height: 1.9;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.subtitle-transcript p {
  margin: 0 0 8px;
}

.subtitle-transcript p:last-child {
  margin-bottom: 0;
}

.subtitle-word {
  background: linear-gradient(to right, var(--voice-primary, #646cff) var(--word-progress), var(--subtitle-pending) var(--word-progress));
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.subtitle-word.is-active {
  text-decoration: underline;
  text-decoration-color: var(--voice-primary, #646cff);
  text-underline-offset: 5px;
}

.dark .subtitle-preview {
  --subtitle-pending: #b0b5c0;
}
</style>
