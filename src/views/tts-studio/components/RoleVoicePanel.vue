<script setup lang="ts">
/**
 * RoleVoicePanel — 🎭 角色语音 Tab
 * 对应 :8001 CustomVoice run_instruct
 * 9 个预设说话人 + 情绪指令 + 文本合成
 */
import { ref } from 'vue';
import { useTts, LANGUAGE_OPTIONS, SPEAKERS } from '../composables/use-tts';
import AudioPlayer from './AudioPlayer.vue';

const { loading, result, error, synthesize, reset } = useTts();

const selectedSpeaker = ref(SPEAKERS[0].id);
const language = ref('Auto');
const targetText = ref('');
const instruction = ref('');

const languageOpts = LANGUAGE_OPTIONS.map(l => ({ label: l.label, value: l.value }));

async function handleGenerate() {
  if (!targetText.value.trim()) return;

  await synthesize('custom', 'run_instruct', [
    targetText.value,
    language.value,
    selectedSpeaker.value,
    instruction.value || '',
  ]);
}

function handleReset() {
  targetText.value = '';
  instruction.value = '';
  reset();
}
</script>

<template>
  <div class="role-voice-panel">
    <div class="panel-body">
      <!-- 左侧：输入区 -->
      <div class="input-section">
        <div class="input-card">
          <!-- 角色选择 -->
          <div class="section-label">选择说话人</div>
          <div class="speaker-grid">
            <div
              v-for="s in SPEAKERS"
              :key="s.id"
              class="speaker-card"
              :class="{ active: selectedSpeaker === s.id }"
              @click="selectedSpeaker = s.id"
            >
              <span class="speaker-icon">{{ s.icon }}</span>
              <div class="speaker-info">
                <span class="speaker-name">{{ s.name }}</span>
                <span class="speaker-desc">{{ s.desc }}</span>
              </div>
            </div>
          </div>

          <!-- 分隔 -->
          <NDivider style="margin: 16px 0 12px" />

          <!-- 语种 + 情绪指令 -->
          <div class="form-row">
            <div class="form-item" style="flex: 0 0 150px">
              <div class="section-label">语种</div>
              <NSelect v-model:value="language" :options="languageOpts" size="small" />
            </div>
            <div class="form-item" style="flex: 1">
              <div class="section-label">
                情绪 / 语气指令
                <NTag size="tiny" round :bordered="false" type="info">可选</NTag>
              </div>
              <NInput
                v-model:value="instruction"
                placeholder="如：用开心的语气说 / Say it angrily"
                size="small"
                clearable
              />
            </div>
          </div>

          <!-- 合成文本 -->
          <div class="section-label" style="margin-top: 12px">待合成文本</div>
          <NInput
            v-model:value="targetText"
            type="textarea"
            placeholder="输入要合成的文本内容..."
            :autosize="{ minRows: 3, maxRows: 6 }"
          />

          <!-- 操作按钮 -->
          <div class="action-row">
            <NButton
              type="primary"
              :loading="loading"
              :disabled="!targetText.trim()"
              size="large"
              @click="handleGenerate"
            >
              <template #icon><span class="i-mdi-play" /></template>
              生成语音
            </NButton>
            <NButton v-if="result" quaternary size="small" @click="handleReset">
              清除结果
            </NButton>
          </div>

          <!-- 错误提示 -->
          <NAlert v-if="error" type="error" :title="error" closable style="margin-top: 12px" @close="error = ''" />
        </div>
      </div>

      <!-- 右侧：结果区 -->
      <div class="result-section">
        <div class="result-card">
          <template v-if="loading">
            <div class="result-placeholder">
              <NSpin size="large" />
              <p class="loading-hint">AI 正在合成语音，请稍候...</p>
            </div>
          </template>
          <template v-else-if="result">
            <div class="result-content">
              <div class="result-header">
                <NTag type="success" size="small" round>
                  <template #icon><span class="i-mdi-check-circle" /></template>
                  合成完成
                </NTag>
              </div>
              <div class="result-meta-row">
                <span class="meta-speaker">
                  {{ SPEAKERS.find(s => s.id === selectedSpeaker)?.icon }}
                  {{ selectedSpeaker }}
                </span>
                <span v-if="instruction" class="meta-instruction">· {{ instruction }}</span>
              </div>
              <AudioPlayer :src="result.audioUrl" :filename="`tts_${selectedSpeaker}_${Date.now()}.wav`" />
              <div v-if="result.status" class="result-status">
                {{ result.status }}
              </div>
            </div>
          </template>
          <template v-else>
            <div class="result-placeholder">
              <div class="placeholder-icon-wrap">
                <span class="placeholder-icon">🎭</span>
              </div>
              <p class="placeholder-title">等待合成</p>
              <p class="placeholder-text">
                选择说话人，输入文本后<br>点击「生成语音」试听效果
              </p>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-voice-panel {
  height: 100%;
  overflow-y: auto;
}

.panel-body {
  display: flex;
  gap: 20px;
  height: 100%;
}

.input-section {
  flex: 1;
  min-width: 0;
}

.input-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  border-radius: 14px;
  background: rgba(128, 128, 128, 0.03);
  border: 1px solid rgba(128, 128, 128, 0.08);
}

.result-section {
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
}

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

/* ── 说话人网格 ── */
.speaker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.speaker-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid transparent;
  background: rgba(128, 128, 128, 0.04);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.speaker-card:hover {
  border-color: rgba(99, 140, 255, 0.3);
  background: rgba(99, 140, 255, 0.05);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(99, 140, 255, 0.08);
}

.speaker-card.active {
  border-color: #638cff;
  background: rgba(99, 140, 255, 0.1);
  box-shadow: 0 0 0 3px rgba(99, 140, 255, 0.1), 0 2px 8px rgba(99, 140, 255, 0.12);
}

.speaker-icon {
  font-size: 22px;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.06);
}

.speaker-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.speaker-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.speaker-desc {
  font-size: 11px;
  color: rgba(128, 128, 128, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── 表单 ── */
.form-row {
  display: flex;
  gap: 12px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}

/* ── 结果区 ── */
.result-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
}

.placeholder-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(128, 128, 128, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.placeholder-icon {
  font-size: 32px;
  opacity: 0.6;
}

.placeholder-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(128, 128, 128, 0.6);
  margin: 0;
}

.placeholder-text {
  font-size: 12px;
  color: rgba(128, 128, 128, 0.4);
  text-align: center;
  line-height: 1.6;
  margin: 0;
}

.loading-hint {
  font-size: 13px;
  color: rgba(128, 128, 128, 0.5);
  margin: 0;
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
}

.result-header {
  display: flex;
  align-items: center;
}

.result-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(128, 128, 128, 0.6);
}

.meta-speaker {
  font-weight: 500;
}

.meta-instruction {
  font-style: italic;
}

.result-status {
  font-size: 11px;
  color: rgba(128, 128, 128, 0.4);
  font-family: monospace;
  padding-top: 4px;
  border-top: 1px solid rgba(128, 128, 128, 0.08);
}

/* ── 暗色适配 ── */
.dark .input-card,
.dark .result-card {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.06);
}

.dark .speaker-card {
  background: rgba(255, 255, 255, 0.03);
}

.dark .speaker-icon {
  background: rgba(255, 255, 255, 0.05);
}

.dark .placeholder-icon-wrap {
  background: rgba(255, 255, 255, 0.04);
}

@media (max-width: 900px) {
  .panel-body {
    flex-direction: column;
  }
  .result-section {
    flex: none;
    min-height: 200px;
  }
  .speaker-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
