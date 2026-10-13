import { cloneModelOptions, defaultCloneModel, modelForVoice, voiceModelLabel } from '@/service/api/voice-models';
import { fetchCharacterLibrary, type CharacterRecord } from '@/service/api/character-library';
import { adoptCharacter } from '../../character-library/project';
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { useAuthStore } from '@/store/modules/auth';
import { getToken } from '@/store/modules/auth/shared';
import {
  fetchVoiceClones,
  fetchVoiceCatalog,
  fetchVoiceLabStatus,
  synthesizeVoice,
  createVoiceCloneFromUpload,
  type VoiceCloneItem
} from '@/service/api/voice-lab';
import * as projects from '@/service/api/sequence-player';
import {
  audioKey,
  synthesisInstruction,
  buildRenderJob,
  createCharacter,
  createSegment,
  dialogueText,
  emptyState,
  exportText,
  findRole,
  fromProject,
  isReady,
  parseTranscript,
  prepareSegments,
  prepareEditedTranscript,
  punctuationPause,
  presetReferenceUrl,
  updateAutomaticPauses,
  resolvePortrait,
  resolvePose,
  roleFor,
  segmentDuration,
  splitSpeech,
  toProject,
  type Segment,
  type SegmentAudio,
  type WorkshopCharacter
} from './model';
import { abortCheck, delay, requestError, retryRequest, runGenerationQueue } from './generation';
import { loadAudioBlob, measureAudio, useWorkshopPlayback } from './audio';

