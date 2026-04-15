<script setup lang="ts">
/**
 * 时间戳转换工具
 *
 * 功能：
 * - Unix 时间戳 ↔ 可读日期 双向转换
 * - 实时当前时间戳显示
 * - 支持秒级/毫秒级时间戳
 * - 批量转换
 * - 多种日期格式输出
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePageTracker } from '@/hooks/common/use-tracker';

usePageTracker('timestamp-converter');

const { t } = useI18n();

// ──── 实时时钟 ────
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 100);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const currentTimestamp = computed(() => Math.floor(now.value / 1000));
const currentTimestampMs = computed(() => now.value);
const currentDateStr = computed(() => {
  const d = new Date(now.value);
  return d.toLocaleString('zh-CN', { hour12: false });
});
const currentISOStr = computed(() => new Date(now.value).toISOString());

// ──── 时间戳 → 日期 ────
const inputTimestamp = ref('');
const tsUnit = ref<'s' | 'ms'>('s');

const parsedDate = computed(() => {
  const val = inputTimestamp.value.trim();
  if (!val) return null;
  const num = Number(val);
  if (Number.isNaN(num)) return null;
  const ms = tsUnit.value === 's' ? num * 1000 : num;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d;
});

const dateOutputFormats = computed(() => {
  if (!parsedDate.value) return [];
  const d = parsedDate.value;
  return [
    { label: 'ISO 8601', value: d.toISOString() },
    { label: t('page.timestampConverter.localTime'), value: d.toLocaleString('zh-CN', { hour12: false }) },
    { label: 'UTC', value: d.toUTCString() },
    {
      label: 'YYYY-MM-DD HH:mm:ss',
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    },
    {
      label: t('page.timestampConverter.relativeTime'),
      value: getRelativeTime(d)
    }
  ];
});

// ──── 日期 → 时间戳 ────
const inputDateStr = ref('');

const parsedTimestamp = computed(() => {
  const val = inputDateStr.value.trim();
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return {
    seconds: Math.floor(d.getTime() / 1000),
    milliseconds: d.getTime()
  };
});

// ──── 批量转换 ────
const batchInput = ref('');
const batchUnit = ref<'s' | 'ms'>('s');

const batchResults = computed(() => {
  const lines = batchInput.value.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const num = Number(line.trim());
    if (Number.isNaN(num)) return { input: line.trim(), output: t('page.timestampConverter.invalidInput'), error: true };
    const ms = batchUnit.value === 's' ? num * 1000 : num;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return { input: line.trim(), output: t('page.timestampConverter.invalidInput'), error: true };
    return {
      input: line.trim(),
      output: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`,
      error: false
    };
  });
});

// ──── 辅助函数 ────
function getRelativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const isFuture = diff < 0;
  const suffix = isFuture ? t('page.timestampConverter.later') : t('page.timestampConverter.ago');

  if (abs < 60_000) return `${Math.floor(abs / 1000)} ${t('page.timestampConverter.seconds')}${suffix}`;
  if (abs < 3_600_000) return `${Math.floor(abs / 60_000)} ${t('page.timestampConverter.minutes')}${suffix}`;
  if (abs < 86_400_000) return `${Math.floor(abs / 3_600_000)} ${t('page.timestampConverter.hours')}${suffix}`;
  if (abs < 2_592_000_000) return `${Math.floor(abs / 86_400_000)} ${t('page.timestampConverter.days')}${suffix}`;
  return `${Math.floor(abs / 2_592_000_000)} ${t('page.timestampConverter.months')}${suffix}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(String(text));
  window.$message?.success(t('page.timestampConverter.copied'));
}

function fillCurrentTimestamp() {
  inputTimestamp.value = String(currentTimestamp.value);
  tsUnit.value = 's';
}

function fillCurrentDate() {
  const d = new Date();
  inputDateStr.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

const unitOptions = [
  { label: '秒 (s)', value: 's' },
  { label: '毫秒 (ms)', value: 'ms' }
];
</script>

<template>
  <div class="timestamp-converter">
    <!-- 实时时钟卡片 -->
    <NCard :bordered="false" class="clock-card" size="small">
      <div class="clock-display">
        <div class="clock-item">
          <span class="clock-label">{{ t('page.timestampConverter.currentTimestamp') }}</span>
          <div class="clock-value-row">
            <span class="clock-value mono">{{ currentTimestamp }}</span>
            <NTag size="tiny" type="info">s</NTag>
            <NButton quaternary size="tiny" @click="copyToClipboard(String(currentTimestamp))">
              <template #icon><span class="icon mdi mdi-content-copy" /></template>
            </NButton>
          </div>
        </div>
        <NDivider vertical />
        <div class="clock-item">
          <span class="clock-label">{{ t('page.timestampConverter.currentTimestampMs') }}</span>
          <div class="clock-value-row">
            <span class="clock-value mono">{{ currentTimestampMs }}</span>
            <NTag size="tiny" type="warning">ms</NTag>
            <NButton quaternary size="tiny" @click="copyToClipboard(String(currentTimestampMs))">
              <template #icon><span class="icon mdi mdi-content-copy" /></template>
            </NButton>
          </div>
        </div>
        <NDivider vertical />
        <div class="clock-item">
          <span class="clock-label">{{ t('page.timestampConverter.currentDate') }}</span>
          <div class="clock-value-row">
            <span class="clock-value">{{ currentDateStr }}</span>
            <NButton quaternary size="tiny" @click="copyToClipboard(currentDateStr)">
              <template #icon><span class="icon mdi mdi-content-copy" /></template>
            </NButton>
          </div>
        </div>
        <NDivider vertical />
        <div class="clock-item">
          <span class="clock-label">ISO 8601</span>
          <div class="clock-value-row">
            <span class="clock-value mono iso-value">{{ currentISOStr }}</span>
            <NButton quaternary size="tiny" @click="copyToClipboard(currentISOStr)">
              <template #icon><span class="icon mdi mdi-content-copy" /></template>
            </NButton>
          </div>
        </div>
      </div>
    </NCard>

    <div class="main-layout">
      <!-- 时间戳 → 日期 -->
      <NCard :bordered="false" class="card-wrapper" size="small">
        <template #header>
          <div class="panel-header">
            <span class="icon mdi mdi-clock-outline header-icon" />
            <span>{{ t('page.timestampConverter.tsToDate') }}</span>
          </div>
        </template>
        <div class="converter-section">
          <div class="input-row">
            <NInput
              v-model:value="inputTimestamp"
              :placeholder="t('page.timestampConverter.enterTimestamp')"
              class="flex-1"
              clearable
            />
            <NSelect v-model:value="tsUnit" :options="unitOptions" class="unit-select" size="medium" />
            <NButton type="primary" ghost size="small" @click="fillCurrentTimestamp">
              {{ t('page.timestampConverter.now') }}
            </NButton>
          </div>

          <NAlert v-if="parsedDate" type="success" :show-icon="false" class="result-alert">
            <div class="result-list">
              <div v-for="fmt in dateOutputFormats" :key="fmt.label" class="result-item">
                <span class="result-label">{{ fmt.label }}</span>
                <div class="result-value-row">
                  <span class="result-value mono">{{ fmt.value }}</span>
                  <NButton quaternary size="tiny" @click="copyToClipboard(fmt.value)">
                    <template #icon><span class="icon mdi mdi-content-copy" /></template>
                  </NButton>
                </div>
              </div>
            </div>
          </NAlert>
          <NAlert v-else-if="inputTimestamp.trim()" type="warning" :show-icon="true">
            {{ t('page.timestampConverter.invalidInput') }}
          </NAlert>
        </div>
      </NCard>

      <!-- 日期 → 时间戳 -->
      <NCard :bordered="false" class="card-wrapper" size="small">
        <template #header>
          <div class="panel-header">
            <span class="icon mdi mdi-calendar-clock header-icon" />
            <span>{{ t('page.timestampConverter.dateToTs') }}</span>
          </div>
        </template>
        <div class="converter-section">
          <div class="input-row">
            <NInput
              v-model:value="inputDateStr"
              :placeholder="t('page.timestampConverter.enterDate')"
              class="flex-1"
              clearable
            />
            <NButton type="primary" ghost size="small" @click="fillCurrentDate">
              {{ t('page.timestampConverter.now') }}
            </NButton>
          </div>
          <p class="hint">{{ t('page.timestampConverter.dateHint') }}</p>

          <NAlert v-if="parsedTimestamp" type="success" :show-icon="false" class="result-alert">
            <div class="result-list">
              <div class="result-item">
                <span class="result-label">{{ t('page.timestampConverter.timestampSeconds') }}</span>
                <div class="result-value-row">
                  <span class="result-value mono">{{ parsedTimestamp.seconds }}</span>
                  <NButton quaternary size="tiny" @click="copyToClipboard(String(parsedTimestamp.seconds))">
                    <template #icon><span class="icon mdi mdi-content-copy" /></template>
                  </NButton>
                </div>
              </div>
              <div class="result-item">
                <span class="result-label">{{ t('page.timestampConverter.timestampMs') }}</span>
                <div class="result-value-row">
                  <span class="result-value mono">{{ parsedTimestamp.milliseconds }}</span>
                  <NButton quaternary size="tiny" @click="copyToClipboard(String(parsedTimestamp.milliseconds))">
                    <template #icon><span class="icon mdi mdi-content-copy" /></template>
                  </NButton>
                </div>
              </div>
            </div>
          </NAlert>
          <NAlert v-else-if="inputDateStr.trim()" type="warning" :show-icon="true">
            {{ t('page.timestampConverter.invalidInput') }}
          </NAlert>
        </div>
      </NCard>

      <!-- 批量转换 -->
      <NCard :bordered="false" class="card-wrapper batch-card" size="small">
        <template #header>
          <div class="panel-header">
            <span class="icon mdi mdi-format-list-numbered header-icon" />
            <span>{{ t('page.timestampConverter.batchConvert') }}</span>
          </div>
        </template>
        <div class="converter-section">
          <div class="input-row">
            <NSelect v-model:value="batchUnit" :options="unitOptions" class="unit-select" size="medium" />
            <span class="hint">{{ t('page.timestampConverter.batchHint') }}</span>
          </div>
          <NInput
            v-model:value="batchInput"
            type="textarea"
            :placeholder="t('page.timestampConverter.batchPlaceholder')"
            :rows="4"
          />
          <div v-if="batchResults.length > 0" class="batch-results">
            <div v-for="(r, i) in batchResults" :key="i" class="batch-result-row" :class="{ error: r.error }">
              <span class="mono batch-input">{{ r.input }}</span>
              <span class="batch-arrow">→</span>
              <span class="mono batch-output">{{ r.output }}</span>
              <NButton v-if="!r.error" quaternary size="tiny" @click="copyToClipboard(r.output)">
                <template #icon><span class="icon mdi mdi-content-copy" /></template>
              </NButton>
            </div>
          </div>
        </div>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.timestamp-converter {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── 实时时钟 ── */
