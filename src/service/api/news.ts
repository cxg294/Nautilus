import { request } from '../request';

/** AI 新闻条目 */
export interface NewsItem {
  id: number;
  title: string;
  summary: string;
  source: string;
  url: string;
  timeAgo: string;
  rank: number;
  date: number;
}

/** 获取 AI 新闻列表（来自飞书多维表格） */
export function fetchAINews() {
  return request<NewsItem[]>({
    url: '/api/news',
    method: 'get',
  });
}

/** 强制刷新 AI 新闻缓存 */
export function refreshAINews() {
  return request<NewsItem[]>({
    url: '/api/news/refresh',
    method: 'post',
  });
}

