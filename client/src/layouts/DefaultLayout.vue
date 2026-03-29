<template>
  <div class="app-layout">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ collapsed: appStore.sidebarCollapsed }">
      <!-- Logo 区域 -->
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">🐚</span>
          <span class="logo-text" v-show="!appStore.sidebarCollapsed">Nautilus</span>
        </div>
        <button class="toggle-btn" @click="appStore.toggleSidebar" :title="appStore.sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'">
          <span class="toggle-icon">{{ appStore.sidebarCollapsed ? '›' : '‹' }}</span>
        </button>
      </div>

      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <router-link
          v-for="mod in appStore.modules"
          :key="mod.id"
          :to="mod.path"
          class="nav-item"
          :class="{ active: $route.path.startsWith(mod.path) }"
          :title="mod.name"
        >
          <span class="nav-icon">{{ mod.icon }}</span>
          <span class="nav-label" v-show="!appStore.sidebarCollapsed">{{ mod.name }}</span>
        </router-link>
      </nav>

      <!-- 底部状态 -->
      <div class="sidebar-footer">
        <div class="server-status" :title="serverOnline ? '服务器在线' : '服务器离线'">
          <span class="status-dot" :class="{ online: serverOnline }"></span>
          <span class="status-text" v-show="!appStore.sidebarCollapsed">
            {{ serverOnline ? '在线' : '离线' }}
          </span>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAppStore } from '@/stores/app.js';

const appStore = useAppStore();
const serverOnline = ref(false);

// 检查后端是否在线
async function checkServerHealth() {
  try {
    const res = await fetch('/api/health');
    serverOnline.value = res.ok;
  } catch {
    serverOnline.value = false;
  }
}

onMounted(() => {
  checkServerHealth();
  // 每 30 秒检查一次
  setInterval(checkServerHealth, 30000);
});
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

/* === 侧边栏 === */
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-surface);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  transition: width var(--transition-normal);
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  height: 64px;
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  overflow: hidden;
}

.logo-icon {
  font-size: var(--text-2xl);
  flex-shrink: 0;
}

.logo-text {
  font-size: var(--text-lg);
  font-weight: 600;
  white-space: nowrap;
  background: linear-gradient(135deg, var(--color-primary-300), var(--color-accent-400));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.toggle-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.toggle-btn:hover {
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
}

.toggle-icon {
  font-size: var(--text-lg);
  font-weight: bold;
}

/* === 导航菜单 === */
.sidebar-nav {
  flex: 1;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
}

.nav-item:hover {
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
}

.nav-item.active {
  background: rgba(15, 155, 142, 0.15);
  color: var(--color-primary-400);
}

.nav-icon {
  font-size: var(--text-xl);
  flex-shrink: 0;
  width: 28px;
  text-align: center;
}

.nav-label {
  font-size: var(--text-sm);
  font-weight: 500;
}

/* === 底部状态 === */
.sidebar-footer {
  padding: var(--space-4);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.server-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-error);
  flex-shrink: 0;
}

.status-dot.online {
  background: var(--color-success);
  animation: pulse-glow 2s infinite;
}

.status-text {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* === 主内容区 === */
.main-content {
  flex: 1;
  margin-left: var(--sidebar-width);
  transition: margin-left var(--transition-normal);
  padding: var(--space-8);
  min-height: 100vh;
}

.sidebar.collapsed ~ .main-content {
  margin-left: var(--sidebar-collapsed-width);
}

/* === 页面切换动画 === */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
