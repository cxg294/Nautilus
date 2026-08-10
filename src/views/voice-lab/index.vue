<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue';
import { NButton, NInput, NTag, useDialog, useMessage, type DataTableColumns, type UploadFileInfo } from 'naive-ui';
import {
  createVoiceClone,
  createVoiceCloneFromUpload,
  createVoiceDesign,
  deleteVoiceClone,
  fetchVoiceClones,
  fetchVoiceLabStatus,
  generateVoiceAudition,
  synthesizeVoice,
  updateVoiceName,
  type VoiceCloneItem,
  type VoiceDesignLanguage,
  type VoiceLabAudio,
  type VoiceLabStatus,
  type VoiceLanguageHint,
  type VoiceSynthesisResult,
} from '@/service/api/voice-lab';
import { useActionTracker, usePageTracker } from '@/hooks/common/use-tracker';
import { useAuth } from '@/hooks/business/auth';
import { getToken } from '@/store/modules/auth/shared';
import EffectsPanel from './components/effects-panel.vue';

defineOptions({ name: 'VoiceLab' });

usePageTracker('voice-lab');
const { trackAction } = useActionTracker('voice-lab');

const message = useMessage();
const dialog = useDialog();
const { hasAuth } = useAuth();

type VoiceMode = 'synthesis' | 'effects' | 'clone' | 'design' | 'voices';

const VOICE_LAB_PERMISSIONS = {
  clone: 'feature:voice-lab:clone',
  design: 'feature:voice-lab:design',
  manageVoices: 'feature:voice-lab:manage-voices',
};

const activeTab = ref<VoiceMode>('synthesis');
const status = ref<VoiceLabStatus | null>(null);
const loadingStatus = ref(false);

const voices = ref<VoiceCloneItem[]>([]);
const loadingVoices = ref(false);
// 音色库默认展示所有可见音色；“只看我的”仅作为用户主动收窄列表的筛选项。
const onlyMyVoices = ref(false);

const synthesisText = ref('');
const selectedVoice = ref('');
const manualVoice = ref('');
const languageHint = ref<VoiceLanguageHint>('zh');
const instruction = ref('');
const speechRate = ref(1);
const synthesizing = ref(false);
const synthesisResult = ref<VoiceSynthesisResult | null>(null);
const auditioningVoice = ref('');

const cloneDisplayName = ref('');
const clonePrefix = ref('nautilus');
const cloneAudioUrl = ref('');
const cloneFileList = ref<UploadFileInfo[]>([]);
const cloneLanguageHint = ref<VoiceLanguageHint>('zh');
const cloneEnablePreprocess = ref(false);
const cloneMaxPromptAudioLength = ref(10);
const cloning = ref(false);

const designDisplayName = ref('温柔老师');
const designPrefix = ref('teacher');
const designPrompt = ref('温柔、清晰、有耐心的年轻女老师，适合少儿编程课程讲解。');
const designPreviewText = ref('同学们好，我们今天来一起完成一个有趣的小挑战。');
const designLanguageHint = ref<VoiceDesignLanguage>('zh');
const designing = ref(false);
const designPreviewAudio = ref<VoiceLabAudio | null>(null);

