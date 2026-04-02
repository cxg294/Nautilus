<template>
  <div class="btc-flow-page w-full overflow-y-auto" style="padding: 20px 28px">
    <!-- 顶部工具栏 -->
    <header class="flex items-center gap-16px mb-20px flex-nowrap">
      <h2 class="text-18px font-800 m-0 flex items-center gap-6px shrink-0 whitespace-nowrap">
        <span class="header-icon">📊</span>
        BTC 课程流转数据
      </h2>
      <div class="mode-tabs shrink-0">
        <NButton
          v-for="tab in modes"
          :key="tab.key"
          :type="activeMode === tab.key ? 'primary' : 'default'"
          :ghost="activeMode !== tab.key"
          :tertiary="activeMode !== tab.key"
          size="small"
          @click="activeMode = tab.key"
        >
          <template #icon><span class="text-13px">{{ tab.icon }}</span></template>
          {{ tab.label }}
        </NButton>
      </div>
      <div class="flex-1" />
      <div class="flex items-center gap-12px shrink-0">
        <NSwitch v-model:value="excludeTest" size="small" @update:value="reload">
          <template #checked>屏蔽测试</template>
          <template #unchecked>含测试</template>
        </NSwitch>
        <NUpload
          :show-file-list="false"
          accept=".xlsx,.xls"
          :custom-request="handleUploadRequest"
        >
          <NButton type="primary" size="small" strong>
            <template #icon><span class="i-mdi-folder-upload text-14px" /></template>
            上传数据
          </NButton>
        </NUpload>
      </div>
    </header>

    <!-- 加载 / 空态 -->
    <div v-if="loading" class="flex-col-center min-h-400px gap-16px">
      <NSpin size="large" />
      <p class="op-40 text-14px">数据加载中…</p>
    </div>
    <div v-else-if="!hasData" class="flex-col-center min-h-400px gap-16px">
      <div class="empty-hero">
        <span class="text-72px">📋</span>
        <h3 class="text-20px font-700 m-0 mt-8px">暂无数据</h3>
        <p class="op-40 m-0 mt-4px text-14px">请上传 BTC 课程流转数据 (.xlsx) 文件开始分析</p>
        <NUpload
          :show-file-list="false"
          accept=".xlsx,.xls"
          :custom-request="handleUploadRequest"
          class="mt-20px"
        >
          <NButton type="primary" size="large" strong>
            <template #icon><span class="i-mdi-upload text-16px" /></template>
            上传数据文件
          </NButton>
        </NUpload>
      </div>
    </div>

    <!-- ═══ 透视分析模式 ═══ -->
    <template v-else-if="activeMode === 'pivot'">
      <!-- 概览卡片 -->
      <div class="stat-grid">
        <div class="stat-card" v-for="(stat, idx) in statCards" :key="idx" :class="stat.accent ? 'accent' : ''">
          <div class="stat-card-inner">
            <div class="stat-icon-wrap" :style="{ background: stat.iconBg }">
              <span class="text-20px">{{ stat.icon }}</span>
            </div>
            <div class="stat-body">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 紧凑控制栏 -->
      <NCard size="small" :bordered="true" class="toolbar-card mt-20px">
        <div class="flex items-start gap-16px flex-wrap">
          <div class="flex items-center gap-8px shrink-0">
            <span class="tbar-label">行维度</span>
            <NSelect
              v-model:value="rowDim"
              :options="dimOptions"
              size="small"
              class="w-130px"
            />
          </div>
          <NDivider vertical class="h-28px!" />
          <div class="flex items-center gap-8px shrink-0">
            <span class="tbar-label">期次</span>
            <div class="flex gap-4px flex-wrap max-w-520px">
              <NButton
                size="tiny"
                :type="periodFilter.length === 0 ? 'primary' : 'default'"
                :ghost="periodFilter.length !== 0"
                round
                @click="periodFilter = []"
              >全部</NButton>
              <NButton
                v-for="p in availablePeriods"
                :key="p"
                size="tiny"
                :type="periodFilter.includes(p) ? 'primary' : 'default'"
                :ghost="!periodFilter.includes(p)"
                round
                @click="togglePeriod(p)"
              >{{ shortPeriod(p) }}</NButton>
            </div>
          </div>
          <NDivider vertical class="h-28px!" />
          <div class="flex items-center gap-8px shrink-0">
            <span class="tbar-label">指标</span>
            <div class="flex gap-4px flex-wrap">
              <NButton
                v-for="(m, k) in rateMetrics"
                :key="k"
                size="tiny"
                :type="selectedMetrics.includes(k) ? 'primary' : 'default'"
                :ghost="!selectedMetrics.includes(k)"
                round
                @click="toggleMetric(k)"
              >{{ m.label }}</NButton>
            </div>
          </div>
        </div>
      </NCard>

      <!-- 图表 + 表格 -->
      <div class="flex flex-col gap-16px mt-20px">
        <NCard size="small" title="📈 透视图表" :segmented="{ content: true }">
          <div ref="chartRef" class="w-full h-320px" />
        </NCard>
        <NCard size="small" title="📋 透视表格" :segmented="{ content: true }" :content-style="{ padding: 0 }">
          <div class="overflow-x-auto">
            <table class="btc-table">
              <thead>
                <tr>
                  <th class="sticky-col">{{ DIMENSIONS[rowDim]?.label }}</th>
                  <th>n(首课到课)</th>
                  <th v-for="mk in selectedMetrics" :key="mk">{{ METRICS[mk]?.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in pivotResult"
                  :key="row._key"
                  @mouseenter="highlightChart(row._key)"
                  @mouseleave="highlightChart(null)"
                >
                  <td class="sticky-col dim-cell">{{ row._key }}</td>
                  <td class="num-cell n-cell">{{ fmtNum(row._n) }}</td>
                  <td
                    v-for="mk in selectedMetrics"
                    :key="mk"
                    class="num-cell"
                    :style="cellStyle(row[mk], mk, row._n)"
                  >
                    {{ METRICS[mk]?.type === 'rate' ? fmtRate(row[mk]) : fmtNum(row[mk]) }}
                    <NTag
                      v-if="METRICS[mk]?.type === 'rate' && row._n < 30"
                      type="warning"
                      size="tiny"
                      :bordered="false"
                      round
                      class="ml-4px"
                    >⚠</NTag>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td class="sticky-col">合计</td>
                  <td class="num-cell n-cell">{{ fmtNum(totalEntry._n) }}</td>
                  <td v-for="mk in selectedMetrics" :key="mk" class="num-cell">
                    {{ METRICS[mk]?.type === 'rate' ? fmtRate(totalEntry[mk]) : fmtNum(totalEntry[mk]) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </NCard>
      </div>
    </template>

    <!-- ═══ 课程对比模式 ═══ -->
    <template v-else-if="activeMode === 'compare'">
      <div class="flex gap-20px min-h-500px">
        <!-- 左侧固定侧边栏 -->
        <NCard size="small" class="w-250px shrink-0 sticky top-16px self-start max-h-[calc(100vh-120px)] overflow-y-auto sidebar-card">
          <div class="flex flex-col gap-14px">
            <div class="flex flex-col gap-6px">
              <span class="tbar-label">对比 A</span>
              <NSelect v-model:value="compareA" :options="courseOptions" size="small" placeholder="选择课程…" />
            </div>
            <div class="flex flex-col gap-6px">
              <span class="tbar-label">对比 B</span>
              <NSelect v-model:value="compareB" :options="courseOptions" size="small" placeholder="选择课程…" />
            </div>
            <NDivider class="my-2px!" />
            <div class="flex flex-col gap-6px">
              <span class="tbar-label">每期门槛</span>
              <NSelect v-model:value="compareThreshold" :options="thresholdOptions" size="small" />
            </div>
            <!-- 期次选择 -->
            <template v-if="compareA && compareB">
              <NDivider class="my-2px!" />
              <div class="flex flex-col gap-6px">
                <span class="tbar-label">A 期次 <span class="op-40 text-10px">({{ manualPeriodsA.length }}选)</span></span>
                <div class="flex gap-4px flex-wrap">
                  <NButton
                    v-for="p in comparePeriodsA"
                    :key="p.period"
                    size="tiny"
                    :type="manualPeriodsA.includes(p.period) ? 'primary' : 'default'"
                    :ghost="!manualPeriodsA.includes(p.period)"
                    round
                    @click="toggleManualPeriod('A', p.period); compareUserTouched = true"
                  >{{ shortPeriod(p.period) }} <span class="op-40 text-10px ml-2px">({{ p.n }})</span></NButton>
                </div>
              </div>
              <div class="flex flex-col gap-6px">
                <span class="tbar-label">B 期次 <span class="op-40 text-10px">({{ manualPeriodsB.length }}选)</span></span>
                <div class="flex gap-4px flex-wrap">
                  <NButton
                    v-for="p in comparePeriodsB"
                    :key="p.period"
                    size="tiny"
                    :type="manualPeriodsB.includes(p.period) ? 'primary' : 'default'"
                    :ghost="!manualPeriodsB.includes(p.period)"
                    round
                    @click="toggleManualPeriod('B', p.period); compareUserTouched = true"
                  >{{ shortPeriod(p.period) }} <span class="op-40 text-10px ml-2px">({{ p.n }})</span></NButton>
                </div>
              </div>
            </template>
          </div>
        </NCard>
        <!-- 右侧内容区 -->
        <div class="flex-1 min-w-0">
          <div v-if="compareResult">
            <NAlert :type="compareResult.level === 'good' ? 'success' : 'warning'" class="mb-16px">
              {{ compareResult.matchInfo }}
            </NAlert>
            <div class="flex gap-16px flex-wrap">
              <NCard size="small" :content-style="{ padding: 0 }" class="flex-1 min-w-400px" title="📋 指标对比">
                <table class="btc-table compare-table">
                  <thead>
                    <tr>
                      <th class="sticky-col">指标</th>
                      <th>{{ compareA }}</th>
                      <th>{{ compareB }}</th>
                      <th>差异(B-A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in compareResult.rows" :key="row.label" :class="{ 'separator-row': row.separator }">
                      <td class="sticky-col dim-cell">{{ row.label }}</td>
                      <td class="num-cell">{{ row.valA }}</td>
                      <td class="num-cell">{{ row.valB }}</td>
                      <td class="num-cell" :style="diffStyle(row.diff)">{{ row.diffStr }}</td>
                    </tr>
                  </tbody>
                </table>
              </NCard>
              <NCard size="small" class="w-380px shrink-0" title="📊 差异可视化">
                <div ref="compareChartRef" class="w-full h-400px" />
              </NCard>
            </div>
          </div>
          <NEmpty v-else description="请在左侧选择两个不同的课程进行对比" class="min-h-300px flex-center" />
        </div>
      </div>
    </template>

    <!-- ═══ 完课漏斗模式 ═══ -->
    <template v-else-if="activeMode === 'funnel'">
      <div class="flex gap-20px min-h-500px">
        <NCard size="small" class="w-210px shrink-0 sticky top-16px self-start sidebar-card">
          <div class="flex flex-col gap-14px">
            <div class="flex flex-col gap-6px">
              <span class="tbar-label">课程</span>
              <NSelect v-model:value="funnelCourse" :options="courseOptionsWithAll" size="small" />
            </div>
            <NDivider class="my-2px!" />
            <div class="flex flex-col gap-6px">
              <span class="tbar-label">渠道拆分</span>
              <NSelect v-model:value="funnelChannel" :options="channelOptionsWithAll" size="small" />
            </div>
          </div>
        </NCard>
        <NCard size="small" class="flex-1 min-h-480px" title="🔻 完课漏斗">
          <div ref="funnelChartRef" class="w-full h-440px" />
        </NCard>
      </div>
    </template>

    <!-- ═══ 期次趋势模式 ═══ -->
    <template v-else-if="activeMode === 'trend'">
      <NCard size="small" class="toolbar-card">
        <div class="flex items-start gap-16px flex-wrap">
          <div class="flex items-center gap-8px">
            <span class="tbar-label">课程</span>
            <NSelect v-model:value="trendCourse" :options="courseOptionsWithAll" size="small" class="w-170px" />
          </div>
          <NDivider vertical class="h-28px!" />
          <div class="flex items-center gap-8px">
            <span class="tbar-label">指标</span>
            <NSelect v-model:value="trendMetric" :options="rateMetricOptions" size="small" class="w-170px" />
          </div>
          <NDivider vertical class="h-28px!" />
          <div class="flex items-center gap-8px">
            <span class="tbar-label">拆分维度</span>
            <NSelect v-model:value="trendSplit" :options="splitOptions" size="small" class="w-130px" />
          </div>
        </div>
      </NCard>
      <NCard size="small" class="min-h-480px mt-20px" title="📈 趋势走势">
        <div ref="trendChartRef" class="w-full h-440px" />
      </NCard>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue';
import { useMessage } from 'naive-ui';
import * as echarts from 'echarts';
import { useBtcData, METRICS, DIMENSIONS, pivot, totalRow, fmtRate, fmtNum } from './composables/use-btc-data';

const { rawData, meta, loading, hasData, loadData, loadMeta, uploadFile } = useBtcData();
const message = useMessage();

// ═══ 读取主题色（用于 ECharts） ═══
function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const primary = style.getPropertyValue('--primary-color')?.trim();
  if (primary) {
    const parts = primary.split(' ').map(Number);
    if (parts.length === 3) {
      return `#${parts.map(p => p.toString(16).padStart(2, '0')).join('')}`;
    }
  }
  return '#0f9b8e';
}

// ═══ 通用状态 ═══
const activeMode = ref('pivot');
const excludeTest = ref(true);

const modes = [
  { key: 'pivot', label: '透视分析', icon: '📊' },
  { key: 'compare', label: '课程对比', icon: '⚖️' },
  { key: 'funnel', label: '完课漏斗', icon: '🔻' },
  { key: 'trend', label: '期次趋势', icon: '📈' },
];

// ═══ 透视模式状态 ═══
const rowDim = ref('course_name');
const periodFilter = ref([]);
const selectedMetrics = ref(['cr_1', 'funnel_rate', 'l1_rate', 'ret_2', 'ret_3', 'ret_4']);
const chartRef = ref(null);
let chartInstance = null;

// ═══ 对比模式状态 ═══
const compareA = ref('');
const compareB = ref('');
const compareThreshold = ref(200);
const compareUserTouched = ref(false);
const manualPeriodsA = ref([]);
const manualPeriodsB = ref([]);
const compareChartRef = ref(null);
let compareChartInstance = null;

// ═══ 漏斗模式状态 ═══
const funnelCourse = ref('');
const funnelChannel = ref('');
const funnelChartRef = ref(null);
let funnelChartInstance = null;

// ═══ 趋势模式状态 ═══
const trendCourse = ref('');
const trendMetric = ref('funnel_rate');
const trendSplit = ref('');
const trendChartRef = ref(null);
let trendChartInstance = null;

// ═══ 概览 stat 卡片数据 ═══
const statCards = computed(() => [
  { icon: '📝', label: '数据行', value: filteredData.value.length.toLocaleString(), iconBg: 'rgba(99,102,241,0.12)' },
  { icon: '🎫', label: '总领号', value: fmtNum(totalSums.value.reg_count), iconBg: 'rgba(14,165,233,0.12)' },
  { icon: '🎓', label: '首课到课', value: fmtNum(totalSums.value.attend_1), iconBg: 'rgba(16,185,129,0.12)' },
  { icon: '✅', label: '完课率', value: fmtRate(totalSums.value.funnel_rate), iconBg: 'rgba(245,158,11,0.12)', accent: true },
  { icon: '🏆', label: 'L1领取率', value: fmtRate(totalSums.value.l1_rate), iconBg: 'rgba(139,92,246,0.12)', accent: true },
]);

// ═══ NSelect 选项 ═══
const dimOptions = computed(() =>
  Object.entries(DIMENSIONS).map(([k, d]) => ({ label: d.label, value: k }))
);

const courseOptions = computed(() =>
  courseList.value.map(c => ({ label: c, value: c }))
);

const courseOptionsWithAll = computed(() => [
  { label: '全部课程', value: '' },
  ...courseList.value.map(c => ({ label: c, value: c }))
]);

const channelOptionsWithAll = computed(() => [
  { label: '不拆分', value: '' },
  ...channelList.value.map(c => ({ label: c, value: c }))
]);

const thresholdOptions = [
  { label: '≥50', value: 50 },
  { label: '≥100', value: 100 },
  { label: '≥200', value: 200 },
];

const rateMetricOptions = computed(() =>
  Object.entries(METRICS)
    .filter(([, v]) => v.type === 'rate')
    .map(([k, v]) => ({ label: v.label, value: k }))
);

const splitOptions = [
  { label: '不拆分', value: '' },
  { label: '渠道', value: 'channel' },
  { label: '设备', value: 'device' },
  { label: '年级', value: 'grade' },
  { label: '课程', value: 'course_name' },
];

// ═══ 计算属性 ═══
const rateMetrics = computed(() => {
  const result = {};
  for (const [k, v] of Object.entries(METRICS)) {
    if (v.type === 'rate') result[k] = v;
  }
  return result;
});

const availablePeriods = computed(() => {
  const set = new Set(rawData.value.map(r => r.period));
  return [...set].sort();
});

const courseList = computed(() => {
  const set = new Set(rawData.value.map(r => r.course_name));
  return [...set].filter(Boolean).sort();
});

const channelList = computed(() => {
  const set = new Set(rawData.value.map(r => r.channel));
  return [...set].filter(Boolean).sort();
});

const comparePeriodsA = computed(() => {
  if (!compareA.value) return [];
  const data = rawData.value.filter(r => r.course_name === compareA.value);
  const byP = new Map();
  for (const r of data) { byP.set(r.period, (byP.get(r.period) || 0) + (r.attend_1 || 0)); }
  return [...byP].map(([period, n]) => ({ period, n })).sort((a, b) => a.period.localeCompare(b.period));
});

const comparePeriodsB = computed(() => {
  if (!compareB.value) return [];
  const data = rawData.value.filter(r => r.course_name === compareB.value);
  const byP = new Map();
  for (const r of data) { byP.set(r.period, (byP.get(r.period) || 0) + (r.attend_1 || 0)); }
  return [...byP].map(([period, n]) => ({ period, n })).sort((a, b) => a.period.localeCompare(b.period));
});

const filteredData = computed(() => {
  let data = rawData.value;
  if (periodFilter.value.length > 0) {
    data = data.filter(r => periodFilter.value.includes(r.period));
  }
  return data;
});

const pivotResult = computed(() => {
  return pivot(filteredData.value, rowDim.value, selectedMetrics.value)
    .sort((a, b) => (b._n || 0) - (a._n || 0));
});

const totalEntry = computed(() => totalRow(filteredData.value, selectedMetrics.value));

const totalSums = computed(() => {
  const t = totalEntry.value;
  return { reg_count: t.reg_count || 0, attend_1: t.attend_1 || 0, funnel_rate: t.funnel_rate, l1_rate: t.l1_rate };
});

// ═══ 课程对比逻辑 ═══
function toggleManualPeriod(side, period) {
  const arr = side === 'A' ? manualPeriodsA : manualPeriodsB;
  const idx = arr.value.indexOf(period);
  if (idx >= 0) arr.value.splice(idx, 1);
  else arr.value.push(period);
}

const compareResult = computed(() => {
  if (!compareA.value || !compareB.value || compareA.value === compareB.value) return null;
  const dataA = rawData.value.filter(r => r.course_name === compareA.value);
  const dataB = rawData.value.filter(r => r.course_name === compareB.value);

  const pListA = manualPeriodsA.value.length > 0 ? manualPeriodsA.value : [...new Set(dataA.map(r => r.period))];
  const pListB = manualPeriodsB.value.length > 0 ? manualPeriodsB.value : [...new Set(dataB.map(r => r.period))];

  const useRowsA = dataA.filter(r => pListA.includes(r.period));
  const useRowsB = dataB.filter(r => pListB.includes(r.period));
  const nA = useRowsA.reduce((s, r) => s + (r.attend_1||0), 0);
  const nB = useRowsB.reduce((s, r) => s + (r.attend_1||0), 0);

  const isCommon = pListA.length === pListB.length && pListA.every(p => pListB.includes(p));
  let matchInfo, level;
  if (isCommon) {
    matchInfo = `✅ 共同期次: ${pListA.length}期, A: n=${nA.toLocaleString()}, B: n=${nB.toLocaleString()}`;
    level = 'good';
  } else {
    matchInfo = `⚡ 不同期次: A=${pListA.length}期(n=${nA.toLocaleString()}), B=${pListB.length}期(n=${nB.toLocaleString()}) — 仅供参考`;
    level = 'warn';
  }
  if (compareUserTouched.value) matchInfo += ' (已手动微调)';

  const allRateKeys = Object.keys(rateMetrics.value);
  const sumsA = totalRow(useRowsA, allRateKeys);
  const sumsB = totalRow(useRowsB, allRateKeys);

  const rows = [
    mkCompRow('首课到课', sumsA.attend_1, sumsB.attend_1, 'count'),
    mkCompRow('领号人数', sumsA.reg_count, sumsB.reg_count, 'count'),
    { label: '─ 完课率 ─', valA: '', valB: '', diff: null, diffStr: '', separator: true },
    ...['cr_1','cr_2','cr_3','cr_4','cr_5','funnel_rate'].map(k => mkCompRow(METRICS[k].label, sumsA[k], sumsB[k], 'rate')),
    { label: '─ 留存率 ─', valA: '', valB: '', diff: null, diffStr: '', separator: true },
    ...['ret_2','ret_3','ret_4','ret_5'].map(k => mkCompRow(METRICS[k].label, sumsA[k], sumsB[k], 'rate')),
    { label: '─ 转化率 ─', valA: '', valB: '', diff: null, diffStr: '', separator: true },
    mkCompRow('L1领取率', sumsA.l1_rate, sumsB.l1_rate, 'rate'),
    mkCompRow('首课到课转化率', sumsA.to_course_cvr, sumsB.to_course_cvr, 'rate'),
  ];

  return { matchInfo, level, rows };
});

function mkCompRow(label, a, b, type) {
  const isRate = type === 'rate';
  const valA = isRate ? fmtRate(a) : fmtNum(a);
  const valB = isRate ? fmtRate(b) : fmtNum(b);
  let diff = null, diffStr = '-';
  if (a != null && b != null && isRate) {
    diff = (b - a) * 100;
    diffStr = (diff > 0 ? '+' : '') + diff.toFixed(1) + 'pp';
  } else if (a != null && b != null && !isRate) {
    diff = b - a;
    diffStr = (diff > 0 ? '+' : '') + diff.toLocaleString();
  }
  return { label, valA, valB, diff, diffStr };
}

function diffStyle(diff) {
  if (diff === null) return {};
  if (diff > 3) return { color: 'var(--success-color, #16a34a)', fontWeight: '600' };
  if (diff < -3) return { color: 'var(--error-color, #dc2626)', fontWeight: '600' };
  return { opacity: 0.6 };
}

// ═══ 图表 ═══
function renderChart() {
  if (!chartRef.value || pivotResult.value.length === 0) return;
  if (!chartInstance) chartInstance = echarts.init(chartRef.value);

  const primary = getThemeColors();
  const data = pivotResult.value.slice(0, 15);
  const categories = data.map(r => r._key);
  const mainMetric = selectedMetrics.value.find(k => METRICS[k]?.type === 'rate') || 'funnel_rate';
  const secondMetric = selectedMetrics.value.find(k => k !== mainMetric && METRICS[k]?.type === 'rate');

  const series = [
    {
      name: METRICS[mainMetric]?.label,
      type: 'bar',
      data: data.map(r => r[mainMetric] != null ? +(r[mainMetric] * 100).toFixed(1) : 0),
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: primary + 'cc' },
          { offset: 1, color: primary }
        ])
      },
      barMaxWidth: 36,
    }
  ];
  if (secondMetric) {
    series.push({
      name: METRICS[secondMetric]?.label,
      type: 'line',
      yAxisIndex: 0,
      data: data.map(r => r[secondMetric] != null ? +(r[secondMetric] * 100).toFixed(1) : 0),
      lineStyle: { color: '#f97316', width: 2.5 },
      itemStyle: { color: '#f97316' },
      symbol: 'circle',
      symbolSize: 7,
      smooth: true,
    });
  }
  if (mainMetric !== 'l1_rate' && secondMetric !== 'l1_rate') {
    series.push({
      name: 'L1领取率',
      type: 'line',
      yAxisIndex: 0,
      data: data.map(r => r.l1_rate != null ? +(r.l1_rate * 100).toFixed(1) : 0),
      lineStyle: { color: '#8b5cf6', width: 2, type: 'dashed' },
      itemStyle: { color: '#8b5cf6' },
      symbol: 'diamond', symbolSize: 6,
      smooth: true,
    });
  }
  series.push({
    name: '领号人数',
    type: 'bar',
    yAxisIndex: 1,
    data: data.map(r => r.reg_count || 0),
    itemStyle: { color: 'rgba(148,163,184,0.18)', borderRadius: [4, 4, 0, 0] },
    barMaxWidth: 18,
  });

  chartInstance.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#e2e8f0', textStyle: { color: '#334155', fontSize: 12 } },
    legend: { top: 4, textStyle: { fontSize: 12 } },
    grid: { left: 50, right: 60, top: 44, bottom: 56 },
    xAxis: { type: 'category', data: categories, axisLabel: { rotate: 30, fontSize: 11 }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
    yAxis: [
      { type: 'value', axisLabel: { formatter: '{value}%', fontSize: 11 }, max: 100, splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
      { type: 'value', axisLabel: { formatter: (v) => v >= 1000 ? (v/1000).toFixed(0)+'k' : v, fontSize: 11 }, splitLine: { show: false } },
    ],
    series,
  }, true);
}

