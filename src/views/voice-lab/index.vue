<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { NButton, NInput, NTag, useDialog, useMessage, type DataTableColumns, type UploadFileInfo } from 'naive-ui';
import {
  createVoiceClone,
  createVoiceCloneFromUpload,
  createVoiceDesign,
  deleteVoiceClone,
  fetchVoiceClones,
  fetchVoiceCatalog,
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
import SynthesisPreview from './components/synthesis-preview.vue';
import SpeechControlsEditor from './components/speech-controls-editor.vue';
import VoicePicker from './components/voice-picker.vue';
import { commonVoices } from '@/service/api/voice-selection';
import { compileSpeech, type SpeechControl } from '../../../shared/speech-controls';
import { cloneModelOptions, designModelOptions, voiceModelOptions, defaultCloneModel, modelForVoice, voiceModelLabel, voiceModelPrice } from '@/service/api/voice-models';

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
// 常用列表先给已有角色和少量试听候选，完整目录主动展开。
const onlyMyVoices = ref(false);
const voiceLibraryMode = ref('common');
const voiceSearch = ref('');
const voiceModelFilter = ref<string | null>(null);
const voiceSourceFilter = ref('all');
const sourceOptions = [{label:'全部来源', value:'all'}, {label:'复刻 / 设计', value:'custom'}, {label:'系统音色', value:'system'}, {label:'基础音色', value:'basic'}];
function changeLibraryMode(mode: string) {
  voiceSearch.value = '';
  voiceSourceFilter.value = 'all';
  voiceModelFilter.value = mode === 'all' ? 'qwen-audio-3.0-tts-flash' : null;
}

const synthesisText = ref('');
const selectedVoice = ref('');
const manualVoice = ref('');
const languageHint = ref<VoiceLanguageHint>('zh');
const instruction = ref('');
const speechRate = ref(1);
const speechControls = ref<SpeechControl[]>([]);
const synthesizing = ref(false);
const synthesisResult = ref<VoiceSynthesisResult | null>(null);
const synthesisResultText = ref('');
const auditioningVoice = ref('');

const cloneModel = ref(defaultCloneModel);
const cloneDisplayName = ref('');
const clonePrefix = ref('nautilus');
const cloneAudioUrl = ref('');
const cloneFileList = ref<UploadFileInfo[]>([]);
const cloneLanguageHint = ref<VoiceLanguageHint>('zh');
const cloneEnablePreprocess = ref(false);
const cloneMaxPromptAudioLength = ref(10);
const cloning = ref(false);
const recording = ref(false);
const recordingSeconds = ref(0);
const recordingAudioUrl = ref('');

let voiceRecorder: MediaRecorder | null = null;
let voiceStream: MediaStream | null = null;
let recordingStartedAt = 0;
let recordingTimer: number | null = null;
let createCloneAfterRecording = false;

const designDisplayName = ref('温柔老师');
const designModel = ref(defaultCloneModel);
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

const selectedVoiceId = computed(() => selectedVoice.value || manualVoice.value.trim());
const selectedVoiceMeta = computed(() => voices.value.find(item => item.voice === selectedVoiceId.value));
const synthesisModel = computed(() => modelForVoice(selectedVoiceMeta.value, selectedVoiceId.value)
  || (synthesisResult.value?.voice === selectedVoiceId.value ? synthesisResult.value?.model : undefined));

const commonVoiceList = computed(() => commonVoices(voices.value, selectedVoiceId.value ? [selectedVoiceId.value] : []));
const libraryVoices = computed(() => voiceLibraryMode.value === 'common' ? commonVoiceList.value
  : voiceLibraryMode.value === 'custom' ? voices.value.filter(v => !v.readOnly) : voices.value);
const filteredVoices = computed(() => libraryVoices.value.filter(v =>
  (!voiceModelFilter.value || v.targetModel === voiceModelFilter.value) &&
  (voiceSourceFilter.value === 'all' || (voiceSourceFilter.value === 'custom' ? !v.readOnly : v.source === voiceSourceFilter.value)) &&
  `${v.displayName} ${v.voice} ${v.voicePrompt || ''}`.toLowerCase().includes(voiceSearch.value.trim().toLowerCase())
));

const visibleCharacters = computed(() => Array.from(synthesisText.value || '').length);
const billingCharacters = computed(() => countBillingCharacters(synthesisText.value));
const instructionBillingCharacters = computed(() => countBillingCharacters(instruction.value));
const totalBillingCharacters = computed(() => billingCharacters.value + instructionBillingCharacters.value);
const estimatedCost = computed(() => {
  const price = voiceModelPrice(synthesisModel.value);
  return price === undefined ? '待识别模型' : Number(((totalBillingCharacters.value / 10000) * price).toFixed(4));
});

watch(manualVoice, value => {
  if (value.trim() && value.trim() !== selectedVoice.value) selectedVoice.value = '';
});
watch(selectedVoice, value => {
  if (value && manualVoice.value.trim() !== value) manualVoice.value = '';
});
const shouldRequestWordTimestamps = computed(() => selectedVoiceMeta.value?.wordTimestampsSupported ?? selectedVoiceMeta.value?.source !== 'design');
const selectedCloneFile = computed(() => cloneFileList.value.find(item => item.file)?.file || null);
const ossBucketName = computed(() => status.value?.oss?.bucket || 'nautilus-audio');
const ossExplicitlyUnavailable = computed(() => status.value?.oss?.configured === false);
const alignmentWordCount = computed(() => synthesisResult.value?.alignment?.sentences.reduce((sum, sentence) => sum + sentence.words.length, 0) || 0);

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
    const all: VoiceCloneItem[] = [];
    for (let page = 0; page < 20; page++) {
      const { data, error } = await fetchVoiceClones({ pageSize: 100, pageIndex: page, onlyMine: onlyMyVoices.value });
      if (error || !data) return;
      all.push(...data.voices);
      if ((page + 1) * 100 >= data.totalCount) break;
    }
    voices.value = all;
    const catalog = await fetchVoiceCatalog();
    if (!catalog.error && catalog.data) voices.value.push(...catalog.data.voices.filter(v => !all.some(existing => existing.voice === v.voice)).sort((a,b) => Number(a.source !== 'system') - Number(b.source !== 'system')));
    const firstReadyVoice = commonVoices(voices.value).find(item => item.modelSupported !== false && (!item.status || item.status === 'OK'));
    if (!selectedVoice.value && !manualVoice.value.trim() && firstReadyVoice) selectedVoice.value = firstReadyVoice.voice;
  } finally {
    loadingVoices.value = false;
  }
}