const languageHintOptions: { label: string; value: VoiceLanguageHint }[] = [
  { label: '中文', value: 'zh' },
  { label: 'English', value: 'en' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Русский', value: 'ru' },
  { label: 'Português', value: 'pt' },
  { label: 'ไทย', value: 'th' },
  { label: 'Bahasa Indonesia', value: 'id' },
  { label: 'Tiếng Việt', value: 'vi' },
];

const designLanguageOptions: { label: string; value: VoiceDesignLanguage }[] = [
  { label: '中文', value: 'zh' },
  { label: 'English', value: 'en' },
];

const allVoiceModeItems: { name: VoiceMode; label: string; icon: string; permission?: string }[] = [
  { name: 'synthesis', label: '合成', icon: 'mdi:play-circle-outline' },
  { name: 'effects', label: '效果器', icon: 'mdi:tune-variant' },
  { name: 'clone', label: '复刻', icon: 'mdi:account-voice', permission: VOICE_LAB_PERMISSIONS.clone },
  { name: 'design', label: '设计', icon: 'mdi:palette-outline', permission: VOICE_LAB_PERMISSIONS.design },
  { name: 'voices', label: '音色库', icon: 'mdi:playlist-music-outline' },
];

const canCloneVoice = computed(() => hasAuth(VOICE_LAB_PERMISSIONS.clone));
const canDesignVoice = computed(() => hasAuth(VOICE_LAB_PERMISSIONS.design));
const canManageVoices = computed(() => hasAuth(VOICE_LAB_PERMISSIONS.manageVoices));
const voiceModeItems = computed(() => allVoiceModeItems.filter(item => !item.permission || hasAuth(item.permission)));

watch(voiceModeItems, items => {
  if (!items.some(item => item.name === activeTab.value)) {
    activeTab.value = 'synthesis';
  }
}, { immediate: true });

const cloneVoiceOptions = computed(() => voices.value.map(item => ({
  label: `${getVoiceDisplayLabel(item)}${item.status && item.status !== 'OK' ? ` · ${item.status}` : ''}`,
  value: item.voice,
  disabled: Boolean(item.status && item.status !== 'OK'),
})));

const visibleCharacters = computed(() => Array.from(synthesisText.value || '').length);
const billingCharacters = computed(() => countBillingCharacters(synthesisText.value));
const instructionBillingCharacters = computed(() => countBillingCharacters(instruction.value));
const totalBillingCharacters = computed(() => billingCharacters.value + instructionBillingCharacters.value);
const estimatedCost = computed(() => Number(((totalBillingCharacters.value / 10000) * 0.8).toFixed(4)));

const synthesisModel = computed(() => status.value?.defaults.synthesisModel || 'cosyvoice-v3.5-flash');
const selectedVoiceId = computed(() => selectedVoice.value || manualVoice.value.trim());
const selectedCloneFile = computed(() => cloneFileList.value.find(item => item.file)?.file || null);
const ossBucketName = computed(() => status.value?.oss?.bucket || 'nautilus-audio');
const ossExplicitlyUnavailable = computed(() => status.value?.oss?.configured === false);

const audioUrl = computed(() => {
  const url = synthesisResult.value?.audio?.url || '';
  return url ? withAuthQuery(url) : '';
});

const designPreviewUrl = computed(() => (designPreviewAudio.value?.url ? withAuthQuery(designPreviewAudio.value.url) : ''));

function withAuthQuery(url: string) {
  const token = getToken();
  if (!token || !url.startsWith('/api/')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_token=${encodeURIComponent(token)}`;
}

function formatBytes(bytes?: number) {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function countBillingCharacters(text: string) {
  return Array.from(text || '').reduce((sum, char) => {
    return sum + (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(char) ? 2 : 1);
  }, 0);
}

function getVoiceDisplayLabel(voice: VoiceCloneItem) {
  return voice.displayName ? `${voice.displayName} · ${voice.voice}` : voice.voice;
}

async function loadStatus() {
  loadingStatus.value = true;
  try {
    const { data, error } = await fetchVoiceLabStatus();
    if (!error && data) status.value = data;
  } finally {
    loadingStatus.value = false;
  }
}

async function loadVoices() {
  loadingVoices.value = true;
  try {
    const { data, error } = await fetchVoiceClones({ pageSize: 50, pageIndex: 0, onlyMine: onlyMyVoices.value });
    if (!error && data) {
      voices.value = data.voices || [];
      const firstReadyVoice = voices.value.find(item => !item.status || item.status === 'OK');
      if (!selectedVoice.value && firstReadyVoice) selectedVoice.value = firstReadyVoice.voice;
    }
  } finally {
    loadingVoices.value = false;
  }
}


async function handleSynthesize() {
  if (!synthesisText.value.trim()) {
    message.warning('请填写合成文本');
    return;
  }
  if (!selectedVoiceId.value) {
    message.warning('请先选择或填写 CosyVoice 音色 ID');
    return;
  }
  if (instructionBillingCharacters.value > 100) {
    message.warning('指令不能超过 100 个计费字符');
    return;
  }

  synthesizing.value = true;
  synthesisResult.value = null;
  try {
    const { data, error } = await synthesizeVoice({
      text: synthesisText.value,
      voice: selectedVoiceId.value,
      model: synthesisModel.value,
      languageHint: languageHint.value,
      instruction: instruction.value,
      rate: speechRate.value,
    });

    if (!error && data) {
      synthesisResult.value = data;
      if (data.auditionSaved && data.auditionAudio) {
        voices.value = voices.value.map(item => (item.voice === data.voice ? { ...item, auditionAudio: data.auditionAudio } : item));
      }
      trackAction('synthesize', 'success', {
        model: data.model,
        characters: data.usage?.characters || totalBillingCharacters.value,
      });
      message.success('语音合成完成');
    }
  } finally {
    synthesizing.value = false;
  }
}


async function handleCreateClone() {
  if (!canCloneVoice.value) {
    message.warning('当前账号没有复刻音色权限');
    return;
  }
  if (!selectedCloneFile.value && !cloneAudioUrl.value.trim()) {
    message.warning('请上传音频，或填写公网可访问的音频 URL');
    return;
  }
  if (!clonePrefix.value.trim()) {
    message.warning('请填写音色前缀');
    return;
  }
  if (selectedCloneFile.value && ossExplicitlyUnavailable.value) {
    message.warning('OSS 未配置，无法使用本地上传中转');
    return;
  }

  cloning.value = true;
  try {
    const request = selectedCloneFile.value
      ? createVoiceCloneFromUpload(createCloneFormData(selectedCloneFile.value))
      : createVoiceClone({
          audioUrl: cloneAudioUrl.value,
          prefix: clonePrefix.value,
          displayName: cloneDisplayName.value,
          languageHint: cloneLanguageHint.value,
          maxPromptAudioLength: cloneMaxPromptAudioLength.value,
          enablePreprocess: cloneEnablePreprocess.value,
        });

    const { data, error } = await request;

    if (!error && data) {
      trackAction('clone_voice', 'success', {
        voice: data.voice,
        targetModel: data.targetModel,
        transit: data.transit?.bucket || 'direct-url',
      });
      selectedVoice.value = data.voice;
      manualVoice.value = data.voice;
      message.success('CosyVoice 复刻音色已创建');
      await loadVoices();
      activeTab.value = 'synthesis';
    }
  } finally {
    cloning.value = false;
  }
}

function createCloneFormData(file: File) {
  const formData = new FormData();
  formData.append('audio', file, file.name);
  formData.append('prefix', clonePrefix.value);
  formData.append('displayName', cloneDisplayName.value);
  formData.append('languageHint', cloneLanguageHint.value);
  formData.append('maxPromptAudioLength', String(cloneMaxPromptAudioLength.value));
  formData.append('enablePreprocess', String(cloneEnablePreprocess.value));
  return formData;
}

function handleCloneUploadChange(nextFileList: UploadFileInfo[]) {
  cloneFileList.value = nextFileList.slice(-1);
  const fileName = cloneFileList.value[0]?.file?.name || '';
  if (!cloneDisplayName.value && fileName) {
    cloneDisplayName.value = fileName.replace(/\.[^.]+$/, '');
  }
}

async function handleCreateDesign() {
  if (!canDesignVoice.value) {
    message.warning('当前账号没有设计音色权限');
    return;
  }
  if (!designPrompt.value.trim()) {
    message.warning('请填写声音描述');
    return;
  }
  if (!designPreviewText.value.trim()) {
    message.warning('请填写预览文本');
    return;
  }

  designing.value = true;
  designPreviewAudio.value = null;
  try {
    const { data, error } = await createVoiceDesign({
      voicePrompt: designPrompt.value,
      previewText: designPreviewText.value,
      prefix: designPrefix.value,
      displayName: designDisplayName.value,
      languageHint: designLanguageHint.value,
    });

    if (!error && data) {
      trackAction('design_voice', 'success', {
        voice: data.voice,
        targetModel: data.targetModel,
      });
      selectedVoice.value = data.voice;
      manualVoice.value = data.voice;
      designPreviewAudio.value = data.previewAudio || null;
      message.success('CosyVoice 设计音色已创建');
      await loadVoices();
    }
  } finally {
    designing.value = false;
  }
}

function useVoiceForSynthesis(voice: string) {
  selectedVoice.value = voice;
  manualVoice.value = voice;
  activeTab.value = 'synthesis';
}

async function handleGenerateAudition(row: VoiceCloneItem) {
  if (row.status && row.status !== 'OK') return;

  auditioningVoice.value = row.voice;
  try {
    const { data, error } = await generateVoiceAudition(row.voice, {
      model: synthesisModel.value,
      languageHint: languageHint.value,
      rate: speechRate.value,
      instruction: '',
    });
    if (!error && data?.auditionAudio) {
      voices.value = voices.value.map(item => (item.voice === row.voice
        ? { ...item, auditionAudio: data.auditionAudio, auditionText: '大家好，这是这个音色的试听样本。' }
        : item));
      message.success('试听音频已生成');
    }
  } finally {
    auditioningVoice.value = '';
  }
}

function promptRenameVoice(row: VoiceCloneItem) {
  if (!canManageVoices.value) {
    message.warning('当前账号没有管理音色权限');
    return;
  }
  const nextName = ref(row.displayName || '');
  dialog.create({
    title: '编辑音色名称',
    content: () => h('div', { class: 'rename-dialog' }, [
      h(NInput, {
        value: nextName.value,
        maxlength: 50,
        clearable: true,
        placeholder: '例如：桃子老师、旁白男声',
        'onUpdate:value': value => {
          nextName.value = value;
        },
      }),
      h('p', { class: 'rename-dialog__hint' }, row.voice),
    ]),
    positiveText: '保存',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { data, error } = await updateVoiceName(row.voice, nextName.value);
      if (!error && data) {
        row.displayName = data.displayName;
        voices.value = voices.value.map(item => (item.voice === row.voice ? { ...item, displayName: data.displayName } : item));
        message.success(data.displayName ? '音色名称已保存' : '音色名称已清空');
      }
    },
  });
}

function confirmDeleteVoice(voice: string) {
  if (!canManageVoices.value) {
    message.warning('当前账号没有管理音色权限');
    return;
  }
  dialog.warning({
    title: '删除音色',
    content: `确认删除 ${voice}？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await deleteVoiceClone(voice);
      if (!error) {
        message.success('音色已删除');
        voices.value = voices.value.filter(item => item.voice !== voice);
        if (selectedVoice.value === voice) selectedVoice.value = '';
        if (manualVoice.value === voice) manualVoice.value = '';
        await loadVoices();
      }
    },
  });
}

