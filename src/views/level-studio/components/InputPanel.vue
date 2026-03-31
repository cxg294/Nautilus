<script setup lang="ts">
/**
 * InputPanel — 左右双栏布局 V2
 *
 * 左侧：参考图 + 描述 + 风格参考按钮 + 比例 + 生成按钮
 * 右侧：生成结果区（空白 → 加载 → 双候选）
 * 风格参考：浮层展示所有风格卡片
 */
import { ref, computed } from 'vue';
import { useLevelStudio } from '../composables/use-level-studio';
import { STYLE_OPTIONS, ASPECT_RATIOS } from '../constants/presets';

const emit = defineEmits<{ openInpaint: [url: string] }>();

const {
  state, setRefImage, forkPrompts, generateScenes,
  selectScene, analyzeScene,
} = useLevelStudio();

// 风格浮层
const showStyleOverlay = ref(false);

// 当前选中风格的示意图
const currentStyle = computed(() =>
  STYLE_OPTIONS.find(o => o.value === state.styleTag)
);

function pickStyle(value: string) {
  state.styleTag = value;
  showStyleOverlay.value = false;
}

function handleRefUpload(options: { file: { file: File | null } }) {
  setRefImage(options.file.file);
}

async function handleGenerate() {
  await forkPrompts();
  if (state.promptA && state.promptB) {
    await generateScenes();
  }
}

async function handleConfirmScene() {
  await analyzeScene();
}

// 右侧面板状态（去掉 style-preview，风格改浮层展示）
const rightMode = computed(() => {
  if (state.sceneA && state.sceneB) return 'candidates';
  if (state.sceneLoading || state.promptForkLoading) return 'loading';
  return 'empty';
});
</script>

<template>
  <div class="studio-layout">
    <!-- ===== 左侧配置栏 ===== -->
    <div class="left-panel">
      <!-- 参考图 -->
      <div class="ref-block">
        <div class="block-title">
          <span>📎 参考图</span>
          <NTag size="tiny" type="warning" round>强烈建议</NTag>
        </div>
        <NUpload
          :show-file-list="false"
          accept="image/*"
          :custom-request="() => {}"
          @change="handleRefUpload"
        >
          <div v-if="!state.refImageUrl" class="ref-dropzone">
            <div class="dz-icon">🖼️</div>
            <div class="dz-text">拖拽上传 / 点击选择</div>
            <div class="dz-hint">让 AI 理解你想要的风格</div>
          </div>
          <div v-else class="ref-thumb-row">
            <img :src="state.refImageUrl" class="ref-thumb" />
            <div class="ref-thumb-info">
              <NTag type="success" size="small">已上传</NTag>
              <NButton size="tiny" quaternary @click.stop="setRefImage(null)">更换</NButton>
            </div>
          </div>
        </NUpload>
      </div>

      <!-- 关卡描述 -->
      <div class="form-block">
        <div class="block-title">📝 关卡描述</div>
        <NInput
          v-model:value="state.description"
          type="textarea"
          :rows="3"
          placeholder="例如：太空飞机大战，有玩家飞机、三种敌机、子弹和爆炸效果..."
        />
      </div>

      <!-- 风格参考按钮 -->
      <div class="form-block">
        <div class="block-title">🎨 画面风格</div>
        <NButton
          block
          :type="currentStyle ? 'primary' : 'default'"
          secondary
          @click="showStyleOverlay = true"
        >
          {{ currentStyle ? `${currentStyle.label}` : '选择风格参考...' }}
          <template #icon><span>🎨</span></template>
        </NButton>
      </div>

      <!-- 比例 -->
      <div class="form-block">
        <div class="block-title">📐 画面比例</div>
        <NSelect
          v-model:value="state.aspectRatio"
          :options="ASPECT_RATIOS.map(r => ({ label: r.label, value: r.value }))"
          size="small"
        />
      </div>

      <!-- 生成按钮 -->
      <div class="generate-area">
        <NButton
          type="primary"
          block
          size="large"
          :loading="state.promptForkLoading || state.sceneLoading"
          :disabled="!state.description.trim()"
          @click="handleGenerate"
        >
          <template #icon><span>✨</span></template>
          {{ state.sceneLoading ? '生成中...' : state.promptForkLoading ? 'AI 优化中...' : '生成 2 张候选场景' }}
        </NButton>
      </div>
    </div>

    <!-- ===== 右侧预览区 ===== -->
    <div class="right-panel">
      <!-- 空白等待态 -->
      <template v-if="rightMode === 'empty'">
        <div class="right-center">
          <div class="empty-icon">🎮</div>
          <div class="empty-title">关卡素材工作台</div>
          <div class="empty-desc">填写左侧信息后点击生成<br/>AI 将为你创作 2 张候选场景</div>
        </div>
      </template>

      <!-- 加载态 -->
      <template v-if="rightMode === 'loading'">
        <div class="right-center">
          <NSpin size="large" />
          <div class="loading-msg">
            {{ state.promptForkLoading ? '🤖 AI 正在优化你的描述...' : '🎨 场景图生成中，约 15-30 秒...' }}
          </div>
        </div>
      </template>

      <!-- 双候选场景 -->
      <template v-if="rightMode === 'candidates'">
        <div class="candidates-wrap">
          <div class="cand-toolbar">
            <span class="cand-title">🖼️ 选择你喜欢的场景</span>
            <NSpace :size="6">
              <NButton size="tiny" quaternary :loading="state.sceneLoading" @click="generateScenes">🔄 重新</NButton>
              <NButton v-if="state.selectedScene" size="tiny" quaternary @click="emit('openInpaint', state.selectedScene)">🖌️ 局部修改</NButton>
            </NSpace>
          </div>
          <div class="cand-grid">
            <div
              class="cand-card"
              :class="{ selected: state.selectedScene === state.sceneA }"
              @click="selectScene(state.sceneA)"
            >
              <div class="cand-badge">方向 A · {{ state.directionA }}</div>
              <img :src="state.sceneA" class="cand-img" />
              <div class="cand-radio"><NRadio :checked="state.selectedScene === state.sceneA" /></div>
            </div>
            <div
              class="cand-card"
              :class="{ selected: state.selectedScene === state.sceneB }"
              @click="selectScene(state.sceneB)"
            >
              <div class="cand-badge">方向 B · {{ state.directionB }}</div>
              <img :src="state.sceneB" class="cand-img" />
              <div class="cand-radio"><NRadio :checked="state.selectedScene === state.sceneB" /></div>
            </div>
          </div>
          <div class="cand-confirm">
            <NButton
              type="primary"
              :disabled="!state.selectedScene"
              :loading="state.analyzeLoading"
              @click="handleConfirmScene"
            >
              🔍 识别元素并继续 →
            </NButton>
          </div>
        </div>
      </template>
    </div>

    <!-- ===== 风格浮层 ===== -->
    <NDrawer v-model:show="showStyleOverlay" :width="480" placement="right">
      <NDrawerContent title="🎨 选择画面风格" closable>
        <div class="style-grid">
          <div
            v-for="s in STYLE_OPTIONS"
            :key="s.value"
            class="style-card"
            :class="{ active: state.styleTag === s.value }"
            @click="pickStyle(s.value)"
          >
            <img v-if="s.preview" :src="s.preview" class="style-card-img" />
            <div v-else class="style-card-placeholder">🎨</div>
            <div class="style-card-name">{{ s.label }}</div>
          </div>
        </div>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
