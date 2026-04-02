<script setup lang="ts">
/**
 * VoiceClonePanel — 🎤 声音克隆 Tab
 * 对应 :8000 Base run_voice_clone
 */
import { ref, computed } from 'vue';
import { useMessage } from 'naive-ui';
import { useTts, uploadAudio, LANGUAGE_OPTIONS } from '../composables/use-tts';
import AudioPlayer from './AudioPlayer.vue';

const message = useMessage();
const { loading, result, error, synthesize, reset } = useTts();

const language = ref('Auto');
const targetText = ref('');
const refText = ref('');
const useXVector = ref(false);
const refAudioFile = ref<File | null>(null);
const refAudioUrl = ref('');
const uploading = ref(false);

const languageOpts = LANGUAGE_OPTIONS.map(l => ({ label: l.label, value: l.value }));

const canGenerate = computed(() => {
  if (!targetText.value.trim()) return false;
  if (!refAudioFile.value) return false;
  if (!useXVector.value && !refText.value.trim()) return false;
  return true;
});

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('audio/')) {
    message.warning('请选择音频文件');
    return;
  }
  refAudioFile.value = file;
  refAudioUrl.value = URL.createObjectURL(file);
}

function removeRefAudio() {
  if (refAudioUrl.value) URL.revokeObjectURL(refAudioUrl.value);
  refAudioFile.value = null;
  refAudioUrl.value = '';
}

async function handleGenerate() {
  if (!canGenerate.value || !refAudioFile.value) return;
  loading.value = true;
  error.value = '';
  try {
    uploading.value = true;
    const paths = await uploadAudio('base', refAudioFile.value);
    uploading.value = false;
    if (!paths || paths.length === 0) throw new Error('参考音频上传失败');
    await synthesize('base', 'run_voice_clone', [
      { path: paths[0], meta: { _type: 'gradio.FileData' } },
      refText.value,
      useXVector.value,
      targetText.value,
      language.value,
    ]);
  } catch (err: any) {
    uploading.value = false;
    error.value = err.message;
    message.error(`操作失败：${err.message}`);
    loading.value = false;
  }
}

function handleReset() {
  targetText.value = '';
  refText.value = '';
  reset();
}
</script>

<template>
  <div class="voice-clone-panel">
    <div class="panel-body">
      <div class="input-section">
        <div class="input-card">
          <!-- 参考音频 -->
          <div class="section-label">参考音频</div>
          <div v-if="!refAudioFile" class="upload-area" @click="($refs.fileInput as HTMLInputElement).click()">
            <input ref="fileInput" type="file" accept="audio/*" hidden @change="handleFileChange" />
            <span class="upload-icon">🎙️</span>
            <div class="upload-text-wrap">
              <span class="upload-text">点击上传参考音频</span>
              <span class="upload-hint">支持 WAV / MP3 / M4A 格式</span>
            </div>
          </div>
          <div v-else class="ref-audio-card">
            <div class="ref-audio-info">
              <span class="i-mdi-music-note" style="font-size: 18px; color: #638cff;" />
              <div class="ref-file-meta">
                <span class="ref-filename">{{ refAudioFile.name }}</span>
                <span class="ref-filesize">{{ (refAudioFile.size / 1024).toFixed(1) }} KB</span>
              </div>
              <NButton circle size="tiny" quaternary @click="removeRefAudio">
                <template #icon><span class="i-mdi-close" /></template>
              </NButton>
            </div>
            <audio v-if="refAudioUrl" :src="refAudioUrl" controls class="ref-audio-preview" />
          </div>

          <!-- 参考文本 + 语种/选项 同行 -->
          <div class="clone-options-row">
            <div class="form-item" style="flex: 1">
              <div class="section-label">
                参考音频文本
                <NTag v-if="useXVector" size="tiny" round :bordered="false" type="info">已跳过</NTag>
              </div>
              <NInput
                v-model:value="refText"
                placeholder="输入参考音频对应的文字内容"
                :disabled="useXVector"
                size="small"
              />
            </div>
            <div class="form-item" style="width: 140px">
              <div class="section-label">语种</div>
              <NSelect v-model:value="language" :options="languageOpts" size="small" />
            </div>
          </div>
          <NCheckbox v-model:checked="useXVector" size="small">
            仅用说话人向量（无需参考文本，克隆效果有限）
          </NCheckbox>

          <!-- 合成文本 -->
          <div class="section-label" style="margin-top: 8px">待合成文本</div>
          <NInput
            v-model:value="targetText"
            type="textarea"
            placeholder="输入希望用克隆声音说出的文本..."
            :autosize="{ minRows: 3, maxRows: 6 }"
          />

          <div class="action-row">
            <NButton
              type="primary"
              :loading="loading"
              :disabled="!canGenerate"
              size="large"
              @click="handleGenerate"
            >
              <template #icon><span class="i-mdi-play" /></template>
              {{ uploading ? '上传中...' : '克隆并合成' }}
            </NButton>
            <NButton v-if="result" quaternary size="small" @click="handleReset">清除结果</NButton>
          </div>

          <NAlert v-if="error" type="error" :title="error" closable style="margin-top: 12px" @close="error = ''" />
        </div>
      </div>

      <!-- 结果区 -->
      <div class="result-section">
        <div class="result-card">
          <template v-if="loading">
            <div class="result-placeholder">
              <NSpin size="large" />
              <p class="loading-hint">{{ uploading ? '上传参考音频...' : 'AI 克隆音色中...' }}</p>
            </div>
          </template>
          <template v-else-if="result">
            <div class="result-content">
              <NTag type="success" size="small" round>
                <template #icon><span class="i-mdi-check-circle" /></template>
                克隆合成完成
              </NTag>
              <AudioPlayer :src="result.audioUrl" :filename="`tts_clone_${Date.now()}.wav`" />
              <div v-if="result.status" class="result-status">{{ result.status }}</div>
            </div>
          </template>
          <template v-else>
            <div class="result-placeholder">
              <div class="placeholder-icon-wrap">
                <span class="placeholder-icon">🎤</span>
              </div>
              <p class="placeholder-title">等待合成</p>
              <p class="placeholder-text">上传一段参考音频<br>AI 将克隆其音色合成新语音</p>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voice-clone-panel { height: 100%; overflow-y: auto; }

