<script setup lang="ts">
/**
 * SpritePanel — 角色/素材管理（V6）
 *
 * 修复：造型图片预览、完整元数据（名称/大小/尺寸）、广播→脚本跳转
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { NSwitch, NSelect, NButton, NEmpty, NTag, NUpload, useMessage } from 'naive-ui';
import { useSb3Project } from '../composables/use-sb3-project';
import { extractScripts, extractOrphans, extractReferencedResources } from '../core/blockConverter';

const message = useMessage();
const { project, assets, navigationTarget } = useSb3Project();

const selectedIndex = ref(0);
const targets = computed((): any[] => project.value?.targets || []);
const current = computed(() => targets.value[selectedIndex.value]);

// Scratch 积木分类颜色
const CATEGORY_COLORS: Record<string, string> = {
  motion: '#4C97FF', looks: '#9966FF', sound: '#CF63CF',
  event: '#FFBF00', control: '#FFAB19', sensing: '#5CB1D6',
  operator: '#59C059', data: '#FF8C1A', procedures: '#FF6680',
  argument: '#FF6680', pen: '#0FBD8C', music: '#D65CD6',
  _else: '#FFAB19',
};
const CATEGORY_BG: Record<string, string> = {
  motion: 'rgba(76,151,255,0.08)', looks: 'rgba(153,102,255,0.08)',
  sound: 'rgba(207,99,207,0.08)', event: 'rgba(255,191,0,0.08)',
  control: 'rgba(255,171,25,0.08)', sensing: 'rgba(92,177,214,0.08)',
  operator: 'rgba(89,192,89,0.08)', data: 'rgba(255,140,26,0.08)',
  procedures: 'rgba(255,102,128,0.08)', argument: 'rgba(255,102,128,0.08)',
  pen: 'rgba(15,189,140,0.08)', music: 'rgba(214,92,214,0.08)',
  _else: 'rgba(255,171,25,0.08)',
};
const CATEGORY_LABELS: Record<string, string> = {
  motion: '运动', looks: '外观', sound: '声音', event: '事件',
  control: '控制', sensing: '侦测', operator: '运算', data: '变量',
  procedures: '自定义', argument: '参数', pen: '画笔', music: '音乐',
};

function getCatColor(opcode: string) {
  const p = opcode?.split('_')[0] || '';
  return CATEGORY_COLORS[p] || '#888';
}
function getCatBg(opcode: string) {
  const p = opcode?.split('_')[0] || '';
  return CATEGORY_BG[p] || 'rgba(0,0,0,0.03)';
}
function getCatLabel(opcode: string) {
  const p = opcode?.split('_')[0] || '';
  return CATEGORY_LABELS[p] || '其他';
}

// 旋转方式
const rotationOptions = [
  { label: '任意旋转', value: 'all around' },
  { label: '左右翻转', value: 'left-right' },
  { label: '不旋转', value: "don't rotate" },
];

const costumes = computed((): any[] => current.value?.costumes || []);
const sounds = computed((): any[] => current.value?.sounds || []);
const scripts = computed(() => {
  if (!current.value) return [];
  try { return extractScripts(current.value); } catch { return []; }
});

// 引用资源
const resources = computed(() => {
  if (!current.value) return { variables: [], broadcasts: { sends: [], receives: [] } };
  try { return extractReferencedResources(current.value); } catch { return { variables: [], broadcasts: { sends: [], receives: [] } }; }
});

// 孤立积木
const orphans = computed(() => {
  if (!current.value) return [];
  try { return extractOrphans(current.value); } catch { return []; }
});

// ─── 造型图片预览 URL ───
const costumeUrls = ref<Map<string, string>>(new Map());

function buildCostumeUrls() {
  // 释放旧 URLs
  costumeUrls.value.forEach(url => URL.revokeObjectURL(url));
  const map = new Map<string, string>();
  if (!assets.value || assets.value.size === 0) {
    costumeUrls.value = map;
    return;
  }
  for (const c of costumes.value) {
    const md5 = c.assetId || c.md5ext?.replace(/\.[^.]+$/, '');
    const key = c.md5ext || `${md5}.${c.dataFormat}`;
    const blob = assets.value.get(key);
    if (blob) {
      map.set(key, URL.createObjectURL(blob));
    }
  }
  costumeUrls.value = map;
}

watch([costumes, assets], () => buildCostumeUrls(), { immediate: true });
onBeforeUnmount(() => {
  costumeUrls.value.forEach(url => URL.revokeObjectURL(url));
});

function getCostumeUrl(c: any) {
  if (c._replaced && c._fileData) return c._fileData;
  const key = c.md5ext || `${c.assetId}.${c.dataFormat}`;
  return costumeUrls.value.get(key) || null;
}

// ─── 文件大小格式化 ───
function getAssetSize(c: any): string {
  const key = c.md5ext || `${c.assetId}.${c.dataFormat}`;
  const blob = assets.value?.get(key);
  if (!blob) return '—';
  const bytes = blob.size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── #4 脚本过滤器 ───
const filterVar = ref<string | null>(null);
const filterBroadcast = ref<string | null>(null);

const varFilterOptions = computed(() =>
  resources.value.variables.map((v: any) => ({ label: `📦 ${v.name}`, value: v.name }))
);
const broadcastFilterOptions = computed(() => {
  const all = new Set([...resources.value.broadcasts.sends, ...resources.value.broadcasts.receives]);
  return [...all].map(b => ({ label: `📡 ${b}`, value: b }));
});

function scriptUsesVar(script: any, varName: string) {
  return script.lines.some((line: any) =>
    line.text.includes(varName) ||
    (line.opcode?.startsWith('data_') && line.text.includes(varName))
  );
}
function scriptUsesBroadcast(script: any, broadcastName: string) {
  return script.lines.some((line: any) =>
    line.text.includes(broadcastName) &&
    (line.opcode?.startsWith('event_') || line.opcode === 'event_broadcast' || line.opcode === 'event_broadcastandwait')
  );
}

const filteredScripts = computed(() => {
  let result = scripts.value;
  if (filterVar.value) {
    result = result.filter((s: any) => scriptUsesVar(s, filterVar.value!));
  }
  if (filterBroadcast.value) {
    result = result.filter((s: any) => scriptUsesBroadcast(s, filterBroadcast.value!));
  }
  return result;
});

const isFiltering = computed(() => !!(filterVar.value || filterBroadcast.value));

// 脚本展开/收起状态
const collapsedScripts = ref<Set<number>>(new Set());
const orphansExpanded = ref(false);

function toggleScript(index: number) {
  const s = new Set(collapsedScripts.value);
  if (s.has(index)) s.delete(index); else s.add(index);
  collapsedScripts.value = s;
}
function isCollapsed(index: number) { return collapsedScripts.value.has(index); }
function expandAll() { collapsedScripts.value = new Set(); }
function collapseAll() {
  collapsedScripts.value = new Set(filteredScripts.value.map((_: any, i: number) => i));
}

watch(() => project.value, () => { selectedIndex.value = 0; });
watch(selectedIndex, () => {
  collapsedScripts.value = new Set();
  orphansExpanded.value = false;
  filterVar.value = null;
  filterBroadcast.value = null;
});

function setTargetProp(key: string, value: any) {
  if (current.value) (current.value as any)[key] = value;
}

// ─── 跨面板导航：广播→脚本 ───
watch(navigationTarget, (nav) => {
  if (!nav || !nav.targetName) return;
  // 找到目标角色
  const idx = targets.value.findIndex((t: any) => t.name === nav.targetName);
  if (idx === -1) return;
  selectedIndex.value = idx;
  // 等待 computeds 更新后设置广播过滤
  nextTick(() => {
    if (nav.broadcastName) {
      filterBroadcast.value = nav.broadcastName;
      filterVar.value = null;
      collapsedScripts.value = new Set(); // 展开所有匹配脚本
      message.success(`📡 已跳转到「${nav.targetName}」的广播「${nav.broadcastName}」相关脚本`);
    }
  });
});

// ─── #8 声音播放 ───
const playingSound = ref<number | null>(null);
let currentAudio: HTMLAudioElement | null = null;

function playSound(sound: any, index: number) {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if (playingSound.value === index) { playingSound.value = null; return; }

  // 尝试从 assets 中获取音频
  const key = sound.md5ext || `${sound.assetId}.${sound.dataFormat}`;
  const blob = assets.value?.get(key);
  if (blob) {
    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.onended = () => { playingSound.value = null; URL.revokeObjectURL(url); };
    currentAudio.onerror = () => { playingSound.value = null; URL.revokeObjectURL(url); message.warning('播放失败'); };
    playingSound.value = index;
    currentAudio.play().catch(() => { playingSound.value = null; URL.revokeObjectURL(url); });
  } else {
    playingSound.value = index;
    message.info(`🔊 ${sound.name} (${sound.dataFormat}) — 示例数据无音频文件`);
    setTimeout(() => { playingSound.value = null; }, 1500);
  }
}

// ─── #8 造型/声音替换 ───
function handleCostumeReplace(options: any, costumeIndex: number) {
  const file = options.file?.file;
  if (!file || !current.value) return;
  const reader = new FileReader();
  reader.onload = () => {
    const costumeArr = current.value!.costumes;
    if (costumeArr[costumeIndex]) {
      costumeArr[costumeIndex].name = file.name.replace(/\.[^.]+$/, '');
      costumeArr[costumeIndex]._replaced = true;
      costumeArr[costumeIndex]._fileData = reader.result;
      message.success(`✅ 造型 ${costumeIndex + 1} 已替换为 ${file.name}`);
    }
  };
  reader.readAsDataURL(file);
}

function handleSoundReplace(options: any, soundIndex: number) {
  const file = options.file?.file;
  if (!file || !current.value) return;
  const reader = new FileReader();
  reader.onload = () => {
    const soundArr = current.value!.sounds;
    if (soundArr[soundIndex]) {
      soundArr[soundIndex].name = file.name.replace(/\.[^.]+$/, '');
      soundArr[soundIndex]._replaced = true;
      soundArr[soundIndex]._fileData = reader.result;
      message.success(`✅ 声音 ${soundIndex + 1} 已替换为 ${file.name}`);
    }
  };
  reader.readAsDataURL(file);
}
</script>

<template>
  <div class="sprite-panel">
    <!-- ▌左侧：角色列表 -->
    <div class="sprite-list">
      <div class="list-header">角色</div>
      <div
        v-for="(tg, i) in targets" :key="i"
        class="sprite-item" :class="{ active: selectedIndex === i }"
        @click="selectedIndex = i"
      >
        <span class="si-icon">{{ tg.isStage ? '🎬' : '🎭' }}</span>
        <span class="si-name">{{ tg.name }}</span>
        <span class="si-count">{{ Object.values(tg.blocks || {}).filter((b: any) => typeof b === 'object' && b.opcode).length }}</span>
      </div>
    </div>

    <!-- ▌右侧：详情 -->
    <div class="sprite-detail" v-if="current">

      <!-- ━━ 属性信息条 ━━ -->
      <div class="section props-bar">
        <div class="section-title">
          {{ current.isStage ? '🎬' : '🎭' }} {{ current.name }}
          <span class="section-subtitle">属性</span>
        </div>
        <div v-if="current.isStage" class="prop-grid cols-3">
          <div class="prop-cell"><span class="pk">背景</span><span class="pv">{{ current.currentCostume + 1 }}/{{ costumes.length }}</span></div>
          <div class="prop-cell"><span class="pk">音量</span><span class="pv">{{ current.volume }}%</span></div>
          <div class="prop-cell"><span class="pk">视频</span><span class="pv">{{ current.videoState || 'on' }}</span></div>
        </div>
        <div v-else class="prop-grid cols-4">
          <div class="prop-cell"><span class="pk">位置</span><span class="pv">{{ current.x }}, {{ current.y }}</span></div>
          <div class="prop-cell"><span class="pk">大小</span><span class="pv">{{ current.size }}%</span></div>
          <div class="prop-cell"><span class="pk">方向</span><span class="pv">{{ current.direction }}°</span></div>
          <div class="prop-cell">
            <span class="pk">旋转</span>
            <NSelect size="tiny" :value="current.rotationStyle" :options="rotationOptions" style="width:100px" @update:value="(v: string) => setTargetProp('rotationStyle', v)" />
          </div>
          <div class="prop-cell">
            <span class="pk">显示</span>
            <NSwitch size="small" :value="current.visible" @update:value="(v: boolean) => setTargetProp('visible', v)" />
          </div>
          <div class="prop-cell">
            <span class="pk">可拖拽</span>
            <NSwitch size="small" :value="current.draggable" @update:value="(v: boolean) => setTargetProp('draggable', v)" />
          </div>
          <div class="prop-cell"><span class="pk">造型</span><span class="pv">{{ current.currentCostume + 1 }}/{{ costumes.length }}</span></div>
          <div class="prop-cell"><span class="pk">音量</span><span class="pv">{{ current.volume }}%</span></div>
        </div>
      </div>

      <!-- ━━ 引用资源条 ━━ -->
      <div class="section ref-bar" v-if="resources.variables.length > 0 || resources.broadcasts.sends.length > 0 || resources.broadcasts.receives.length > 0">
        <div class="section-title">🔗 引用资源</div>
        <div class="ref-content">
          <!-- 变量 -->
          <div v-if="resources.variables.length > 0" class="ref-group">
            <span class="ref-label">📦 变量</span>
            <div class="ref-tags">
              <span v-for="v in resources.variables" :key="v.name" class="ref-tag var-tag">
                {{ v.name }}
                <span class="rw-badge">R{{ v.reads }}/W{{ v.writes }}</span>
              </span>
            </div>
          </div>
          <!-- 发送广播 -->
          <div v-if="resources.broadcasts.sends.length > 0" class="ref-group">
            <span class="ref-label">📡 发送</span>
            <div class="ref-tags">
              <span v-for="b in resources.broadcasts.sends" :key="b" class="ref-tag send-tag">{{ b }}</span>
            </div>
          </div>
          <!-- 接收广播 -->
          <div v-if="resources.broadcasts.receives.length > 0" class="ref-group">
            <span class="ref-label">📡 接收</span>
            <div class="ref-tags">
              <span v-for="b in resources.broadcasts.receives" :key="b" class="ref-tag recv-tag">{{ b }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ━━ 双列主体 ━━ -->
      <div class="main-columns">

        <!-- ●  左列：脚本 + 孤立积木 -->
        <div class="col-scripts">
          <div class="section">
            <div class="section-title">
              📜 脚本
              <span class="badge">{{ isFiltering ? `${filteredScripts.length}/${scripts.length}` : scripts.length }}</span>
              <span v-if="filteredScripts.length > 1" class="section-actions">
                <NButton size="tiny" quaternary @click="expandAll">全部展开</NButton>
                <NButton size="tiny" quaternary @click="collapseAll">全部收起</NButton>
              </span>
            </div>
            <!-- #4 过滤器栏 -->
            <div v-if="varFilterOptions.length > 0 || broadcastFilterOptions.length > 0" class="filter-bar">
              <NSelect
                v-if="varFilterOptions.length > 0"
                v-model:value="filterVar"
                :options="varFilterOptions"
                placeholder="以变量筛选"
                size="tiny"
                clearable
                style="flex:1; min-width: 100px"
              />
              <NSelect
                v-if="broadcastFilterOptions.length > 0"
                v-model:value="filterBroadcast"
                :options="broadcastFilterOptions"
                placeholder="以广播筛选"
                size="tiny"
                clearable
                style="flex:1; min-width: 100px"
              />
              <NButton v-if="isFiltering" size="tiny" quaternary @click="filterVar = null; filterBroadcast = null" style="flex-shrink:0">✕ 清除</NButton>
            </div>
            <div v-if="filteredScripts.length > 0" class="scripts-flow">
              <div v-for="(script, si) in filteredScripts" :key="si" class="script-card" :class="{ collapsed: isCollapsed(si) }">
                <!-- 帽子块（可点击展开/收起） -->
                <div
                  class="script-hat-bar clickable"
                  :style="{ background: getCatBg(script.hat.opcode), borderLeftColor: getCatColor(script.hat.opcode) }"
                  @click="toggleScript(si)"
                >
                  <span class="hat-chevron">{{ isCollapsed(si) ? '▶' : '▼' }}</span>
                  <span class="cat-badge" :style="{ background: getCatColor(script.hat.opcode) }">{{ getCatLabel(script.hat.opcode) }}</span>
                  <span class="hat-text" :style="{ color: getCatColor(script.hat.opcode) }">{{ script.hat.text }}</span>
                  <span class="hat-count">{{ script.blockCount }} 积木</span>
                </div>
                <!-- 积木体（可收起） -->
                <div v-show="!isCollapsed(si)" class="script-body">
                  <div
                    v-for="(line, li) in script.lines.slice(1)" :key="li"
                    class="block-line"
                    :style="{
                      paddingLeft: `${10 + line.depth * 16}px`,
                      borderLeftColor: getCatColor(line.opcode),
                      background: getCatBg(line.opcode),
                    }"
                  >
                    <span class="line-num">{{ Number(li) + 2 }}</span>
                    <span class="cat-badge-sm" :style="{ background: getCatColor(line.opcode) }">{{ getCatLabel(line.opcode) }}</span>
                    <span class="bl-text" :style="{ color: getCatColor(line.opcode) }">{{ line.text }}</span>
                  </div>
                </div>
              </div>
            </div>
            <NEmpty v-else-if="isFiltering" description="无匹配脚本（尝试清除过滤）" size="small" style="padding:16px 0" />
            <NEmpty v-else description="无脚本" size="small" style="padding:16px 0" />
          </div>

          <!-- 孤立积木 -->
          <div v-if="orphans.length > 0" class="section orphan-section">
            <div class="section-title orphan-title" @click="orphansExpanded = !orphansExpanded" style="cursor:pointer">
              <span class="hat-chevron">{{ orphansExpanded ? '▼' : '▶' }}</span>
              ⚠️ 孤立积木
              <span class="badge orphan-badge">{{ orphans.length }}</span>
              <span class="orphan-hint">未连接帽子块的散落积木</span>
            </div>
            <div v-show="orphansExpanded" class="orphan-list">
              <div v-for="(orph, oi) in orphans" :key="oi" class="orphan-card">
                <div class="orphan-hat">
                  <span class="cat-badge" :style="{ background: getCatColor(orph.rootOpcode) }">{{ getCatLabel(orph.rootOpcode) }}</span>
                  <span style="font-size:11px; color: var(--n-text-color-2)">{{ orph.blockCount }} 积木</span>
                </div>
                <div v-for="(line, li) in orph.lines" :key="li" class="orphan-line" :style="{ color: getCatColor(line.opcode) }">
                  <span class="line-num">{{ Number(li) + 1 }}</span>
                  {{ line.text }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ●  右列：造型（上）+ 声音（下） -->
        <div class="col-assets">
          <!-- 造型 -->
          <div class="section">
            <div class="section-title">🎨 造型 <span class="badge">{{ costumes.length }}</span></div>
            <div class="asset-full-list">
              <div v-for="(c, i) in costumes" :key="i" class="asset-row costume-row">
                <div class="asset-idx">{{ i + 1 }}</div>
                <!-- 缩略图：有图片则显示图片，否则显示格式标签 -->
                <div class="costume-preview" :class="{ replaced: c._replaced }">
                  <img v-if="getCostumeUrl(c)" :src="getCostumeUrl(c)" :alt="c.name" class="costume-img" />
                  <span v-else class="costume-format">{{ c.dataFormat?.toUpperCase() }}</span>
                </div>
                <div class="asset-body">
                  <div class="asset-name">
                    {{ c.name }}
                    <NTag v-if="current.currentCostume === i" size="tiny" type="success" style="margin-left:4px">当前</NTag>
                    <NTag v-if="c._replaced" size="tiny" type="warning" style="margin-left:4px">已替换</NTag>
                  </div>
                  <div class="asset-meta">
                    {{ c.dataFormat?.toUpperCase() }}
                    · {{ getAssetSize(c) }}
                    · 旋转中心 ({{ c.rotationCenterX ?? '—' }}, {{ c.rotationCenterY ?? '—' }})
                    <template v-if="c.bitmapResolution && c.bitmapResolution !== 1"> · {{ c.bitmapResolution }}x</template>
                  </div>
                </div>
                <NUpload
                  :show-file-list="false"
                  accept=".svg,.png,.jpg,.jpeg,.gif,.bmp"
                  :custom-request="() => {}"
                  @change="(e: any) => handleCostumeReplace(e, i)"
                  style="display: inline-flex"
                >
                  <NButton size="tiny" quaternary class="replace-btn">🔄 替换</NButton>
                </NUpload>
              </div>
            </div>
            <NEmpty v-if="costumes.length === 0" description="无造型" size="small" />
          </div>

          <!-- 声音 -->
          <div class="section">
            <div class="section-title">🔊 声音 <span class="badge">{{ sounds.length }}</span></div>
            <div class="asset-full-list">
              <div v-for="(s, i) in sounds" :key="i" class="asset-row">
                <div class="asset-idx">{{ i + 1 }}</div>
                <div class="asset-thumb sound-color" :class="{ replaced: s._replaced, playing: playingSound === i }">
                  <template v-if="s._replaced">✅</template>
                  <template v-else>{{ s.dataFormat?.toUpperCase() }}</template>
                </div>
                <div class="asset-body">
                  <div class="asset-name">
                    {{ s.name }}
                    <NTag v-if="s._replaced" size="tiny" type="warning" style="margin-left:4px">已替换</NTag>
                  </div>
                  <div class="asset-meta">
                    {{ s.dataFormat?.toUpperCase() }}
                    · {{ getAssetSize(s) }}
                    {{ s.rate ? ` · ${s.rate}Hz` : '' }}
                    {{ s.sampleCount ? ` · ${s.sampleCount} 采样` : '' }}
                  </div>
                </div>
                <NButton size="tiny" quaternary :type="playingSound === i ? 'warning' : 'default'" @click="playSound(s, i)" class="play-btn">
                  {{ playingSound === i ? '⏹ 停止' : '▶ 播放' }}
                </NButton>
                <NUpload
                  :show-file-list="false"
                  accept=".wav,.mp3,.ogg"
                  :custom-request="() => {}"
                  @change="(e: any) => handleSoundReplace(e, i)"
                  style="display: inline-flex"
                >
                  <NButton size="tiny" quaternary class="replace-btn">🔄 替换</NButton>
                </NUpload>
              </div>
            </div>
            <NEmpty v-if="sounds.length === 0" description="无声音" size="small" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sprite-panel {
  display: grid;
  grid-template-columns: 130px 1fr;
  height: 100%;
  min-height: 0;
}

/* ── 角色列表 ── */
.sprite-list {
  border-right: 1px solid var(--n-divider-color);
  overflow-y: auto;
  background: var(--n-color-modal);
}
.list-header {
  font-size: 11px; font-weight: 700;
  color: var(--n-text-color-3);
  text-transform: uppercase; letter-spacing: 1px;
  padding: 8px 8px 4px;
}
.sprite-item {
  display: flex; align-items: center; gap: 3px;
  padding: 4px 6px; cursor: pointer; font-size: 12px;
  border-left: 3px solid transparent;
  transition: background 0.1s;
}
.sprite-item:hover { background: rgba(0,0,0,0.04); }
.sprite-item.active {
  background: rgba(24,160,88,0.06);
  border-left-color: #18a058;
  font-weight: 600;
}
.si-icon { font-size: 12px; flex-shrink: 0; }
.si-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.si-count {
  font-size:10px; color:var(--n-text-color-3);
  background:rgba(0,0,0,0.05); border-radius:8px;
  padding:0 4px; flex-shrink:0;
}

