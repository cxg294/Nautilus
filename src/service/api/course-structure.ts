import { request } from '../request';

export interface CourseStructureError {
  reason: string;
  message: string;
  output?: string;
}

export interface CourseStructureStatus {
  status: 'ready' | 'error';
  cli?: {
    available: boolean;
  };
  auth?: {
    identity: string;
    tokenStatus: string;
    userName: string;
    userOpenId: string;
    roleCodes: string[];
    grantedAt: string;
    expiresAt: string;
    refreshExpiresAt: string;
  };
  cache?: {
    memory?: {
      size: number;
      ttlMs: number;
    };
    persisted?: {
      count: number;
      bytes: number;
      latestUpdatedAt: string;
    };
  };
  durationMs?: number;
  error?: CourseStructureError;
}

export interface CourseStructureSource {
  provider: string;
  cacheKey: string;
  generatedAt: string;
  fromCache: boolean;
  cacheStatus?: 'fresh' | 'stale' | 'missing' | string;
  updateAvailable?: boolean;
  resourceListIncomplete?: boolean;
  cachedAt?: string;
  checkedAt?: string;
}

export interface CourseStructureCourse {
  subjectId: number;
  unitId: number;
  unitName: string;
  unitContentType: string;
  chapterId: number;
  chapterName: string;
  itemType: string;
  arrangementId: number | null;
  arrangementDescription: string;
  arrangementPublishTime: string;
  zipUrl: string;
  zipMd5: string;
  zipPlatform: string;
}

export interface CourseStructureStats {
  nodeCount: number;
  edgeCount: number;
  videoCount: number;
  checkpointCount: number;
  questionCount: number;
  mappedQuestionCount: number;
}

export interface CourseStructureVideo {
  objectId: number;
  objectName: string;
  url: string;
  playPattern: string;
  width: number | null;
  height: number | null;
  isStayEnd: boolean;
  nodeId?: number;
  nodeName?: string;
  sequenceNo?: string;
  senseId?: number | null;
}

export interface CourseStructureQuestion {
  questionId: number;
  questionType: string;
  name: string;
  difficulty: number | null;
  isHomework: boolean;
  stem: unknown;
  analyze: unknown;
  description: string;
  originChapterDescription: string;
  learningTarget: string;
  startDescriptionList: Array<Record<string, unknown>>;
  auxiliaryTips: Array<Record<string, unknown>>;
  feedbackCount: number;
  pictures: Array<Record<string, unknown>>;
  objectUrls: string[];
  descPictureUrls: string[];
  webThumbnailUrl: string;
  options: Array<{
    index: number;
    label: string;
    isAnswer: boolean;
    resourceUrls: string[];
  }>;
  drags: Array<Record<string, unknown>>;
  hotAreas: Array<Record<string, unknown>>;
  correctType: string;
  ideType: string;
  answerUrl: string;
  projectUrl: string;
  playerUrl: string;
  grammarJudgementUrl: string;
  defaultOpenFile: string;
  runResultShowUrl: string;
  projectExtendJson: Array<Record<string, unknown>>;
  taskTargets: Array<{
    key: string;
    name: string;
    value: string;
    autoPlay: boolean;
  }>;
  resourceRefs: Array<{
    kind: string;
    label: string;
    url: string;
    source: string;
  }>;
  codeTemplates: Array<Record<string, unknown>>;
}

export interface CourseStructureCheckpoint {
  checkpointKey: string;
  name: string;
  writeCheckpointType: string;
  passType: string;
  noPassType: string;
  description: string;
  targetLearningTime: number | null;
  questionIds: number[];
  questions: CourseStructureQuestion[];
  graph: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
}

export interface CourseStructureBoard {
  objectId: number;
  objectName: string;
  calculusKey: string;
  checkpointId: number | null;
  difficulty: number | null;
  answerStatus: string;
  knowledge: unknown;
  successfulGoal: unknown;
  tipButton: unknown;
  resourceRefs: Array<{
    kind: string;
    label: string;
    url: string;
    source: string;
  }>;
  checkpoint: CourseStructureCheckpoint | null;
}

export interface CourseStructureH5Object {
  objectId: number;
  objectName: string;
  h5Url: string;
  kanbanUrl: string;
  openInWindow: boolean;
}

