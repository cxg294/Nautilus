<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMessage, type UploadFileInfo } from 'naive-ui';
import {
  fetchVoiceEffectPresets,
  renderVoiceEffect,
  uploadEffectSource,
  type VoiceEffectParams,
  type VoiceEffectPreset,
  type VoiceLabAudio,
} from '@/service/api/voice-lab';
import { getToken } from '@/store/modules/auth/shared';

const message = useMessage();
const fileList = ref<UploadFileInfo[]>([]);
const sourceAudio = ref<VoiceLabAudio | null>(null);
const resultAudio = ref<VoiceLabAudio | null>(null);
const rendering = ref(false);
const uploading = ref(false);
const selectedPreset = ref('original');

const fallbackPresets: VoiceEffectPreset[] = [
  { id: 'original', label: '原声清晰', description: '不改变角色，只做轻微响度规整', params: {} as VoiceEffectParams },
  { id: 'robot', label: '电子机器人', description: '清晰、克制的机械播报感', params: {} as VoiceEffectParams },
  { id: 'heavy-mech', label: '重装机甲', description: '低沉厚重，保留台词可懂度', params: {} as VoiceEffectParams },
  { id: 'playful-high', label: '童趣高音', description: '明亮、活泼的高音质感', params: {} as VoiceEffectParams },
  { id: 'telephone', label: '电话', description: '窄频、压缩的电话与对讲机效果', params: {} as VoiceEffectParams },
];
const presets = ref<VoiceEffectPreset[]>(fallbackPresets);
const params = ref<VoiceEffectParams>({
  pitchSemitones: 0, effectStrength: 0.55, clarity: 0.7, space: 0.1,
});

const presetOptions = computed(() => presets.value.map(item => ({ label: item.label, value: item.id })));
const sourceUrl = computed(() => sourceAudio.value?.url ? withAuthQuery(sourceAudio.value.url) : '');
const resultUrl = computed(() => resultAudio.value?.url ? withAuthQuery(resultAudio.value.url) : '');

function withAuthQuery(url: string) {
  const token = getToken();
  return token && url.startsWith('/api/') ? `${url}?_token=${encodeURIComponent(token)}` : url;
}

function formatPercent(value: number) { return `${Math.round(value * 100)}%`; }

async function loadPresets() {
  const { data, error } = await fetchVoiceEffectPresets();
  if (!error && data?.presets?.length) {
    presets.value = data.presets;
    applyPreset(selectedPreset.value);
  }
}

function applyPreset(id: string) {
  selectedPreset.value = id;
  const preset = presets.value.find(item => item.id === id);
  if (preset?.params && Object.keys(preset.params).length) params.value = { ...preset.params };
}

async function handleUpload(options: { file: UploadFileInfo }) {
  const file = options.file.file;
  if (!file) return;
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('audio', file);
    const { data, error } = await uploadEffectSource(formData);
    if (!error && data) {
      sourceAudio.value = data;
      resultAudio.value = null;
      message.success('原音频已载入效果器');
    }
  } finally {
    uploading.value = false;
  }
}

function handleFileList(files: UploadFileInfo[]) {
  fileList.value = files.slice(-1);
  const file = fileList.value[0];
  if (file?.file) handleUpload({ file });
}

async function render() {
  if (!sourceAudio.value) {
    message.warning('请先上传一段 wav、mp3 或 m4a 音频');
    return;
  }
  rendering.value = true;
  try {
    const { data, error } = await renderVoiceEffect({
      sourceFileName: sourceAudio.value.fileName,
      sourceDownloadName: sourceAudio.value.downloadName,
      presetId: selectedPreset.value,
      params: params.value,
    });
    if (!error && data) {
      resultAudio.value = data.audio;
      message.success('效果试听已生成');
    }
  } finally {
    rendering.value = false;
  }
}

loadPresets();
</script>

