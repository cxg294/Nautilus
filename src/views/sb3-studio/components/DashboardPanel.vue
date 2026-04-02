<script setup lang="ts">
/**
 * DashboardPanel — 项目总览（紧凑布局）
 *
 * 上方：统计指标条 (横排单行)
 * 下方：角色概览表格 + 诊断问题 (并排或堆叠)
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSb3Project } from '../composables/use-sb3-project';

const { t } = useI18n();
const { analysis, project } = useSb3Project();

const stats = computed(() => analysis.value?.stats || {});
const diagnostics = computed(() => analysis.value?.diagnostics || []);

/** 统计指标：注意 analyzer.js 返回的 key 带 Count 后缀 */
const statCards = computed(() => [
  { key: 'spriteCount', label: '角色', icon: '🎭', color: '#18a058' },
  { key: 'blockCount', label: '积木', icon: '🧱', color: '#2080f0' },
  { key: 'scriptCount', label: '脚本', icon: '📜', color: '#f0a020' },
  { key: 'costumeCount', label: '造型', icon: '🎨', color: '#d03050' },
  { key: 'soundCount', label: '声音', icon: '🔊', color: '#8b5cf6' },
  { key: 'variableCount', label: '变量', icon: '📦', color: '#06b6d4' },
  { key: 'listCount', label: '列表', icon: '📋', color: '#ec4899' },
  { key: 'broadcastCount', label: '广播', icon: '📡', color: '#f97316' },
]);

/** 获取目标列表 */
const targets = computed(() => {
  if (!project.value) return [];
  return (project.value.targets || []).map((target: any) => ({
    name: target.name,
    isStage: target.isStage,
    blockCount: Object.values(target.blocks || {}).filter((b: any) => typeof b === 'object' && b.opcode).length,
    costumeCount: (target.costumes || []).length,
    soundCount: (target.sounds || []).length,
  }));
});

/** 诊断类型映射 */
function getDiagType(type: string) {
  if (type === 'error') return 'error';
  if (type === 'warning') return 'warning';
  return 'info';
}
</script>

<template>
  <div class="dashboard">
    <!-- 统计指标条：单行紧凑 -->
    <div class="stats-bar">
      <div
        v-for="card in statCards"
        :key="card.key"
        class="stat-chip"
      >
        <span class="stat-chip-icon">{{ card.icon }}</span>
        <span class="stat-chip-value" :style="{ color: card.color }">{{ stats[card.key] ?? 0 }}</span>
        <span class="stat-chip-label">{{ card.label }}</span>
      </div>
    </div>

    <!-- 下方内容区域 -->
    <div class="content-row">
      <!-- 角色概览表格 -->
      <NCard size="small" :bordered="false" class="content-card" v-if="targets.length > 0">
        <template #header>
          <span style="font-size: 14px; font-weight: 600">🎭 角色概览</span>
        </template>
        <NDataTable
          :columns="[
            { title: '名称', key: 'name', width: 200, render: (row: any) => `${row.isStage ? '🎬 ' : '🎭 '}${row.name}` },
            { title: '积木', key: 'blockCount', width: 80, align: 'center' },
            { title: '造型', key: 'costumeCount', width: 80, align: 'center' },
            { title: '声音', key: 'soundCount', width: 80, align: 'center' },
          ]"
          :data="targets"
          :bordered="false"
          size="small"
          :pagination="false"
          :max-height="360"
        />
      </NCard>

      <!-- 诊断问题 -->
      <NCard size="small" :bordered="false" class="content-card" v-if="diagnostics.length > 0">
        <template #header>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600">
            ⚠️ 诊断 <NTag type="warning" size="tiny" round>{{ diagnostics.length }}</NTag>
          </div>
        </template>
        <div class="diagnostics-list">
          <NAlert
            v-for="(diag, idx) in diagnostics"
            :key="idx"
            :type="getDiagType(diag.type)"
            :title="diag.category"
            class="diag-item"
          >
            {{ diag.message }}
            <NTag v-if="diag.targetName" size="tiny" type="info" style="margin-left: 6px">
              {{ diag.targetName }}
            </NTag>
          </NAlert>
        </div>
      </NCard>

      <!-- 项目健康 -->
      <NCard
        v-if="diagnostics.length === 0 && analysis"
        size="small"
        :bordered="false"
        class="content-card healthy-card"
      >
        <div class="healthy-msg">✨ 项目健康，未检测到潜在问题</div>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 统计指标条 */
.stats-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--n-color-modal);
  border-radius: 20px;
  font-size: 13px;
  transition: transform 0.12s;
}
.stat-chip:hover {
  transform: translateY(-1px);
}

.stat-chip-icon {
  font-size: 14px;
}

.stat-chip-value {
  font-weight: 700;
  font-size: 16px;
  min-width: 20px;
  text-align: center;
}

.stat-chip-label {
  font-size: 11px;
  color: var(--n-text-color-3);
}

/* 内容区域 */
.content-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.content-card {
  min-height: 0;
}

@media (max-width: 900px) {
  .content-row {
    grid-template-columns: 1fr;
  }
}

.diagnostics-list {
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.diag-item {
  font-size: 12px;
}

.healthy-card {
  display: flex;
  align-items: center;
  justify-content: center;
}

.healthy-msg {
  text-align: center;
  padding: 24px;
  color: var(--n-text-color-2);
  font-size: 14px;
}
</style>