export type CourseStructureNodeKind =
  | 'start'
  | 'end'
  | 'stage'
  | 'share'
  | 'exam'
  | 'video'
  | 'dialog-video'
  | 'dialog'
  | 'unknown'
  | string;

export interface CourseStructureNode {
  nodeId: number;
  nodeName: string;
  nodeType: string;
  kind: CourseStructureNodeKind;
  sequenceNo: string;
  senseId: number | null;
  pageType: string;
  subPageType: string;
  senseType: string;
  objectTypes: string[];
  nodeProgress: number | null;
  necessary: boolean;
  isSelection: boolean;
  hideInSelectList: boolean;
  shareTargetNodeId: number | null;
  isSideNode: boolean;
  orderIndex: number;
  videos: CourseStructureVideo[];
  boards: CourseStructureBoard[];
  h5Objects: CourseStructureH5Object[];
  objectUrls: string[];
  learningData: null;
}

export interface CourseStructureGraph {
  orderedNodeIds: string[];
  sideNodeIds: string[];
  edges: Array<{
    sourceNodeId: number;
    targetNodeId: number;
    name: string;
    listenVars: string[];
    conditionCodeScript: string;
  }>;
}

export interface CourseStructureResult {
  status: 'ready' | 'error';
  source?: CourseStructureSource;
  course?: CourseStructureCourse;
  stats?: CourseStructureStats;
  graph?: CourseStructureGraph;
  nodes?: CourseStructureNode[];
  videos?: CourseStructureVideo[];
  learningDataStatus?: 'todo' | string;
  error?: CourseStructureError;
}

export interface CourseStructureCacheMeta {
  exists: boolean;
  cacheKey: string;
  status: 'fresh' | 'stale' | 'missing' | string;
  updateAvailable: boolean;
  parsedAt: string;
  updatedAt: string;
  cachedZipMd5: string;
  currentZipMd5: string;
  structureBytes: number;
  course: CourseStructureCourse;
}

export interface CourseStructureMetaResult {
  status: 'ready' | 'error';
  source?: {
    provider: string;
    checkedAt: string;
    cacheKey: string;
  };
  course?: CourseStructureCourse;
  cache?: CourseStructureCacheMeta;
  error?: CourseStructureError;
}

export interface CourseStructureQuery {
  subjectId: number | string;
  unitId: number | string;
  chapterId?: number | string;
  forceRefresh?: boolean;
}

export interface CourseStructureChapter {
  id: number;
  name: string;
  partId: number;
  partName: string;
  itemType: string;
  hasCourseware: boolean;
}

export interface CourseStructureChaptersResult {
  status: 'ready' | 'error';
  unit?: { subjectId: number; unitId: number; unitName: string };
  chapters?: CourseStructureChapter[];
  checkedAt?: string;
  error?: CourseStructureError;
}

export interface CourseAssetPreview {
  status: 'ready' | 'error';
  source?: {
    url: string;
    archive: boolean;
    contentType: string;
    fromCache: boolean;
    fetchedAt: string;
  };
  fileName?: string;
  language?: string;
  availableFiles?: string[];
  content?: string;
  bytes?: number;
  truncated?: boolean;
  error?: CourseStructureError;
}

export function fetchCourseStructureStatus() {
  return request<CourseStructureStatus>({ url: '/course-structure/status' });
}

export function fetchCourseStructureUnit(params: CourseStructureQuery) {
  return request<CourseStructureResult>({ url: '/course-structure/unit', params, timeout: 180000, silentError: true });
}

export function fetchCourseStructureChapters(params: Omit<CourseStructureQuery, 'chapterId' | 'forceRefresh'>) {
  return request<CourseStructureChaptersResult>({ url: '/course-structure/unit/chapters', params, silentError: true });
}

export function fetchCourseStructureUnitMeta(params: Omit<CourseStructureQuery, 'forceRefresh'>) {
  return request<CourseStructureMetaResult>({ url: '/course-structure/unit/meta', params, silentError: true });
}

export function fetchCourseAssetPreview(params: { url: string; defaultOpenFile?: string }) {
  return request<CourseAssetPreview>({ url: '/course-structure/asset-preview', params });
}
