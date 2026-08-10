<script setup lang="ts">
/**
 * 图标库浏览器 — 主页面
 *
 * 核心体验：
 * - 大搜索框居中（无结果时），搜索后上移
 * - 中英文搜索支持（内置翻译表）
 * - 实时 300ms 防抖搜索
 * - 图标网格 + hover 放大预览
 * - 一键复制多种格式
 * - 图标集侧边筛选
 * - 搜索历史标签
 * - 加载更多分页
 */
import { ref, watch, nextTick } from 'vue';
import { useMessage } from 'naive-ui';
import { useIconSearch } from './composables/use-icon-search';
import type { IconResult } from './composables/use-icon-search';
import { usePageTracker } from '@/hooks/common/use-tracker';

usePageTracker('icon-explorer');

const message = useMessage();
const {
  query,
  isSearching,
  prefixFilter,
  searchState,
  searchHistory,
  errorMsg,
  availableCollections,
  filteredIcons,
  resultSummary,
  search,
  loadMore,
  clearResults,
  removeFromHistory,
  clearHistory,
  getSvgUrl,
  copyToClipboard,
  getCopyFormats,
} = useIconSearch();

// === 状态 ===
const hasSearched = ref(false);
const activeIcon = ref<IconResult | null>(null);
const showCopyMenu = ref(false);
const iconSize = ref(28);

// === 防抖搜索 ===
let debounceTimer: ReturnType<typeof setTimeout>;
watch(query, (v) => {
  clearTimeout(debounceTimer);
  if (!v.trim()) {
    hasSearched.value = false;
    clearResults();
    return;
  }
  debounceTimer = setTimeout(() => {
    hasSearched.value = true;
    search();
  }, 300);
});

/** 点击历史标签搜索 */
function searchFromHistory(keyword: string) {
  query.value = keyword;
  hasSearched.value = true;
  search(keyword);
}

/** 点击热门搜索建议 */
const hotKeywords = [
  '箭头', '用户', '设置', '搜索', '删除',
  'home', 'star', 'heart', 'check', 'warning',
  'chart', 'calendar', 'lock', 'cloud', 'code',
];

/** 复制指定格式 */
async function handleCopy(icon: IconResult, format: 'iconify' | 'unocss' | 'vue' | 'svgUrl' | 'img') {
  const formats = getCopyFormats(icon);
  const text = formats[format];
  const ok = await copyToClipboard(text);
  if (ok) {
    message.success(`已复制: ${text}`);
  } else {
    message.error('复制失败');
  }
  showCopyMenu.value = false;
}

/** 快速复制（默认 iconify 格式） */
async function handleQuickCopy(icon: IconResult) {
  const ok = await copyToClipboard(icon.fullName);
  if (ok) {
    message.success(`已复制: ${icon.fullName}`);
  }
}

/** 显示复制菜单 */
function handleShowCopyMenu(icon: IconResult) {
  activeIcon.value = icon;
  showCopyMenu.value = true;
}

/** 滚动加载更多 */
function handleScrollBottom() {
  if (searchState.value.hasMore && !isSearching.value) {
    loadMore();
  }
}
</script>

