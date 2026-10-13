<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { saveLibraryCharacter } from '@/service/api/character-library';
import CharacterEditor from '../character-library/components/CharacterEditor.vue';
import PortraitSprite from '../character-library/components/PortraitSprite.vue';
import { useWorkshop } from './workshop/use-workshop';
import { TONES, PLACEHOLDER, type Segment } from './workshop/model';
import SpeechControlsEditor from '../voice-lab/components/speech-controls-editor.vue';
import VoicePicker from '../voice-lab/components/voice-picker.vue';
import { usePageTracker } from '@/hooks/common/use-tracker';

defineOptions({ name: 'SequencePlayer' });
usePageTracker('sequence-player');
const w = useWorkshop();
const {
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
  loadingVoices,
  voices,
  voiceStatus,
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
  dialogueSegments,
  readyCount,
  progress,
  allReady,
  totalMs,
  canEdit,
  roleOptions,
  workflowStep
} = w;
const router = useRouter();
const message = useMessage();
const showCharacterEditor = ref(false);
const showLibrary = ref(false);
const savingCharacter = ref(false);
const pickedCharacter = ref<string | null>(null);
const pickedRecord = computed(() => library.value.find(r => r.id === pickedCharacter.value));
async function openLibrary() {
  showLibrary.value = true;
  await w.loadLibrary();
}
function adoptPicked(replace: boolean) {
  if (!pickedRecord.value) return;
  w.useLibraryCharacter(pickedRecord.value, replace ? selectedRole.value?.id : undefined);
  showLibrary.value = false;
}
async function saveCharacterToLibrary(update: boolean) {
  const role = selectedRole.value;
  if (!role || savingCharacter.value) return;
  savingCharacter.value = true;
  const snapshot = JSON.parse(JSON.stringify(role));
  const result = await saveLibraryCharacter(snapshot, update ? role.libraryRef : undefined);
  savingCharacter.value = false;
  if (!result.error && result.data) {
    role.libraryRef = { id: result.data.id, revision: result.data.revision };
    message.success('已保存到人物库，其他项目不会自动更改');
    void w.loadLibrary();
  }
}
const scriptInput = ref<HTMLInputElement>();
const portraitInput = ref<HTMLInputElement>();
const voiceInput = ref<HTMLInputElement>();
const segmentList = ref<HTMLElement>();
const rolesExpanded = ref(true);
const roleNav = ref<'list' | 'settings'>('list');
const roleBody = ref<HTMLElement>();
const roleSettings = ref<HTMLElement>();
async function goToRoles(section: 'list' | 'settings') {
  rolesExpanded.value = true;
  roleNav.value = section;
  await nextTick();
  const body = roleBody.value;
  if (body) body.scrollTo({ top: section === 'list' ? 0 : roleSettings.value?.offsetTop || 0, behavior: 'smooth' });
}
function syncRoleNav() {
  if (roleBody.value && roleSettings.value)
    roleNav.value = roleBody.value.scrollTop + 36 >= roleSettings.value.offsetTop ? 'settings' : 'list';
}

const selectedIndex = computed(() => state.value.segments.findIndex(segment => segment.id === selectedId.value));
const selectedCharacter = computed(() => w.roleFor(state.value, selected.value));
const portraitOptions = computed(() => [
  { label: '自动匹配（推荐）', value: 'auto' },
  ...(selectedCharacter.value?.poses || []).map(pose => ({ label: pose.name, value: pose.id }))
]);
const generationTitle = computed(() =>
  generating.value
    ? paused.value
      ? activeGenerationId.value
        ? '完成当前句后暂停'
        : '生成已暂停'
      : '正在生成配音'
    : failedSegments.value.length
      ? `${failedSegments.value.length} 句生成未成功`
      : allReady.value
        ? '整段音频生成完成'
        : state.value.segments.length
          ? '准备生成配音'
          : '等待上传逐字稿'
);
const generationDetail = computed(() =>
  allReady.value && !generating.value && !failedSegments.value.length
    ? `${readyCount.value} 句均已就绪，可以连续试听或逐句微调。`
    : generationMessage.value
);
const exportOptions = [
  { label: '导出逐字稿 TXT', key: 'text' },
  { label: '导出完整项目 JSON', key: 'json' }
];
const moreOptions = [
  { label: '我的项目', key: 'projects' },
  { label: '新建逐字稿', key: 'new' }
];
const sideOptions = [
  { label: '左侧', value: 'left' },
  { label: '右侧', value: 'right' }
];
const formatTime = (ms: number) =>
  `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, '0')}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, '0')}`;
const labelFor = (segment: Segment) =>
  segment.kind === 'wait'
    ? '停顿'
    : segment.kind === 'direction'
      ? '画面提示'
      : w.roleFor(state.value, segment)?.displayName || '旁白';
function imageError(event: Event) {
  const image = event.target as HTMLImageElement;
  if (!image.src.endsWith(PLACEHOLDER)) image.src = PLACEHOLDER;
}
async function scriptChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await w.readFile(file);
}
function portraitChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  if (files.length) void w.uploadPortraits(files);
}
function voiceChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void w.cloneVoice(file);
}
function chooseRole(id: string) {
  selectedRoleId.value = id;
}
function removePose(id: string) {
  const role = selectedRole.value;
  if (!role || role.poses.length < 2) return;
  role.poses = role.poses.filter(pose => pose.id !== id);
  if (role.defaultPoseId === id) role.defaultPoseId = role.poses[0].id;
}
function selectMore(key: string) {
  if (key === 'projects') void w.openProjects();
  else w.newProject();
}
watch(
  () => playback.currentIndex.value,
  async index => {
    if (playback.status.value !== 'idle') selectedId.value = state.value.segments[index]?.id || '';
    await nextTick();
    segmentList.value?.querySelector<HTMLElement>('.sentence-row.is-selected')?.scrollIntoView({ block: 'nearest' });
  }
);
</script>

