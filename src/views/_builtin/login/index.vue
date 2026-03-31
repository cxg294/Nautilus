<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Component } from 'vue';
import { loginModuleRecord } from '@/constants/app';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import { $t } from '@/locales';
import PwdLogin from './modules/pwd-login.vue';
import Register from './modules/register.vue';
import ResetPwd from './modules/reset-pwd.vue';
import BindWechat from './modules/bind-wechat.vue';

interface Props {
  /** The login module */
  module?: UnionKey.LoginModule;
}

const props = defineProps<Props>();

const appStore = useAppStore();
const themeStore = useThemeStore();

interface LoginModule {
  label: App.I18n.I18nKey;
  component: Component;
}

const moduleMap: Record<UnionKey.LoginModule, LoginModule> = {
  'pwd-login': { label: loginModuleRecord['pwd-login'], component: PwdLogin },
  'code-login': { label: loginModuleRecord['pwd-login'], component: PwdLogin },
  register: { label: loginModuleRecord.register, component: Register },
  'reset-pwd': { label: loginModuleRecord['reset-pwd'], component: ResetPwd },
  'bind-wechat': { label: loginModuleRecord['bind-wechat'], component: BindWechat }
};

const activeModule = computed(() => moduleMap[props.module || 'pwd-login']);

// Slogan typewriter animation
const sloganText = 'Navigate Your Digital Universe';
const displayedSlogan = ref('');
const showSubtitle = ref(false);
const showCursor = ref(true);

onMounted(() => {
  let i = 0;
  const typeInterval = setInterval(() => {
    if (i < sloganText.length) {
      displayedSlogan.value += sloganText[i];
      i++;
    } else {
      clearInterval(typeInterval);
      // Hide cursor after typing, show subtitle
      setTimeout(() => {
        showCursor.value = false;
        showSubtitle.value = true;
      }, 600);
    }
  }, 65);
});
</script>

<template>
  <div class="login-container">
    <!-- Left: Slogan area -->
    <div class="login-left">
      <!-- Floating orbs -->
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>

      <div class="slogan-wrapper">
        <SystemLogo class="slogan-logo" />
        <h1 class="slogan-text">
          <span>{{ displayedSlogan }}</span>
          <span v-if="showCursor" class="cursor">|</span>
        </h1>
        <Transition name="fade-up">
          <p v-if="showSubtitle" class="slogan-subtitle">
            探索你的数字宇宙 · 一站式智能工作平台
          </p>
        </Transition>
      </div>

      <!-- Bottom decorative line -->
      <div class="bottom-glow"></div>
    </div>

    <!-- Right: Login form -->
    <div class="login-right" :class="{ 'dark-mode': themeStore.darkMode }">
      <div class="login-form-wrapper">
        <header class="login-header">
          <h3 class="login-title">{{ $t(activeModule.label) }}</h3>
          <div class="header-actions">
            <ThemeSchemaSwitch
              :theme-schema="themeStore.themeScheme"
              :show-tooltip="false"
              class="text-20px"
              @switch="themeStore.toggleThemeScheme"
            />
            <LangSwitch
              v-if="themeStore.header.multilingual.visible"
              :lang="appStore.locale"
              :lang-options="appStore.localeOptions"
              :show-tooltip="false"
              @change-lang="appStore.changeLocale"
            />
          </div>
        </header>
        <main class="login-form-body">
          <Transition :name="themeStore.page.animateMode" mode="out-in" appear>
            <component :is="activeModule.component" />
          </Transition>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

/* ===== Left Panel ===== */
.login-left {
  position: relative;
  flex: 0 0 55%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
  overflow: hidden;
}

.slogan-wrapper {
  position: relative;
  z-index: 2;
  text-align: left;
  padding: 0 64px;
  max-width: 600px;
}

.slogan-logo {
  width: 72px;
  height: 72px;
  margin-bottom: 32px;
  filter: drop-shadow(0 0 24px rgba(124, 111, 255, 0.5));
}

.slogan-text {
  font-size: 42px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.3;
  letter-spacing: -0.5px;
  min-height: 120px;
  font-family: 'Inter', 'SF Pro Display', system-ui, sans-serif;
}

.cursor {
  display: inline-block;
  font-weight: 300;
  color: rgba(124, 111, 255, 0.9);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.slogan-subtitle {
  margin-top: 24px;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.65);
  letter-spacing: 2px;
  font-weight: 300;
}

/* Fade-up transition for subtitle */
.fade-up-enter-active {
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.fade-up-enter-to {
  opacity: 1;
  transform: translateY(0);
}

/* Floating orbs */
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
  animation: float 8s ease-in-out infinite;
}

.orb-1 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, #7c6fff 0%, transparent 70%);
  top: -50px;
  right: -50px;
  animation-delay: 0s;
}

.orb-2 {
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, #36d1dc 0%, transparent 70%);
  bottom: 10%;
  left: -30px;
  animation-delay: -3s;
}

.orb-3 {
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, #f093fb 0%, transparent 70%);
  top: 50%;
  right: 20%;
  animation-delay: -5s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 15px) scale(0.95); }
}

/* Bottom glow line */
.bottom-glow {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #7c6fff, #36d1dc, transparent);
  opacity: 0.6;
}

/* ===== Right Panel ===== */
.login-right {
  flex: 0 0 45%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  transition: background-color 0.3s ease;
}

.login-right.dark-mode {
  background: #1a1a2e;
}

.login-form-wrapper {
  width: 100%;
  max-width: 420px;
  padding: 48px 40px;
}

.login-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 36px;
}

.login-title {
  font-size: 26px;
  font-weight: 600;
  color: var(--n-text-color, #333);
}

.header-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.login-form-body {
  width: 100%;
}

/* ===== Responsive ===== */
@media (max-width: 900px) {
  .login-container {
    flex-direction: column;
  }

  .login-left {
    flex: 0 0 40%;
  }

  .slogan-wrapper {
    padding: 0 32px;
  }

  .slogan-text {
    font-size: 28px;
    min-height: auto;
  }

  .slogan-subtitle {
    font-size: 14px;
  }

  .login-right {
    flex: 1;
  }

  .login-form-wrapper {
    padding: 32px 24px;
  }
}

@media (max-width: 600px) {
  .login-left {
    flex: 0 0 35%;
  }

  .slogan-logo {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
  }

  .slogan-text {
    font-size: 22px;
  }
}
</style>