async function handleSynthesize() {
  try { compileSpeech(synthesisText.value.trim(), speechControls.value); }
  catch (error) { message.warning((error as Error).message); return; }
  if (speechControls.value.length && selectedVoiceMeta.value?.ssmlSupported === false) {
    message.warning('此声音暂不支持停顿和指定读法，请选择复刻音色或基础音色');
    return;
  }
  if (!synthesisText.value.trim()) {
    message.warning('请填写合成文本');
    return;
  }
  if (!selectedVoiceId.value) {
    message.warning('请先选择或填写音色 ID');
    return;
  }
  if (instructionBillingCharacters.value > 100) {
    message.warning('指令不能超过 100 个计费字符');
    return;
  }

  synthesizing.value = true;
  synthesisResult.value = null;
  synthesisResultText.value = synthesisText.value.trim();
  try {
    const { data, error } = await synthesizeVoice({
      text: synthesisResultText.value,
      voice: selectedVoiceId.value,
      model: synthesisModel.value,
      languageHint: languageHint.value,
      instruction: instruction.value,
      rate: speechRate.value,
      enableWordTimestamps: shouldRequestWordTimestamps.value,
      speechControls: speechControls.value,
    });

    if (!error && data) {
      synthesisResult.value = data;
      if (data.auditionSaved && data.auditionAudio) {
        voices.value = voices.value.map(item => (item.voice === data.voice ? { ...item, auditionAudio: data.auditionAudio } : item));
      }
      message.success(data.alignment?.available ? `语音合成完成，已返回 ${alignmentWordCount.value} 个字/词时间戳` : '语音合成完成');
    }
  } finally {
    synthesizing.value = false;
  }
}