<template>
  <div class="transcript-workshop" :class="{ 'editor-collapsed': !editorOpen }">
    <NModal
      v-model:show="showCharacterEditor"
      preset="card"
      title="当前项目 · 人物声音与立绘"
      style="width: min(1240px, 94vw)"
      :content-style="{ maxHeight: '78vh', overflow: 'auto' }"
      :mask-closable="false"
    >
      <CharacterEditor
        v-if="selectedRole"
        :key="selectedRole.id"
        :character="selectedRole"
        :disabled="!canEdit || savingCharacter"
      />
      <template #footer>
        <div class="draft-actions">
          <span class="small-note">调整会保存到当前草稿。声音改变后，受影响的台词需要重新生成。</span>
          <NButton :loading="savingCharacter" :disabled="!canEdit" @click="saveCharacterToLibrary(false)">
            存为库中新人物
          </NButton>
          <NButton
            v-if="selectedRole?.libraryRef"
            :loading="savingCharacter"
            :disabled="!canEdit"
            @click="saveCharacterToLibrary(true)"
          >
            更新库中人物
          </NButton>
          <NButton
            type="primary"
            @click="
              showCharacterEditor = false;
              w.saveRoleSettings();
            "
          >
            完成
          </NButton>
        </div>
      </template>
    </NModal>
    <NModal v-model:show="showLibrary" preset="card" title="从人物库复用" style="width: min(640px, 94vw)">
      <p class="small-note">应用一份配置快照到当前项目。库中后续修改不会自动覆盖项目。</p>
      <NSelect
        v-model:value="pickedCharacter"
        :options="library.map(r => ({ label: `${r.character.displayName} · 版本 ${r.revision}`, value: r.id }))"
        :loading="loadingLibrary"
        filterable
        placeholder="选择人物"
        aria-label="选择库中人物"
      />
      <p v-if="pickedRecord" class="small-note">
        {{ pickedRecord.character.poses.length }} 张立绘 ·
        {{ pickedRecord.character.ttsConfig.voiceId ? '已绑定声音' : '尚未绑定声音' }}
      </p>
      <template #footer>
        <div class="draft-actions">
          <NButton
            @click="
              showLibrary = false;
              router.push('/copywriting/character-library');
            "
          >
            管理人物库
          </NButton>
          <NButton :disabled="!pickedRecord || !canEdit" @click="adoptPicked(false)">添加到项目</NButton>
          <NButton type="primary" :disabled="!pickedRecord || !selectedRole || !canEdit" @click="adoptPicked(true)">
            替换当前人物配置
          </NButton>
        </div>
      </template>
    </NModal>
    <header class="workshop-topbar">
      <div class="workshop-brand">
        <span class="brand-mark"><icon-mdi-waveform /></span>
        <strong>逐字稿视频工坊</strong>
      </div>
      <div class="project-name">
        <NInput v-model:value="state.title" aria-label="项目名称" size="small" placeholder="未命名逐字稿">
          <template #prefix><icon-mdi-pencil-outline /></template>
        </NInput>
        <span class="save-state" aria-live="polite">{{ saveLabel }}</span>
      </div>
      <ol class="workflow-steps" aria-label="当前工作流程">
        <li
          v-for="(label, index) in ['上传逐字稿', '自动生成', '逐句微调']"
          :key="label"
          :class="{ active: workflowStep >= index + 1 }"
        >
          <b aria-hidden="true"></b>
          {{ label }}
        </li>
      </ol>
      <div class="topbar-actions">
        <NButton size="small" :disabled="!canEdit" @click="openLibrary">人物库</NButton>
        <NButton quaternary size="small" aria-label="保存项目" :loading="saving" @click="w.saveProject">
          <template #icon><icon-mdi-content-save-outline /></template>
        </NButton>
        <NDropdown :options="moreOptions" trigger="click" @select="selectMore">
          <NButton quaternary size="small" aria-label="项目菜单">
            <template #icon><icon-mdi-folder-outline /></template>
          </NButton>
        </NDropdown>
        <NDropdown :options="exportOptions" trigger="click" @select="(key: 'text' | 'json') => w.download(key)">
          <NButton size="small" :disabled="!state.segments.length && !(editingScript && draftText.trim())">
            <template #icon><icon-mdi-file-document-outline /></template>
            导出逐字稿
          </NButton>
        </NDropdown>
        <NButton type="primary" size="small" :disabled="!state.segments.length" @click="showVideo = true">
          <template #icon><icon-mdi-video-outline /></template>
          生成视频
        </NButton>
      </div>
    </header>

    <div class="workshop-columns">
      <aside class="composer-panel" aria-label="逐字稿与角色">
        <section class="composer-section">
          <div class="section-heading">
            <h2>逐字稿与角色</h2>
            <NButton v-if="state.segments.length" text size="tiny" :disabled="!canEdit" @click="scriptInput?.click()">
              重新上传
            </NButton>
          </div>
          <NButton class="upload-script" dashed block :disabled="!canEdit" @click="scriptInput?.click()">
            <icon-mdi-file-upload-outline class="upload-glyph" />
            <span>{{ state.segments.length ? '重新上传逐字稿' : '上传逐字稿' }}</span>
            <icon-mdi-chevron-right />
          </NButton>
          <p v-if="!state.segments.length" class="upload-hint">TXT / 项目 JSON</p>
          <NButton
            v-if="!state.segments.length && !editingScript"
            class="paste-entry"
            text
            size="small"
            @click="editingScript = true"
          >
            也可以直接粘贴文本
          </NButton>
          <template v-if="editingScript">
            <NInput
              v-model:value="draftText"
              class="script-draft"
              type="textarea"
              aria-label="逐字稿文案"
              :autosize="{ minRows: 7, maxRows: 16 }"
              placeholder="艾博士：今天我们来认识一个新朋友。&#10;乌拉乎：是谁呀？"
              :disabled="!canEdit"
            />
            <div class="draft-actions">
              <NButton
                type="primary"
                size="small"
                :disabled="!canEdit || !draftText.trim()"
                @click="w.finishEditScript"
              >
                {{ state.segments.length ? '完成编辑' : '整理逐字稿' }}
              </NButton>
              <NButton text size="small" @click="editingScript = false">取消</NButton>
            </div>
          </template>
          <div v-else-if="state.segments.length" class="draft-actions">
            <NButton size="tiny" :disabled="!canEdit" @click="w.startEditScript">
              <template #icon><icon-mdi-pencil-outline /></template>
              编辑整稿
            </NButton>
            <NButton text size="tiny" :disabled="!canEdit || !state.sourceScript" @click="w.restoreOriginal">
              还原导入原稿
            </NButton>
          </div>
          <div v-if="state.segments.length" class="prepare-actions">
            <NButton
              block
              type="primary"
              :disabled="loadingVoices || loadingLibrary || (!dialogueSegments.length && !generating)"
              @click="w.generateAll()"
            >
              <template #icon>
                <icon-mdi-play v-if="generating && paused" />
                <icon-mdi-pause v-else-if="generating" />
                <icon-mdi-auto-fix v-else />
              </template>
              {{
                generating
                  ? paused
                    ? '继续生成'
                    : '暂停生成'
                  : allReady && !failedSegments.length
                    ? '重新生成整段'
                    : '生成整段配音'
              }}
            </NButton>
            <NButton v-if="generating" text size="tiny" class="stop-generation" @click="w.stopGeneration">
              停止生成
            </NButton>
            <span class="small-note">
              {{ allReady ? '修改台词后，只需生成有变化的句子' : '保留已生成音频，继续处理未完成台词' }}
            </span>
          </div>
        </section>

        <section class="composer-section role-section" :class="{ collapsed: !rolesExpanded }">
          <NButton
            text
            block
            class="role-heading"
            :aria-label="rolesExpanded ? '收起出场角色' : '展开出场角色'"
            :aria-expanded="rolesExpanded"
            @click="rolesExpanded = !rolesExpanded"
          >
            <strong>出场角色</strong>
            <span class="muted">
              {{ state.characters.length }} 个
              <icon-mdi-chevron-up v-if="rolesExpanded" />
              <icon-mdi-chevron-down v-else />
            </span>
          </NButton>
          <nav v-show="rolesExpanded" class="role-nav" aria-label="角色库导航">
            <NButton
              :type="roleNav === 'list' ? 'primary' : 'default'"
              :quaternary="roleNav !== 'list'"
              size="small"
              @click="goToRoles('list')"
            >
              角色列表
            </NButton>
            <NButton
              :type="roleNav === 'settings' ? 'primary' : 'default'"
              :quaternary="roleNav !== 'settings'"
              size="small"
              @click="goToRoles('settings')"
            >
              角色设置
            </NButton>
          </nav>
          <div v-show="rolesExpanded" ref="roleBody" class="role-body" @scroll="syncRoleNav">
            <div class="role-list" aria-label="角色列表">
              <NButton
                v-for="role in state.characters"
                :key="role.id"
                quaternary
                block
                class="role-item"
                :class="{ 'is-selected': selectedRoleId === role.id }"
                @click="chooseRole(role.id)"
              >
                <span class="role-item-inner">
                  <img :src="w.mediaUrl(role.poses[0]?.imageUrl || PLACEHOLDER)" alt="" @error="imageError" />
                  <span class="role-item-copy">
                    <strong>{{ role.displayName }}</strong>
                    <small>
                      {{ role.poses.some(p => p.layout) ? '按立绘定位' : role.position === 'left' ? '左侧' : '右侧' }} ·
                      {{ role.ttsConfig.voiceId ? '已选声音' : role.referencePreset ? '预设待绑定' : '待选声音' }}
                    </small>
                  </span>
                </span>
              </NButton>
            </div>
            <NButton
              dashed
              block
              size="small"
              :disabled="!canEdit"
              @click="
                w.addRole();
                goToRoles('settings');
              "
            >
              <template #icon><icon-mdi-account-plus-outline /></template>
              新增角色
            </NButton>
            <div v-if="selectedRole" ref="roleSettings" class="role-settings">
              <div class="section-heading">
                <h3>角色设置</h3>
                <NTag size="small" :bordered="false">{{ selectedRole.displayName }}</NTag>
              </div>
              <label>
                角色名称
                <NInput
                  v-model:value="selectedRole.displayName"
                  size="small"
                  aria-label="角色名称"
                  :disabled="!canEdit"
                />
              </label>
              <label v-if="!selectedRole.poses.some(p => p.layout)">
                出场位置
                <NSelect
                  v-model:value="selectedRole.position"
                  size="small"
                  :options="sideOptions"
                  :disabled="!canEdit"
                  aria-label="角色位置"
                />
              </label>
              <label>
                角色声音
                <VoicePicker
                  :value="selectedRole.ttsConfig.voiceId || null"
                  :voices="voices"
                  :loading="loadingVoices"
                  :disabled="!canEdit"
                  aria-label="角色声音"
                  @update:value="value => selectedRole && w.changeVoice(selectedRole, value)"
                />
              </label>
              <div class="voice-status">
                <span>{{ voiceStatus }}</span>
                <NButton text size="tiny" :loading="loadingVoices" @click="w.loadVoices">刷新</NButton>
              </div>
              <label>
                语速
                <span class="muted">{{ selectedRole.ttsConfig.rate.toFixed(1) }}×</span>
                <NSlider
                  v-model:value="selectedRole.ttsConfig.rate"
                  :min="0.5"
                  :max="2"
                  :step="0.1"
                  :disabled="!canEdit"
                  aria-label="角色语速"
                  @update:value="playback.stop"
                />
              </label>
              <div class="reference-audio">
                <span class="field-label">角色参考音频</span>
                <label>新声音的克隆模型
                  <NSelect v-model:value="cloneModel" :options="cloneModelOptions" :disabled="!canEdit || cloning" size="small" aria-label="逐字稿克隆模型" />
                </label>
                <template v-if="referenceUrl">
                  <span class="small-note">预设参考样本 · {{ selectedRole.name }}</span>
                  <audio
                    :key="referenceUrl"
                    controls
                    preload="none"
                    :src="referenceUrl"
                    :aria-label="`${selectedRole.displayName}预设参考音频`"
                  />
                  <NButton
                    block
                    size="small"
                    :loading="cloning"
                    :disabled="!canEdit || loadingVoices"
                    @click="w.usePresetVoice"
                  >
                    使用预设声音
                  </NButton>
                  <span class="small-note">优先复用所选模型的同名声音；没有时用此样本创建。预处理默认关闭。</span>
                </template>
                <NButton block size="small" :loading="cloning" :disabled="!canEdit" @click="voiceInput?.click()">
                  <template #icon><icon-mdi-microphone-outline /></template>
                  {{ referenceUrl ? '用其他参考音频创建声音' : '上传参考音频创建声音' }}
                </NButton>
              </div>
              <div class="section-heading">
                <h3>角色立绘</h3>
                <NButton
                  text
                  size="tiny"
                  :loading="uploadingPortrait"
                  :disabled="!canEdit"
                  @click="portraitInput?.click()"
                >
                  上传立绘
                </NButton>
              </div>
              <NButton block size="small" :disabled="!canEdit" @click="showCharacterEditor = true">
                编辑立绘位置与声音
              </NButton>
              <div class="pose-library">
                <div v-for="pose in selectedRole.poses" :key="pose.id" class="pose-row">
                  <img :src="w.mediaUrl(pose.imageUrl || PLACEHOLDER)" alt="" @error="imageError" />
                  <NInput v-model:value="pose.name" size="tiny" :disabled="!canEdit" aria-label="立绘名称" />
                  <NButton
                    text
                    size="tiny"
                    :disabled="!canEdit || selectedRole.poses.length < 2"
                    aria-label="移除立绘"
                    @click="removePose(pose.id)"
                  >
                    <icon-mdi-close />
                  </NButton>
                </div>
              </div>
              <p class="small-note">立绘名称中的“开心、疑惑、惊讶”等词用于自动匹配。</p>
              <NButton text type="error" size="tiny" :disabled="!canEdit" @click="w.removeRole">
                删除未使用的角色
              </NButton>
            </div>
          </div>
          <div v-if="rolesExpanded && selectedRole" class="role-save-bar">
            <NButton type="primary" size="small" :disabled="!canEdit" @click="w.saveRoleSettings">
              <template #icon><icon-mdi-content-save-outline /></template>
              保存设置
            </NButton>
          </div>
        </section>
      </aside>

      <main class="preview-panel" aria-label="生成效果预览">
        <div class="section-heading preview-heading">
          <h1>生成效果预览</h1>
          <span v-if="state.segments.length" class="muted">{{ state.segments.length }} 段台词</span>
        </div>
        <div class="generation-card" :aria-label="generationTitle">
          <NProgress
            type="line"
            :percentage="progress"
            :show-indicator="false"
            :height="7"
            color="rgb(var(--primary-color))"
          />
          <span class="generation-percentage">{{ readyCount }}/{{ dialogueSegments.length }}</span>
        </div>
        <div v-if="state.segments.length" class="generation-summary" aria-live="polite">
          <span>{{ generating && paused ? generationTitle : generationDetail }}</span>
          <NButton
            v-if="failedSegments.length"
            text
            size="tiny"
            type="error"
            :disabled="generating"
            @click="w.generateAll(true)"
          >
            重试失败句（{{ failedSegments.length }}）
          </NButton>
        </div>
        <details v-if="failedSegments.length" class="generation-failures">
          <summary>{{ failedSegments.length }} 句失败 · 查看原因</summary>
          <NButton
            v-for="line in failedSegments"
            :key="line.id"
            text
            block
            class="failed-line"
            @click="w.selectSegment(line)"
          >
            第 {{ state.segments.indexOf(line) + 1 }} 句 · {{ line.generationError || line.audio?.error }}
            {{ w.isReady(line, w.roleFor(state, line)) ? '（已保留上次音频）' : '' }}
          </NButton>
        </details>
        <div class="stage-preview" aria-label="逐字稿视频预览画面">
          <span class="safe-label">安全区</span>
          <PortraitSprite
            v-if="stageSegment?.kind === 'dialogue'"
            :pose="stagePose"
            :src="stagePortrait"
            :position="stageRole?.position"
            :name="stageRole?.displayName"
          />
          <div v-if="!stageSegment" class="stage-empty">
            <span class="empty-indicator"></span>
            <span>完成生成后开始连续试听</span>
          </div>
          <div v-else-if="stageSegment.kind !== 'dialogue'" class="stage-note">
            {{ stageSegment.kind === 'wait' ? `停顿 ${stageSegment.waitMs / 1000} 秒` : stageSegment.text }}
          </div>
          <div v-if="stageSegment?.kind === 'dialogue'" class="subtitle-area">
            <span class="speaker-label">{{ stageRole?.displayName }}</span>
            <p>{{ stageSegment.text }}</p>
          </div>
        </div>
        <div class="playback-controls" aria-label="播放控制">
          <NButton
            size="small"
            quaternary
            :disabled="!state.segments.length || generating"
            aria-label="上一句"
            @click="playback.select(playback.currentIndex.value - 1)"
          >
            <template #icon><icon-mdi-skip-previous-outline /></template>
          </NButton>
          <NButton
            circle
            type="primary"
            :disabled="!state.segments.length || generating"
            :aria-label="playback.status.value === 'playing' || playback.status.value === 'loading' ? '暂停' : '播放'"
            @click="playback.toggle"
          >
            <template #icon>
              <icon-mdi-pause v-if="playback.status.value === 'playing' || playback.status.value === 'loading'" />
              <icon-mdi-play v-else />
            </template>
          </NButton>
          <NButton
            size="small"
            quaternary
            :disabled="!state.segments.length || generating"
            aria-label="下一句"
            @click="playback.select(playback.currentIndex.value + 1)"
          >
            <template #icon><icon-mdi-skip-next-outline /></template>
          </NButton>
          <span class="timecode">{{ formatTime(playback.elapsedMs.value) }}</span>
          <NSlider
            :value="playback.elapsedMs.value"
            :max="Math.max(1, totalMs)"
            :step="10"
            :tooltip="false"
            :disabled="!state.segments.length || generating"
            aria-label="播放进度"
            @update:value="playback.seek"
          />
          <span class="timecode">{{ formatTime(totalMs) }}</span>
          <NButton
            size="small"
            quaternary
            :disabled="!state.segments.length || generating"
            aria-label="从头播放"
            @click="playback.play(0)"
          >
            <template #icon><icon-mdi-restart /></template>
          </NButton>
        </div>
        <p class="playback-note">
          {{
            playback.status.value === 'loading'
              ? '正在读取配音…'
              : allReady
                ? '全部配音已就绪 · 空格播放 / 暂停'
                : state.segments.length
                  ? '生成配音后可连续试听，拖动进度条定位到句子'
                  : ''
          }}
        </p>
      </main>

      <NButton
        class="editor-toggle"
        circle
        size="tiny"
        :aria-label="editorOpen ? '收起逐句编辑' : '展开逐句编辑'"
        @click="editorOpen = !editorOpen"
      >
        <template #icon>
          <icon-mdi-chevron-right v-if="editorOpen" />
          <icon-mdi-chevron-left v-else />
        </template>
      </NButton>
      <aside v-show="editorOpen" class="sentence-panel" aria-label="逐句编辑">
        <section class="sentence-list-section">
          <div class="section-heading">
            <h2>逐句列表</h2>
            <span class="muted">{{ state.segments.length }} 段</span>
          </div>
          <div ref="segmentList" class="sentence-list" aria-label="角色发言段">
            <div
              v-for="(segment, index) in state.segments"
              :key="segment.id"
              class="sentence-row"
              :class="{ 'is-selected': selectedId === segment.id }"
            >
              <span class="sentence-number">{{ String(index + 1).padStart(2, '0') }}</span>
              <NButton
                text
                class="sentence-select"
                :aria-label="`编辑第 ${index + 1} 段角色发言`"
                @click="w.selectSegment(segment)"
              >
                <span class="sentence-copy">
                  <span class="sentence-role">
                    <i
                      class="audio-dot"
                      :class="{
                        ready: w.isReady(segment, w.roleFor(state, segment)),
                        failed: Boolean(segment.generationError) || segment.audio?.status === 'failed',
                        busy: activeGenerationId === segment.id
                      }"
                    />
                    {{ labelFor(segment) }}
                  </span>
                  <span class="sentence-text">
                    {{ segment.kind === 'wait' ? `${segment.waitMs / 1000} 秒` : segment.text || '输入台词…' }}
                  </span>
                </span>
              </NButton>
              <NButton
                text
                size="tiny"
                :disabled="generating || !segment.speakText"
                :aria-label="`试听第 ${index + 1} 段`"
                @click="w.audition(segment)"
              >
                <icon-mdi-play-outline />
              </NButton>
            </div>
            <div v-if="!state.segments.length" class="list-empty">
              上传逐字稿后
              <br />
              这里会显示可编辑的台词
            </div>
          </div>
          <NButton dashed block size="small" :disabled="!canEdit" @click="w.addLine">
            <template #icon><icon-mdi-plus /></template>
            添加一句台词
          </NButton>
        </section>
        <section class="sentence-editor">
          <div class="section-heading">
            <div>
              <p class="eyebrow">当前句</p>
              <h2>当前单句设置</h2>
            </div>
            <span class="muted">{{ selected ? `第 ${selectedIndex + 1} 段` : '未选择' }}</span>
          </div>
          <div v-if="selected" class="sentence-form">
            <template v-if="selected.kind === 'dialogue'">
              <label>
                出场角色
                <NSelect
                  v-model:value="selected.characterId"
                  :options="roleOptions"
                  size="small"
                  :disabled="!canEdit"
                  aria-label="出场角色"
                  @update:value="w.dirty(selected)"
                />
              </label>
              <label>
                角色发言段与字幕
                <NInput
                  :value="selected.text"
                  type="textarea"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                  :disabled="!canEdit"
                  aria-label="角色发言段与字幕"
                  @update:value="value => selected && w.editText(selected, value)"
                />
              </label>
              <div>
                <SpeechControlsEditor :model-value="selected.speechControls" :text="selected.speakText" :disabled="!canEdit" :available="voices.find(v => v.voice === state.characters.find(c => c.id === selected?.characterId)?.ttsConfig.voiceId)?.ssmlSupported" @update:model-value="value => { if (selected) { selected.speechControls = value; w.dirty(selected); } }" />
                <NCheckbox :checked="selected.useInstruction !== false" :disabled="!canEdit" aria-label="使用情绪指令" @update:checked="value => { if (selected) { selected.useInstruction = value; w.dirty(selected); } }">使用情绪指令</NCheckbox>
                <p class="small-note">默认关闭，保留自然表达；开启后应用下面的语气设置。</p>
                <span class="field-label">本段语气</span>
                <div class="tone-options" role="group" aria-label="本段语气">
                  <NButton
                    v-for="tone in TONES"
                    :key="tone"
                    size="tiny"
                    :type="selected.tone === tone ? 'primary' : 'default'"
                    :secondary="selected.tone === tone"
                    :disabled="!canEdit || selected.useInstruction === false"
                    :aria-pressed="selected.tone === tone"
                    @click="
                      selected.tone = tone;
                      w.dirty(selected);
                    "
                  >
                    {{ tone }}
                  </NButton>
                </div>
              </div>
              <label>
                本句立绘
                <NSelect
                  v-model:value="selected.portraitId"
                  :options="portraitOptions"
                  size="small"
                  :disabled="!canEdit"
                  aria-label="本句立绘"
                />
              </label>
              <label>
                语气语调描述
                <NInput
                  v-model:value="selected.toneDescription"
                  size="small"
                  :maxlength="80"
                  :disabled="!canEdit || selected.useInstruction === false"
                  aria-label="语气语调描述"
                  placeholder="例如：句末上扬，像在邀请孩子回答"
                  @update:value="w.dirty(selected)"
                />
              </label>
              <label>
                句后停顿（秒）
                <NInputNumber
                  :value="selected.pauseAfterMs / 1000"
                  :min="0"
                  :max="5"
                  :step="0.1"
                  size="small"
                  :disabled="!canEdit"
                  aria-label="句后停顿"
                  @update:value="
                    value => {
                      if (selected) {
                        selected.pauseAfterMs = Math.round((value || 0) * 1000);
                        selected.pauseMode = 'manual';
                      }
                      playback.stop();
                    }
                  "
                />
              </label>
              <p
                class="audio-state"
                :class="{ error: Boolean(selected.generationError) || selected.audio?.status === 'failed' }"
              >
                {{
                  selected.generationError || selected.audio?.status === 'failed'
                    ? `${selected.generationError || selected.audio?.error}${w.isReady(selected, selectedCharacter) ? '；已保留上次音频，可继续试听。' : ''}`
                    : w.isReady(selected, selectedCharacter)
                      ? '此句音频已就绪，可直接试听或继续调整。'
                      : selectedCharacter?.ttsConfig.voiceId
                        ? '此句配音待生成。'
                        : '请先在左侧角色设置中选择声音。'
                }}
              </p>
              <div class="line-actions">
                <NButton
                  type="primary"
                  size="small"
                  :loading="activeGenerationId === selected.id"
                  :disabled="generating"
                  @click="w.generateOne(selected)"
                >
                  <template #icon><icon-mdi-refresh /></template>
                  {{ selected.audio ? '重新生成此句' : '生成此句' }}
                </NButton>
                <NButton size="small" :disabled="generating || !selected.text.trim()" @click="w.audition(selected)">
                  <template #icon><icon-mdi-volume-high /></template>
                  试听此段
                </NButton>
              </div>
            </template>
            <label v-else-if="selected.kind === 'wait'">
              停顿时长（秒）
              <NInputNumber
                :value="selected.waitMs / 1000"
                :min="0.1"
                :max="60"
                :step="0.1"
                :disabled="!canEdit"
                @update:value="
                  value => {
                    if (selected) selected.waitMs = Math.round((value || 1) * 1000);
                    w.dirty();
                  }
                "
              />
            </label>
            <label v-else>
              画面提示
              <NInput v-model:value="selected.text" type="textarea" :disabled="!canEdit" @update:value="w.dirty()" />
            </label>
            <NButton text type="error" size="tiny" :disabled="!canEdit" @click="w.deleteLine">
              <template #icon><icon-mdi-delete-outline /></template>
              删除整句台词
            </NButton>
          </div>
          <div v-else class="list-empty">选择一句台词，调整角色、语气与立绘</div>
        </section>
      </aside>
    </div>

    <input
      ref="scriptInput"
      class="hidden"
      type="file"
      accept=".txt,.json,text/plain,application/json"
      @change="scriptChange"
    />
    <input
      ref="portraitInput"
      class="hidden"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      multiple
      @change="portraitChange"
    />
    <input ref="voiceInput" class="hidden" type="file" accept="audio/*,.wav,.mp3,.m4a" @change="voiceChange" />
    <NDrawer v-model:show="showProjects" :width="340">
      <NDrawerContent title="我的项目" closable>
        <NSpin :show="loadingProjects">
          <NEmpty v-if="!projectList.length" description="暂无保存的项目" />
          <div v-else class="project-list">
            <NButton v-for="project in projectList" :key="project.id" block secondary @click="w.loadProject(project)">
              {{ project.title }}
            </NButton>
          </div>
        </NSpin>
      </NDrawerContent>
    </NDrawer>
    <NModal v-model:show="showVideo" preset="card" title="生成讲解视频" style="width: min(520px, 92vw)">
      <NAlert type="info" :bordered="false">
        视频渲染服务尚未接入。当前可以导出渲染任务，包含台词、立绘、声音与停顿参数。
      </NAlert>
      <div class="video-specs">
        <span>画面</span>
        <strong>1080p · 16:9 · 白色背景</strong>
        <span>音频</span>
        <strong>{{ readyCount }} / {{ dialogueSegments.length }} 句已生成</strong>
      </div>
      <p v-if="!allReady" class="video-note">还有台词未生成配音，导出的任务会保留待生成状态。</p>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="w.download('render')">下载渲染任务</NButton>
          <NButton type="primary" disabled>提交视频生成</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.transcript-workshop {
  --ws-primary: rgb(var(--primary-color));
  --ws-soft: rgb(var(--primary-color) / 0.08);
  --ws-border: rgb(var(--base-text-color) / 0.1);
  --ws-bg: rgb(var(--container-bg-color));
  --ws-panel: rgb(var(--layout-bg-color));
  --ws-text: rgb(var(--base-text-color));
  --ws-muted: rgb(var(--base-text-color) / 0.52);
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 540px;
  overflow: hidden;
  background: var(--ws-bg);
  color: var(--ws-text);
  border: 1px solid var(--ws-border);
  border-radius: 8px;
}
.workshop-topbar {
  min-height: 66px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--ws-border);
  flex-shrink: 0;
}
.workshop-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  white-space: nowrap;
  font-size: 13px;
}
.brand-mark {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: var(--ws-primary);
  color: white;
  border-radius: 8px;
  font-size: 18px;
}
.project-name {
  width: 160px;
  min-width: 100px;
}
.project-name :deep(.n-input__input-el) {
  font-size: 12px;
}
.save-state {
  display: block;
  padding-left: 10px;
  font-size: 10px;
  color: var(--ws-muted);
}
.workflow-steps {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  flex: 1;
  padding: 0;
  margin: 0;
  list-style: none;
  font-size: 11px;
  color: var(--ws-muted);
  white-space: nowrap;
}
.workflow-steps li {
  display: flex;
  align-items: center;
  gap: 5px;
}
.workflow-steps b {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--ws-panel);
  font-size: 10px;
}
.workflow-steps .active {
  color: var(--ws-primary);
}
.workflow-steps .active b {
  background: var(--ws-soft);
}
.topbar-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.topbar-actions :deep(.n-button) {
  font-size: 11px;
}
.workshop-columns {
  display: grid;
  grid-template-columns: 276px minmax(260px, 1fr) 292px;
  flex: 1;
  min-height: 0;
  position: relative;
}
.composer-panel {
  border-right: 1px solid var(--ws-border);
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow: hidden;
  background: var(--ws-panel);
}
.composer-section {
  padding: 14px;
  background: var(--ws-bg);
  border: 1px solid var(--ws-border);
  border-radius: 10px;
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.025);
  flex-shrink: 0;
}
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.section-heading h1,
.section-heading h2,
.section-heading h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
}
.section-heading h3 {
  font-size: 12px;
}
.eyebrow {
  font-size: 10px;
  color: var(--ws-muted);
  margin: 0 0 4px;
}
.muted,
.small-note {
  color: var(--ws-muted);
  font-size: 10px;
}
.small-note {
  display: block;
  line-height: 1.6;
  margin: 7px 0;
}
.upload-script {
  height: 58px;
  border-color: rgb(var(--primary-color) / 0.25);
}
.upload-script :deep(.n-button__content) {
  width: 100%;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  font-size: 12px;
}
.upload-glyph {
  font-size: 23px;
  color: var(--ws-primary);
}
.upload-hint {
  color: var(--ws-muted);
  text-align: center;
  font-size: 10px;
  margin: 8px 0;
}
.paste-entry {
  display: flex;
  margin: 10px auto 0;
  font-size: 11px;
}
.script-draft {
  margin-top: 12px;
}
.draft-actions {
  display: flex;
  gap: 9px;
  align-items: center;
  margin-top: 10px;
}
.draft-actions :deep(.n-button) {
  font-size: 10px;
}
.prepare-actions {
  margin-top: 14px;
}
.role-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 12px;
}
.role-item {
  height: 50px;
  padding: 0 8px;
  border-radius: 6px;
}
.role-item.is-selected {
  background: var(--ws-soft);
  color: var(--ws-primary);
}
.role-item :deep(.n-button__content) {
  width: 100%;
}
.role-item-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
}
.role-item img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  object-position: top;
  background: var(--ws-panel);
}
.role-item strong {
  font-size: 12px;
  font-weight: 550;
}
.role-item small {
  display: block;
  font-size: 10px;
  color: var(--ws-muted);
}
.role-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
}
.role-settings label,
.sentence-form label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--ws-muted);
  font-size: 10px;
}
.role-settings .section-heading {
  margin: 3px 0 0;
}
.voice-status {
  display: flex;
  gap: 5px;
  justify-content: space-between;
  color: var(--ws-muted);
  font-size: 10px;
}
.pose-library {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pose-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.pose-row img {
  width: 30px;
  height: 36px;
  object-fit: contain;
  background: var(--ws-panel);
  border-radius: 4px;
}
.pose-row :deep(.n-input) {
  min-width: 0;
}
.preview-panel {
  display: flex;
  flex-direction: column;
  padding: 20px 12px;
  min-width: 0;
  overflow-y: auto;
  background: var(--ws-panel);
}
.preview-heading {
  margin-bottom: 16px;
}
.preview-heading h1 {
  font-size: 15px;
}
.generation-card {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 10px 12px;
  background: var(--ws-bg);
  border: 1px solid var(--ws-border);
  border-radius: 8px;
  margin-bottom: 8px;
}
.generation-card :deep(.n-progress) {
  flex: 1;
}
.generation-percentage {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--ws-muted);
}
.generation-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 5px;
  font-size: 10px;
  color: var(--ws-muted);
  margin: 0 0 8px;
}
.generation-failures {
  color: rgb(var(--error-color));
  font-size: 11px;
  margin-bottom: 8px;
  max-height: 120px;
  overflow: auto;
}
.failed-line {
  height: auto;
  text-align: left;
  margin: 8px 0;
}
.failed-line :deep(.n-button__content) {
  white-space: normal;
  display: block;
  width: 100%;
}
.stage-preview {
  position: relative;
  width: min(100%, calc((100vh - 370px) * 16 / 9));
  align-self: center;
  aspect-ratio: 16 / 9;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #e1e6e7;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.035);
  color: #222;
}
.safe-label {
  position: absolute;
  top: 12px;
  left: 13px;
  font-size: 9px;
  color: #b5bfc2;
}
.stage-character {
  position: absolute;
  bottom: 4%;
  width: 32%;
  height: 66%;
}
.stage-character.on-left {
  left: 5%;
}
.stage-character.on-right {
  right: 5%;
}
.stage-character img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
}
.stage-empty {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  color: #a1aaad;
  font-size: 12px;
}
.stage-empty svg {
  font-size: 42px;
  opacity: 0.45;
}
.stage-note {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 40px;
  color: #788489;
  font-size: 14px;
}
.subtitle-area {
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: 8%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}
.speaker-label {
  background: var(--ws-primary);
  padding: 2px 8px;
  border-radius: 3px 3px 0 0;
  color: white;
  font-size: 10px;
}
.subtitle-area p {
  width: 100%;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid #dce1e4;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.96);
  font-size: clamp(12px, 1.1vw, 20px);
  font-weight: 550;
  line-height: 1.5;
  text-align: center;
  overflow-wrap: anywhere;
}
.playback-controls {
  display: flex;
  gap: 7px;
  align-items: center;
  margin-top: 13px;
  min-width: 0;
}
.playback-controls :deep(.n-slider) {
  flex: 1;
  min-width: 40px;
}
.timecode {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--ws-muted);
}
.playback-note {
  color: var(--ws-muted);
  font-size: 10px;
  min-height: 15px;
  margin: 10px 0;
  text-align: center;
}
.editor-toggle {
  position: absolute;
  right: 280px;
  top: 13px;
  z-index: 2;
  background: var(--ws-bg);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.sentence-panel {
  display: grid;
  grid-template-rows: minmax(200px, 0.46fr) minmax(240px, 0.54fr);
  gap: 12px;
  padding: 12px;
  min-height: 0;
  border-left: 1px solid var(--ws-border);
  background: var(--ws-panel);
}
.sentence-list-section {
  padding: 16px 14px 12px;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.sentence-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  margin-bottom: 8px;
}
.sentence-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 9px 5px;
  border-bottom: 1px solid var(--ws-border);
  border-radius: 4px;
}
.sentence-row.is-selected {
  background: var(--ws-soft);
}
.sentence-number {
  font-size: 9px;
  width: 16px;
  padding-top: 4px;
  color: var(--ws-muted);
  font-variant-numeric: tabular-nums;
}
.sentence-select {
  flex: 1;
  min-width: 0;
  height: auto;
  justify-content: flex-start;
  text-align: left;
}
.sentence-select :deep(.n-button__content) {
  width: 100%;
  white-space: normal;
}
.sentence-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.sentence-role {
  display: flex;
  gap: 5px;
  align-items: center;
  font-size: 10px;
  color: var(--ws-muted);
}
.audio-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgb(var(--warning-color));
}
.audio-dot.ready {
  background: var(--ws-primary);
}
.audio-dot.failed {
  background: rgb(var(--error-color));
}
.audio-dot.busy {
  animation: pulse 1s infinite;
}
.sentence-text {
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.sentence-row > :deep(.n-button:last-child) {
  margin-top: 8px;
}
.sentence-editor {
  padding: 15px 14px;
  border-top: 1px solid var(--ws-border);
  min-height: 0;
  overflow-y: auto;
}
.sentence-editor .section-heading {
  margin-bottom: 12px;
}
.sentence-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field-label {
  display: block;
  font-size: 10px;
  color: var(--ws-muted);
  margin-bottom: 5px;
}
.tone-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}
.tone-options :deep(.n-button) {
  font-size: 10px;
  padding: 0 3px;
}
.audio-state {
  font-size: 10px;
  color: var(--ws-muted);
  margin: 0;
  line-height: 1.5;
}
.audio-state.error {
  color: rgb(var(--error-color));
}
.line-actions {
  display: flex;
  gap: 6px;
}
.line-actions :deep(.n-button) {
  flex: 1;
  font-size: 11px;
}
.list-empty {
  color: var(--ws-muted);
  font-size: 11px;
  text-align: center;
  line-height: 1.8;
  padding: 24px 5px;
}
.editor-collapsed .workshop-columns {
  grid-template-columns: 276px minmax(0, 1fr);
}
.editor-collapsed .editor-toggle {
  right: 8px;
}
.project-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.video-specs {
  display: grid;
  grid-template-columns: 50px 1fr;
  gap: 12px;
  margin: 24px 0;
  font-size: 13px;
}
.video-specs span {
  opacity: 0.55;
}
.video-specs strong {
  font-weight: 500;
}
.video-note {
  opacity: 0.6;
  font-size: 12px;
}
.hidden {
  display: none;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}