function renderFunnelChart() {
  if (!funnelChartRef.value) return;
  if (!funnelChartInstance) funnelChartInstance = echarts.init(funnelChartRef.value);

  let data = rawData.value;
  if (funnelCourse.value) data = data.filter(r => r.course_name === funnelCourse.value);
  if (funnelChannel.value) data = data.filter(r => r.channel === funnelChannel.value);

  const sums = totalRow(data, []);
  const steps = [
    { name: '领号', value: sums.reg_count },
    { name: 'BTC1课到课', value: sums.attend_1 },
    { name: 'BTC2课到课', value: sums.attend_2 },
    { name: 'BTC3课到课', value: sums.attend_3 },
    { name: 'BTC4课到课', value: sums.attend_4 },
  ];
  if (sums.attend_5 > 0) steps.push({ name: 'BTC5课到课', value: sums.attend_5 });
  steps.push({ name: 'L1领取', value: sums.l1_count });

  const maxVal = steps[0].value || 1;
  const primary = getThemeColors();
  const colors = [primary, '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#ef4444'];

  funnelChartInstance.setOption({
    tooltip: { trigger: 'item', formatter: (p) => `${p.name}: ${p.value.toLocaleString()} (${(p.value/maxVal*100).toFixed(1)}%)` },
    series: [{
      type: 'funnel',
      left: 60, right: 60, top: 40, bottom: 40,
      minSize: '15%', maxSize: '100%', sort: 'none', gap: 6,
      label: { show: true, position: 'inside', formatter: (p) => `${p.name}\n${p.value.toLocaleString()}`, fontSize: 13, fontWeight: 500 },
      data: steps.map((s, i) => ({ ...s, itemStyle: { color: colors[i % colors.length], borderRadius: 6 } })),
    }],
  }, true);
}

