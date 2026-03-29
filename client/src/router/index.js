import { createRouter, createWebHistory } from 'vue-router';

// 路由懒加载 — 每个模块按需加载
const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/modules/dashboard/DashboardView.vue'),
    meta: { title: '仪表盘', icon: '🏠', requiresAuth: false }, // Phase 1 后改为 true
  },
  // TODO: Phase 1 - 登录注册
  // {
  //   path: '/login',
  //   name: 'Login',
  //   component: () => import('@/modules/auth/LoginView.vue'),
  //   meta: { title: '登录', layout: 'auth' },
  // },
  // TODO: Phase 1 - 用户管理
  // {
  //   path: '/admin/users',
  //   name: 'UserManagement',
  //   component: () => import('@/modules/admin/UsersView.vue'),
  //   meta: { title: '用户管理', requiresAuth: true, permission: 'system:user:manage' },
  // },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// TODO: Phase 1 - 路由守卫（鉴权）
// router.beforeEach((to, from, next) => { ... });

export default router;
