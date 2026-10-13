import { request } from '../request';

export interface CourseAssetsError {
  reason: string;
  message: string;
}

export interface CourseAssetUnitCover {
  unitId: number;
  coverUrl: string;
  fromCache: boolean;
  error?: CourseAssetsError;
}

export interface CourseAssetUnitCoverResult {
  status: 'ready' | 'error';
  subjectId?: number;
  covers?: CourseAssetUnitCover[];
  cache?: {
    size: number;
    ttlMs: number;
  };
  error?: CourseAssetsError;
}

export interface CourseAssetPath {
  chapterId: number;
  arrangementId: number;
  itemType: string;
  name: string;
  hasCourseware: boolean;
  publishedAt?: string;
}

export interface CourseAssetTemplateDetail {
  subjectId: number;
  templateId: number;
  id: number;
  name: string;
  levels: Array<{
    levelNo: number;
    name?: string;
    units: Array<{
      unitId: number;
      title: string;
      order: number;
      levelNo: number;
      unitNo: number;
      contentType: string;
      coverUrl: string;
      paths?: CourseAssetPath[];
      livePathId?: number;
      livePathName?: string;
      practicePathId?: number;
      practicePathName?: string;
      materialLabel?: string;
      materialUrl?: string;
      pathSummary: string;
      error?: CourseAssetsError;
    }>;
  }>;
  error?: CourseAssetsError;
  source?: 'cache' | 'upstream';
  syncedAt?: string;
}

export interface CourseAssetTemplateDetailsResult {
  status: 'ready' | 'error';
  checkedAt?: string;
  templates?: CourseAssetTemplateDetail[];
  error?: CourseAssetsError;
}

export interface CourseAssetTemplateCacheResult {
  status: 'ready' | 'missing' | 'error';
  source?: 'cache';
  syncedAt?: string;
  template?: CourseAssetTemplateDetail;
  error?: CourseAssetsError;
}

export function fetchCourseAssetUnitCovers(payload: { subjectId: number | string; unitIds: Array<number | string> }) {
  return request<CourseAssetUnitCoverResult>({
    url: '/course-assets/unit-covers',
    method: 'post',
    data: payload,
  });
}

export function fetchCourseAssetTemplateDetails(payload: { templates: Array<{ subjectId: number; templateId: number }> }) {
  return request<CourseAssetTemplateDetailsResult>({ url: '/course-assets/template-details', method: 'post', data: payload, timeout: 180000 });
}

export function fetchCourseAssetTemplateCache(params: { subjectId: number; templateId: number }) {
  return request<CourseAssetTemplateCacheResult>({ url: '/course-assets/template-cache', params, silentError: true });
}

export interface CourseAssetTemplateCheck {
  status: 'fresh' | 'stale' | 'missing' | 'error';
  checkedAt?: string;
  error?: CourseAssetsError;
}

export function fetchCourseAssetTemplateCheck(params: { subjectId: number; templateId: number }) {
  return request<CourseAssetTemplateCheck>({ url: '/course-assets/template-check', params, timeout: 180000, silentError: true });
}

export function fetchCourseAssetCatalog(context: 'assets' | 'structure') {
  return request<CourseAssetTemplateDetailsResult>({
    url: context === 'assets' ? '/course-assets/catalog' : '/course-structure/template-catalog',
    silentError: true,
  });
}
