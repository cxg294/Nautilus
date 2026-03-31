<script setup lang="ts">
/**
 * TTS Studio — Qwen3 语音合成工具
 *
 * 通过 iframe 嵌入内网 Gradio TTS 服务。
 * 使用 Vite 代理解决 X-Frame-Options / CORS 限制。
 */
import { ref, onMounted } from 'vue';

const TTS_URL = '/tts-proxy/';
const loading = ref(true);
const error = ref(false);

function onIframeLoad() {
  loading.value = false;
}

function onIframeError() {
  loading.value = false;
  error.value = true;
}

function retry() {
  error.value = false;
  loading.value = true;
  // 强制 iframe 重载
  const iframe = document.querySelector('.tts-iframe') as HTMLIFrameElement;
  if (iframe) {
    iframe.src = `${TTS_URL}?t=${Date.now()}`;
  }
}

function openInNewTab() {
  window.open('http://10.64.128.6:8000', '_blank');
}

// 5s 超时检测
onMounted(() => {
  setTimeout(() => {
    if (loading.value) {
      loading.value = false;
      error.value = true;
    }
  }, 8000);
});
</script>

<template>
  <div class="tts-studio">
    <!-- 顶部工具栏 -->
    <div class="tts-toolbar">
      <div class="toolbar-left">
        <NTag type="success" size="small" round>
          <template #icon>
            <span class="i-mdi-circle" style="color: #18a058" />
          </template>
          Qwen3 TTS
        </NTag>
        <span class="toolbar-model">12Hz-1.7B-Base</span>
      </div>
      <div class="toolbar-right">
        <NButton quaternary size="small" @click="retry">
          <template #icon>
            <span class="i-mdi-refresh" />
          </template>
          刷新
        </NButton>
        <NButton quaternary size="small" @click="openInNewTab">
          <template #icon>
            <span class="i-mdi-open-in-new" />
          </template>
          新窗口
        </NButton>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="tts-loading">
      <NSpin size="large" />
      <p class="loading-text">正在连接 TTS 服务...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="tts-error">
      <NResult status="warning" title="加载失败，请确认内网环境" description="TTS 服务 (10.64.128.6:8000) 可能未启动或当前网络不可达">
        <template #footer>
          <NSpace>
            <NButton type="primary" @click="retry">重试</NButton>
            <NButton @click="openInNewTab">新窗口打开</NButton>
          </NSpace>
        </template>
      </NResult>
    </div>

    <!-- iframe -->
    <iframe
      v-show="!loading && !error"
      class="tts-iframe"
      :src="TTS_URL"
      allow="microphone"
      @load="onIframeLoad"
      @error="onIframeError"
    />
  </div>
</template>

<style scoped>
.tts-studio {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tts-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-model {
  font-size: 12px;
  color: rgba(128, 128, 128, 0.7);
  font-family: monospace;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tts-iframe {
  flex: 1;
  width: 100%;
  border: none;
  min-height: 0;
}

.tts-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading-text {
  font-size: 14px;
  color: rgba(128, 128, 128, 0.7);
}

.tts-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