/* ── 详情区 ── */
.sprite-detail {
  display: flex; flex-direction: column;
  gap: 0; overflow-y: auto; padding: 0 0 8px;
}

/* ── 通用 Section ── */
.section {
  border: 1px solid var(--n-divider-color);
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
}
.section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700;
  padding: 6px 10px;
  border-bottom: 1px solid var(--n-divider-color);
  background: var(--n-color-modal);
}
.section-subtitle {
  font-size: 11px; font-weight: 400; color: var(--n-text-color-3); margin-left: 4px;
}
.badge {
  font-size: 10px; font-weight: 600;
  background: rgba(24,160,88,0.1); color: #18a058;
  border-radius: 10px; padding: 1px 7px; margin-left: auto;
}

/* ── 属性信息条 ── */
.props-bar { margin: 8px 10px 0; }
.prop-grid {
  display: grid; gap: 4px 12px; padding: 6px 10px 8px;
}
.cols-3 { grid-template-columns: repeat(3, 1fr); }
.cols-4 { grid-template-columns: repeat(4, 1fr); }
.prop-cell {
  display: flex; align-items: center; gap: 6px; font-size: 12px;
}
.pk { color: var(--n-text-color-3); white-space: nowrap; font-size: 11px; }
.pv { font-weight: 600; }