function renderCompareChart() {
  if (!compareChartRef.value || !compareResult.value) return;
  if (!compareChartInstance) compareChartInstance = echarts.init(compareChartRef.value);

  const rows = compareResult.value.rows.filter(r => !r.separator && r.diff !== null && typeof r.diff === 'number');
  const labels = rows.map(r => r.label);
  const diffs = rows.map(r => r.diff);

  compareChartInstance.setOption({
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}: ${p[0].value > 0 ? '+' : ''}${p[0].value.toFixed(1)}pp` },
    grid: { left: 130, right: 50, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}pp', fontSize: 11 }, splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
    yAxis: { type: 'category', data: labels, axisLabel: { fontSize: 11 }, inverse: true },
    series: [{
      type: 'bar',
      data: diffs.map(d => ({
        value: +d.toFixed(1),
        itemStyle: {
          color: d >= 0 ? '#16a34a' : '#dc2626',
          borderRadius: d >= 0 ? [0, 6, 6, 0] : [6, 0, 0, 6]
        }
      })),
      barMaxWidth: 22,
      label: { show: true, position: 'right', formatter: (p) => (p.value > 0 ? '+' : '') + p.value + 'pp', fontSize: 11, color: '#64748b' },
    }],
  }, true);
}

function renderTrendChart() {
  if (!trendChartRef.value) return;
  if (!trendChartInstance) trendChartInstance = echarts.init(trendChartRef.value);

  const primary = getThemeColors();
  let data = rawData.value;
  if (trendCourse.value) data = data.filter(r => r.course_name === trendCourse.value);

  const metricKey = trendMetric.value;
  const metricDef = METRICS[metricKey];
  const allPeriods = [...new Set(data.map(r => r.period))].sort();
  const periods = allPeriods.filter(p => {
    const pN = data.filter(r => r.period === p).reduce((s, r) => s + (r.attend_1 || 0), 0);
    return pN >= 10;
  });

  if (trendSplit.value) {
    const splitVals = [...new Set(data.map(r => r[trendSplit.value]))].filter(Boolean);
    const colors = [primary,'#f97316','#10b981','#8b5cf6','#ef4444','#14b8a6','#f59e0b','#ec4899'];
    const series = splitVals.map((sv, idx) => {
      const svData = data.filter(r => r[trendSplit.value] === sv);
      const values = periods.map(p => {
        const pData = svData.filter(r => r.period === p);
        const sums = totalRow(pData, [metricKey]);
        return sums[metricKey] != null ? +(sums[metricKey] * 100).toFixed(1) : null;
      });
      return {
        name: sv, type: 'line', data: values, connectNulls: true, smooth: true,
        lineStyle: { color: colors[idx % colors.length], width: 2.5 },
        itemStyle: { color: colors[idx % colors.length] },
        symbol: 'circle', symbolSize: 5,
      };
    });
    trendChartInstance.setOption({
      tooltip: { trigger: 'axis', formatter: (ps) => ps.map(p => `${p.seriesName}: ${p.value != null ? p.value + '%' : '-'}`).join('<br>') },
      legend: { top: 4, type: 'scroll', textStyle: { fontSize: 11 } },
      grid: { left: 50, right: 20, top: 50, bottom: 50 },
      xAxis: { type: 'category', data: periods.map(shortPeriod), axisLabel: { rotate: 30, fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { formatter: '{value}%', fontSize: 11 }, max: 100, splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
      series,
    }, true);
  } else {
    const values = periods.map(p => {
      const pData = data.filter(r => r.period === p);
      const sums = totalRow(pData, [metricKey]);
      return sums[metricKey] != null ? +(sums[metricKey] * 100).toFixed(1) : null;
    });
    const nValues = periods.map(p => data.filter(r => r.period === p).reduce((s, r) => s + (r.attend_1 || 0), 0));

    trendChartInstance.setOption({
      tooltip: { trigger: 'axis' },
      legend: { top: 4, textStyle: { fontSize: 12 } },
      grid: { left: 50, right: 50, top: 44, bottom: 50 },
      xAxis: { type: 'category', data: periods.map(shortPeriod), axisLabel: { rotate: 30, fontSize: 11 } },
      yAxis: [
        { type: 'value', axisLabel: { formatter: '{value}%', fontSize: 11 }, max: 100, splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
        { type: 'value', axisLabel: { formatter: (v) => v >= 1000 ? (v/1000).toFixed(0)+'k' : v, fontSize: 11 }, splitLine: { show: false } },
      ],
      series: [
        {
          name: metricDef?.label || metricKey,
          type: 'line', data: values, connectNulls: true, smooth: true,
          lineStyle: { color: primary, width: 3 },
          itemStyle: { color: primary },
          symbol: 'circle', symbolSize: 7,
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: primary + '30' }, { offset: 1, color: primary + '03' }]) },
        },
        {
          name: '样本量(首课到课)',
          type: 'bar', yAxisIndex: 1, data: nValues,
          itemStyle: { color: 'rgba(148,163,184,0.22)', borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 28,
        },
      ],
    }, true);
  }
}

function highlightChart(key) {
  if (!chartInstance) return;
  if (key) chartInstance.dispatchAction({ type: 'highlight', name: key });
  else chartInstance.dispatchAction({ type: 'downplay' });
}

// ═══ 工具函数 ═══
function shortPeriod(p) { return p.replace(/\d{4}年/, '').replace('期', ''); }

function togglePeriod(p) {
  const idx = periodFilter.value.indexOf(p);
  if (idx >= 0) periodFilter.value.splice(idx, 1);
  else periodFilter.value.push(p);
}

function toggleMetric(key) {
  const idx = selectedMetrics.value.indexOf(key);
  if (idx >= 0) selectedMetrics.value.splice(idx, 1);
  else selectedMetrics.value.push(key);
}

function cellStyle(val, metricKey, n) {
  const def = METRICS[metricKey];
  if (def?.type !== 'rate' || val === null || val === undefined) return {};
  if (n < 30) return { opacity: 0.4, fontStyle: 'italic' };
  const pct = val * 100;
  if (pct >= 80) return { color: 'var(--success-color, #16a34a)', fontWeight: '600' };
  if (pct >= 60) return { color: '#65a30d' };
  if (pct < 40) return { color: 'var(--error-color, #dc2626)', fontWeight: '600' };
  if (pct < 55) return { color: 'var(--warning-color, #ea580c)' };
  return {};
}

// ═══ 上传 ═══
async function handleUploadRequest({ file }) {
  try {
    const result = await uploadFile(file.file);
    message.success(result.message || '上传成功');
    await reload();
  } catch (err) {
    message.error(err.message || '上传失败');
  }
}

async function reload() {
  await Promise.all([loadData(excludeTest.value), loadMeta(excludeTest.value)]);
}

// ═══ 生命周期 ═══
onMounted(async () => {
  await reload();
  if (courseList.value.length >= 2) {
    compareA.value = courseList.value[0];
    compareB.value = courseList.value[1];
  }
});

watch([pivotResult, selectedMetrics], () => { nextTick(renderChart); }, { deep: true });
watch(activeMode, (m, oldM) => {
  if (oldM === 'pivot' && chartInstance) { chartInstance.dispose(); chartInstance = null; }
  if (oldM === 'funnel' && funnelChartInstance) { funnelChartInstance.dispose(); funnelChartInstance = null; }
  if (oldM === 'trend' && trendChartInstance) { trendChartInstance.dispose(); trendChartInstance = null; }
  if (oldM === 'compare' && compareChartInstance) { compareChartInstance.dispose(); compareChartInstance = null; }
  if (m === 'pivot') nextTick(renderChart);
  if (m === 'funnel') nextTick(renderFunnelChart);
  if (m === 'trend') nextTick(renderTrendChart);
  if (m === 'compare') nextTick(renderCompareChart);
});
watch(funnelCourse, () => nextTick(renderFunnelChart));
watch(funnelChannel, () => nextTick(renderFunnelChart));
watch([trendCourse, trendMetric, trendSplit], () => nextTick(renderTrendChart));
watch(compareResult, () => nextTick(renderCompareChart));

watch([compareA, compareB, compareThreshold], () => {
  compareUserTouched.value = false;
  if (!compareA.value || !compareB.value) return;
  const dataA = rawData.value.filter(r => r.course_name === compareA.value);
  const dataB = rawData.value.filter(r => r.course_name === compareB.value);
  const byPeriod = (rows) => {
    const m = new Map();
    for (const r of rows) { const p = r.period; if (!m.has(p)) m.set(p, []); m.get(p).push(r); }
    return m;
  };
  const pA = byPeriod(dataA);
  const pB = byPeriod(dataB);
  const allP = new Set([...pA.keys(), ...pB.keys()]);
  const matched = [];
  for (const p of allP) {
    const nA = (pA.get(p) || []).reduce((s, r) => s + (r.attend_1 || 0), 0);
    const nB = (pB.get(p) || []).reduce((s, r) => s + (r.attend_1 || 0), 0);
    if (nA >= compareThreshold.value && nB >= compareThreshold.value) matched.push(p);
  }
  if (matched.length >= 2) {
    manualPeriodsA.value = [...matched];
    manualPeriodsB.value = [...matched];
  } else {
    manualPeriodsA.value = [...pA].filter(([, rows]) => rows.reduce((s, r) => s + (r.attend_1||0), 0) >= compareThreshold.value).map(([p]) => p);
    manualPeriodsB.value = [...pB].filter(([, rows]) => rows.reduce((s, r) => s + (r.attend_1||0), 0) >= compareThreshold.value).map(([p]) => p);
  }
});

onBeforeUnmount(() => {
  chartInstance?.dispose();
  funnelChartInstance?.dispose();
  trendChartInstance?.dispose();
  compareChartInstance?.dispose();
});

const resizeHandler = () => { chartInstance?.resize(); funnelChartInstance?.resize(); trendChartInstance?.resize(); compareChartInstance?.resize(); };
onMounted(() => window.addEventListener('resize', resizeHandler));
onBeforeUnmount(() => window.removeEventListener('resize', resizeHandler));
</script>

<style scoped>
/* ═══ 标题区域 ═══ */
.header-icon {
  font-size: 22px;
}

.mode-tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: rgba(128, 128, 128, 0.05);
  border-radius: 10px;
}

/* ═══ 概览卡片网格 ═══ */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 900px) {
  .stat-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 600px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}

.stat-card {
  background: var(--n-color, #fff);
  border: 1px solid var(--n-border-color, #e8e8e8);
  border-radius: 10px;
  padding: 14px 16px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

.stat-card.accent {
  border-color: rgba(var(--primary-color), 0.3);
  background: linear-gradient(135deg, rgba(var(--primary-color), 0.04), rgba(var(--primary-color), 0.01));
}

.stat-card-inner {
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-body {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.stat-label {
  font-size: 11px;
  opacity: 0.45;
  margin-top: 2px;
  font-weight: 500;
  white-space: nowrap;
}

/* ═══ 工具栏 ═══ */
.tbar-label {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.45;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  white-space: nowrap;
}

.toolbar-card :deep(.n-card__content) {
  padding: 12px 16px !important;
}

/* ═══ 侧边栏 ═══ */
.sidebar-card :deep(.n-card__content) {
  padding: 16px !important;
}

/* ═══ 空状态 ═══ */
.empty-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  opacity: 0;
  animation: fadeUp 0.5s ease-out 0.1s forwards;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ═══ 表格 ═══ */
.btc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.btc-table th {
  position: sticky;
  top: 0;
  background: var(--n-color-modal, #f9fafb);
  padding: 10px 12px;
  text-align: right;
  font-weight: 600;
  border-bottom: 2px solid var(--n-border-color, #e5e7eb);
  white-space: nowrap;
  font-size: 12px;
  letter-spacing: 0.3px;
}

.btc-table th.sticky-col {
  text-align: left;
}

.btc-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--n-border-color, #f3f4f6);
}

.btc-table tbody tr {
  transition: background 0.15s;
}

.btc-table tbody tr:hover {
  background: rgba(var(--primary-color), 0.03);
}

.dim-cell {
  font-weight: 600;
  white-space: nowrap;
}

.num-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.n-cell {
  opacity: 0.45;
}

.total-row td {
  font-weight: 700;
  background: var(--n-color-modal, #f9fafb);
  border-top: 2px solid var(--n-border-color, #e5e7eb);
}

.separator-row td {
  background: var(--n-color-modal, #f9fafb) !important;
  font-size: 11px;
  opacity: 0.5 !important;
  font-weight: 600 !important;
  text-align: center !important;
  letter-spacing: 1px;
}
</style>