async function handleCreateClone(file = selectedCloneFile.value) {
  if (!canCloneVoice.value) {
    message.warning('当前账号没有复刻音色权限');
    return;
  }
  if (!file && !cloneAudioUrl.value.trim()) {
    message.warning('请上传音频，或填写公网可访问的音频 URL');
    return;
  }
  if (!clonePrefix.value.trim()) {
    message.warning('请填写音色前缀');
    return;
  }
  if (file && ossExplicitlyUnavailable.value) {
    message.warning('OSS 未配置，无法使用本地上传中转');
    return;
  }

  cloning.value = true;
  try {
    const request = file
      ? createVoiceCloneFromUpload(createCloneFormData(file))
      : createVoiceClone({
          audioUrl: cloneAudioUrl.value,
          targetModel: cloneModel.value,
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
      if (data.warning) message.warning(data.warning);
      else message.success(`${voiceModelLabel(data.targetModel)} 音色已创建，原始录音已保存`);
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
  formData.append('targetModel', cloneModel.value);
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

function getRecordingMimeType() {
  const supportedMimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return supportedMimeTypes.find(mimeType => MediaRecorder.isTypeSupported(mimeType)) || '';
}

function clearRecordingTimer() {
  if (recordingTimer) window.clearInterval(recordingTimer);
  recordingTimer = null;
}

function releaseRecordingResources() {
  clearRecordingTimer();
  voiceStream?.getTracks().forEach(track => track.stop());
  voiceStream = null;
  voiceRecorder = null;
  recording.value = false;
}

function getRecordingExtension(mimeType: string) {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'm4a';
  return 'webm';
}

function stopVoiceRecording(createClone = true) {
  createCloneAfterRecording = createClone;
  if (voiceRecorder?.state === 'recording') {
    voiceRecorder.stop();
    return;
  }
  releaseRecordingResources();
}

async function startVoiceRecording() {
  if (!status.value?.configured) {
    message.warning('请先配置百炼服务');
    return;
  }
  if (ossExplicitlyUnavailable.value) {
    message.warning('OSS 未配置，录音无法自动上传复刻');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    message.error('当前浏览器不支持麦克风录音，请改用上传音频');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    const mimeType = getRecordingMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    voiceStream = stream;
    voiceRecorder = recorder;
    recordingStartedAt = Date.now();
    recordingSeconds.value = 0;
    createCloneAfterRecording = false;

    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      releaseRecordingResources();
      message.error('录音中断，请检查麦克风后重试');
    };
    recorder.onstop = async () => {
      const shouldCreateClone = createCloneAfterRecording;
      const duration = (Date.now() - recordingStartedAt) / 1000;
      const recordedMimeType = recorder.mimeType || mimeType || 'audio/webm';
      releaseRecordingResources();

      if (!shouldCreateClone || duration < 3 || chunks.length === 0) {
        if (shouldCreateClone && duration < 3) message.warning('录音至少需要 3 秒，请重新录制');
        return;
      }

      const extension = getRecordingExtension(recordedMimeType);
      const file = new File([new Blob(chunks, { type: recordedMimeType })], `voice-sample-${Date.now()}.${extension}`, {
        type: recordedMimeType,
      });
      if (recordingAudioUrl.value) URL.revokeObjectURL(recordingAudioUrl.value);
      recordingAudioUrl.value = URL.createObjectURL(file);
      cloneFileList.value = [{ id: `recorded-${Date.now()}`, name: file.name, status: 'finished', file }];
      cloneAudioUrl.value = '';
      if (!cloneDisplayName.value.trim()) cloneDisplayName.value = `我的录音 ${new Date().toLocaleDateString()}`;

      message.info('录音完成，正在创建复刻音色…');
      await handleCreateClone(file);
    };

    recorder.start();
    recording.value = true;
    recordingTimer = window.setInterval(() => {
      recordingSeconds.value = Math.min(30, (Date.now() - recordingStartedAt) / 1000);
      if (recordingSeconds.value >= 30) stopVoiceRecording(true);
    }, 100);
  } catch (error) {
    releaseRecordingResources();
    const errorName = error instanceof DOMException ? error.name : '';
    message.error(errorName === 'NotAllowedError' ? '未获得麦克风权限，请在浏览器中允许后重试' : '无法开启麦克风，请检查设备后重试');
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
      targetModel: designModel.value,
    });

    if (!error && data) {
      trackAction('design_voice', 'success', {
        voice: data.voice,
        targetModel: data.targetModel,
      });
      selectedVoice.value = data.voice;
      manualVoice.value = data.voice;
      designPreviewAudio.value = data.previewAudio || null;
      message.success(`${voiceModelLabel(designModel.value)} 设计音色已创建`);
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
      model: modelForVoice(row) || '',
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

function downloadAlignment() {
  if (!synthesisResult.value?.alignment?.available) return;

  const audioName = synthesisResult.value.audio?.downloadName || synthesisResult.value.audio?.fileName || `voice-lab-${Date.now()}.wav`;
  const fileName = audioName.replace(/\.[^.]+$/, '') + '.alignment.json';
  const content = {
    version: 1,
    text: synthesisResultText.value,
    requestId: synthesisResult.value.requestId,
    model: synthesisResult.value.model,
    voice: synthesisResult.value.voice,
    audio: synthesisResult.value.audio,
    alignment: synthesisResult.value.alignment,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderVoiceAudition(row: VoiceCloneItem) {
  if (row.auditionAudio?.url) return h('audio', {
    class: 'voice-audition-player', controls: true, src: withAuthQuery(row.auditionAudio.url),
  });
  return h(NButton, {
    size: 'small', tertiary: true, loading: auditioningVoice.value === row.voice,
    disabled: row.modelSupported === false || Boolean(row.status && row.status !== 'OK'),
    onClick: () => handleGenerateAudition(row),
  }, { default: () => '生成试听' });
}

const commonVoiceColumns = computed<DataTableColumns<VoiceCloneItem>>(() => [
  { title: '声音', key: 'voice', minWidth: 150, render: row => row.displayName?.replace(/ · Audio Flash$/, '') || '未命名声音' },
  { title: '特点与用途', key: 'description', minWidth: 210, render: row => row.readOnly
    ? [row.gender, row.description, row.scene, row.language].filter(Boolean).join(' · ')
    : row.source === 'design' ? row.voicePrompt || '文字设计的声音' : '已有角色复刻声音' },
  { title: '模型', key: 'targetModel', width: 150, render: row => voiceModelLabel(modelForVoice(row)) },
  { title: '试听', key: 'audition', minWidth: 220, render: renderVoiceAudition },
  { title: '选用', key: 'actions', width: 90, render: row => h(NButton, {
    size: 'small', tertiary: true, disabled: row.modelSupported === false || Boolean(row.status && row.status !== 'OK'),
    onClick: () => useVoiceForSynthesis(row.voice),
  }, { default: () => '选用' }) },
]);

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
    title: '模型', key: 'targetModel', width: 180,
    render: row => voiceModelLabel(modelForVoice(row)),
  },
  {
    title: '原始录音', key: 'sourceAudio', width: 110,
    render: row => row.sourceAudio ? h(NButton, { tag: 'a', size: 'small', tertiary: true, href: withAuthQuery(row.sourceAudio.url), target: '_blank' }, { default: () => '查看原件' }) : '—',
  },
  {
    title: '来源',
    key: 'source',
    width: 92,
    render(row) {
      return h(NTag, { size: 'small', bordered: false, type: row.source === 'design' ? 'info' : 'default' }, {
        default: () => ({design:'设计',system:'系统',basic:'基础'}[row.source] || '复刻'),
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
    title: '生成 / 试听',
    key: 'synthesisCount',
    width: 120,
    render(row) {
      return h('span', { title: row.lastSynthesizedAt ? `最近合成：${row.lastSynthesizedAt}` : '新埋点上线后暂无合成记录；历史次数未知' },
        `${row.synthesisCount || 0} / ${row.auditionCount || 0}`);
    },
  },
  {
    title: '试听',
    key: 'audition',
    minWidth: 260,
    render: renderVoiceAudition,
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
        h(NButton, { size: 'small', tertiary: true, disabled: row.modelSupported === false || Boolean(row.status && row.status !== 'OK'), onClick: () => useVoiceForSynthesis(row.voice) }, {
          default: () => '选用',
        }),
      ];

      if (canManageVoices.value && !row.readOnly) {
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

onBeforeUnmount(() => {
  if (recordingAudioUrl.value) URL.revokeObjectURL(recordingAudioUrl.value);
  stopVoiceRecording(false);
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
            <span>CosyVoice / Audio · 模型随音色自动匹配</span>
            <span>支持现成、复刻与设计音色</span>
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
              <NTag size="small" :bordered="false">{{ voiceModelLabel(synthesisModel) }}</NTag>
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
                <VoicePicker v-model:value="selectedVoice" :voices="voices" :loading="loadingVoices" :disabled="synthesizing" aria-label="合成声音" />
              </NFormItem>
              <NFormItem label="目标语种">
                <NSelect v-model:value="languageHint" :options="languageHintOptions" />
              </NFormItem>
            </div>

            <div class="form-grid">
              <NFormItem label="手动音色 ID">
                <NInput v-model:value="manualVoice" clearable placeholder="粘贴音色 ID，自动识别模型" />
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

            <SpeechControlsEditor v-model="speechControls" :text="synthesisText" :available="selectedVoiceMeta?.ssmlSupported" :disabled="synthesizing" />

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
              <NSpace v-if="audioUrl" size="small">
                <NButton v-if="synthesisResult?.alignment?.available" tertiary @click="downloadAlignment">
                  <template #icon>
                    <SvgIcon icon="mdi:timeline-text-outline" />
                  </template>
                  时间轴 JSON
                </NButton>
                <NButton tertiary @click="downloadResult">
                  <template #icon>
                    <SvgIcon icon="mdi:download-outline" />
                  </template>
                  下载音频
                </NButton>
              </NSpace>
            </div>

            <div v-if="audioUrl" class="audio-result">
              <SynthesisPreview
                :key="audioUrl"
                :src="audioUrl"
                :text="synthesisResultText"
                :alignment="synthesisResult?.alignment"
              />
              <div class="result-meta">
                <span>Request {{ synthesisResult?.requestId || '-' }}</span>
                <span>{{ synthesisResult?.audio?.downloadName || synthesisResult?.audio?.fileName }}</span>
                <span v-if="synthesisResult?.alignment?.available">
                  已返回 {{ alignmentWordCount }} 个字/词时间戳
                </span>
                <span v-else-if="synthesisResult?.alignment?.requested">当前音色未返回字级时间轴</span>
                <span v-else>此音色暂不请求字级时间轴</span>
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
                <p>选择模型并提供原始录音；合成时自动使用该音色对应的模型</p>
              </div>
            </div>

            <div class="clone-compact-grid">
              <div class="clone-compact-column">
                <NFormItem label="克隆模型">
                  <NSelect v-model:value="cloneModel" :options="cloneModelOptions" :disabled="cloning || recording" aria-label="克隆模型" />
                </NFormItem>
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

                <div class="record-clone-card" :class="{ 'is-recording': recording }">
                  <div class="record-clone-card__heading">
                    <span class="record-clone-card__icon">
                      <SvgIcon :icon="recording ? 'mdi:microphone' : 'mdi:microphone-outline'" />
                    </span>
                    <div>
                      <strong>直接录音复刻</strong>
                      <p v-if="recording">正在录音 {{ recordingSeconds.toFixed(1) }} 秒 / 30 秒</p>
                      <p v-else>录制 3–30 秒清晰人声，结束后会自动上传并创建音色</p>
                    </div>
                  </div>
                  <div class="record-clone-card__actions">
                    <NButton
                      :type="recording ? 'error' : 'primary'"
                      :disabled="cloning || !status?.configured || (!recording && ossExplicitlyUnavailable)"
                      @click="recording ? stopVoiceRecording(true) : startVoiceRecording()"
                    >
                      <template #icon>
                        <SvgIcon :icon="recording ? 'mdi:stop-circle-outline' : 'mdi:microphone'" />
                      </template>
                      {{ recording ? '结束并复刻' : '开始录音' }}
                    </NButton>
                    <span v-if="recording" class="recording-indicator"><i />录音中</span>
                  </div>
                  <audio v-if="recordingAudioUrl && !recording" controls :src="recordingAudioUrl" class="record-clone-card__audio" />
                </div>
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
                  <NFormItem label="音频预处理（默认关闭）">
                    <div class="flex flex-col gap-8px">
                      <NCheckbox v-model:checked="cloneEnablePreprocess">
                        开启降噪、增强与音量规整
                      </NCheckbox>
                      <NText depth="3" class="text-12px">
                        关闭可保留原声细节；样本噪声明显时再尝试开启。仅影响本次新复刻的音色。
                      </NText>
                    </div>
                  </NFormItem>
                </div>

                <div class="notice-box clone-notice-box">
                  <SvgIcon icon="mdi:link-variant" />
                  <span>
                    通过 {{ ossBucketName }} 临时中转，创建后在 Nautilus 保存原始录音。预处理、样本音量归一化默认关闭。
                  </span>
                </div>

                <div class="action-row clone-action-row">
                  <NButton
                    type="primary"
                    :loading="cloning"
                    :disabled="!status?.configured || Boolean(selectedCloneFile && ossExplicitlyUnavailable)"
                    @click="() => handleCreateClone()"
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
                <p>{{ voices.length }} 个音色</p>
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
                <span>暂无音色</span>
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
                <p>描述声音的年龄、特点和用途，生成后试听确认。</p>
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

            <NFormItem label="设计模型">
              <NSelect v-model:value="designModel" :options="designModelOptions" />
            </NFormItem>
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
              <h2>音色库</h2>
              <p>先试听已有角色和少量候选；需要新声线时再打开更多音色。</p>
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
          <NRadioGroup v-model:value="voiceLibraryMode" size="small" style="margin-bottom: 12px" @update:value="changeLibraryMode">
            <NRadioButton value="common">常用声音</NRadioButton>
            <NRadioButton value="custom">复刻与设计</NRadioButton>
            <NRadioButton value="all">更多音色</NRadioButton>
          </NRadioGroup>
          <NSpace style="margin-bottom: 12px" align="center">
            <NInput v-model:value="voiceSearch" clearable placeholder="搜索名称、性别、特点或用途" style="width: 260px" />
            <NSelect v-if="voiceLibraryMode !== 'common'" v-model:value="voiceModelFilter" :options="voiceModelOptions" clearable placeholder="全部模型" style="width: 190px" />
            <NSelect v-if="voiceLibraryMode !== 'common'" v-model:value="voiceSourceFilter" :options="sourceOptions" style="width: 150px" />
            <span>{{ filteredVoices.length }} 个{{ voiceLibraryMode === 'common' ? '常用声音' : '音色' }}</span>
          </NSpace>
          <NDataTable
            :columns="voiceLibraryMode === 'common' ? commonVoiceColumns : voiceColumns"
            :data="filteredVoices"
            :loading="loadingVoices"
            :pagination="{ pageSize: voiceLibraryMode === 'common' ? 16 : 10 }"
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

.record-clone-card {
  display: grid;
  gap: 10px;
  border: 1px solid rgba(32, 128, 240, 0.24);
  border-radius: 8px;
  background: rgba(32, 128, 240, 0.045);
  padding: 11px;
}

.record-clone-card.is-recording {
  border-color: rgba(208, 48, 80, 0.48);
  background: rgba(208, 48, 80, 0.06);
}

.record-clone-card__heading {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.record-clone-card__icon {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(32, 128, 240, 0.12);
  color: #2080f0;
}

.record-clone-card.is-recording .record-clone-card__icon {
  background: rgba(208, 48, 80, 0.14);
  color: #d03050;
}

.record-clone-card__heading strong {
  display: block;
  font-size: 13px;
  line-height: 1.4;
}

.record-clone-card__heading p {
  margin: 2px 0 0;
  color: rgba(128, 128, 128, 0.92);
  font-size: 12px;
  line-height: 1.45;
}

.record-clone-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.recording-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #d03050;
  font-size: 12px;
}

.recording-indicator i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: record-pulse 1.15s ease-in-out infinite;
}

.record-clone-card__audio {
  width: 100%;
  height: 32px;
}

@keyframes record-pulse {
  50% {
    opacity: 0.35;
    transform: scale(0.82);
  }
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
