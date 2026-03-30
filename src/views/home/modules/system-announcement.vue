<script setup lang="ts">
import { ref } from 'vue';
import { $t } from '@/locales';

defineOptions({ name: 'SystemAnnouncement' });

// 使用 localStorage 记住关闭状态，每个版本的公告可以通过修改版本号重新显示
const STORAGE_KEY = 'NTL_announcement_dismissed_v1';
const dismissed = ref(localStorage.getItem(STORAGE_KEY) === 'true');

function dismiss() {
  dismissed.value = true;
  localStorage.setItem(STORAGE_KEY, 'true');
}
</script>

<template>
  <Transition name="fade-slide" appear>
    <NAlert
      v-if="!dismissed"
      type="info"
      :title="$t('page.home.announcement.title')"
      closable
      class="announcement-alert"
      @close="dismiss"
    >
      {{ $t('page.home.announcement.content') }}
    </NAlert>
  </Transition>
</template>

<style scoped>
.announcement-alert {
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
