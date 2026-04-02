<script setup lang="ts">
/**
 * VoiceDesignPanel — 🎨 音色设计 Tab
 * 对应 :8002 VoiceDesign run_voice_design
 */
import { ref } from 'vue';
import { useTts, LANGUAGE_OPTIONS } from '../composables/use-tts';
import AudioPlayer from './AudioPlayer.vue';

const { loading, result, error, synthesize, reset } = useTts();

const language = ref('Auto');
const targetText = ref('');
const voiceDesc = ref('');

const languageOpts = LANGUAGE_OPTIONS.map(l => ({ label: l.label, value: l.value }));

const presets = [
  { label: '温柔知性女声', desc: '年轻女性，声音温柔甜美，带有知性气质' },
  { label: '磁性低沉男声', desc: '成熟男性，声音低沉有磁性，沉稳大气' },
  { label: '活泼可爱童声', desc: '小女孩，声音清脆活泼，天真可爱' },
  { label: '新闻播报', desc: '专业播音员，吐字清晰标准，语速适中，端庄大气' },
  { label: '温暖长辈', desc: '中年女性，声音温暖亲切，像妈妈一样慈爱' },
  { label: '元气少年', desc: '年轻男性，声音充满活力和朝气，阳光开朗' },
];

function applyPreset(desc: string) {
  voiceDesc.value = desc;
}

async function handleGenerate() {
  if (!targetText.value.trim() || !voiceDesc.value.trim()) return;
  await synthesize('design', 'run_voice_design', [
    targetText.value,
    language.value,
    voiceDesc.value,
  ]);
}

function handleReset() {
  targetText.value = '';
  voiceDesc.value = '';
  reset();
}
</script>

<template>
  <div class="voice-design-panel">
    <div class="panel-body">
      <!-- 左侧：输入区 -->
      <div class="input-section">
        <div class="input-card">
          <!-- 音色描述 -->
          <div class="section-label">音色描述</div>
          <NInput
            v-model:value="voiceDesc"
            type="textarea"
            placeholder="用自然语言描述你想要的声音特征，如：年轻女性，声音温柔甜美..."
            :autosize="{ minRows: 2, maxRows: 4 }"
          />

          <!-- 快捷模板 -->
          <div class="preset-area">
            <span class="preset-label">快捷模板</span>
            <div class="preset-tags">
              <NTag
                v-for="p in presets"
                :key="p.label"
                size="small"
                round
                :bordered="true"
                :type="voiceDesc === p.desc ? 'primary' : 'default'"
                class="preset-tag"
                @click="applyPreset(p.desc)"
              >
                {{ p.label }}
              </NTag>
            </div>
          </div>

          <NDivider style="margin: 12px 0 8px" />

          <!-- 语种 -->
          <div class="form-row">
            <div class="form-item" style="width: 150px">
              <div class="section-label">语种</div>
              <NSelect v-model:value="language" :options="languageOpts" size="small" />
            </div>
          </div>

          <!-- 合成文本 -->
          <div class="section-label" style="margin-top: 8px">待合成文本</div>
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
              :disabled="!targetText.trim() || !voiceDesc.trim()"
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

          <NAlert v-if="error" type="error" :title="error" closable style="margin-top: 12px" @close="error = ''" />
        </div>
      </div>

      <!-- 右侧：结果区 -->
      <div class="result-section">
        <div class="result-card">
          <template v-if="loading">
            <div class="result-placeholder">
              <NSpin size="large" />
              <p class="loading-hint">AI 正在设计音色并合成...</p>
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
              <div class="result-desc">
                <span class="desc-label">音色：</span>{{ voiceDesc }}
              </div>
              <AudioPlayer :src="result.audioUrl" :filename="`tts_design_${Date.now()}.wav`" />
              <div v-if="result.status" class="result-status">{{ result.status }}</div>
            </div>
          </template>
          <template v-else>
            <div class="result-placeholder">
              <div class="placeholder-icon-wrap">
                <span class="placeholder-icon">🎨</span>
              </div>
              <p class="placeholder-title">等待合成</p>
              <p class="placeholder-text">描述你想要的声音特征<br>AI 将为你定制专属音色</p>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voice-design-panel {
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

/* ── 快捷模板 ── */
.preset-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(128, 128, 128, 0.5);
}

.preset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-tag {
  cursor: pointer;
  transition: all 0.2s;
}
.preset-tag:hover {
  transform: translateY(-1px);
}

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

.placeholder-icon { font-size: 32px; opacity: 0.6; }
.placeholder-title { font-size: 14px; font-weight: 600; color: rgba(128, 128, 128, 0.6); margin: 0; }
.placeholder-text { font-size: 12px; color: rgba(128, 128, 128, 0.4); text-align: center; line-height: 1.6; margin: 0; }
.loading-hint { font-size: 13px; color: rgba(128, 128, 128, 0.5); margin: 0; }

.result-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
}

.result-header { display: flex; align-items: center; }

.result-desc {
  font-size: 12px;
  color: rgba(128, 128, 128, 0.6);
  line-height: 1.5;
}
.desc-label { font-weight: 600; }

.result-status {
  font-size: 11px;
  color: rgba(128, 128, 128, 0.4);
  font-family: monospace;
  padding-top: 4px;
  border-top: 1px solid rgba(128, 128, 128, 0.08);
}

.dark .input-card,
.dark .result-card { background: rgba(255, 255, 255, 0.02); border-color: rgba(255, 255, 255, 0.06); }

.dark .placeholder-icon-wrap { background: rgba(255, 255, 255, 0.04); }

@media (max-width: 900px) {
  .panel-body { flex-direction: column; }
  .result-section { flex: none; min-height: 200px; }
}
</style>
