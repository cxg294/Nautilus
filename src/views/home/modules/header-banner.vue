<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useAppStore } from '@/store/modules/app';
import { useAuthStore } from '@/store/modules/auth';
import { $t } from '@/locales';

defineOptions({
  name: 'HeaderBanner'
});

const appStore = useAppStore();
const authStore = useAuthStore();

// 实时时钟，每分钟更新
const now = ref(new Date());
let timer: ReturnType<typeof setInterval>;

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date();
  }, 60000);
});

onUnmounted(() => {
  clearInterval(timer);
});

// 根据当前语言环境格式化日期
const dateDisplay = computed(() => {
  const locale = appStore.locale === 'zh-CN' ? 'zh-CN' : 'en-US';
  return now.value.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
});

// 时间显示
const timeDisplay = computed(() => {
  return now.value.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
});
</script>

<template>
  <NCard :bordered="false" class="card-wrapper">
    <div class="banner-wrapper">
      <div class="flex-y-center">
        <div class="size-64px shrink-0 overflow-hidden rd-1/2">
          <img src="@/assets/imgs/soybean.jpg" class="size-full" />
        </div>
        <div class="pl-16px">
          <h3 class="text-20px font-semibold greeting-text">
            {{ $t('page.home.greeting', { userName: authStore.userInfo.userName }) }}
          </h3>
          <p class="date-text">{{ dateDisplay }}</p>
        </div>
      </div>
      <div class="time-display">
        <span class="time-text">{{ timeDisplay }}</span>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.banner-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.greeting-text {
  color: var(--text-color-1, #333);
  margin-bottom: 4px;
}

.date-text {
  color: var(--text-color-3, #999);
  font-size: 14px;
  line-height: 1.6;
}

.time-display {
  display: flex;
  align-items: center;
}

.time-text {
  font-size: 40px;
  font-weight: 200;
  color: var(--text-color-3, #bbb);
  letter-spacing: 2px;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .time-display {
    display: none;
  }
}
</style>
