<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { $t } from '@/locales';
import { fetchAINews } from '@/service/api/news';
import type { NewsItem } from '@/service/api/news';

defineOptions({ name: 'AINewsFeed' });

const newsList = ref<NewsItem[]>([]);
const loading = ref(false);
const error = ref('');

/**
 * 格式化相对时间：将 'm' / 'h' / 'd' 后缀转为本地化文案
 */
function formatTimeAgo(timeAgo: string): string {
  const num = parseInt(timeAgo);
  if (Number.isNaN(num)) return timeAgo;
  if (timeAgo.endsWith('d')) {
    return `${num}天前`;
  }
  if (timeAgo.endsWith('m')) {
    return $t('page.home.aiNews.minutesAgo', { n: num });
  }
  return $t('page.home.aiNews.hoursAgo', { n: num });
}

/**
 * 从后端获取 AI 新闻
 */
async function loadNews() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await fetchAINews();
    if (data) {
      // 只展示最新 5 条
      newsList.value = data.slice(0, 5);
    }
  } catch (e: any) {
    error.value = e?.message || '获取新闻失败';
    console.error('[AINewsFeed] 加载失败:', e);
  } finally {
    loading.value = false;
  }
}

/**
 * 点击新闻跳转链接
 */
function openNews(item: NewsItem) {
  if (item.url) {
    window.open(item.url, '_blank', 'noopener,noreferrer');
  }
}

onMounted(() => {
  loadNews();
});
</script>

<template>
  <NCard :title="$t('page.home.aiNews.title')" :bordered="false" size="small" segmented class="card-wrapper">
    <!-- 加载中 -->
    <template v-if="loading && newsList.length === 0">
      <div class="loading-state">
        <NSpin size="small" />
        <span class="loading-text">加载中...</span>
      </div>
    </template>

    <!-- 空状态 -->
    <template v-else-if="newsList.length === 0">
      <div class="empty-state">
        {{ error || $t('page.home.aiNews.noNews') }}
      </div>
    </template>

    <!-- 新闻列表 -->
    <template v-else>
      <div class="news-list">
        <div
          v-for="item in newsList"
          :key="item.id"
          class="news-item"
          :class="{ clickable: !!item.url }"
          @click="openNews(item)"
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
    </template>

    <!-- 数据来源标注 -->
    <template #header-extra>
      <NTag size="tiny" :bordered="false" type="default" class="source-tag">
        飞书 · AI每日资讯
      </NTag>
    </template>
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

.news-item.clickable {
  cursor: pointer;
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

.empty-state,
.loading-state {
  text-align: center;
  padding: 40px 0;
  color: var(--text-color-3, #999);
  font-size: 14px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.loading-text {
  color: var(--text-color-3, #999);
}

.source-tag {
  font-size: 11px;
  opacity: 0.7;
}
</style>