<template>
  <div class="icon-explorer" :class="{ 'icon-explorer--centered': !hasSearched }">
    <!-- 搜索区域 -->
    <div class="search-area">
      <h1 v-if="!hasSearched" class="search-title">
        <span class="search-title__icon">🎨</span>
        图标库
      </h1>
      <p v-if="!hasSearched" class="search-subtitle">
        搜索 200,000+ 开源图标 · 支持中英文 · 一键复制
      </p>

      <div class="search-box">
        <NInput
          v-model:value="query"
          :placeholder="hasSearched ? '搜索图标…' : '输入图标名称，例如 箭头、user、home…'"
          clearable
          :size="hasSearched ? 'medium' : 'large'"
          :loading="isSearching"
          @keydown.enter="search()"
        >
          <template #prefix>
            <span class="i-mdi-magnify" style="font-size: 18px; opacity: 0.5;" />
          </template>
        </NInput>
      </div>

      <!-- 热门搜索（无结果时） -->
      <div v-if="!hasSearched" class="hot-keywords">
        <span class="hot-keywords__label">热门搜索</span>
        <div class="hot-keywords__list">
          <NTag
            v-for="kw in hotKeywords"
            :key="kw"
            size="small"
            round
            :bordered="false"
            class="hot-keyword-tag"
            @click="searchFromHistory(kw)"
          >
            {{ kw }}
          </NTag>
        </div>
      </div>

      <!-- 搜索历史（无结果时） -->
      <div v-if="!hasSearched && searchHistory.length > 0" class="search-history">
        <div class="search-history__header">
          <span class="search-history__label">搜索历史</span>
          <NButton text size="tiny" @click="clearHistory">清除</NButton>
        </div>
        <div class="search-history__list">
          <NTag
            v-for="kw in searchHistory.slice(0, 10)"
            :key="kw"
            size="small"
            round
            closable
            class="history-tag"
            @click="searchFromHistory(kw)"
            @close="removeFromHistory(kw)"
          >
            {{ kw }}
          </NTag>
        </div>
      </div>
    </div>

    <!-- 搜索结果区域 -->
    <template v-if="hasSearched">
      <!-- 结果统计 + 尺寸调节 -->
      <div class="results-toolbar">
        <div class="results-toolbar__left">
          <span v-if="resultSummary" class="results-summary">{{ resultSummary }}</span>
          <NTag v-if="errorMsg" type="error" size="small">{{ errorMsg }}</NTag>
        </div>
        <div class="results-toolbar__right">
          <NSpace :size="8" align="center">
            <span class="size-label">图标大小</span>
            <NSlider
              v-model:value="iconSize"
              :min="20"
              :max="48"
              :step="4"
              style="width: 100px;"
            />
          </NSpace>
        </div>
      </div>

      <div class="results-layout">
        <!-- 图标集侧边筛选 -->
        <div v-if="availableCollections.length > 1" class="collection-filter">
          <div class="filter-title">图标集筛选</div>
          <div
            class="filter-item"
            :class="{ 'filter-item--active': !prefixFilter }"
            @click="prefixFilter = null"
          >
            <span>全部</span>
            <span class="filter-count">{{ searchState.total }}</span>
          </div>
          <div
            v-for="col in availableCollections"
            :key="col.prefix"
            class="filter-item"
            :class="{ 'filter-item--active': prefixFilter === col.prefix }"
            @click="prefixFilter = col.prefix"
          >
            <span class="filter-name" :title="col.name">{{ col.name }}</span>
            <span class="filter-count">{{ col.total }}</span>
          </div>
        </div>

        <!-- 图标网格 -->
        <div class="icon-grid-wrapper">
          <div v-if="filteredIcons.length === 0 && !isSearching" class="no-results">
            <span class="no-results__icon">😕</span>
            <p>没有找到匹配的图标，试试其他关键词？</p>
          </div>

          <div v-else class="icon-grid">
            <div
              v-for="icon in filteredIcons"
              :key="icon.fullName"
              class="icon-card"
              @click="handleQuickCopy(icon)"
              @contextmenu.prevent="handleShowCopyMenu(icon)"
            >
              <div class="icon-card__preview">
                <img
                  :src="getSvgUrl(icon)"
                  :alt="icon.fullName"
                  :style="{ width: iconSize + 'px', height: iconSize + 'px' }"
                  loading="lazy"
                  class="icon-card__svg"
                />
              </div>
              <div class="icon-card__name" :title="icon.fullName">{{ icon.name }}</div>
              <div class="icon-card__prefix">{{ icon.prefix }}</div>

              <!-- hover 操作按钮 -->
              <div class="icon-card__actions">
                <NButton
                  size="tiny"
                  quaternary
                  circle
                  title="复制 Iconify 名称"
                  @click.stop="handleCopy(icon, 'iconify')"
                >
                  <template #icon><span class="i-mdi-content-copy" /></template>
                </NButton>
                <NButton
                  size="tiny"
                  quaternary
                  circle
                  title="更多复制格式"
                  @click.stop="handleShowCopyMenu(icon)"
                >
                  <template #icon><span class="i-mdi-dots-horizontal" /></template>
                </NButton>
              </div>
            </div>
          </div>

          <!-- 加载更多 -->
          <div v-if="searchState.hasMore" class="load-more">
            <NButton
              :loading="isSearching"
              quaternary
              @click="loadMore"
            >
              加载更多（已显示 {{ searchState.loaded }} / {{ searchState.total }}）
            </NButton>
          </div>
        </div>
      </div>
    </template>

    <!-- 复制格式菜单 Drawer -->
    <NDrawer v-model:show="showCopyMenu" :width="340" placement="right">
      <NDrawerContent v-if="activeIcon" :title="activeIcon.fullName" closable>
        <!-- 预览 -->
        <div class="copy-preview">
          <img
            :src="getSvgUrl(activeIcon)"
            :alt="activeIcon.fullName"
            class="copy-preview__img"
          />
        </div>

        <!-- 复制选项 -->
        <div class="copy-options">
          <div class="copy-option" @click="handleCopy(activeIcon!, 'iconify')">
            <div class="copy-option__label">Iconify 名称</div>
            <code class="copy-option__code">{{ getCopyFormats(activeIcon).iconify }}</code>
          </div>
          <div class="copy-option" @click="handleCopy(activeIcon!, 'unocss')">
            <div class="copy-option__label">UnoCSS Class</div>
            <code class="copy-option__code">{{ getCopyFormats(activeIcon).unocss }}</code>
          </div>
          <div class="copy-option" @click="handleCopy(activeIcon!, 'vue')">
            <div class="copy-option__label">Vue 组件</div>
            <code class="copy-option__code">{{ getCopyFormats(activeIcon).vue }}</code>
          </div>
          <div class="copy-option" @click="handleCopy(activeIcon!, 'svgUrl')">
            <div class="copy-option__label">SVG URL</div>
            <code class="copy-option__code copy-option__code--sm">{{ getCopyFormats(activeIcon).svgUrl }}</code>
          </div>
          <div class="copy-option" @click="handleCopy(activeIcon!, 'img')">
            <div class="copy-option__label">HTML img</div>
            <code class="copy-option__code copy-option__code--sm">{{ getCopyFormats(activeIcon).img }}</code>
          </div>
        </div>

        <NAlert type="info" :bordered="false" style="margin-top: 16px;">
          点击即可复制 · 左键快速复制名称 · 右键打开此面板
        </NAlert>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.icon-explorer {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 16px;
  transition: all 0.3s ease;
}