function downloadResult() {
  if (!audioUrl.value) return;
  const a = document.createElement('a');
  a.href = audioUrl.value;
  a.download = synthesisResult.value?.audio?.downloadName || synthesisResult.value?.audio?.fileName || `voice-lab-${Date.now()}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const voiceColumns = computed<DataTableColumns<VoiceCloneItem>>(() => [
  {
    title: '名称 / 音色 ID',
    key: 'voice',
    minWidth: 260,
    ellipsis: { tooltip: true },
    render(row) {
      return h('div', { class: 'voice-name-cell' }, [
        h('strong', row.displayName || '未命名音色'),
        h('code', { class: 'voice-code' }, row.voice),
      ]);
    },
  },
  {
    title: '来源',
    key: 'source',
    width: 92,
    render(row) {
      return h(NTag, { size: 'small', bordered: false, type: row.source === 'design' ? 'info' : 'default' }, {
        default: () => (row.source === 'design' ? '设计' : '复刻'),
      });
    },
  },
  {
    title: '创建者',
    key: 'creatorUsername',
    width: 130,
    render(row) {
      return row.isSystemDefault ? '系统默认' : (row.creatorUsername || '未知');
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render(row) {
      return h(NTag, { size: 'small', bordered: false, type: !row.status || row.status === 'OK' ? 'success' : 'warning' }, {
        default: () => row.status || 'OK',
      });
    },
  },
  {
    title: '试听',
    key: 'audition',
    minWidth: 260,
    render(row) {
      if (row.auditionAudio?.url) {
        return h('audio', {
          class: 'voice-audition-player',
          controls: true,
          src: withAuthQuery(row.auditionAudio.url),
        });
      }

      return h(NButton, {
        size: 'small',
        tertiary: true,
        loading: auditioningVoice.value === row.voice,
        disabled: Boolean(row.status && row.status !== 'OK'),
        onClick: () => handleGenerateAudition(row),
      }, {
        default: () => '生成试听',
      });
    },
  },
  {
    title: '描述/预览',
    key: 'voicePrompt',
    minWidth: 220,
    ellipsis: { tooltip: true },
    render(row) {
      return row.voicePrompt || row.previewText || '-';
    },
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 170,
    ellipsis: { tooltip: true },
  },
  {
    title: '操作',
    key: 'actions',
    width: 204,
    render(row) {
      const actions = [
        h(NButton, { size: 'small', tertiary: true, disabled: Boolean(row.status && row.status !== 'OK'), onClick: () => useVoiceForSynthesis(row.voice) }, {
          default: () => '试音',
        }),
      ];

      if (canManageVoices.value) {
        actions.unshift(
          h(NButton, { size: 'small', tertiary: true, onClick: () => promptRenameVoice(row) }, {
            default: () => '改名',
          })
        );
        actions.push(
          h(NButton, { size: 'small', tertiary: true, type: 'error', onClick: () => confirmDeleteVoice(row.voice) }, {
            default: () => '删除',
          })
        );
      }

      return h('div', { class: 'voice-actions' }, actions);
    },
  },
]);

onMounted(async () => {
  await loadStatus();
  await loadVoices();
});
</script>

<template>
  <div class="voice-lab-page">
    <header class="voice-header">
      <div class="voice-title">
        <span class="voice-title__icon">
          <SvgIcon icon="mdi:waveform" />
        </span>
        <div>
          <h1>语音合成</h1>
          <div class="voice-subtitle">
            <NTag size="small" :type="status?.configured ? 'info' : 'error'" :bordered="false">
              {{ status?.configured ? '百炼已配置' : '缺少百炼 Key' }}
            </NTag>
            <span>{{ status?.defaults.synthesisModel || 'cosyvoice-v3.5-flash' }}</span>
            <span>无系统音色 · 使用复刻/设计音色</span>
          </div>
        </div>
      </div>
      <nav class="voice-mode-nav" aria-label="语音工具模式">
        <button
          v-for="item in voiceModeItems"
          :key="item.name"
          class="voice-mode-nav__item"
          :class="{ 'is-active': activeTab === item.name }"
          type="button"
          @click="activeTab = item.name"
        >
          <SvgIcon :icon="item.icon" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
      <div class="voice-header__actions">
        <NButton tertiary :loading="loadingVoices" @click="loadVoices">
          <template #icon>
            <SvgIcon icon="mdi:refresh" />
          </template>
          刷新音色
        </NButton>
      </div>
    </header>

    <NTabs v-model:value="activeTab" type="segment" animated class="voice-tabs">
      <NTabPane name="synthesis" tab="合成">
        <div class="workspace-grid">
          <section class="panel synthesis-panel">
            <div class="panel-header">
              <div>
                <h2>文本</h2>
                <p>
                  {{ visibleCharacters }} 可见字符，正文 {{ billingCharacters }} + 指令 {{ instructionBillingCharacters }} = {{ totalBillingCharacters }} 计费字符，约 {{ estimatedCost }} 元
                </p>
              </div>
              <NTag size="small" :bordered="false">{{ synthesisModel }}</NTag>
            </div>

            <NInput
              v-model:value="synthesisText"
              type="textarea"
              class="script-input"
              :autosize="{ minRows: 9, maxRows: 14 }"
              maxlength="5000"
              show-count
              placeholder="输入需要合成的台词"
            />

            <div class="form-grid">
              <NFormItem label="音色库">
                <NSelect
                  v-model:value="selectedVoice"
                  filterable
                  clearable
                  :options="cloneVoiceOptions"
                  placeholder="选择 CosyVoice 音色"
                />
              </NFormItem>
              <NFormItem label="目标语种">
                <NSelect v-model:value="languageHint" :options="languageHintOptions" />
              </NFormItem>
            </div>

            <div class="form-grid">
              <NFormItem label="手动音色 ID">
                <NInput v-model:value="manualVoice" clearable placeholder="cosyvoice-v3.5-flash-..." />
              </NFormItem>
              <NFormItem label="语速">
                <div class="speed-field">
                  <NSlider v-model:value="speechRate" :min="0.5" :max="2" :step="0.05" />
                  <NInputNumber v-model:value="speechRate" :min="0.5" :max="2" :step="0.05" />
                </div>
              </NFormItem>
            </div>

            <NFormItem label="指令">
              <div class="instruction-field">
                <NInput v-model:value="instruction" clearable placeholder="可选，例如：语气更温柔，情绪更活泼" />
                <span :class="{ 'is-danger': instructionBillingCharacters > 100 }">
                  {{ instructionBillingCharacters }} / 100 计费字符
                </span>
              </div>
            </NFormItem>

            <div class="action-row">
              <NButton type="primary" :loading="synthesizing" :disabled="!status?.configured" @click="handleSynthesize">
                <template #icon>
                  <SvgIcon icon="mdi:play-circle-outline" />
                </template>
                生成语音
              </NButton>
            </div>
          </section>

          <section class="panel result-panel">
            <div class="panel-header">
              <div>
                <h2>结果</h2>
                <p v-if="synthesisResult">
                  {{ synthesisResult.voice }} · {{ synthesisResult.usage?.characters || totalBillingCharacters }} 计费字符 · {{ formatBytes(synthesisResult.audio?.bytes) }}
                </p>
                <p v-else>等待生成</p>
              </div>
              <NButton v-if="audioUrl" tertiary @click="downloadResult">
                <template #icon>
                  <SvgIcon icon="mdi:download-outline" />
                </template>
                下载
              </NButton>
            </div>

            <div v-if="audioUrl" class="audio-result">
              <audio controls :src="audioUrl" />
              <div class="result-meta">
                <span>Request {{ synthesisResult?.requestId || '-' }}</span>
                <span>{{ synthesisResult?.audio?.downloadName || synthesisResult?.audio?.fileName }}</span>
              </div>
            </div>
            <div v-else class="empty-result">
              <SvgIcon icon="mdi:music-note-outline" />
              <span>生成后会在这里播放</span>
            </div>
          </section>
        </div>
      </NTabPane>

      <NTabPane name="effects" tab="效果器">
        <EffectsPanel />
      </NTabPane>

      <NTabPane v-if="canCloneVoice" name="clone" tab="复刻">
        <div class="workspace-grid">
          <section class="panel clone-panel">
            <div class="panel-header">
              <div>
                <h2>声音复刻</h2>
                <p>上传音频到 OSS 临时中转，或粘贴已有公网 URL</p>
              </div>
            </div>

            <div class="clone-compact-grid">
              <div class="clone-compact-column">
                <NFormItem label="音色名称">
                  <NInput v-model:value="cloneDisplayName" maxlength="50" show-count clearable placeholder="例如：桃子老师、旁白男声" />
                </NFormItem>

                <NFormItem label="本地音频">
                  <NUpload
                    :file-list="cloneFileList"
                    :max="1"
                    :default-upload="false"
                    accept="audio/*,.wav,.mp3,.m4a,.aac,.flac,.ogg,.opus,.amr,.webm"
                    @update:file-list="handleCloneUploadChange"
                  >
                    <NUploadDragger>
                      <div class="audio-upload-dragger">
                        <SvgIcon icon="mdi:cloud-upload-outline" />
                        <strong>{{ selectedCloneFile ? selectedCloneFile.name : '点击或拖入音频样本' }}</strong>
                        <span>最大 30MB，推荐 3-30 秒清晰人声</span>
                      </div>
                    </NUploadDragger>
                  </NUpload>
                </NFormItem>
              </div>

              <div class="clone-compact-column">
                <NFormItem label="公网音频 URL（可选）">
                  <NInput v-model:value="cloneAudioUrl" clearable placeholder="https://example.com/sample.wav" />
                </NFormItem>

                <div class="form-grid clone-form-grid">
                  <NFormItem label="音色前缀">
                    <NInput v-model:value="clonePrefix" maxlength="10" show-count placeholder="英文字母或数字" />
                  </NFormItem>
                  <NFormItem label="样本语种">
                    <NSelect v-model:value="cloneLanguageHint" :options="languageHintOptions" />
                  </NFormItem>
                </div>

                <div class="form-grid">
                  <NFormItem label="参考时长">
                    <NInputNumber v-model:value="cloneMaxPromptAudioLength" :min="3" :max="30" :step="1" />
                  </NFormItem>
                  <NFormItem label="音频预处理">
                    <NCheckbox v-model:checked="cloneEnablePreprocess">
                      开启降噪、增强与音量规整
                    </NCheckbox>
                  </NFormItem>
                </div>

                <div class="notice-box clone-notice-box">
                  <SvgIcon icon="mdi:link-variant" />
                  <span>
                    本地上传会写入 {{ ossBucketName }} 并生成短期签名 URL；URL 模式仍需公网可访问且无需额外请求头。
                  </span>
                </div>

                <div class="action-row clone-action-row">
                  <NButton
                    type="primary"
                    :loading="cloning"
                    :disabled="!status?.configured || Boolean(selectedCloneFile && ossExplicitlyUnavailable)"
                    @click="handleCreateClone"
                  >
                    <template #icon>
                      <SvgIcon icon="mdi:account-voice" />
                    </template>
                    {{ selectedCloneFile ? '上传并创建复刻音色' : '创建复刻音色' }}
                  </NButton>
                </div>
              </div>
            </div>
          </section>

          <section class="panel clone-notes">
            <div class="panel-header">
              <div>
                <h2>当前音色</h2>
                <p>{{ voices.length }} 个 CosyVoice 音色</p>
              </div>
            </div>
            <div class="voice-list">
              <button
                v-for="voice in voices.slice(0, 8)"
                :key="voice.id"
                class="voice-pill"
                type="button"
                :disabled="Boolean(voice.status && voice.status !== 'OK')"
                @click="useVoiceForSynthesis(voice.voice)"
              >
                <span>{{ voice.displayName || voice.voice }}</span>
                <small>{{ voice.source === 'design' ? '设计' : '复刻' }}</small>
              </button>
              <div v-if="voices.length === 0" class="empty-result empty-result--compact">
                <SvgIcon icon="mdi:account-voice" />
                <span>暂无 CosyVoice 音色</span>
              </div>
            </div>
          </section>
        </div>
      </NTabPane>

      <NTabPane v-if="canDesignVoice" name="design" tab="设计">
        <div class="workspace-grid">
          <section class="panel design-panel">
            <div class="panel-header">
              <div>
                <h2>声音设计</h2>
                <p>用文字描述生成 CosyVoice 音色</p>
              </div>
            </div>

            <div class="form-grid">
              <NFormItem label="音色名称">
                <NInput v-model:value="designDisplayName" maxlength="50" show-count clearable placeholder="例如：温柔老师" />
              </NFormItem>
              <NFormItem label="音色前缀">
                <NInput v-model:value="designPrefix" maxlength="10" show-count placeholder="英文字母或数字" />
              </NFormItem>
            </div>

            <NFormItem label="语言倾向">
              <NSelect v-model:value="designLanguageHint" :options="designLanguageOptions" />
            </NFormItem>

            <NFormItem label="声音描述">
              <NInput
                v-model:value="designPrompt"
                type="textarea"
                :autosize="{ minRows: 4, maxRows: 7 }"
                maxlength="500"
                show-count
                placeholder="例如：温柔、清晰、有耐心的年轻女老师"
              />
            </NFormItem>

            <NFormItem label="预览文本">
              <NInput
                v-model:value="designPreviewText"
                type="textarea"
                :autosize="{ minRows: 3, maxRows: 5 }"
                maxlength="200"
                show-count
                placeholder="生成音色时用于试听的文本"
              />
            </NFormItem>

            <div class="action-row">
              <NButton type="primary" :loading="designing" :disabled="!status?.configured" @click="handleCreateDesign">
                <template #icon>
                  <SvgIcon icon="mdi:palette-outline" />
                </template>
                创建设计音色
              </NButton>
            </div>
          </section>

          <section class="panel result-panel">
            <div class="panel-header">
              <div>
                <h2>设计预览</h2>
                <p v-if="designPreviewAudio">{{ formatBytes(designPreviewAudio.bytes) }}</p>
                <p v-else>生成后可试听</p>
              </div>
            </div>

            <div v-if="designPreviewUrl" class="audio-result">
              <audio controls :src="designPreviewUrl" />
              <div class="result-meta">
                <span>{{ designPreviewAudio?.fileName }}</span>
              </div>
            </div>
            <div v-else class="empty-result">
              <SvgIcon icon="mdi:account-music-outline" />
              <span>设计音色会生成一段预览音频</span>
            </div>
          </section>
        </div>
      </NTabPane>

      <NTabPane name="voices" tab="音色库">
        <section class="panel table-panel">
          <div class="panel-header">
            <div>
              <h2>CosyVoice 音色</h2>
              <p>{{ onlyMyVoices ? '仅显示你创建的音色与系统默认音色。' : '显示全部可见音色。' }}</p>
            </div>
            <div class="voice-library-actions">
              <NCheckbox v-model:checked="onlyMyVoices" @update:checked="loadVoices">
                只看我的（含系统默认）
              </NCheckbox>
              <NButton tertiary :loading="loadingVoices" @click="loadVoices">
                <template #icon>
                  <SvgIcon icon="mdi:refresh" />
                </template>
                刷新
              </NButton>
            </div>
          </div>
          <NDataTable
            :columns="voiceColumns"
            :data="voices"
            :loading="loadingVoices"
            :pagination="{ pageSize: 10 }"
            size="small"
            class="voice-table"
          />
        </section>
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.voice-lab-page {
  --voice-primary: rgb(var(--primary-color, 100 108 255));
  --voice-primary-soft: rgb(var(--primary-color, 100 108 255) / 0.12);
  --voice-primary-hover: rgb(var(--primary-color, 100 108 255) / 0.5);
  --voice-primary-shadow: rgb(var(--primary-color, 100 108 255) / 0.18);
  min-height: 100%;
  padding: 16px 24px 22px;
  color: var(--n-text-color);
}

.voice-header {
  display: grid;
  grid-template-columns: minmax(340px, max-content) minmax(360px, 1fr) auto;
  align-items: start;
  gap: 16px;
  margin-bottom: 14px;
}

.voice-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.voice-title__icon {
  display: inline-flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--voice-primary-soft);
  color: var(--voice-primary);
  font-size: 24px;
}

.voice-title h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.25;
  font-weight: 700;
}

.voice-subtitle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
  color: rgba(128, 128, 128, 0.84);
}

.voice-header__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.voice-library-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.voice-mode-nav {
  display: grid;
  grid-template-columns: repeat(5, minmax(82px, 1fr));
  gap: 8px;
  align-self: center;
  width: 100%;
}

.voice-mode-nav__item {
  min-width: 0;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--n-text-color);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.dark .voice-mode-nav__item {
  background: rgba(255, 255, 255, 0.06);
}

.voice-mode-nav__item :deep(svg) {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

.voice-mode-nav__item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voice-mode-nav__item:hover {
  border-color: var(--voice-primary-hover);
  color: var(--voice-primary);
}

.voice-mode-nav__item.is-active {
  border-color: var(--voice-primary);
  background: var(--voice-primary);
  color: #fff;
  box-shadow: 0 8px 20px var(--voice-primary-shadow);
}

.voice-tabs {
  min-height: 0;
}

.voice-tabs :deep(.n-tabs-nav) {
  display: none;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
  gap: 16px;
  margin-top: 0;
}

.panel {
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  padding: 18px;
}

.dark .panel {
  background: rgba(24, 24, 28, 0.72);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.panel-header p {
  margin: 5px 0 0;
  color: rgba(128, 128, 128, 0.9);
  font-size: 12px;
}

.script-input {
  margin-bottom: 14px;
}

.audio-upload-dragger {
  min-height: 112px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 7px;
  padding: 14px;
  text-align: center;
}

.audio-upload-dragger :deep(svg),
.audio-upload-dragger > svg {
  width: 28px;
  height: 28px;
  color: #2080f0;
}

.audio-upload-dragger strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.audio-upload-dragger span {
  color: rgba(128, 128, 128, 0.9);
  font-size: 12px;
}

.instruction-field {
  display: grid;
  width: 100%;
  gap: 4px;
}

.speed-field {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(120px, 1fr) 108px;
  align-items: center;
  gap: 12px;
}

.instruction-field span {
  justify-self: end;
  color: rgba(128, 128, 128, 0.9);
  font-size: 12px;
}

.instruction-field span.is-danger {
  color: #d03050;
}

.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.clone-form-grid {
  margin-top: 0;
}

.clone-panel {
  padding: 16px;
}

.clone-panel :deep(.n-form-item) {
  margin-bottom: 0;
}

.clone-panel :deep(.n-form-item-label) {
  min-height: 24px;
  padding-bottom: 4px;
}

.clone-panel :deep(.n-form-item-feedback-wrapper) {
  min-height: 8px;
}

.clone-panel :deep(.n-upload-dragger) {
  padding: 0;
}

.clone-compact-grid {
  display: grid;
  grid-template-columns: minmax(300px, 1fr) minmax(320px, 0.95fr);
  gap: 16px;
  align-items: start;
}

.clone-compact-column {
  display: grid;
  gap: 10px;
}

.clone-notice-box {
  padding: 9px 11px;
}

.clone-action-row {
  margin-top: 0;
}

.notice-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid rgba(32, 128, 240, 0.22);
  border-radius: 8px;
  background: rgba(32, 128, 240, 0.06);
  padding: 10px 12px;
  color: rgba(80, 80, 80, 0.95);
  font-size: 12px;
  line-height: 1.5;
}

.dark .notice-box {
  color: rgba(220, 220, 220, 0.92);
}

.notice-box :deep(svg) {
  flex: 0 0 auto;
  width: 17px;
  height: 17px;
  color: #2080f0;
  margin-top: 1px;
}

.action-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.result-panel {
  min-height: 360px;
  display: flex;
  flex-direction: column;
}

.audio-result {
  display: grid;
  gap: 12px;
  margin-top: auto;
  margin-bottom: auto;
}

.audio-result audio {
  width: 100%;
}

.voice-effects {
  margin-top: 18px;
  border-top: 1px solid rgba(128, 128, 128, 0.16);
  padding-top: 16px;
}

.voice-effects__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.voice-effects__header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.voice-effects__header p {
  margin: 4px 0 0;
  color: rgba(128, 128, 128, 0.9);
  font-size: 12px;
}

.effect-preset-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.effect-preset {
  min-width: 0;
  margin-right: 0;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 7px;
  padding: 8px;
}

.effect-preset :deep(.n-checkbox__label) {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.effect-preset small {
  overflow: hidden;
  color: rgba(128, 128, 128, 0.88);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effect-result-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.effect-result-item {
  display: grid;
  gap: 7px;
  border-radius: 7px;
  background: rgba(32, 128, 240, 0.055);
  padding: 10px;
}

.effect-result-item audio {
  width: 100%;
}

.effect-result-item a {
  justify-self: start;
  color: var(--voice-primary);
  font-size: 12px;
  text-decoration: none;
}

.effect-result-item__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.effect-result-item__title span {
  color: rgba(128, 128, 128, 0.9);
}

.result-meta {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: rgba(128, 128, 128, 0.92);
  word-break: break-all;
}

.empty-result {
  flex: 1;
  min-height: 220px;
  display: grid;
  place-content: center;
  gap: 8px;
  color: rgba(128, 128, 128, 0.74);
  text-align: center;
}

.empty-result :deep(svg) {
  width: 32px;
  height: 32px;
  margin: 0 auto;
}

.empty-result--compact {
  min-height: 128px;
}

.voice-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.voice-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-height: 34px;
  border: 1px solid rgba(128, 128, 128, 0.22);
  border-radius: 8px;
  background: transparent;
  padding: 6px 10px;
  color: inherit;
  cursor: pointer;
}

.voice-pill:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.voice-pill span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 210px;
}

.voice-pill small {
  color: rgba(128, 128, 128, 0.86);
}

.voice-pill:not(:disabled):hover {
  border-color: #2080f0;
  color: #2080f0;
}

.table-panel {
  margin-top: 0;
}

.voice-table :deep(.voice-code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.voice-table :deep(.voice-name-cell) {
  display: grid;
  gap: 3px;
}

.voice-table :deep(.voice-name-cell strong) {
  overflow: hidden;
  color: var(--n-text-color);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voice-table :deep(.voice-name-cell code) {
  overflow: hidden;
  color: rgba(128, 128, 128, 0.92);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voice-table :deep(.voice-actions) {
  display: flex;
  gap: 6px;
}

.voice-table :deep(.voice-audition-player) {
  width: 100%;
  max-width: 260px;
  height: 32px;
}

:global(.rename-dialog) {
  display: grid;
  gap: 8px;
}

:global(.rename-dialog__hint) {
  margin: 0;
  color: rgba(128, 128, 128, 0.92);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

@media (max-width: 1100px) {
  .voice-header {
    grid-template-columns: 1fr;
  }

  .voice-header__actions {
    justify-content: flex-start;
  }

  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .clone-compact-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .voice-lab-page {
    padding: 14px;
  }

  .voice-mode-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .speed-field {
    grid-template-columns: 1fr;
  }

  .panel {
    padding: 14px;
  }
}
</style>
