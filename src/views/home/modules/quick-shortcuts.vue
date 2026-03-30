<script setup lang="ts">
import { useRouter } from 'vue-router';
import { $t } from '@/locales';

defineOptions({ name: 'QuickShortcuts' });

const router = useRouter();

// 快捷入口列表，从路由配置中提取
interface Shortcut {
  key: string;
  icon: string;
  color: string;
  bgColor: string;
  route: string;
  i18nKey: string;
}

const shortcuts: Shortcut[] = [
  {
    key: 'image-compressor',
    icon: 'mdi:image-size-select-large',
    color: '#36d399',
    bgColor: 'rgba(54, 211, 153, 0.1)',
    route: '/image-tools/image-compressor',
    i18nKey: 'route.image-tools_image-compressor'
  },
  {
    key: 'video-frame',
    icon: 'mdi:movie-open-play-outline',
    color: '#6c5ce7',
    bgColor: 'rgba(108, 92, 231, 0.1)',
    route: '/image-tools/video-frame-extractor',
    i18nKey: 'route.image-tools_video-frame-extractor'
  },
  {
    key: 'effects',
    icon: 'mdi:creation',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
    route: '/image-tools/effects-generator',
    i18nKey: 'route.image-tools_effects-generator'
  },
  {
    key: 'sb3-studio',
    icon: 'mdi:puzzle-outline',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    route: '/sb3-graphical/sb3-studio',
    i18nKey: 'route.sb3-graphical_sb3-studio'
  },
  {
    key: 'sb3-compress',
    icon: 'mdi:archive-arrow-down-outline',
    color: '#f43f5e',
    bgColor: 'rgba(244, 63, 94, 0.1)',
    route: '/sb3-graphical/sb3-compressor',
    i18nKey: 'route.sb3-graphical_sb3-compressor'
  },
  {
    key: 'timestamp',
    icon: 'mdi:clock-time-four-outline',
    color: '#14b8a6',
    bgColor: 'rgba(20, 184, 166, 0.1)',
    route: '/misc-shop/timestamp-converter',
    i18nKey: 'route.misc-shop_timestamp-converter'
  },
  {
    key: 'base64',
    icon: 'mdi:code-braces',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    route: '/misc-shop/base64-converter',
    i18nKey: 'route.misc-shop_base64-converter'
  },
  {
    key: 'qrcode',
    icon: 'mdi:qrcode',
    color: '#0ea5e9',
    bgColor: 'rgba(14, 165, 233, 0.1)',
    route: '/misc-shop/qrcode-generator',
    i18nKey: 'route.misc-shop_qrcode-generator'
  }
];

function navigate(route: string) {
  router.push(route);
}
</script>

<template>
  <NCard :title="$t('page.home.shortcuts.title')" :bordered="false" size="small" segmented class="card-wrapper">
    <div class="shortcuts-grid">
      <div
        v-for="item in shortcuts"
        :key="item.key"
        class="shortcut-card"
        @click="navigate(item.route)"
      >
        <div class="shortcut-icon" :style="{ backgroundColor: item.bgColor }">
          <SvgIcon :icon="item.icon" :style="{ color: item.color, fontSize: '24px' }" />
        </div>
        <span class="shortcut-label">{{ $t(item.i18nKey as any) }}</span>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.shortcut-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
  background: transparent;
}

.shortcut-card:hover {
  background: rgba(0, 0, 0, 0.03);
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
}

.shortcut-card:active {
  transform: translateY(-1px);
}

.shortcut-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  transition: transform 0.25s ease;
}

.shortcut-card:hover .shortcut-icon {
  transform: scale(1.08);
}

.shortcut-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color-2, #666);
  text-align: center;
  line-height: 1.3;
}

@media (max-width: 768px) {
  .shortcuts-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 480px) {
  .shortcuts-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
