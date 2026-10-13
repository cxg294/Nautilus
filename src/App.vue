<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { NConfigProvider, darkTheme } from 'naive-ui';
import type { WatermarkProps } from 'naive-ui';
import { useAppStore } from './store/modules/app';
import { useThemeStore } from './store/modules/theme';
import { naiveDateLocales, naiveLocales } from './locales/naive';
import { useAuthStore } from './store/modules/auth';

defineOptions({
  name: 'App'
});

const appStore = useAppStore();
const themeStore = useThemeStore();
const authStore = useAuthStore();
let authorizationTimer: ReturnType<typeof setInterval>;
function syncAuthorization() {
  if (document.visibilityState === 'visible') void authStore.refreshAuthorization();
}
onMounted(() => {
  authorizationTimer = setInterval(syncAuthorization, 30000);
  window.addEventListener('focus', syncAuthorization);
  document.addEventListener('visibilitychange', syncAuthorization);
});
onBeforeUnmount(() => {
  clearInterval(authorizationTimer);
  window.removeEventListener('focus', syncAuthorization);
  document.removeEventListener('visibilitychange', syncAuthorization);
});

const naiveDarkTheme = computed(() => (themeStore.darkMode ? darkTheme : undefined));

const naiveLocale = computed(() => {
  return naiveLocales[appStore.locale];
});

const naiveDateLocale = computed(() => {
  return naiveDateLocales[appStore.locale];
});

const watermarkProps = computed<WatermarkProps>(() => {
  return {
    content: themeStore.watermarkContent,
    cross: true,
    fullscreen: true,
    fontSize: 16,
    lineHeight: 16,
    width: 384,
    height: 384,
    xOffset: 12,
    yOffset: 60,
    rotate: -15,
    zIndex: 9999
  };
});
</script>

<template>
  <NConfigProvider
    :theme="naiveDarkTheme"
    :theme-overrides="themeStore.naiveTheme"
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
    class="h-full"
  >
    <AppProvider>
      <RouterView class="bg-layout" />
      <NWatermark v-if="themeStore.watermark.visible" v-bind="watermarkProps" />
    </AppProvider>
  </NConfigProvider>
</template>

<style scoped></style>
