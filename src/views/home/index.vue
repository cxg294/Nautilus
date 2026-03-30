<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '@/store/modules/app';
import HeaderBanner from './modules/header-banner.vue';
import SystemAnnouncement from './modules/system-announcement.vue';
import WeatherForecast from './modules/weather-forecast.vue';
import QuickShortcuts from './modules/quick-shortcuts.vue';
import Changelog from './modules/changelog.vue';
import AINewsFeed from './modules/ai-news-feed.vue';

const appStore = useAppStore();

const gap = computed(() => (appStore.isMobile ? 0 : 16));
</script>

<template>
  <NSpace vertical :size="16">
    <!-- 顶部欢迎横幅 -->
    <HeaderBanner />

    <!-- 系统公告（可关闭） -->
    <SystemAnnouncement />

    <!-- 天气预报 + 快捷入口 -->
    <NGrid :x-gap="gap" :y-gap="16" responsive="screen" item-responsive>
      <NGi span="24 s:24 m:10">
        <WeatherForecast />
      </NGi>
      <NGi span="24 s:24 m:14">
        <QuickShortcuts />
      </NGi>
    </NGrid>

    <!-- 今日新闻 + 更新日志 -->
    <NGrid :x-gap="gap" :y-gap="16" responsive="screen" item-responsive>
      <NGi span="24 s:24 m:14">
        <AINewsFeed />
      </NGi>
      <NGi span="24 s:24 m:10">
        <Changelog />
      </NGi>
    </NGrid>
  </NSpace>
</template>

<style scoped></style>
