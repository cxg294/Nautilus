<script setup lang="ts">
/**
 * 常用网站 — 主页面
 *
 * 分组卡片布局 + 标签页切换 + favicon + 搜索过滤
 */
import { ref, computed, reactive } from 'vue';
import { siteGroups, getFaviconUrl } from './data/sites';
import type { SiteItem } from './data/sites';
import { usePageTracker } from '@/hooks/common/use-tracker';

usePageTracker('quick-links');

// ──── 分组切换 ────
const activeGroup = ref('all');

const groupTabs = computed(() => [
  { key: 'all', label: '全部', icon: 'mdi:view-grid-outline', count: siteGroups.reduce((s, g) => s + g.sites.length, 0) },
  ...siteGroups.map((g) => ({ key: g.key, label: g.label, icon: g.icon, count: g.sites.length }))
]);

// ──── 搜索过滤 ────
const searchQuery = ref('');

const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const targetGroups = activeGroup.value === 'all' ? siteGroups : siteGroups.filter((g) => g.key === activeGroup.value);

  if (!q) return targetGroups;

  return targetGroups
    .map((group) => ({
      ...group,
      sites: group.sites.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          s.url.toLowerCase().includes(q)
      )
    }))
    .filter((g) => g.sites.length > 0);
});



// ──── favicon 加载状态 ────
const faviconErrors = reactive<Record<string, boolean>>({});

function onFaviconError(url: string) {
  faviconErrors[url] = true;
}

function hasFaviconError(url: string) {
  return faviconErrors[url] === true;
}

// ──── 操作 ────
function openSite(site: SiteItem) {
  window.open(site.url, '_blank', 'noopener,noreferrer');
}

function getEnvLabel(env?: 'prod' | 'test') {
  if (env === 'test') return '测试';
  if (env === 'prod') return '生产';
  return '';
}

function getEnvType(env?: 'prod' | 'test') {
  if (env === 'test') return 'warning';
  if (env === 'prod') return 'success';
  return 'default';
}
</script>

<template>
  <div class="quick-links">
    <!-- 顶栏 -->
    <div class="top-bar">
      <div class="tabs-row">
        <button
          v-for="tab in groupTabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeGroup === tab.key }"
          @click="activeGroup = tab.key"
        >
          <span class="icon mdi" :class="`mdi-${tab.icon.replace('mdi:', '')}`" />
          <span class="tab-label">{{ tab.label }}</span>
          <span class="tab-count">{{ tab.count }}</span>
        </button>
      </div>
      <NInput
        v-model:value="searchQuery"
        placeholder="搜索…"
        clearable
        size="small"
        class="search-input"
      >
        <template #prefix>
          <span class="icon mdi mdi-magnify" style="opacity: 0.4" />
        </template>
      </NInput>
    </div>

    <!-- 空状态 -->
    <div v-if="filteredGroups.length === 0" class="empty-state">
      <span class="icon mdi mdi-web-off empty-icon" />
      <span class="empty-text">没有找到匹配的网站</span>
    </div>

    <!-- 分组卡片列表 -->
    <div v-else class="groups-scroll">
      <NCard
        v-for="group in filteredGroups"
        :key="group.key"
        :bordered="false"
        size="small"
        class="group-card"
      >
        <template #header>
          <div class="group-header">
            <span
              class="icon mdi group-icon"
              :class="`mdi-${group.icon.replace('mdi:', '')}`"
              :style="{ color: group.accentColor }"
            />
            <span class="group-label">{{ group.label }}</span>
            <span class="group-count">{{ group.sites.length }}</span>
          </div>
        </template>

        <!-- 卡片网格：固定宽度，不拉伸 -->
        <div class="sites-wrap">
          <div
            v-for="site in group.sites"
            :key="site.url"
            class="site-card"
            :class="{ 'is-test': site.env === 'test' }"
            @click="openSite(site)"
          >
            <!-- Favicon -->
            <div class="card-favicon">
              <img
                v-if="!hasFaviconError(site.url)"
                :src="getFaviconUrl(site.url)"
                :alt="site.name"
                class="favicon-img"
                loading="lazy"
                @error="onFaviconError(site.url)"
              />
              <span
                v-else
                class="icon mdi favicon-fallback"
                :class="`mdi-${site.fallbackIcon.replace('mdi:', '')}`"
                :style="{ color: group.accentColor }"
              />
            </div>

            <!-- 信息 -->
            <div class="card-content">
              <div class="card-title-row">
                <span class="card-name">{{ site.name }}</span>
                <NTag
                  v-if="site.env"
                  :type="getEnvType(site.env)"
                  size="tiny"
                  :bordered="false"
                  round
                >
                  {{ getEnvLabel(site.env) }}
                </NTag>
              </div>
              <span class="card-desc">{{ site.description }}</span>
            </div>

            <span class="icon mdi mdi-arrow-top-right card-arrow" />
          </div>
        </div>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.quick-links {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

/* ── 顶栏 ── */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}

.tabs-row {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(128, 128, 128, 0.06);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  opacity: 0.55;
}

.tab-btn:hover {
  opacity: 0.8;
  background: rgba(128, 128, 128, 0.06);
}

.tab-btn.active {
  opacity: 1;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.1);
}

.tab-btn .icon {
  font-size: 16px;
}

.tab-label {
  font-size: 13px;
}

.tab-count {
  font-size: 11px;
  opacity: 0.5;
  font-weight: 600;
  min-width: 16px;
  text-align: center;
  background: rgba(128, 128, 128, 0.08);
  border-radius: 6px;
  padding: 1px 5px;
}

.tab-btn.active .tab-count {
  background: rgba(99, 102, 241, 0.15);
  opacity: 0.8;
}

.search-input {
  width: 200px;
  flex-shrink: 0;
}

/* ── 空状态 ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 12px;
  opacity: 0.35;
}

.empty-icon {
  font-size: 48px;
}

.empty-text {
  font-size: 14px;
}

/* ── 分组滚动区 ── */
.groups-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 20px;
}

/* ── 分组卡片 ── */
.group-card {
  border-radius: 12px;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-icon {
  font-size: 20px;
}

.group-label {
  font-size: 14px;
  font-weight: 600;
}

.group-count {
  font-size: 12px;
  opacity: 0.35;
  font-weight: 500;
}

/* ── 网站卡片容器：flex wrap + 固定宽度 ── */
.sites-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* ── 网站卡片：固定宽度，不拉伸 ── */
.site-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 228px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.08);
  background: rgba(128, 128, 128, 0.02);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.site-card:hover {
  transform: translateY(-1px);
  border-color: rgba(99, 102, 241, 0.25);
  background: rgba(99, 102, 241, 0.04);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}

.site-card:active {
  transform: scale(0.99);
}

.site-card.is-test {
  border-style: dashed;
}

/* ── Favicon ── */
.card-favicon {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  background: rgba(128, 128, 128, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.favicon-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.favicon-fallback {
  font-size: 18px;
}

/* ── 内容 ── */
.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.card-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-desc {
  font-size: 11px;
  opacity: 0.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-arrow {
  font-size: 13px;
  opacity: 0;
  flex-shrink: 0;
  color: rgba(99, 102, 241, 0.5);
  transition: all 0.2s;
}

.site-card:hover .card-arrow {
  opacity: 1;
  transform: translate(1px, -1px);
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .top-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .tabs-row {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .search-input {
    width: 100%;
  }

  .site-card {
    width: 100%;
  }
}
</style>
