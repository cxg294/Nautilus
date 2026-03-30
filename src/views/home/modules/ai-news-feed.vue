<script setup lang="ts">
import { $t } from '@/locales';

defineOptions({ name: 'AINewsFeed' });

// 新闻数据类型
interface NewsItem {
  id: number;
  title: string;
  summary: string;
  source: string;
  timeAgo: string;
  url?: string;
}

// Mock 新闻数据
// TODO: 后续替换为 fetchAINews() API 调用，接入 24h 内 AI 领域新闻源
const mockNews: NewsItem[] = [
  {
    id: 1,
    title: 'OpenAI 发布 GPT-5 Turbo，推理速度提升 3 倍',
    summary: '新模型在复杂推理任务上表现显著提升，同时 API 调用成本降低 40%。开发者可立即通过 API 接入测试。',
    source: 'The Verge',
    timeAgo: '2h'
  },
  {
    id: 2,
    title: 'Google DeepMind 开源 Gemma 3 系列模型',
    summary: 'Gemma 3 涵盖 2B 到 27B 参数规模，支持多模态输入，在多项基准测试中超越同量级竞品。',
    source: 'Google AI Blog',
    timeAgo: '5h'
  },
  {
    id: 3,
    title: 'Anthropic 推出 Claude 编程助手企业版',
    summary: '新版本支持整个代码仓库的上下文理解，集成 CI/CD 流水线，面向企业级软件开发团队。',
    source: 'TechCrunch',
    timeAgo: '8h'
  },
  {
    id: 4,
    title: 'Meta 发布视频生成模型 MovieGen 2.0',
    summary: '支持 4K 分辨率、最长 2 分钟的高质量视频生成，内置音频自动匹配功能。',
    source: 'Ars Technica',
    timeAgo: '12h'
  },
  {
    id: 5,
    title: 'Stability AI 推出实时图像编辑工具 Stable Edit',
    summary: '基于自然语言指令对图像进行精确编辑，延迟低于 500ms，适用于设计师和创作者日常工作流。',
    source: 'Wired',
    timeAgo: '18h'
  }
];

// 格式化时间显示
function formatTimeAgo(timeAgo: string): string {
  const num = parseInt(timeAgo);
  if (timeAgo.endsWith('m')) {
    return $t('page.home.aiNews.minutesAgo', { n: num });
  }
  return $t('page.home.aiNews.hoursAgo', { n: num });
}
</script>

<template>
  <NCard :title="$t('page.home.aiNews.title')" :bordered="false" size="small" segmented class="card-wrapper">
    <div v-if="mockNews.length === 0" class="empty-state">
      {{ $t('page.home.aiNews.noNews') }}
    </div>
    <div v-else class="news-list">
      <div
        v-for="item in mockNews"
        :key="item.id"
        class="news-item"
      >
        <div class="news-header">
          <h4 class="news-title">{{ item.title }}</h4>
        </div>
        <p class="news-summary">{{ item.summary }}</p>
        <div class="news-meta">
          <NTag size="tiny" :bordered="false" type="info">{{ item.source }}</NTag>
          <span class="news-time">{{ formatTimeAgo(item.timeAgo) }}</span>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.news-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.news-item {
  padding: 14px 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  transition: background-color 0.2s ease;
  border-radius: 6px;
}

.news-item:last-child {
  border-bottom: none;
}

.news-item:hover {
  background: rgba(0, 0, 0, 0.02);
}

.news-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.news-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color-1, #333);
  line-height: 1.5;
  margin: 0;
}

.news-summary {
  font-size: 13px;
  color: var(--text-color-3, #999);
  line-height: 1.6;
  margin: 6px 0 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.news-time {
  font-size: 12px;
  color: var(--text-color-3, #bbb);
}

.empty-state {
  text-align: center;
  padding: 40px 0;
  color: var(--text-color-3, #999);
  font-size: 14px;
}
</style>
