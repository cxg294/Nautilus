<script setup lang="ts">
/**
 * AuthGate - 功能级权限遮罩组件
 *
 * 用于在页面内包裹需要权限的功能区域，
 * 未登录时显示半透明遮罩 + "登录后解锁"按钮，
 * 无权限时显示"权限不足"提示。
 *
 * @example
 * <AuthGate require-login>
 *   <SomeProtectedFeature />
 * </AuthGate>
 *
 * <AuthGate :require-permission="['module:sb3-studio:access']">
 *   <SomeAdminFeature />
 * </AuthGate>
 */
import { computed } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { useAuth } from '@/hooks/business/auth';
import { useRouterPush } from '@/hooks/common/router';

interface Props {
  /** 是否需要登录 */
  requireLogin?: boolean;
  /** 需要的权限 key（字符串或数组） */
  requirePermission?: string | string[];
  /** 遮罩提示文字（未登录时） */
  loginText?: string;
  /** 遮罩提示文字（无权限时） */
  noPermissionText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  requireLogin: false,
  requirePermission: undefined,
  loginText: '登录后解锁此功能',
  noPermissionText: '权限不足，请联系管理员'
});

const authStore = useAuthStore();
const { hasAuth } = useAuth();
const { toLogin } = useRouterPush();

const isLoggedIn = computed(() => authStore.isLogin);

const hasPermission = computed(() => {
  if (!props.requirePermission) return true;
  return hasAuth(props.requirePermission);
});

const isBlocked = computed(() => {
  // 需要登录但未登录
  if (props.requireLogin && !isLoggedIn.value) return 'login';
  // 需要权限但无权限（且已登录）
  if (props.requirePermission && !hasPermission.value) {
    if (!isLoggedIn.value) return 'login';
    return 'permission';
  }
  return false;
});

function handleLogin() {
  toLogin();
}
</script>

<template>
  <div class="auth-gate" :class="{ 'auth-gate--blocked': isBlocked }">
    <slot />
    <Transition name="auth-gate-fade">
      <div v-if="isBlocked" class="auth-gate__overlay">
        <div class="auth-gate__content">
          <template v-if="isBlocked === 'login'">
            <div class="auth-gate__icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2m-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2M9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2z"
                />
              </svg>
            </div>
            <p class="auth-gate__text">{{ loginText }}</p>
            <button class="auth-gate__btn" @click="handleLogin">
              立即登录
            </button>
          </template>
          <template v-else>
            <div class="auth-gate__icon auth-gate__icon--warn">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z"
                />
              </svg>
            </div>
            <p class="auth-gate__text">{{ noPermissionText }}</p>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.auth-gate {
  position: relative;
}

.auth-gate--blocked {
  pointer-events: none;
  user-select: none;
}

.auth-gate__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  border-radius: inherit;
  z-index: 10;
  pointer-events: auto;
}

.auth-gate__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 32px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}

/* Dark mode support */
.dark .auth-gate__content {
  background: rgba(30, 30, 30, 0.95);
}

.auth-gate__icon {
  color: #646cff;
  opacity: 0.8;
}

.auth-gate__icon--warn {
  color: #f59e0b;
}

.auth-gate__text {
  margin: 0;
  font-size: 15px;
  color: #333;
  font-weight: 500;
}

.dark .auth-gate__text {
  color: #ddd;
}

.auth-gate__btn {
  margin-top: 4px;
  padding: 8px 24px;
  background: #646cff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.auth-gate__btn:hover {
  background: #535bf2;
}

.auth-gate-fade-enter-active,
.auth-gate-fade-leave-active {
  transition: opacity 0.3s ease;
}

.auth-gate-fade-enter-from,
.auth-gate-fade-leave-to {
  opacity: 0;
}
</style>
