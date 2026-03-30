<script setup lang="ts">
import { $t } from '@/locales';

defineOptions({ name: 'Changelog' });

// 更新日志数据类型
interface ChangelogItem {
  date: string;
  type: 'feature' | 'fix' | 'optimize' | 'milestone';
  content: string;
}

// 项目真实里程碑记录
// TODO: 后续可改为从 Git 日志或数据库读取
const logs: ChangelogItem[] = [
  {
    date: '2026-03-31',
    type: 'optimize',
    content: '首页全面重新设计，新增天气预报、快捷入口、AI新闻等模块'
  },
  {
    date: '2026-03-30',
    type: 'feature',
    content: '新增杂货铺模块：时间戳转换、Base64 转换、二维码生成'
  },
  {
    date: '2026-03-30',
    type: 'feature',
    content: '重构导航结构，新增图片工具与 SB3 图形化分类'
  },
  {
    date: '2026-03-30',
    type: 'optimize',
    content: '特效生成器粒子预设全面升级（6 款高品质背景特效）'
  },
  {
    date: '2026-03-29',
    type: 'feature',
    content: '视频抽帧工具上线，支持按帧数/时间间隔抽取'
  },
  {
    date: '2026-03-29',
    type: 'milestone',
    content: '完成 Soybean Admin 模板迁移，前后端联调成功'
  }
];

// 类型 → 颜色映射
const typeColors: Record<ChangelogItem['type'], string> = {
  feature: '#36d399',
  fix: '#f97316',
  optimize: '#3b82f6',
  milestone: '#f43f5e'
};

// 类型 → i18n key
function getTagLabel(type: ChangelogItem['type']): string {
  return $t(`page.home.changelog.tags.${type}` as any);
}
</script>

<template>
  <NCard :title="$t('page.home.changelog.title')" :bordered="false" size="small" segmented class="card-wrapper">
    <NTimeline>
      <NTimelineItem
        v-for="(log, index) in logs"
        :key="index"
        :time="log.date"
        :color="typeColors[log.type]"
      >
        <div class="log-item">
          <NTag :color="{ color: typeColors[log.type] + '18', textColor: typeColors[log.type], borderColor: typeColors[log.type] + '40' }" size="small" round>
            {{ getTagLabel(log.type) }}
          </NTag>
          <span class="log-content">{{ log.content }}</span>
        </div>
      </NTimelineItem>
    </NTimeline>
  </NCard>
</template>

<style scoped>
.log-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.log-content {
  font-size: 13px;
  color: var(--text-color-2, #666);
  line-height: 1.6;
  flex: 1;
  min-width: 0;
}
</style>
