<script setup lang="ts">
/**
 * 数据看板 — 埋点分析可视化
 *
 * 展示工具使用排行、用户活跃度、每日趋势、事件流水
 * 仅 owner 角色可访问
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import {
  fetchAnalyticsSummary,
  fetchRecentEvents,
  type AnalyticsSummary,
  type RecentEvent,
} from '@/service/api/analytics';
import { usePageTracker } from '@/hooks/common/use-tracker';

usePageTracker('analytics-dashboard');

const loading = ref(false);
const summary = ref<AnalyticsSummary | null>(null);
const days = ref(30);
const daysOptions = [
  { label: '近 7 天', value: 7 },
  { label: '近 30 天', value: 30 },
  { label: '近 90 天', value: 90 },
];

// 最近事件
const recentEvents = ref<RecentEvent[]>([]);
const recentTotal = ref(0);
const recentPage = ref(1);
const recentLoading = ref(false);
const recentToolFilter = ref('');

// 图表
const toolChartRef = ref<HTMLElement | null>(null);
const trendChartRef = ref<HTMLElement | null>(null);
let toolChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;

// ═══ 概览卡片 ═══
const statCards = computed(() => {
  if (!summary.value) return [];
  const t = summary.value.totals;
  const todayRow = summary.value.dailyTrend.find(
    d => d.date === new Date().toISOString().slice(0, 10)
  );
  return [
    { icon: '📊', label: '总事件', value: t.total_events.toLocaleString(), bg: 'rgba(99,102,241,0.1)' },
    { icon: '👥', label: '活跃用户', value: String(t.total_users), bg: 'rgba(16,185,129,0.1)' },
    { icon: '🔧', label: '活跃工具', value: String(t.total_tools), bg: 'rgba(245,158,11,0.1)' },
    { icon: '⚡', label: '今日事件', value: String(todayRow?.total || 0), bg: 'rgba(139,92,246,0.1)' },
  ];
});

// ═══ 工具选项 ═══
const toolOptions = computed(() => {
  if (!summary.value) return [{ label: '全部工具', value: '' }];
  return [
    { label: '全部工具', value: '' },
    ...summary.value.toolRanking.map(t => ({ label: t.tool_name, value: t.tool_name })),
  ];
});

// ═══ 加载数据 ═══
async function loadSummary() {
  loading.value = true;
  try {
    const { data, error } = await fetchAnalyticsSummary(days.value);
    if (!error) summary.value = data;
  } finally {
    loading.value = false;
  }
}

async function loadRecent() {
  recentLoading.value = true;
  try {
    const params: any = { limit: 20, offset: (recentPage.value - 1) * 20 };
    if (recentToolFilter.value) params.tool = recentToolFilter.value;
    const { data, error } = await fetchRecentEvents(params);
    if (!error) {
      recentEvents.value = data.events;
      recentTotal.value = data.total;
    }
  } finally {
    recentLoading.value = false;
  }
}

// ═══ 图表渲染 ═══
function renderToolChart() {
  if (!toolChartRef.value || !summary.value) return;
  if (!toolChart) toolChart = echarts.init(toolChartRef.value);

  const data = summary.value.toolRanking.slice(0, 12);
  const names = data.map(d => d.tool_name);

  toolChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 4, textStyle: { fontSize: 12 } },
    grid: { left: 140, right: 30, top: 40, bottom: 16 },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
    yAxis: { type: 'category', data: names.reverse(), axisLabel: { fontSize: 12 } },
    series: [
      {
        name: '页面访问', type: 'bar', stack: 'total',
        data: data.map(d => d.views).reverse(),
        itemStyle: { color: '#6366f1', borderRadius: [0, 0, 0, 0] },
        barMaxWidth: 22,
      },
      {
        name: '操作', type: 'bar', stack: 'total',
        data: data.map(d => d.actions).reverse(),
        itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 22,
      },
    ],
  }, true);
}

function renderTrendChart() {
  if (!trendChartRef.value || !summary.value) return;
  if (!trendChart) trendChart = echarts.init(trendChartRef.value);

  const data = [...summary.value.dailyTrend].reverse();
  const dates = data.map(d => d.date.slice(5)); // MM-DD

  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 4, textStyle: { fontSize: 12 } },
    grid: { left: 50, right: 50, top: 44, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 11 } },
    yAxis: [
      { type: 'value', name: '事件数', splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
      { type: 'value', name: '用户数', splitLine: { show: false } },
    ],
    series: [
      {
        name: '页面访问', type: 'bar', stack: 'events',
        data: data.map(d => d.views),
        itemStyle: { color: '#6366f1' },
        barMaxWidth: 16,
      },
      {
        name: '操作', type: 'bar', stack: 'events',
        data: data.map(d => d.actions),
        itemStyle: { color: '#10b981' },
        barMaxWidth: 16,
      },
      {
        name: '活跃用户', type: 'line', yAxisIndex: 1,
        data: data.map(d => d.active_users),
        lineStyle: { color: '#f59e0b', width: 2.5 },
        itemStyle: { color: '#f59e0b' },
        symbol: 'circle', symbolSize: 5, smooth: true,
      },
    ],
  }, true);
}

// ═══ 事件流水表格列 ═══
function formatTime(ts: string) {
  if (!ts) return '-';
  return new Date(ts + (ts.includes('Z') || ts.includes('+') ? '' : 'Z')).toLocaleString('zh-CN');
}

function eventTypeLabel(type: string) {
  return type === 'page_view' ? '📄 页面' : '⚡ 操作';
}

// ═══ 生命周期 ═══
onMounted(async () => {
  await loadSummary();
  await loadRecent();
  nextTick(() => { renderToolChart(); renderTrendChart(); });
});

watch(days, async () => {
  await loadSummary();
  nextTick(() => { renderToolChart(); renderTrendChart(); });
});
watch([recentPage, recentToolFilter], loadRecent);

const resizeHandler = () => { toolChart?.resize(); trendChart?.resize(); };
onMounted(() => window.addEventListener('resize', resizeHandler));
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeHandler);
  toolChart?.dispose();
  trendChart?.dispose();
});
</script>

<template>
  <div class="analytics-page">
    <!-- 标题栏 -->
    <div class="page-header">
      <h2 class="page-title">📊 数据看板</h2>
      <NSelect
        v-model:value="days"
        :options="daysOptions"
        size="small"
        style="width: 130px"
      />
    </div>

    <!-- 加载态 -->
    <div v-if="loading && !summary" class="center-state">
      <NSpin size="large" />
    </div>

    <template v-else-if="summary">
      <!-- 概览卡片 -->
      <div class="stat-grid">
        <div v-for="(s, i) in statCards" :key="i" class="stat-card">
          <div class="stat-icon" :style="{ background: s.bg }">{{ s.icon }}</div>
          <div class="stat-body">
            <div class="stat-value">{{ s.value }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
        </div>
      </div>

      <!-- 图表区 -->
      <div class="charts-row">
        <NCard size="small" title="🏆 工具使用排行" class="chart-card">
          <div ref="toolChartRef" class="chart-box" />
        </NCard>
        <NCard size="small" title="📈 每日趋势" class="chart-card">
          <div ref="trendChartRef" class="chart-box" />
        </NCard>
      </div>

      <!-- 用户活跃度 + 事件流水 -->
      <div class="bottom-row">
        <!-- 用户活跃度 -->
        <NCard size="small" title="👤 用户活跃度" class="user-card">
          <div class="user-table-wrap">
            <table class="mini-table">
              <thead>
                <tr>
                  <th>用户</th><th>事件数</th><th>工具数</th><th>操作数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in summary.userRanking" :key="u.user_id">
                  <td class="user-cell">{{ u.username || `#${u.user_id}` }}</td>
                  <td class="num-cell">{{ u.total }}</td>
                  <td class="num-cell">{{ u.tools_used }}</td>
                  <td class="num-cell">{{ u.actions }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </NCard>

        <!-- 事件流水 -->
        <NCard size="small" class="events-card">
          <template #header>
            <div class="events-header">
              <span>📋 事件流水</span>
              <NSelect
                v-model:value="recentToolFilter"
                :options="toolOptions"
                size="tiny"
                style="width: 150px"
                clearable
                placeholder="筛选工具"
              />
            </div>
          </template>
          <div class="events-table-wrap">
            <table class="mini-table">
              <thead>
                <tr>
                  <th style="width:70px">类型</th>
                  <th>工具</th>
                  <th>操作</th>
                  <th>用户</th>
                  <th style="width:150px">时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="evt in recentEvents" :key="evt.id">
                  <td><NTag :type="evt.event_type === 'page_view' ? 'info' : 'success'" size="tiny" round>{{ eventTypeLabel(evt.event_type) }}</NTag></td>
                  <td>{{ evt.tool_name }}</td>
                  <td>{{ evt.action_name || '-' }}</td>
                  <td>{{ evt.username }}</td>
                  <td class="time-cell">{{ formatTime(evt.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="recentTotal > 20" class="events-pager">
            <NPagination
              v-model:page="recentPage"
              :page-count="Math.ceil(recentTotal / 20)"
              size="small"
              :page-slot="5"
            />
          </div>
        </NCard>
      </div>
    </template>
  </div>
</template>

<style scoped>
.analytics-page {
  padding: 20px 28px;
  overflow-y: auto;
  height: 100%;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.center-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

/* 概览卡片 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 12px;
  background: rgba(128,128,128,0.03);
  border: 1px solid rgba(128,128,128,0.08);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  opacity: 0.5;
  margin-top: 2px;
}

/* 图表区 */
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.chart-card {
  border-radius: 12px;
}

