<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { cloneModelOptions, defaultCloneModel, modelForVoice } from '@/service/api/voice-models';
import VoicePicker from '../../voice-lab/components/voice-picker.vue';
import {
  fetchVoiceClones,
  fetchVoiceCatalog,
  synthesizeVoice,
  createVoiceCloneFromUpload,
  type VoiceCloneItem
} from '@/service/api/voice-lab';
import { loadAudioBlob } from '../../sequence-player/workshop/audio';
import { presetReferenceUrl, type WorkshopCharacter } from '../../sequence-player/workshop/model';
defineProps<{ disabled?: boolean }>();
const character = defineModel<WorkshopCharacter>('character', { required: true });
const message = useMessage();
const voices = ref<VoiceCloneItem[]>([]);
const loading = ref(false);
const referenceInput = ref<HTMLInputElement>();
const cloning = ref(false);
const cloneModel = ref(defaultCloneModel);
const error = ref('');
const audition = ref('');
const busy = ref(false);
const auditionLabel = ref('');
const sample = ref('你好，今天我们一起观察画面，想一想接下来会发生什么。');
const voice = computed(() => voices.value.find(v => v.voice === character.value.ttsConfig.voiceId));
const reference = computed(() => presetReferenceUrl(character.value));
const matches = computed(() =>
  voices.value.filter(v =>
    [character.value.name, character.value.displayName, ...(character.value.aliases || [])].includes(
      v.displayName || ''
    )
  )
);
let epoch = 0;
function clear() {
  epoch++;
  busy.value = false;
  if (audition.value) URL.revokeObjectURL(audition.value);
  audition.value = '';
}
watch(
  () => [
    character.value.id,
    character.value.ttsConfig.voiceId,
    character.value.ttsConfig.rate,
    character.value.ttsConfig.model,
    sample.value
  ],
  clear
);
onBeforeUnmount(clear);
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const all: VoiceCloneItem[] = [];
    for (let page = 0; page < 20; page++) {
      const r = await fetchVoiceClones({ pageSize: 100, pageIndex: page });
      if (r.error || !r.data) throw new Error('音色读取失败，请确认语音实验室权限后重试');
      all.push(...r.data.voices);
      if (all.length >= r.data.totalCount) break;
    }
    voices.value = all;
    const catalog = await fetchVoiceCatalog();
    if (!catalog.error && catalog.data) voices.value.push(...catalog.data.voices.filter(v => !all.some(item => item.voice === v.voice)));
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
function choose(value: string | null) {
  character.value.ttsConfig.voiceId = value || '';
  character.value.ttsConfig.model = modelForVoice(voices.value.find(v => v.voice === value)) || '';
  character.value.ttsConfig.engine = 'external';
  character.value.ttsConfig.provider = 'nautilus';
}
async function listen(existing = false) {
  if (!voice.value) return;
  clear();
  const current = epoch;
  busy.value = true;
  try {
    let url = voice.value.auditionAudio?.url;
    if (!existing) {
      const r = await synthesizeVoice({
        text: sample.value,
        voice: voice.value.voice,
        model: modelForVoice(voice.value),
        rate: character.value.ttsConfig.rate,
        languageHint: 'zh',
        origin: 'sequence-player'
      });
      if (r.error || !r.data) throw new Error('试听生成失败');
      url = r.data.audio.url;
    }
    if (!url) throw new Error('该音色没有已有试听，请生成试听');
    const blob = await loadAudioBlob(url);
    if (current !== epoch) return;
    audition.value = URL.createObjectURL(blob);
    auditionLabel.value = existing
      ? '已有音色样本（不代表当前语速）'
      : `当前设置 · ${character.value.ttsConfig.rate.toFixed(1)}×`;
  } catch (e: any) {
    if (current === epoch) message.error(e.message);
  } finally {
    if (current === epoch) busy.value = false;
  }
}
async function uploadReference(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || cloning.value) return;
  const target = character.value;
  cloning.value = true;
  try {
    const form = new FormData();
    form.append('audio', file);
    form.append('targetModel', cloneModel.value);
    form.append('enablePreprocess', 'false');
    form.append('displayName', target.displayName);
    form.append('prefix', 'sequence');
    form.append('languageHint', 'zh');
    const result = await createVoiceCloneFromUpload(form);
    if (result.error || !result.data) throw new Error('参考音频创建声音失败，请检查语音复刻权限');
    await load();
    target.ttsConfig.voiceId = result.data.voice;
    target.ttsConfig.model = result.data.targetModel;
    if (result.data.warning) message.warning(result.data.warning);
    else message.success('声音已创建并绑定，原始录音已保存；请试听后保存人物配置');
  } catch (e: any) {
    message.error(e.message);
  } finally {
    cloning.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="voice-settings">
    <strong>声音</strong>
    <NAlert v-if="error" type="warning" :show-icon="false">{{ error }}</NAlert>
    <VoicePicker
      :value="character.ttsConfig.voiceId || null"
      :voices="voices"
      :loading="loading"
      :disabled="disabled"
      aria-label="人物库声音"
      @update:value="choose"
    />
    <NAlert v-if="!loading && character.ttsConfig.voiceId && !voice" type="warning" :show-icon="false">
      暂时无法访问这个声音，请重新选择或刷新音色。
    </NAlert>
    <label>
      <span class="rate-label">
        语速
        <span>{{ character.ttsConfig.rate.toFixed(1) }}×</span>
      </span>
      <NSlider
        v-model:value="character.ttsConfig.rate"
        :min="0.5"
        :max="2"
        :step="0.1"
        :disabled="disabled"
        aria-label="人物默认语速"
      />
    </label>
    <NButton
      block
      secondary
      type="primary"
      :loading="busy"
      :disabled="disabled || !voice || voice.status !== 'OK' || !sample.trim()"
      @click="listen()"
    >
      试听声音
    </NButton>
    <template v-if="audition">
      <audio :key="audition" :src="audition" controls autoplay aria-label="人物声音试听" />
      <span class="note">{{ auditionLabel }}</span>
    </template>
    <details class="voice-details">
      <summary>更多声音设置</summary>
      <div class="voice-extra">
        <label>
          试听文本
          <NInput
            v-model:value="sample"
            type="textarea"
            :maxlength="300"
            :autosize="{ minRows: 2, maxRows: 4 }"
            aria-label="声音试听文本"
          />
        </label>
        <div class="voice-actions">
          <NButton size="small" :disabled="!voice?.auditionAudio || busy" @click="listen(true)">听原始音色</NButton>
          <NButton size="small" :loading="loading" @click="load">刷新音色</NButton>
        </div>
        <label>新声音的克隆模型
          <NSelect v-model:value="cloneModel" :options="cloneModelOptions" :disabled="disabled || cloning" aria-label="人物克隆模型" />
        </label>
        <NButton size="small" :loading="cloning" :disabled="disabled || busy" @click="referenceInput?.click()">
          上传参考音频创建声音
        </NButton>
        <p v-if="matches.length > 1" class="note">有 {{ matches.length }} 个同名音色，可按模型和末尾标识区分并试听。</p>
        <details v-if="voice">
          <summary>音色详情</summary>
          <div class="voice-meta">
            <span>{{ voice.targetModel }} · {{ voice.status }}</span>
            <code>{{ voice.voice }}</code>
            <span>创建于 {{ voice.createdAt || '未知' }}</span>
          </div>
        </details>
        <details v-if="reference">
          <summary>原始参考样本</summary>
          <audio :src="reference" controls preload="none" aria-label="人物参考样本" />
        </details>
      </div>
    </details>
    <input ref="referenceInput" hidden type="file" accept="audio/*" @change="uploadReference" />
  </div>
</template>
<style scoped>
.voice-settings {
  display: grid;
  gap: 14px;
}
.voice-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
.rate-label {
  display: flex;
  justify-content: space-between;
}
.rate-label span {
  color: rgb(var(--base-text-color) / 0.6);
  font-variant-numeric: tabular-nums;
}
.note,
.voice-meta,
.voice-details {
  color: rgb(var(--base-text-color) / 0.6);
  font-size: 12px;
}
summary {
  cursor: pointer;
}
.voice-extra {
  display: grid;
  gap: 14px;
  padding-top: 16px;
}
.voice-meta {
  display: grid;
  gap: 5px;
  margin-top: 12px;
}
.voice-meta code {
  overflow-wrap: anywhere;
}
audio {
  width: 100%;
}
</style>