.clock-card {
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08));
}

.clock-display {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.clock-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.clock-label {
  font-size: 12px;
  opacity: 0.6;
  font-weight: 500;
}

.clock-value-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.clock-value {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.iso-value {
  font-size: 13px;
}

.mono {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}

/* ── 主要布局 ── */
.main-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  min-height: 0;
}

.batch-card {
  grid-column: 1 / -1;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}

.header-icon {
  font-size: 18px;
  opacity: 0.7;
}

.converter-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flex-1 {
  flex: 1;
}

.unit-select {
  width: 120px;
}

.hint {
  font-size: 12px;
  opacity: 0.5;
  margin: 0;
}

/* ── 结果展示 ── */
.result-alert {
  border-radius: 8px;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.result-label {
  font-size: 13px;
  opacity: 0.6;
  white-space: nowrap;
  min-width: 100px;
}

.result-value-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.result-value {
  font-size: 14px;
  font-weight: 600;
}

/* ── 批量转换 ── */
.batch-results {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  padding: 8px 12px;
}

.batch-result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.batch-result-row.error {
  opacity: 0.5;
}

.batch-input {
  min-width: 160px;
  font-size: 13px;
}

.batch-arrow {
  opacity: 0.4;
  font-weight: 700;
}

.batch-output {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}

/* ── 响应式 ── */
@media (max-width: 1024px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
  .clock-display {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
