<template>
  <div class="dashboard">
    <header class="dashboard-header animate-fade-in">
      <div class="greeting">
        <h1 class="greeting-title">
          {{ greetingText }}
        </h1>
        <p class="greeting-subtitle">Nautilus 万用工作台 · v0.1.0</p>
      </div>
      <div class="header-time">
        <span class="time-display">{{ currentTime }}</span>
        <span class="date-display">{{ currentDate }}</span>
      </div>
    </header>

    <!-- 系统状态卡片 -->
    <section class="status-grid animate-fade-in">
      <div class="status-card glass-panel" v-for="card in statusCards" :key="card.label">
        <span class="status-icon">{{ card.icon }}</span>
        <div class="status-info">
          <span class="status-value">{{ card.value }}</span>
          <span class="status-label">{{ card.label }}</span>
        </div>
      </div>
    </section>

    <!-- 模块快速入口 -->
    <section class="modules-section animate-fade-in">
      <h2 class="section-title">工具模块</h2>
      <div class="modules-grid">
        <div
          class="module-card glass-panel"
          v-for="mod in availableModules"
          :key="mod.id"
          :class="{ disabled: mod.status !== 'active' }"
        >
          <div class="module-icon">{{ mod.icon }}</div>
          <div class="module-info">
            <h3 class="module-name">{{ mod.name }}</h3>
            <span class="module-status" :class="mod.status">
              {{ mod.status === 'active' ? '可用' : '开发中' }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- 基建状态 -->
    <section class="infra-section animate-fade-in">
      <h2 class="section-title">基建服务</h2>
      <div class="infra-list">
        <div class="infra-item glass-panel" v-for="infra in infraServices" :key="infra.name">
          <span class="infra-icon">{{ infra.icon }}</span>
          <span class="infra-name">{{ infra.name }}</span>
          <span class="infra-badge" :class="infra.status">{{ infra.statusText }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// === 时间 ===
const currentTime = ref('');
const currentDate = ref('');
let timeInterval;

function updateTime() {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  currentDate.value = now.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
}

// === 问候语 ===
const greetingText = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '🌙 夜深了，注意休息';
  if (hour < 12) return '☀️ 早上好，准备开始工作';
  if (hour < 14) return '🍱 中午好，休息片刻';
  if (hour < 18) return '💻 下午好，继续推进';
  return '🌆 晚上好，今天辛苦了';
});

// === 状态卡片 ===
const statusCards = ref([
  { icon: '📦', value: '1', label: '可用模块' },
  { icon: '🔧', value: '6', label: '待开发' },
  { icon: '🏗️', value: '5', label: '基建项目' },
  { icon: '🚀', value: 'Phase 0', label: '当前阶段' },
]);

// === 业务模块列表 ===
const availableModules = ref([
  { id: 'sb3-workbench', name: 'SB3批处理工作台', icon: '🎮', status: 'pending' },
  { id: 'cogni-offload', name: '认知卸载', icon: '🧠', status: 'pending' },
  { id: 'asset-generator', name: '素材生成器', icon: '🎨', status: 'pending' },
  { id: 'course-data', name: '课程数据处理', icon: '📊', status: 'pending' },
  { id: 'shiba-hub', name: '柴犬集合站', icon: '🐕', status: 'pending' },
  { id: 'transcript-review', name: '逐字稿审查器', icon: '📝', status: 'pending' },
]);

// === 基建服务列表 ===
const infraServices = ref([
  { name: '账号权限系统', icon: '🔐', status: 'pending', statusText: 'Phase 1' },
  { name: '多层级记忆', icon: '💾', status: 'pending', statusText: 'Phase 2' },
  { name: '飞书通信', icon: '📨', status: 'pending', statusText: 'Phase 2' },
  { name: '社媒爬取', icon: '🕷️', status: 'pending', statusText: 'Phase 2' },
  { name: '多Agent审查', icon: '🤖', status: 'pending', statusText: 'Phase 4' },
]);

onMounted(() => {
  updateTime();
  timeInterval = setInterval(updateTime, 1000);
});

onUnmounted(() => {
  clearInterval(timeInterval);
});
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

/* === 头部 === */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-8);
}

.greeting-title {
  font-size: var(--text-3xl);
  font-weight: 700;
  margin-bottom: var(--space-2);
}

.greeting-subtitle {
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.header-time {
  text-align: right;
}

.time-display {
  display: block;
  font-size: var(--text-3xl);
  font-weight: 300;
  font-family: var(--font-mono);
  color: var(--color-primary-400);
}

.date-display {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* === 状态卡片 === */
.status-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.status-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
}

.status-icon {
  font-size: var(--text-2xl);
}

.status-value {
  display: block;
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.status-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* === 模块网格 === */
.section-title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin-bottom: var(--space-4);
  color: var(--text-secondary);
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.module-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.module-card:hover:not(.disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow);
  border-color: rgba(15, 155, 142, 0.3);
}

.module-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.module-icon {
  font-size: var(--text-2xl);
}

.module-name {
  font-size: var(--text-sm);
  font-weight: 500;
  margin-bottom: var(--space-1);
}

.module-status {
  font-size: var(--text-xs);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.module-status.active {
  background: rgba(16, 185, 129, 0.15);
  color: var(--color-success);
}

.module-status.pending {
  background: rgba(107, 114, 128, 0.15);
  color: var(--text-muted);
}

/* === 基建列表 === */
.infra-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.infra-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.infra-icon {
  font-size: var(--text-lg);
}

.infra-name {
  flex: 1;
  font-size: var(--text-sm);
}

.infra-badge {
  font-size: var(--text-xs);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-weight: 500;
}

.infra-badge.pending {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-warning);
}

.infra-badge.active {
  background: rgba(16, 185, 129, 0.12);
  color: var(--color-success);
}

/* === 响应式 === */
@media (max-width: 1024px) {
  .status-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .modules-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .status-grid {
    grid-template-columns: 1fr;
  }
  .modules-grid {
    grid-template-columns: 1fr;
  }
  .dashboard-header {
    flex-direction: column;
    gap: var(--space-4);
  }
  .header-time {
    text-align: left;
  }
}
</style>
