<script setup lang="ts">
/**
 * TTS Studio — 语音合成工作台
 *
 * 整合 3 个 Qwen3 TTS 服务：
 *   🎭 角色语音  — 预设说话人 + 情绪指令 (:8001)
 *   🎨 音色设计  — 自然语言描述音色 (:8002)
 *   🎤 声音克隆  — 上传参考音频克隆 (:8000)
 */
import { ref } from 'vue';
import RoleVoicePanel from './components/RoleVoicePanel.vue';
import VoiceDesignPanel from './components/VoiceDesignPanel.vue';
import VoiceClonePanel from './components/VoiceClonePanel.vue';

const activeTab = ref('role');
</script>

<template>
  <div class="tts-studio">
    <!-- 顶部信息栏 -->
    <div class="tts-header">
      <div class="header-left">
        <span class="header-title">语音合成工作台</span>
        <NTag size="small" round type="success" :bordered="false">
          <template #icon>
            <span class="status-dot" />
          </template>
          Qwen3 TTS
        </NTag>
        <span class="header-model">12Hz · 1.7B</span>
      </div>
    </div>

    <!-- Tab 面板 -->
    <div class="tts-body">
      <NTabs v-model:value="activeTab" type="segment" animated class="tts-tabs">
        <NTabPane name="role" tab="🎭 角色语音">
          <div class="tab-content">
            <RoleVoicePanel />
          </div>
        </NTabPane>
        <NTabPane name="design" tab="🎨 音色设计">
          <div class="tab-content">
            <VoiceDesignPanel />
          </div>
        </NTabPane>
        <NTabPane name="clone" tab="🎤 声音克隆">
          <div class="tab-content">
            <VoiceClonePanel />
          </div>
        </NTabPane>
      </NTabs>
    </div>
  </div>
</template>

<style scoped>
.tts-studio {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px 24px 16px;
}

/* ── 顶部栏 ── */
.tts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.01em;
}

.header-model {
  font-size: 12px;
  color: rgba(128, 128, 128, 0.45);
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  letter-spacing: 0.02em;
}

.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #18a058;
  box-shadow: 0 0 6px rgba(24, 160, 88, 0.5);
}

/* ── 主体 ── */
.tts-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── Tab 样式 ── */
.tts-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tts-tabs :deep(.n-tabs-nav) {
  flex-shrink: 0;
}

.tts-tabs :deep(.n-tabs-pane-wrapper) {
  flex: 1;
  min-height: 0;
}

.tts-tabs :deep(.n-tab-pane) {
  flex: 1;
  min-height: 0;
}

.tab-content {
  padding-top: 20px;
  height: 100%;
}
</style>