/* ===== 整体双栏 ===== */
.studio-layout {
  display: flex;
  gap: 20px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 8px 12px 8px 16px;
}

/* ===== 左侧 ===== */
.left-panel {
  width: 320px;
  min-width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 8px 16px 2px;
}

.block-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}

.form-block {
  display: flex;
  flex-direction: column;
}

/* 参考图 */
.ref-block {
  background: linear-gradient(135deg, rgba(124,92,252,0.05), rgba(92,186,252,0.05));
  border: 1.5px dashed rgba(124,92,252,0.25);
  border-radius: 10px;
  padding: 10px;
}

.ref-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  cursor: pointer;
}

.dz-icon { font-size: 26px; margin-bottom: 4px; }
.dz-text { font-size: 13px; font-weight: 500; }
.dz-hint { font-size: 11px; color: #999; margin-top: 2px; }

.ref-thumb-row {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.ref-thumb {
  width: 64px;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.06);
}

.ref-thumb-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 生成按钮 */
.generate-area {
  margin-top: auto;
  padding-top: 8px;
}

/* ===== 右侧预览 ===== */
.right-panel {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--n-border-color, #e5e5e5);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--n-color-modal, #fafafa);
}

/* 居中占位 */
.right-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
}

.empty-icon { font-size: 56px; opacity: 0.25; }
.empty-title { font-size: 16px; font-weight: 600; color: #888; }
.empty-desc { font-size: 13px; color: #bbb; line-height: 1.6; }
.loading-msg { font-size: 13px; color: #999; }

/* 候选区 */
.candidates-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 14px;
  gap: 10px;
  min-height: 0;
}

.cand-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.cand-title { font-size: 13px; font-weight: 600; }

.cand-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
}

.cand-card {
  position: relative;
  border: 2px solid var(--n-border-color, #e5e5e5);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
}

.cand-card:hover {
  border-color: rgba(124,92,252,0.4);
  box-shadow: 0 4px 12px rgba(124,92,252,0.08);
}

.cand-card.selected {
  border-color: #7c5cfc;
  box-shadow: 0 4px 16px rgba(124,92,252,0.15);
}

.cand-badge {
  position: absolute;
  top: 6px; left: 6px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 11px;
  z-index: 1;
}

.cand-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: #f0f0f0;
}

.cand-radio {
  position: absolute;
  bottom: 6px; right: 6px;
  background: rgba(255,255,255,0.9);
  border-radius: 50%;
  padding: 2px;
}

.cand-confirm {
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

/* ===== 风格浮层（Drawer 内部） ===== */
.style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.style-card {
  border: 2px solid var(--n-border-color, #e5e5e5);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s;
}

.style-card:hover {
  border-color: rgba(124,92,252,0.4);
  box-shadow: 0 2px 8px rgba(124,92,252,0.1);
}

.style-card.active {
  border-color: #7c5cfc;
  box-shadow: 0 4px 12px rgba(124,92,252,0.2);
}

.style-card-img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  display: block;
}

.style-card-placeholder {
  width: 100%;
  aspect-ratio: 4/3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: #f5f5f5;
}

.style-card-name {
  padding: 4px 6px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.style-card.active .style-card-name {
  color: #7c5cfc;
  font-weight: 600;
}
</style>
