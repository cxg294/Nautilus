import { request } from '../request';

/** 埋点分析看板 API（需 owner 权限） */

export interface AnalyticsTotals {
  total_events: number;
  total_users: number;
  total_tools: number;
}

export interface ToolRankItem {
  tool_name: string;
  total: number;
  views: number;
  actions: number;
}

export interface UserRankItem {
  user_id: number;
  username: string;
  total: number;
  tools_used: number;
  actions: number;
}

export interface DailyTrendItem {
  date: string;
  total: number;
  views: number;
  actions: number;
  active_users: number;
}

export interface AnalyticsSummary {
  days: number;
  totals: AnalyticsTotals;
  toolRanking: ToolRankItem[];
  userRanking: UserRankItem[];
  dailyTrend: DailyTrendItem[];
}

export interface RecentEvent {
  id: number;
  user_id: number;
  username: string;
  event_type: string;
  tool_name: string;
  action_name: string;
  result: string;
  duration: number;
  meta: string;
  created_at: string;
}

export interface RecentEventsResult {
  events: RecentEvent[];
  total: number;
  limit: number;
  offset: number;
}

/** 获取聚合统计 */
export function fetchAnalyticsSummary(days = 30) {
  return request<AnalyticsSummary>({ url: '/analytics/summary', params: { days } });
}

/** 获取最近事件流水 */
export function fetchRecentEvents(params: { limit?: number; offset?: number; tool?: string; user_id?: number } = {}) {
  return request<RecentEventsResult>({ url: '/analytics/recent', params });
}
