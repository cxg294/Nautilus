import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * 应用全局状态
 */
export const useAppStore = defineStore('app', () => {
  // 侧边栏折叠状态
  const sidebarCollapsed = ref(false);

  // 已注册的模块列表
  const modules = ref([
    {
      id: 'dashboard',
      name: '仪表盘',
      icon: '🏠',
      path: '/dashboard',
      category: 'core',
      status: 'active',
    },
    // 后续模块将在各 Phase 中逐步添加
  ]);

  // 切换侧边栏
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  // 按分类获取模块
  const modulesByCategory = computed(() => {
    const categories = {};
    for (const mod of modules.value) {
      if (!categories[mod.category]) {
        categories[mod.category] = [];
      }
      categories[mod.category].push(mod);
    }
    return categories;
  });

  return {
    sidebarCollapsed,
    modules,
    toggleSidebar,
    modulesByCategory,
  };
});