.workflow-steps li + li::before {
  content: '';
  width: 22px;
  height: 1px;
  background: var(--ws-border);
  margin-right: 5px;
}
.workflow-steps b {
  width: 11px;
  height: 11px;
  border: 2px solid var(--ws-border);
  background: transparent;
}
.workflow-steps .active b {
  background: var(--ws-primary);
  border-color: var(--ws-primary);
  box-shadow: 0 0 0 3px var(--ws-soft);
}
.role-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding-bottom: 0;
}
.role-section.collapsed {
  flex: none;
}
.role-heading {
  margin-bottom: 12px;
}
.role-heading :deep(.n-button__content) {
  width: 100%;
  justify-content: space-between;
}
.role-heading strong {
  font-size: 13px;
}
.role-heading .muted {
  display: flex;
  align-items: center;
  gap: 6px;
}
.role-nav {
  display: flex;
  gap: 4px;
  background: var(--ws-panel);
  padding: 3px;
  border-radius: 7px;
  margin-bottom: 10px;
}
.role-nav :deep(.n-button) {
  flex: 1;
  font-size: 11px;
}
.role-body {
  position: relative;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 2px 12px;
}
.role-item-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.role-item strong {
  color: var(--ws-text);
}
.role-settings {
  background: var(--ws-panel);
  border: 1px solid var(--ws-border);
  padding: 12px;
  border-radius: 8px;
  margin-top: 16px;
}
.role-save-bar {
  padding: 9px 0;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--ws-border);
  background: var(--ws-bg);
}
.reference-audio audio {
  display: block;
  width: 100%;
  height: 34px;
  margin-bottom: 10px;
}
.reference-audio .n-button {
  font-size: 11px;
}
.stop-generation {
  display: block;
  margin: 7px auto 0;
}
.empty-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ws-primary);
}
.sentence-list-section,
.sentence-editor {
  border: 1px solid var(--ws-border);
  border-radius: 10px;
  background: var(--ws-bg);
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.025);
}
.playback-controls {
  background: var(--ws-bg);
  border: 1px solid var(--ws-border);
  border-radius: 8px;
  padding: 8px;
  margin-top: 10px;
}
@media (max-width: 1250px) {
  .workflow-steps {
    display: none;
  }
  .project-name {
    flex: 1;
  }
  .workshop-columns {
    grid-template-columns: 236px minmax(230px, 1fr) 264px;
  }
  .preview-panel {
    padding: 20px 18px;
  }
  .editor-toggle {
    right: 252px;
  }
  .composer-section {
    padding: 12px 10px;
  }
  .editor-collapsed .workshop-columns {
    grid-template-columns: 236px minmax(0, 1fr);
  }
}
@media (max-width: 980px) {
  .stage-preview {
    width: 100%;
  }
  .workshop-topbar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
  }
  .workshop-brand strong {
    font-size: 12px;
  }
  .workshop-columns {
    grid-template-columns: 186px minmax(230px, 1fr);
    overflow-y: auto;
  }
  .composer-panel {
    grid-row: 1 / 3;
    overflow-y: auto;
    padding: 8px;
  }
  .role-body {
    max-height: 600px;
  }
  .role-section {
    flex: none;
  }
  .sentence-panel {
    grid-column: 2;
    grid-template-columns: minmax(150px, 0.8fr) minmax(220px, 1fr);
    grid-template-rows: auto;
    min-height: 450px;
    border-top: 1px solid var(--ws-border);
  }
  .sentence-editor {
    border-left: 1px solid var(--ws-border);
    border-top: 0;
    max-height: none;
  }
  .sentence-list {
    max-height: 470px;
  }
  .preview-panel {
    overflow: visible;
  }
  .editor-toggle {
    right: 8px;
    top: 8px;
  }
  .editor-collapsed .workshop-columns {
    grid-template-columns: 186px minmax(0, 1fr);
  }
  .role-item strong {
    font-size: 11px;
  }
  .role-item small {
    font-size: 8px;
  }
}
@media (max-width: 640px) {
  .transcript-workshop {
    overflow: auto;
    height: auto;
  }
  .workshop-columns {
    display: flex;
    flex-direction: column;
    overflow: visible;
  }
  .composer-panel {
    overflow: visible;
    border-right: 0;
  }
  .role-body {
    max-height: 440px;
  }
  .role-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .sentence-panel {
    display: flex;
    flex-direction: column;
    min-height: 520px;
  }
  .sentence-list {
    max-height: 280px;
  }
  .sentence-editor {
    border-left: 0;
    border-top: 1px solid var(--ws-border);
  }
  .topbar-actions {
    margin-left: auto;
  }
  .project-name {
    width: 130px;
  }
  .editor-toggle {
    display: none;
  }
  .preview-panel {
    padding: 20px 14px;
  }
  .subtitle-area p {
    font-size: 12px;
  }
}
</style>