/* ── 引用资源条 ── */
.ref-bar { margin: 8px 10px 0; }
.ref-content {
  display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 10px;
}
.ref-group {
  display: flex; align-items: flex-start; gap: 4px;
}
.ref-label {
  font-size: 11px; color: var(--n-text-color-3); white-space: nowrap;
  padding-top: 2px;
}
.ref-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.ref-tag {
  font-size: 11px; font-weight: 500; border-radius: 4px;
  padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px;
}
.var-tag {
  background: rgba(255,140,26,0.1); color: #FF8C1A;
  border: 1px solid rgba(255,140,26,0.2);
}
.send-tag {
  background: rgba(33,150,243,0.1); color: #2196F3;
  border: 1px solid rgba(33,150,243,0.2);
}
.recv-tag {
  background: rgba(76,175,80,0.1); color: #4CAF50;
  border: 1px solid rgba(76,175,80,0.2);
}
.rw-badge {
  font-size: 9px; font-weight: 700;
  background: rgba(0,0,0,0.06); border-radius: 3px;
  padding: 0 3px;
}

/* ── 双列主体 ── */
.main-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 10px 10px 0;
  min-height: 0;
  align-items: start;
}

/* ── 脚本列 ── */
.col-scripts {
  min-height: 0;
  display: flex; flex-direction: column; gap: 10px;
}
.scripts-flow {
  display: flex; flex-direction: column; gap: 8px;
  padding: 8px;
}
.script-card {
  border: 1px solid var(--n-divider-color);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.script-hat-bar {
  display: flex; align-items: center;
  padding: 5px 10px;
  border-left: 5px solid;
  font-size: 12px; font-weight: 700;
  gap: 6px;
}
.script-hat-bar.clickable { cursor: pointer; user-select: none; }
.script-hat-bar.clickable:hover { filter: brightness(0.96); }
.hat-chevron {
  font-size: 9px; color: var(--n-text-color-3);
  width: 12px; flex-shrink: 0; text-align: center;
}
.hat-text { flex: 1; }
.hat-count {
  font-size: 10px; font-weight: 400; color: var(--n-text-color-3);
  white-space: nowrap; margin-left: auto;
}
.script-card.collapsed { opacity: 0.85; }
.section-actions { margin-left: auto; display: flex; gap: 2px; }

/* 分类 Badge */
.cat-badge {
  font-size: 9px; font-weight: 700; color: #fff;
  border-radius: 3px; padding: 1px 4px;
  flex-shrink: 0; white-space: nowrap;
}
.cat-badge-sm {
  font-size: 8px; font-weight: 700; color: #fff;
  border-radius: 2px; padding: 0px 3px;
  flex-shrink: 0; white-space: nowrap;
}

/* 行号 */
.line-num {
  font-size: 9px; color: var(--n-text-color-3);
  width: 18px; text-align: right; flex-shrink: 0;
  font-family: monospace; opacity: 0.5;
}

.script-body {
  font-family: 'JetBrains Mono', 'Fira Code', 'Menlo', monospace;
  font-size: 11px; line-height: 1.7;
}
.block-line {
  padding: 1px 10px;
  border-left: 4px solid;
  transition: filter 0.1s;
  display: flex; align-items: center; gap: 4px;
}
.block-line:hover { filter: brightness(0.97); }
.bl-text { font-weight: 600; }

/* ── 孤立积木 ── */
.orphan-section { border-color: rgba(255,152,0,0.3); }
.orphan-title { background: rgba(255,152,0,0.06) !important; color: #e65100; }
.orphan-badge { background: rgba(255,87,34,0.1) !important; color: #ff5722 !important; }
.orphan-hint {
  font-size: 10px; font-weight: 400; color: var(--n-text-color-3);
  margin-left: auto;
}
.orphan-list { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.orphan-card {
  border: 1px dashed rgba(255,152,0,0.4);
  border-radius: 4px; padding: 6px 8px;
  background: rgba(255,152,0,0.03);
}
.orphan-hat {
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
}
.orphan-line {
  font-size: 11px; font-weight: 500; padding: 1px 0; display: flex; align-items: center; gap: 4px;
  font-family: 'JetBrains Mono', monospace;
}

/* ── 资产列表 ── */
.col-assets {
  display: flex; flex-direction: column; gap: 10px; min-height: 0;
}
.asset-full-list {
  display: flex; flex-direction: column;
}
.asset-row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 8px;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  transition: background 0.1s;
}
.asset-row:last-child { border-bottom: none; }
.asset-row:hover { background: rgba(0,0,0,0.02); }
.asset-idx {
  font-size: 10px; font-weight: 600; color: var(--n-text-color-3);
  width: 18px; text-align: center; flex-shrink: 0;
}
.asset-thumb {
  width: 32px; height: 32px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0;
}
/* 造型缩略预览 */
.costume-preview {
  width: 40px; height: 40px; border-radius: 6px; flex-shrink: 0;
  border: 1px solid rgba(0,0,0,0.08);
  background: #f8f8fa;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.costume-img {
  max-width: 100%; max-height: 100%; object-fit: contain;
}
.costume-format {
  font-size: 10px; font-weight: 700; color: #9966FF;
}
.costume-preview.replaced {
  border-color: #4CAF50;
  background: rgba(76,175,80,0.06);
}
.costume-color { background: linear-gradient(135deg, #9966FF, #7c3aed); }
.sound-color { background: linear-gradient(135deg, #CF63CF, #a855f7); }
.asset-body { flex: 1; min-width: 80px; overflow: hidden; }
.asset-name { font-size: 12px; font-weight: 600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display: flex; align-items: center; gap: 4px; }
.asset-meta { font-size: 10px; color: var(--n-text-color-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.replace-btn { flex-shrink: 0; font-size: 11px; }

@media (max-width: 900px) {
  .main-columns { grid-template-columns: 1fr; }
  .prop-grid.cols-4 { grid-template-columns: repeat(2, 1fr); }
}
/* ── 过滤器栏 ── */
.filter-bar {
  display: flex; gap: 6px; align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--n-divider-color);
  background: rgba(0,0,0,0.01);
}

/* ── 播放按钮 ── */
.play-btn { flex-shrink: 0; font-size: 11px; }
.asset-thumb.playing {
  animation: pulse 0.8s ease-in-out infinite alternate;
}
.asset-thumb.replaced {
  background: linear-gradient(135deg, #4CAF50, #2E7D32) !important;
}
@keyframes pulse {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(1.1); opacity: 0.7; }
}
</style>