.chart-box {
  width: 100%;
  height: 300px;
}

/* 底部区域 */
.bottom-row {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 16px;
}

.user-card, .events-card {
  border-radius: 12px;
}

.user-table-wrap, .events-table-wrap {
  max-height: 320px;
  overflow-y: auto;
}

.mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.mini-table th {
  text-align: left;
  padding: 8px 10px;
  font-weight: 600;
  font-size: 12px;
  opacity: 0.6;
  border-bottom: 1px solid rgba(128,128,128,0.12);
  position: sticky;
  top: 0;
  background: var(--n-color, #fff);
  z-index: 1;
}

.dark .mini-table th {
  background: var(--n-color, #1e1e2e);
}

.mini-table td {
  padding: 7px 10px;
  border-bottom: 1px solid rgba(128,128,128,0.06);
}

.mini-table tbody tr:hover {
  background: rgba(128,128,128,0.04);
}

.num-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.user-cell {
  font-weight: 500;
}

.time-cell {
  font-size: 12px;
  opacity: 0.6;
  white-space: nowrap;
}

.events-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  font-weight: 600;
}

.events-pager {
  display: flex;
  justify-content: center;
  padding-top: 12px;
}

@media (max-width: 1024px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
  .charts-row { grid-template-columns: 1fr; }
  .bottom-row { grid-template-columns: 1fr; }
}
</style>
