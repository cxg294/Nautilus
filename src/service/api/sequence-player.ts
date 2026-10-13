/**
 * 逐字稿播放器 — 前端 API 服务
 *
 * 与后端 /api/sequence-player/* 通信
 * 使用项目统一的 request 实例（自动处理 token、错误码、toast 提示）
 */
import { request } from '../request';
import type { MediaAsset } from '@/views/sequence-player/types/sequence';

// ============================================================
// 类型定义
// ============================================================

export interface ProjectListItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail {
  id: string;
  title: string;
  raw_script: string;
  characters: any[];
  steps: any[];
  settings: Record<string, any>;
  stage?: Record<string, any>;
  stageSequences?: any[];
  assets?: MediaAsset[];
  created_at: string;
  updated_at: string;
}

export interface SaveProjectPayload {
  title: string;
  rawScript: string;
  characters: any[];
  steps: any[];
  settings: Record<string, any>;
  stage?: Record<string, any>;
  stageSequences?: any[];
  assets?: MediaAsset[];
}

// ============================================================
// API 调用
// ============================================================

/** 获取当前用户的项目列表 */
export function fetchProjects() {
  return request<ProjectListItem[]>({
    url: '/sequence-player/projects'
  });
}

/** 获取项目详情 */
export function fetchProject(id: string) {
  return request<ProjectDetail>({
    url: `/sequence-player/projects/${id}`
  });
}

/** 创建新项目 */
export function createProject(payload: SaveProjectPayload) {
  return request<ProjectListItem>({
    url: '/sequence-player/projects',
    method: 'post',
    data: payload
  });
}

/** 更新项目 */
export function updateProject(id: string, payload: SaveProjectPayload) {
  return request<{ updated_at: string }>({
    url: `/sequence-player/projects/${id}`,
    method: 'put',
    data: payload
  });
}

/** 删除项目 */
export function deleteProject(id: string) {
  return request<null>({
    url: `/sequence-player/projects/${id}`,
    method: 'delete'
  });
}

export function uploadSequenceImage(file: File) {
  const data = new FormData();
  data.append('image', file);
  return request<MediaAsset>({ url: '/sequence-player/assets', method: 'post', data, timeout: 60000 });
}
