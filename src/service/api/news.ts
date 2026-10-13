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
  providerName?: string;
}

/** 获取 AI 新闻列表（默认 AIHOT 精选 RSS，飞书多维表格兜底） */
export function fetchAINews() {
  return request<NewsItem[]>({
    url: '/news',
    method: 'get',
  });
}

/** 强制刷新 AI 新闻缓存 */
export function refreshAINews() {
  return request<NewsItem[]>({
    url: '/news/refresh',
    method: 'post',
  });
}