export function useWorkshop() {
  const message = useMessage();
  const dialog = useDialog();
  const auth = useAuthStore();
  const state = ref(emptyState());
  const projectId = ref<string | null>(null);
  const selectedId = ref('');
  const selectedRoleId = ref(state.value.characters[0].id);
  const editingScript = ref(false);
  const draftText = ref('');
  const editorOpen = ref(true);
  const showProjects = ref(false);
  const showVideo = ref(false);
  const projectList = ref<projects.ProjectListItem[]>([]);
  const loadingProjects = ref(false);
  const saving = ref(false);
  const saveLabel = ref('自动保存草稿');
  const voices = ref<VoiceCloneItem[]>([]);
  const loadingVoices = ref(false);
  const serviceConfigured = ref<boolean | null>(null);
  const defaultModel = ref('');
  const voiceStatus = ref('正在读取语音实验室');
  const generating = ref(false);
  const paused = ref(false);
  const activeGenerationId = ref('');
  const generationMessage = ref('上传逐字稿，匹配角色声音后开始生成');
  const uploadingPortrait = ref(false);
  const cloning = ref(false);
  const cloneModel = ref(defaultCloneModel);
  let generationController = new AbortController();
  let generationEpoch = 0;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let voiceLoadEpoch = 0;
  let initialized = false;
  const playback = useWorkshopPlayback(state, value => message.error(value));
  const selected = computed(() => state.value.segments.find(segment => segment.id === selectedId.value));
  const selectedRole = computed(() => state.value.characters.find(role => role.id === selectedRoleId.value));
  const stageSegment = computed(() => state.value.segments[playback.currentIndex.value]);
  const stageRole = computed(() => roleFor(state.value, stageSegment.value));
  const stagePose = computed(() => resolvePose(stageRole.value, stageSegment.value));
  const library = ref<CharacterRecord[]>([]);
  const loadingLibrary = ref(false);
  const stagePortrait = computed(() => mediaUrl(resolvePortrait(stageRole.value, stageSegment.value)));
  const dialogueSegments = computed(() => state.value.segments.filter(segment => segment.kind === 'dialogue'));
  const failedSegments = computed(() =>
    dialogueSegments.value.filter(segment => segment.generationError || segment.audio?.status === 'failed')
  );
  const referenceUrl = computed(() => presetReferenceUrl(selectedRole.value));
  const readyCount = computed(
    () => dialogueSegments.value.filter(segment => isReady(segment, roleFor(state.value, segment))).length
  );
  const progress = computed(() =>
    dialogueSegments.value.length ? Math.round((readyCount.value / dialogueSegments.value.length) * 100) : 0
  );
  const allReady = computed(
    () => dialogueSegments.value.length > 0 && readyCount.value === dialogueSegments.value.length
  );
  const totalMs = computed(() =>
    state.value.segments.reduce((sum, segment) => sum + segmentDuration(segment, roleFor(state.value, segment)), 0)
  );
  const canEdit = computed(
    () => !loadingLibrary.value && (!generating.value || (paused.value && !activeGenerationId.value))
  );
  const roleOptions = computed(() => state.value.characters.map(role => ({ label: role.displayName, value: role.id })));
  const voiceOptions = computed(() =>
    voices.value.map(voice => ({
      label: `${voice.displayName || '未命名'} · ${voiceModelLabel(modelForVoice(voice))} · ${voice.voice.slice(-8)}${voice.status !== 'OK' ? ` · ${voice.status}` : ''}`,
      value: voice.voice,
      disabled: voice.status !== 'OK' || voice.modelSupported === false
    }))
  );
  const workflowStep = computed(() => (allReady.value ? 3 : state.value.segments.length ? 2 : 1));
  const draftKey = () => `nautilus-sequence-workshop-v1:${auth.userInfo.userId || 'local'}`;

  function mediaUrl(url: string) {
    if (!/^\/api\/(sequence-player|character-library)\/assets\//.test(url)) return url;
    return `${url}?_token=${encodeURIComponent(getToken())}`;
  }
  function flushDraft() {
    if (!initialized) return;
    try {
      localStorage.setItem(
        draftKey(),
        JSON.stringify({
          project: toProject(state.value),
          projectId: projectId.value,
          selectedId: selectedId.value,
          draftText: draftText.value,
          editingScript: editingScript.value
        })
      );
      saveLabel.value = '草稿已保存';
    } catch {
      saveLabel.value = '草稿保存失败，请保存项目';
    }
  }
  watch(
    [state, draftText, editingScript],
    () => {
      if (!initialized) return;
      saveLabel.value = '保存草稿中…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushDraft, 350);
    },
    { deep: true }
  );

  function selectSegment(segment: Segment) {
    selectedId.value = segment.id;
    playback.select(state.value.segments.indexOf(segment));
  }
  function syncRaw() {
    updateAutomaticPauses(state.value.segments);
    state.value.rawScript = exportText(state.value);
  }
  function dirty(segment?: Segment) {
    playback.stop();
    if (segment) {
      segment.audio = undefined;
      segment.generationError = undefined;
    }
    syncRaw();
  }
  function editText(segment: Segment, text: string) {
    segment.text = text;
    const result = dialogueText(text);
    segment.speakText = result.speakText;
    dirty(segment);
  }
  function changeVoice(role: WorkshopCharacter, voiceId: string | null) {
    role.ttsConfig.voiceId = voiceId || '';
    role.ttsConfig.provider = 'nautilus';
    role.ttsConfig.model = modelForVoice(voices.value.find(voice => voice.voice === voiceId)) || '';
    playback.stop();
  }
  function autoMatchVoices() {
    for (const role of state.value.characters) {
      if (role.ttsConfig.voiceId) continue;
      const names = [role.name, role.displayName, ...(role.aliases || [])];
      const matches = voices.value.filter(
        voice => voice.status === 'OK' && voice.displayName && names.includes(voice.displayName.trim())
      );
      if (matches.length === 1) changeVoice(role, matches[0].voice);
    }
  }
  async function loadVoices() {
    const epoch = ++voiceLoadEpoch;
    loadingVoices.value = true;
    try {
      const status = await fetchVoiceLabStatus();
      if (status.error || !status.data) throw new Error('语音实验室不可用或没有访问权限');
      if (epoch !== voiceLoadEpoch || disposed) return;
      serviceConfigured.value = status.data.configured;
      defaultModel.value = status.data.defaults.synthesisModel;
      if (!status.data.configured) {
        voiceStatus.value = '语音实验室尚未配置';
        return;
      }
      const all: VoiceCloneItem[] = [];
      for (let page = 0; page < 20; page++) {
        const result = await fetchVoiceClones({ pageSize: 100, pageIndex: page });
        if (result.error || !result.data) throw new Error('音色列表读取失败，请重试');
        const items = result.data.voices;
        all.push(...items.filter(item => !all.some(old => old.voice === item.voice)));
        if ((page + 1) * 100 >= result.data.totalCount) break;
      }
      if (epoch !== voiceLoadEpoch || disposed) return;
      voices.value = all;
      const catalog = await fetchVoiceCatalog();
      if (epoch !== voiceLoadEpoch || disposed) return;
      if (!catalog.error && catalog.data) voices.value.push(...catalog.data.voices.filter(v => !all.some(item => item.voice === v.voice)));
      voiceStatus.value = all.length ? `${all.length} 个可用音色` : '暂无音色，可上传参考音频创建';
      autoMatchVoices();
    } catch (error: any) {
      voiceStatus.value = error.message;
    } finally {
      if (epoch === voiceLoadEpoch) loadingVoices.value = false;
    }
  }
  async function loadLibrary(adoptDefaults = false) {
    loadingLibrary.value = true;
    const before = JSON.stringify(state.value);
    try {
      const result = await fetchCharacterLibrary();
      if (result.error || !result.data || disposed) return;
      library.value = result.data.filter(r => !r.archived);
      if (adoptDefaults && before === JSON.stringify(state.value)) {
        for (const record of library.value) {
          const target = findRole(state.value.characters, record.character.name);
          if (target) adoptCharacter(state.value, record, target.id);
        }
      }
    } finally {
      loadingLibrary.value = false;
    }
  }
  function useLibraryCharacter(record: CharacterRecord, targetId?: string) {
    if (!canEdit.value) return;
    playback.stop();
    const role = adoptCharacter(state.value, record, targetId);
    selectedRoleId.value = role.id;
    flushDraft();
    message.success('人物配置已应用到当前项目');
  }
  function applyScript(source: string, keepSource = false) {
    stopGeneration();
    playback.stop();
    const previousIds = new Set(state.value.characters.map(c => c.id));
    // Offer library names to the parser, then retain only characters actually used.
    for (const record of library.value) {
      if (!findRole(state.value.characters, record.character.name)) adoptCharacter(state.value, record);
    }
    state.value.segments = keepSource
      ? prepareEditedTranscript(source, state.value)
      : prepareSegments(parseTranscript(source, state.value));
    state.value.characters = state.value.characters.filter(
      c => previousIds.has(c.id) || state.value.segments.some(s => s.characterId === c.id)
    );
    if (!keepSource || !state.value.sourceScript) state.value.sourceScript = source;
    updateAutomaticPauses(state.value.segments);
    state.value.prepared = true;
    editingScript.value = false;
    syncRaw();
    autoMatchVoices();
    selectedId.value = state.value.segments[0]?.id || '';
    playback.select(0);
    generationMessage.value = '稿件已整理，确认角色音色后即可生成';
  }
  function startEditScript() {
    draftText.value = exportText(state.value) || state.value.rawScript;
    editingScript.value = true;
  }
  function finishEditScript() {
    if (!draftText.value.trim()) {
      message.warning('请先输入台词');
      return false;
    }
    applyScript(draftText.value, true);
    return true;
  }
  function restoreOriginal() {
    dialog.warning({
      title: '还原导入原稿',
      content: '将恢复最初导入的台词。已修改句子的配音需要重新生成。',
      positiveText: '还原',
      negativeText: '取消',
      onPositiveClick: () => applyScript(state.value.sourceScript, true)
    });
  }
  function addLine() {
    const index = selected.value ? state.value.segments.indexOf(selected.value) + 1 : state.value.segments.length;
    const line = createSegment(
      selected.value?.characterId || selectedRoleId.value || state.value.characters[0]?.id || ''
    );
    state.value.segments.splice(index, 0, line);
    selectSegment(line);
    syncRaw();
  }
  function deleteLine() {
    const segment = selected.value;
    if (!segment) return;
    dialog.warning({
      title: '删除这句台词',
      content: '这句台词及其配音引用将从当前稿件移除。',
      positiveText: '删除',
      negativeText: '取消',
      onPositiveClick: () => {
        playback.stop();
        const index = state.value.segments.indexOf(segment);
        state.value.segments.splice(index, 1);
        const next = state.value.segments[Math.max(0, index - 1)];
        selectedId.value = next?.id || '';
        playback.select(Math.max(0, index - 1));
        syncRaw();
      }
    });
  }
  function addRole() {
    let n = state.value.characters.length + 1;
    while (findRole(state.value.characters, `角色${n}`)) n++;
    const role = createCharacter(`角色${n}`, n);
    state.value.characters.push(role);
    selectedRoleId.value = role.id;
  }
  function removeRole() {
    const role = selectedRole.value;
    if (!role) return;
    if (state.value.segments.some(segment => segment.characterId === role.id)) {
      message.warning('请先把该角色的台词分配给其他角色');
      return;
    }
    state.value.characters = state.value.characters.filter(item => item.id !== role.id);
    selectedRoleId.value = state.value.characters[0]?.id || '';
  }
  async function uploadPortraits(files: File[]) {
    const role = selectedRole.value;
    if (!role) return;
    uploadingPortrait.value = true;
    try {
      for (const file of files) {
        const result = await projects.uploadSequenceImage(file);
        if (result.error || !result.data) throw new Error('立绘上传失败');
        if (disposed || !state.value.characters.includes(role)) return;
        state.value.assets.push(result.data);
        role.poses.push({
          id: result.data.id,
          name: file.name.replace(/\.[^.]+$/, ''),
          imageUrl: result.data.url,
          layout: { x: role.position === 'left' ? 20 : 80, y: 93, height: 60 }
        });
      }
      message.success('立绘已添加，可在单句设置中选择');
    } catch (error: any) {
      message.error(error.message);
    } finally {
      uploadingPortrait.value = false;
    }
  }
  async function cloneVoice(file: File, role = selectedRole.value) {
    if (!role || cloning.value) return;
    cloning.value = true;
    try {
      const form = new FormData();
      form.append('audio', file);
      form.append('targetModel', cloneModel.value);
      form.append('enablePreprocess', 'false');
      form.append('displayName', role.displayName);
      form.append('prefix', 'sequence');
      form.append('languageHint', 'zh');
      const result = await createVoiceCloneFromUpload(form);
      if (result.error || !result.data) throw new Error('创建音色失败，请检查参考音频及音色复刻权限');
      if (disposed || !state.value.characters.includes(role)) return;
      await loadVoices();
      if (disposed || !state.value.characters.includes(role)) return;
      role.ttsConfig = {
        ...role.ttsConfig,
        engine: 'external',
        provider: 'nautilus',
        voiceId: result.data.voice,
        model: result.data.targetModel
      };
      if (result.data.warning) message.warning(result.data.warning);
      else message.success('角色声音已创建并绑定，原始录音已保存');
    } catch (error: any) {
      message.error(error.message);
    } finally {
      cloning.value = false;
    }
  }
  async function usePresetVoice() {
    const role = selectedRole.value;
    const url = presetReferenceUrl(role);
    if (!role || !url || cloning.value) return;
    // 仅明确选择预设时复用同名声音；多重同名交给用户在下拉框选择。
    const matches = voices.value.filter(voice => voice.displayName === role.name && voice.source === 'clone' && modelForVoice(voice) === cloneModel.value && voice.status === 'OK');
    if (matches.length === 1) {
      changeVoice(role, matches[0].voice);
      message.success('已绑定语音实验室中的同名角色声音');
      return;
    }
    if (matches.length > 1) {
      message.warning('有多个同名声音，请在角色声音中选择已有音色');
      return;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('预设参考音频读取失败');
      const file = new File([await response.blob()], `${role.referencePreset}-reference.mp3`, { type: 'audio/mpeg' });
      if (disposed || !state.value.characters.includes(role)) return;
      await cloneVoice(file, role);
    } catch (error: any) {
      message.error(error.message);
    }
  }
  function saveRoleSettings() {
    flushDraft();
    message.success('角色设置已保存到草稿');
  }
  async function waitUntilResumed(signal: AbortSignal) {
    while (paused.value) await delay(80, signal);
    abortCheck(signal);
  }
  async function preflight(signal: AbortSignal) {
    generationMessage.value = '正在检查语音服务…';
    const status = await fetchVoiceLabStatus({ signal, timeout: 12000, silentError: true });
    abortCheck(signal);
    if (status.error || !status.data) throw requestError(status.error, '语音实验室暂时不可用');
    if (!status.data.configured) throw new Error('语音实验室尚未配置');
    defaultModel.value = status.data.defaults.synthesisModel;
  }
  async function generateSegment(segment: Segment, force = false, epoch = generationEpoch) {
    const signal = generationController.signal;
    const role = roleFor(state.value, segment);
    if (segment.kind !== 'dialogue') return;
    if (!role?.ttsConfig.voiceId) throw new Error(`请先为「${role?.displayName || '当前角色'}」选择声音`);
    if (!segment.speakText.trim()) throw new Error('台词不能为空');
    if (!defaultModel.value && !role.ttsConfig.model) throw new Error('请先连接语音实验室');
    role.ttsConfig.model ||= modelForVoice(voices.value.find(voice => voice.voice === role.ttsConfig.voiceId), role.ttsConfig.voiceId) || '';
    let key = audioKey(segment, role);
    if (!force && isReady(segment, role)) return;
    // 新结果先在候选记录里生成，元数据校验通过后才替换可播放的旧结果。
    const keepAudio = isReady(segment, role);
    let record: SegmentAudio = {
      key,
      status: 'pending',
      units: !force && segment.audio?.key === key ? [...segment.audio.units] : []
    };
    if (!keepAudio) {
      segment.audio = record;
      record = segment.audio;
    }
    segment.generationError = undefined;
    activeGenerationId.value = segment.id;
    try {
      const parts = !segment.speechControls?.length && record.units.length > 1 ? splitSpeech(segment.speakText) : [segment.speakText];
      for (let i = 0; i < parts.length; i++) {
        if (epoch !== generationEpoch || disposed) return;
        if (record.units[i]?.text === parts[i] && record.units[i].durationMs > 0) continue;
        const result = await retryRequest(
          async () => {
            const response = await synthesizeVoice(
              {
                text: parts[i],
                voice: role.ttsConfig.voiceId!,
                origin: 'sequence-player',
                model: role.ttsConfig.model!,
                languageHint: 'zh',
                instruction: synthesisInstruction(segment),
                speechControls: segment.speechControls,
                rate: role.ttsConfig.rate
              },
              { signal, timeout: 120000, silentError: true }
            );
            if (response.error || !response.data?.audio?.url) throw requestError(response.error);
            if (epoch !== generationEpoch || disposed || key !== audioKey(segment, role)) return response.data;
            if (response.data.model && role.ttsConfig.model !== response.data.model) {
              role.ttsConfig.model = response.data.model;
              key = audioKey(segment, role);
              record.key = key;
            }
            return response.data;
          },
          {
            signal,
            beforeAttempt: () => waitUntilResumed(signal),
            onRetry: attempt => {
              generationMessage.value = `第 ${state.value.segments.indexOf(segment) + 1} 句正在重试（${attempt}/3）`;
            }
          }
        );
        if (epoch !== generationEpoch || disposed || key !== audioKey(segment, role)) return;
        const url = result.audio.url;
        const blob = await loadAudioBlob(url, signal);
        const durationMs = await measureAudio(blob, signal);
        if (epoch !== generationEpoch || disposed || key !== audioKey(segment, role)) return;
        record.units[i] = {
          text: parts[i],
          url,
          durationMs,
          pauseAfterMs: i < parts.length - 1 ? punctuationPause(parts[i]) : 0
        };
      }
      if (epoch === generationEpoch && key === audioKey(segment, role)) {
        record.status = 'ready';
        if (!isReady({ ...segment, audio: record }, role)) throw new Error('生成的音频不完整，请重试');
        segment.audio = record;
        segment.generationError = undefined;
      }
    } catch (error: any) {
      if (epoch === generationEpoch) {
        record.status = 'failed';
        record.error = error.message;
      }
      throw error;
    } finally {
      if (epoch === generationEpoch) activeGenerationId.value = '';
    }
  }
  function generationFailed(segment: Segment, error: any) {
    const reason = error.message || '生成失败';
    segment.generationError = reason;
    if (!isReady(segment, roleFor(state.value, segment))) {
      const key = audioKey(segment, roleFor(state.value, segment));
      segment.audio = {
        key,
        status: 'failed',
        units: segment.audio?.key === key ? segment.audio.units : [],
        error: reason
      };
    }
  }
  async function generateAll(failedOnly = false) {
    if (generating.value) {
      paused.value = !paused.value;
      return;
    }
    if (editingScript.value && !finishEditScript()) return;
    if (!dialogueSegments.value.length) {
      message.warning('请先上传或粘贴逐字稿');
      return;
    }
    const regenerate = !failedOnly && allReady.value && !failedSegments.value.length;
    const items = [...(failedOnly ? failedSegments.value : dialogueSegments.value)];
    if (!items.length) return;
    playback.stop();
    generating.value = true;
    paused.value = false;
    const epoch = ++generationEpoch;
    generationController = new AbortController();
    const signal = generationController.signal;
    try {
      await preflight(signal);
      await runGenerationQueue(items, {
        signal,
        ready: segment =>
          !state.value.segments.includes(segment) ||
          (!regenerate && !segment.generationError && isReady(segment, roleFor(state.value, segment))),
        beforeItem: () => waitUntilResumed(signal),
        generate: async segment => {
          selectedId.value = segment.id;
          generationMessage.value = `正在生成第 ${state.value.segments.indexOf(segment) + 1} 句 · ${roleFor(state.value, segment)?.displayName}`;
          await generateSegment(
            segment,
            regenerate || Boolean(segment.generationError && isReady(segment, roleFor(state.value, segment))),
            epoch
          );
        },
        failed: (segment, error: any) => {
          generationFailed(segment, error);
          flushDraft();
        }
      });
      if (epoch === generationEpoch) {
        generationMessage.value = failedSegments.value.length
          ? `已生成 ${readyCount.value} 句，${failedSegments.value.length} 句失败，可检查后单独重试`
          : allReady.value
            ? '所有台词的配音已就绪，可以连续试听'
            : '部分台词有修改，请继续生成';
        flushDraft();
      }
    } catch (error: any) {
      if (epoch !== generationEpoch || signal.aborted) return;
      generationMessage.value = error.message;
      message.error(error.message);
    } finally {
      if (epoch === generationEpoch) {
        generating.value = false;
        paused.value = false;
        activeGenerationId.value = '';
      }
    }
  }
  function stopGeneration() {
    if (generating.value) generationMessage.value = '已停止生成，成功音频已保留，可继续生成未完成台词';
    generationController.abort();
    generationEpoch++;
    generating.value = false;
    paused.value = false;
    activeGenerationId.value = '';
  }
  async function generateOne(segment: Segment, force = true) {
    if (generating.value) return;
    playback.stop();
    generating.value = true;
    paused.value = false;
    const epoch = ++generationEpoch;
    generationController = new AbortController();
    try {
      await preflight(generationController.signal);
      await generateSegment(segment, force, epoch);
      if (epoch === generationEpoch) generationMessage.value = '单句配音已就绪';
    } catch (error: any) {
      if (epoch !== generationEpoch || generationController.signal.aborted) return;
      generationFailed(segment, error);
      message.error(error.message);
      generationMessage.value = error.message;
    } finally {
      if (epoch === generationEpoch) {
        generating.value = false;
        paused.value = false;
        activeGenerationId.value = '';
      }
    }
  }
  async function audition(segment: Segment) {
    if (generating.value) return;
    selectSegment(segment);
    if (!isReady(segment, roleFor(state.value, segment))) await generateOne(segment, false);
    if (isReady(segment, roleFor(state.value, segment)))
      await playback.play(state.value.segments.indexOf(segment), true);
  }
  async function saveProject() {
    if (saving.value) return;
    if (editingScript.value && !finishEditScript()) return;
    saving.value = true;
    const savedState = state.value;
    const savedProjectId = projectId.value;
    const snapshot = JSON.stringify(toProject(savedState));
    const payload = JSON.parse(snapshot);
    try {
      const result = savedProjectId
        ? await projects.updateProject(savedProjectId, payload)
        : await projects.createProject(payload);
      if (result.error || !result.data) throw new Error('项目保存失败，已保留本地草稿');
      if (savedState !== state.value || savedProjectId !== projectId.value) return;
      if ('id' in result.data && typeof result.data.id === 'string') projectId.value = result.data.id;
      clearTimeout(saveTimer);
      flushDraft();
      const changed =
        JSON.stringify(toProject(state.value)) !== snapshot ||
        (editingScript.value && draftText.value !== exportText(state.value));
      saveLabel.value = changed ? '有新修改尚未保存到项目' : '已保存到项目';
      message.success(changed ? '提交的版本已保存，后续修改请再次保存' : '项目已保存');
    } catch (error: any) {
      flushDraft();
      message.error(error.message);
    } finally {
      saving.value = false;
    }
  }
  function replaceState(raw: unknown, nextProjectId: string | null = null) {
    const next = fromProject(raw);
    stopGeneration();
    playback.stop();
    state.value = next;
    projectId.value = nextProjectId;
    selectedId.value = next.segments[0]?.id || '';
    selectedRoleId.value = next.characters[0]?.id || '';
    editingScript.value = false;
    draftText.value = '';
    playback.select(0);
    autoMatchVoices();
    generationMessage.value = failedSegments.value.length
      ? `已生成 ${readyCount.value} 句，${failedSegments.value.length} 句失败，可检查后单独重试`
      : next.segments.length
        ? '稿件已恢复，可继续生成或逐句微调'
        : '上传逐字稿，匹配角色声音后开始生成';
    flushDraft();
  }
  async function readFile(file: File) {
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('逐字稿文件不能超过 8 MB');
      const text = await file.text();
      if (/\.json$/i.test(file.name)) {
        const project = JSON.parse(text);
        replaceState(project);
        message.success(
          Array.isArray(project.segments) ? '项目已导入，请重新选择角色声音；旧平台音频已排除' : '项目已导入'
        );
      } else {
        if (!/\.txt$/i.test(file.name)) throw new Error('当前支持 TXT 和项目 JSON');
        projectId.value = null;
        state.value.title = file.name.replace(/\.[^.]+$/, '');
        applyScript(text);
        message.success('逐字稿已导入');
      }
    } catch (error: any) {
      message.error(error.message || '文件无法读取');
    }
  }
  async function openProjects() {
    showProjects.value = true;
    loadingProjects.value = true;
    try {
      const result = await projects.fetchProjects();
      if (!result.error && result.data) projectList.value = result.data;
    } finally {
      loadingProjects.value = false;
    }
  }
  async function loadProject(project: projects.ProjectListItem) {
    const result = await projects.fetchProject(project.id);
    if (result.error || !result.data) return;
    replaceState(result.data, project.id);
    showProjects.value = false;
    message.success('项目已打开');
  }
  function newProject() {
    dialog.warning({
      title: '新建逐字稿',
      content: '当前内容可先保存到项目。新建后将清空本次编辑区。',
      positiveText: '新建',
      negativeText: '取消',
      onPositiveClick: () => {
        stopGeneration();
        playback.stop();
        state.value = emptyState();
        void loadLibrary(true);
        projectId.value = null;
        selectedId.value = '';
        selectedRoleId.value = state.value.characters[0].id;
        draftText.value = '';
        editingScript.value = false;
        playback.select(0);
        autoMatchVoices();
        flushDraft();
      }
    });
  }
  function download(kind: 'text' | 'json' | 'render') {
    if (editingScript.value && !finishEditScript()) return;
    const data =
      kind === 'text'
        ? exportText(state.value)
        : JSON.stringify(kind === 'json' ? toProject(state.value) : buildRenderJob(state.value), null, 2);
    const url = URL.createObjectURL(
      new Blob([data], { type: kind === 'text' ? 'text/plain;charset=utf-8' : 'application/json' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.value.title.replace(/[\\/:*?"<>|]/g, '-') || '逐字稿'}${kind === 'render' ? '-渲染任务' : ''}.${kind === 'text' ? 'txt' : 'json'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function keydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (
      target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') ||
      showProjects.value ||
      showVideo.value
    )
      return;
    if (event.code === 'Space' && state.value.segments.length && !generating.value) {
      event.preventDefault();
      void playback.toggle();
    }
    if (event.code === 'Escape') playback.stop();
  }
  onMounted(() => {
    let restored = false;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey()) || 'null');
      if (saved?.project) {
        restored = true;
        replaceState(saved.project, saved.projectId);
        selectedId.value = saved.selectedId || selectedId.value;
        draftText.value = saved.draftText || '';
        editingScript.value = Boolean(saved.editingScript);
        playback.select(
          Math.max(
            0,
            state.value.segments.findIndex(segment => segment.id === selectedId.value)
          )
        );
      } else {
        const old = JSON.parse(localStorage.getItem('nautilus_sequence_player_draft') || 'null');
        if (old?.rawScript) {
          restored = true;
          replaceState({ ...old, rawScript: old.rawScript });
        }
      }
    } catch {
      message.warning('本地草稿无法读取，可从“我的项目”恢复');
    }
    initialized = true;
    window.addEventListener('beforeunload', flushDraft);
    window.addEventListener('keydown', keydown);
    void loadLibrary(!restored);
    void loadVoices();
  });
  let hasActivated = false;
  onActivated(() => {
    window.addEventListener('keydown', keydown);
    if (hasActivated) void loadLibrary();
    hasActivated = true;
  });
  onDeactivated(() => {
    stopGeneration();
    flushDraft();
    window.removeEventListener('keydown', keydown);
  });
  onBeforeUnmount(() => {
    disposed = true;
    stopGeneration();
    clearTimeout(saveTimer);
    flushDraft();
    window.removeEventListener('beforeunload', flushDraft);
    window.removeEventListener('keydown', keydown);
  });
  return {
    state,
    selectedId,
    selectedRoleId,
    selected,
    selectedRole,
    editingScript,
    draftText,
    editorOpen,
    showProjects,
    showVideo,
    projectList,
    loadingProjects,
    saving,
    saveLabel,
    voices,
    loadingVoices,
    voiceOptions,
    voiceStatus,
    serviceConfigured,
    generating,
    paused,
    activeGenerationId,
    generationMessage,
    uploadingPortrait,
    cloning,
    cloneModel,
    cloneModelOptions,
    referenceUrl,
    failedSegments,
    playback,
    stageSegment,
    stageRole,
    stagePortrait,
    stagePose,
    library,
    loadingLibrary,
    loadLibrary,
    useLibraryCharacter,
    dialogueSegments,
    readyCount,
    progress,
    allReady,
    totalMs,
    canEdit,
    roleOptions,
    workflowStep,
    mediaUrl,
    roleFor,
    isReady,
    selectSegment,
    dirty,
    editText,
    changeVoice,
    loadVoices,
    applyScript,
    startEditScript,
    finishEditScript,
    restoreOriginal,
    addLine,
    deleteLine,
    addRole,
    removeRole,
    uploadPortraits,
    cloneVoice,
    usePresetVoice,
    saveRoleSettings,
    generateAll,
    generateOne,
    audition,
    saveProject,
    readFile,
    openProjects,
    loadProject,
    newProject,
    download,
    stopGeneration
  };
}
