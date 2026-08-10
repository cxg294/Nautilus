import { request } from '../request';

export interface MidPriceLesson { lesson: string; rank: number; unlocked: number; attend: number; complete: number; t7Attend: number; t7Complete: number; durationMedianMs: number | null; attendRate: number | null; completionRate: number | null; t7AttendRate: number | null; t7CompletionRate: number | null }
export interface MidPriceSeries { termId: number; termName: string; templateId: number; subject: '图形化' | 'Python'; lessons: MidPriceLesson[] }
export interface MidPriceGradeRow extends MidPriceLesson { termId: number; termName: string; templateId: number; subject: '图形化' | 'Python'; grade: string }
export interface MidPriceLiveAttendance { termId: number; termName: string; templateId: number; subject: '图形化' | 'Python'; lesson: string; liveName: string; startedAt: string; attendees: number }
export interface MidPriceDashboard { source: { dashboardId: number; viewId: number; sourceLastUpdateTime: string; liveAttendanceUpdatedAt?: string }; tracks: Array<{ id: number; name: string; templateId: number; subject: string }>; series: MidPriceSeries[]; gradeRows: MidPriceGradeRow[]; liveAttendance: MidPriceLiveAttendance[]; cache: { status: string; updatedAt: string; rowCount: number; fromCache: boolean }; errors?: Array<{ message: string }> }
export const fetchMidPriceCourseDashboard = (params: { forceRefresh?: boolean } = {}) => request<MidPriceDashboard>({ url: '/mid-price-course/dashboard', params });
export const refreshMidPriceCourseDashboard = () => request<MidPriceDashboard>({ url: '/mid-price-course/refresh', method: 'post' });