.panel-body { display: flex; gap: 20px; height: 100%; }

.input-section { flex: 1; min-width: 0; }

.input-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  border-radius: 14px;
  background: rgba(128, 128, 128, 0.03);
  border: 1px solid rgba(128, 128, 128, 0.08);
}

.result-section { flex: 0 0 320px; display: flex; flex-direction: column; }

.result-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: rgba(128, 128, 128, 0.03);
  border: 1px solid rgba(128, 128, 128, 0.08);
  overflow: hidden;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(128, 128, 128, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── 上传区（紧凑横向） ── */
.upload-area {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border: 2px dashed rgba(128, 128, 128, 0.15);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(128, 128, 128, 0.02);
}
.upload-area:hover {
  border-color: #638cff;
  background: rgba(99, 140, 255, 0.04);
}
.upload-icon { font-size: 28px; flex-shrink: 0; }
.upload-text-wrap { display: flex; flex-direction: column; }
.upload-text { font-size: 14px; font-weight: 500; }
.upload-hint { font-size: 11px; color: rgba(128, 128, 128, 0.4); }

.clone-options-row { display: flex; gap: 12px; }

/* ── 文件卡片 ── */
.ref-audio-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 12px; border-radius: 10px;
  border: 1.5px solid rgba(99, 140, 255, 0.2);
  background: rgba(99, 140, 255, 0.03);
}
.ref-audio-info { display: flex; align-items: center; gap: 8px; }
.ref-file-meta { flex: 1; display: flex; flex-direction: column; }
.ref-filename { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ref-filesize { font-size: 11px; color: rgba(128, 128, 128, 0.5); }
.ref-audio-preview { width: 100%; height: 32px; border-radius: 6px; }

.form-row { display: flex; gap: 12px; }
.form-item { display: flex; flex-direction: column; gap: 6px; }
.action-row { display: flex; align-items: center; gap: 12px; margin-top: 6px; }

/* ── 结果区 ── */
.result-placeholder {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px; padding: 24px;
}
.placeholder-icon-wrap {
  width: 64px; height: 64px; border-radius: 16px;
  background: rgba(128, 128, 128, 0.06);
  display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
}
.placeholder-icon { font-size: 32px; opacity: 0.6; }
.placeholder-title { font-size: 14px; font-weight: 600; color: rgba(128, 128, 128, 0.6); margin: 0; }
.placeholder-text { font-size: 12px; color: rgba(128, 128, 128, 0.4); text-align: center; line-height: 1.6; margin: 0; }
.loading-hint { font-size: 13px; color: rgba(128, 128, 128, 0.5); margin: 0; }

.result-content { display: flex; flex-direction: column; gap: 12px; padding: 20px; }
.result-status {
  font-size: 11px; color: rgba(128, 128, 128, 0.4); font-family: monospace;
  padding-top: 4px; border-top: 1px solid rgba(128, 128, 128, 0.08);
}

.dark .input-card, .dark .result-card { background: rgba(255, 255, 255, 0.02); border-color: rgba(255, 255, 255, 0.06); }
.dark .upload-area { background: rgba(255, 255, 255, 0.01); border-color: rgba(255, 255, 255, 0.1); }
.dark .upload-icon-wrap, .dark .placeholder-icon-wrap { background: rgba(255, 255, 255, 0.04); }

@media (max-width: 900px) {
  .panel-body { flex-direction: column; }
  .result-section { flex: none; min-height: 200px; }
}
</style>
