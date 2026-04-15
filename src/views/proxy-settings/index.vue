<script setup lang="ts">
/**
 * 服务代理设置 — 配置外部服务的代理地址
 *
 * 支持服务：Gemini API、TTS 系列服务
 * 仅 owner 角色可访问
 */
import { ref, reactive, onMounted } from 'vue';
import { useMessage } from 'naive-ui';
import {
  fetchProxySettings,
  updateProxySettings,
  testProxyConnection,
  type ProxyConfigMap,
} from '@/service/api/system-settings';
import { usePageTracker, useActionTracker } from '@/hooks/common/use-tracker';

usePageTracker('proxy-settings');
const { trackAction } = useActionTracker('proxy-settings');

const message = useMessage();
const loading = ref(false);
const saving = ref(false);

// 服务定义
const services = [
  {
    key: 'proxy.gemini_base_url',
    name: 'Gemini API',
    icon: '✨',
    desc: '用于素材工坊的 AI 图片生成与意图理解。配置代理后可在境内正常使用。',
    placeholder: 'https://your-proxy.example.com/v1beta',
    color: '#6366f1',
  },
  {
    key: 'proxy.tts_base',
    name: 'TTS 声音克隆',
    icon: '🎙️',
    desc: 'Qwen3 TTS 声音克隆服务地址。',
    placeholder: 'http://10.64.128.6:8000',
    color: '#10b981',
  },
  {
    key: 'proxy.tts_custom',
    name: 'TTS 角色语音',
    icon: '🗣️',
    desc: 'Qwen3 TTS 角色语音服务地址。',
    placeholder: 'http://10.64.128.6:8001',
    color: '#f59e0b',
  },
  {
    key: 'proxy.tts_design',
    name: 'TTS 音色设计',
    icon: '🎨',
    desc: 'Qwen3 TTS 音色设计服务地址。',
    placeholder: 'http://10.64.128.6:8002',
    color: '#ec4899',
  },
];

// 表单状态
const formValues = reactive<Record<string, string>>({});
const testStates = reactive<Record<string, { loading: boolean; result: null | { ok: boolean; message: string } }>>({});
const updatedAtMap = reactive<Record<string, string | null>>({});

for (const s of services) {
  formValues[s.key] = '';
  testStates[s.key] = { loading: false, result: null };
  updatedAtMap[s.key] = null;
}

// 加载配置
async function loadSettings() {
  loading.value = true;
  try {
    const { data, error } = await fetchProxySettings();
    if (!error && data) {
      for (const s of services) {
        const item = (data as ProxyConfigMap)[s.key];
        if (item) {
          formValues[s.key] = item.value || '';
          updatedAtMap[s.key] = item.updatedAt;
        }
      }
    }
  } finally {
    loading.value = false;
  }
}

// 保存
async function handleSave() {
  saving.value = true;
  try {
    const settings: Record<string, string> = {};
    for (const s of services) {
      settings[s.key] = formValues[s.key] || '';
    }
    const { error } = await updateProxySettings(settings);
    if (!error) {
      message.success('代理配置已保存');
      trackAction('save_proxy', 'success');
      await loadSettings();
    } else {
      message.error('保存失败');
    }
  } finally {
    saving.value = false;
  }
}

// 测试连通性
async function handleTest(key: string) {
  const url = formValues[key];
  if (!url) {
    message.warning('请先填写代理地址');
    return;
  }
  testStates[key].loading = true;
  testStates[key].result = null;
  try {
    const { data, error } = await testProxyConnection(key, url);
    if (!error && data) {
      testStates[key].result = { ok: data.ok, message: data.message };
      trackAction('test_proxy', data.ok ? 'success' : 'fail', { key });
      if (data.ok) {
        message.success(`${key}: 连通成功 (${data.latency}ms)`);
      } else {
        message.warning(`${key}: ${data.message}`);
      }
    }
  } finally {
    testStates[key].loading = false;
  }
}

// 清除单个代理
function handleClear(key: string) {
  formValues[key] = '';
  testStates[key].result = null;
}

onMounted(loadSettings);
</script>

<template>
  <div class="proxy-page">
    <div class="page-header">
      <h2 class="page-title">⚙️ 服务代理设置</h2>
      <NButton type="primary" :loading="saving" @click="handleSave">
        💾 保存全部
      </NButton>
    </div>

    <p class="page-desc">
      为需要代理访问的外部 AI 服务配置转发地址。保存后立即生效，无需重启服务。
    </p>

    <NSpin :show="loading">
      <div class="services-grid">
        <div
          v-for="s in services"
          :key="s.key"
          class="service-card"
        >
          <!-- 卡片头 -->
          <div class="card-header">
            <div class="card-icon" :style="{ background: s.color + '18' }">
              {{ s.icon }}
            </div>
            <div class="card-meta">
              <div class="card-name">{{ s.name }}</div>
              <div class="card-desc">{{ s.desc }}</div>
            </div>
          </div>

          <!-- 输入 -->
          <div class="card-input">
            <NInput
              v-model:value="formValues[s.key]"
              :placeholder="s.placeholder"
              clearable
              @clear="handleClear(s.key)"
            >
              <template #prefix>
                <span class="input-prefix">🔗</span>
              </template>
            </NInput>
          </div>

          <!-- 操作栏 -->
          <div class="card-actions">
            <NButton
              size="small"
              :type="testStates[s.key].result?.ok ? 'success' : 'default'"
              :loading="testStates[s.key].loading"
              :disabled="!formValues[s.key]"
              @click="handleTest(s.key)"
            >
              🔍 测试连通
            </NButton>

            <!-- 测试结果 -->
            <span v-if="testStates[s.key].result" class="test-result" :class="{ ok: testStates[s.key].result!.ok, fail: !testStates[s.key].result!.ok }">
              {{ testStates[s.key].result!.ok ? '✅' : '❌' }}
              {{ testStates[s.key].result!.message }}
            </span>

            <!-- 上次更新 -->
            <span v-if="updatedAtMap[s.key]" class="updated-at">
              最后更新: {{ updatedAtMap[s.key] }}
            </span>
          </div>

          <!-- 空状态提示 -->
          <div v-if="!formValues[s.key]" class="card-hint">
            未配置代理，将使用默认{{ s.key === 'proxy.gemini_base_url' ? '官方' : '' }}地址
          </div>
        </div>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.proxy-page {
  padding: 20px 28px;
  overflow-y: auto;
  height: 100%;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.page-desc {
  font-size: 13px;
  opacity: 0.55;
  margin: 0 0 24px;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.service-card {
  padding: 20px;
  border-radius: 14px;
  border: 1px solid rgba(128,128,128,0.1);
  background: rgba(128,128,128,0.02);
  transition: all 0.2s;
}

.service-card:hover {
  border-color: rgba(99,102,241,0.2);
  box-shadow: 0 2px 12px rgba(99,102,241,0.06);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
}

.card-desc {
  font-size: 12px;
  opacity: 0.5;
  margin-top: 2px;
  line-height: 1.4;
}

.card-input {
  margin-bottom: 10px;
}

.input-prefix {
  font-size: 14px;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.test-result {
  font-size: 12px;
  font-weight: 500;
}

.test-result.ok {
  color: #10b981;
}

.test-result.fail {
  color: #ef4444;
}

.updated-at {
  font-size: 11px;
  opacity: 0.4;
  margin-left: auto;
}

.card-hint {
  margin-top: 8px;
  font-size: 11px;
  opacity: 0.35;
  font-style: italic;
}

@media (max-width: 900px) {
  .services-grid { grid-template-columns: 1fr; }
}
</style>