<template>
  <div class="effects-workspace">
    <section class="panel effects-input-panel">
      <div class="panel-header">
        <div><h2>效果器</h2><p>上传一段原音频，选择预设后用参数实时探索听感。</p></div>
      </div>
      <NUpload :file-list="fileList" :max="1" :default-upload="false" accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4" @update:file-list="handleFileList">
        <NUploadDragger>
          <div class="effects-upload"><SvgIcon icon="mdi:music-box-multiple-outline" /><strong>{{ sourceAudio ? sourceAudio.fileName : '点击或拖入原音频' }}</strong><span>wav、mp3、m4a，最大 30MB</span></div>
        </NUploadDragger>
      </NUpload>
      <div v-if="sourceUrl" class="effects-source"><span>原音频</span><audio controls :src="sourceUrl" /></div>
    </section>

    <section class="panel effects-control-panel">
      <div class="panel-header"><div><h2>预设与参数</h2><p>改动参数后点击生成试听；预设可随时重新套用。</p></div></div>
      <NFormItem label="预设参数"><NSelect :value="selectedPreset" :options="presetOptions" @update:value="applyPreset" /></NFormItem>
      <div class="effects-presets"><button v-for="preset in presets" :key="preset.id" type="button" :class="{ active: selectedPreset === preset.id }" @click="applyPreset(preset.id)"><strong>{{ preset.label }}</strong><span>{{ preset.description }}</span></button></div>
      <div class="effects-grid">
        <NFormItem label="音高（半音）"><div class="slider-row"><NSlider v-model:value="params.pitchSemitones" :min="-12" :max="12" :step="1" /><NInputNumber v-model:value="params.pitchSemitones" :min="-12" :max="12" /></div></NFormItem>
        <NFormItem label="效果强度"><div class="slider-row"><NSlider v-model:value="params.effectStrength" :min="0" :max="1" :step="0.01" /><span>{{ formatPercent(params.effectStrength) }}</span></div></NFormItem>
        <NFormItem label="清晰度优先"><div class="slider-row"><NSlider v-model:value="params.clarity" :min="0" :max="1" :step="0.01" /><span>{{ formatPercent(params.clarity) }}</span></div></NFormItem>
        <NFormItem label="空间感"><div class="slider-row"><NSlider v-model:value="params.space" :min="0" :max="1" :step="0.01" /><span>{{ formatPercent(params.space) }}</span></div></NFormItem>
      </div>
      <div class="action-row"><NButton type="primary" :loading="rendering || uploading" @click="render"><template #icon><SvgIcon icon="mdi:play-circle-outline" /></template>生成试听</NButton></div>
    </section>

    <section class="panel effects-result-panel">
      <div class="panel-header"><div><h2>效果试听</h2><p>{{ resultAudio?.downloadName || resultAudio?.fileName || '先上传并调整参数' }}</p></div></div>
      <div v-if="resultUrl" class="audio-result"><audio controls :src="resultUrl" /><a :href="resultUrl" :download="resultAudio?.downloadName || resultAudio?.fileName">下载 WAV</a></div>
      <div v-else class="empty-result"><SvgIcon icon="mdi:tune-vertical" /><span>生成后在这里对比试听</span></div>
    </section>
  </div>
</template>

<style scoped>
.effects-workspace { display: grid; grid-template-columns: minmax(260px, .75fr) minmax(460px, 1.35fr) minmax(280px, .8fr); gap: 16px; }
.effects-input-panel, .effects-control-panel, .effects-result-panel { min-height: 470px; }
.effects-upload { min-height: 160px; display: grid; place-items: center; align-content: center; gap: 8px; text-align: center; }.effects-upload :deep(svg) { width: 32px; height: 32px; color: var(--voice-primary); }.effects-upload span, .effects-source span { color: rgba(128,128,128,.88); font-size: 12px; }
.effects-source { display: grid; gap: 8px; margin-top: 16px; }.effects-source audio, .audio-result audio { width: 100%; }
.effects-presets { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 6px; margin: -2px 0 14px; }.effects-presets button { min-width: 0; border: 1px solid rgba(128,128,128,.2); border-radius: 7px; background: transparent; padding: 8px; text-align: left; color: inherit; cursor: pointer; }.effects-presets button.active { border-color: var(--voice-primary); background: var(--voice-primary-soft); }.effects-presets span { display:block; overflow:hidden; margin-top:3px; color:rgba(128,128,128,.85); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.effects-grid { display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); column-gap:14px; }.slider-row { display:grid; grid-template-columns:minmax(0,1fr) 90px; align-items:center; gap:10px; width:100%; }.slider-row > span { color:rgba(128,128,128,.9); font-size:12px; text-align:right; }.audio-result a { justify-self:start; color:var(--voice-primary); font-size:12px; text-decoration:none; }
@media (max-width: 1300px) { .effects-workspace { grid-template-columns: minmax(300px,.8fr) minmax(440px,1.2fr); }.effects-result-panel { grid-column: span 2; min-height:220px; }.effects-presets { grid-template-columns: repeat(3,minmax(0,1fr)); } }
</style>