/* 居中模式（无搜索结果时） */
.icon-explorer--centered {
  justify-content: center;
  align-items: center;
}

.icon-explorer--centered .search-area {
  max-width: 640px;
  width: 100%;
  text-align: center;
}

/* 搜索区域 */
.search-area {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.search-title__icon {
  margin-right: 8px;
}

.search-subtitle {
  margin: 0;
  font-size: 15px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
}

.search-box {
  width: 100%;
}

/* 热门搜索 */
.hot-keywords {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.hot-keywords__label {
  font-size: 12px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
}

.hot-keywords__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.hot-keyword-tag {
  cursor: pointer;
  transition: transform 0.15s;
}

.hot-keyword-tag:hover {
  transform: scale(1.05);
}

/* 搜索历史 */
.search-history {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.search-history__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-history__label {
  font-size: 12px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
}

.search-history__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.history-tag {
  cursor: pointer;
}

/* 结果工具栏 */
.results-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.results-toolbar__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.results-summary {
  font-size: 13px;
  color: var(--n-text-color-2, rgba(255, 255, 255, 0.6));
}

.results-toolbar__right {
  display: flex;
  align-items: center;
}

.size-label {
  font-size: 12px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
  white-space: nowrap;
}

/* 结果布局 */
.results-layout {
  flex: 1;
  display: flex;
  gap: 16px;
  overflow: hidden;
}

/* 图标集筛选 */
.collection-filter {
  width: 180px;
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.filter-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
  padding: 4px 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.filter-item:hover {
  background: rgba(128, 128, 128, 0.1);
}

.filter-item--active {
  background: rgba(99, 226, 183, 0.12) !important;
  color: #63e2b7;
  font-weight: 500;
}

.filter-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.filter-count {
  font-size: 11px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
  flex-shrink: 0;
}

/* 图标网格 */
.icon-grid-wrapper {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.icon-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.icon-card:hover {
  background: rgba(128, 128, 128, 0.08);
  border-color: rgba(128, 128, 128, 0.15);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.icon-card__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
}

.icon-card__svg {
  /* 暗色模式下白色图标可见 */
  filter: var(--icon-filter, none);
  transition: transform 0.2s;
}

.dark .icon-card__svg {
  filter: invert(1);
}

.icon-card:hover .icon-card__svg {
  transform: scale(1.3);
}

.icon-card__name {
  font-size: 11px;
  color: var(--n-text-color-2, rgba(255, 255, 255, 0.6));
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  margin-top: 4px;
}

.icon-card__prefix {
  font-size: 10px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.28));
  margin-top: 2px;
}

.icon-card__actions {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.icon-card:hover .icon-card__actions {
  opacity: 1;
}

/* 无结果 */
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  gap: 12px;
}

.no-results__icon {
  font-size: 48px;
}

.no-results p {
  margin: 0;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
}

/* 加载更多 */
.load-more {
  display: flex;
  justify-content: center;
  padding: 16px 0;
  flex-shrink: 0;
}

/* 复制预览 */
.copy-preview {
  display: flex;
  justify-content: center;
  padding: 24px;
  background: rgba(128, 128, 128, 0.06);
  border-radius: 12px;
  margin-bottom: 16px;
}

.copy-preview__img {
  width: 64px;
  height: 64px;
}

.dark .copy-preview__img {
  filter: invert(1);
}

/* 复制选项 */
.copy-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.copy-option {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  border: 1px solid rgba(128, 128, 128, 0.1);
}

.copy-option:hover {
  background: rgba(99, 226, 183, 0.08);
  border-color: rgba(99, 226, 183, 0.3);
}

.copy-option__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--n-text-color-2, rgba(255, 255, 255, 0.6));
  margin-bottom: 4px;
}

.copy-option__code {
  font-size: 13px;
  font-family: 'Fira Code', 'Consolas', monospace;
  word-break: break-all;
}

.copy-option__code--sm {
  font-size: 11px;
}
</style>
