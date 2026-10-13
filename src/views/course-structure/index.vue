<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchCourseAssetPreview,
  fetchCourseStructureChapters,
  fetchCourseStructureUnit,
  fetchCourseStructureUnitMeta,
  type CourseAssetPreview,
  type CourseStructureBoard,
  type CourseStructureChapter,
  type CourseStructureMetaResult,
  type CourseStructureNode,
  type CourseStructureQuestion,
  type CourseStructureResult,
} from '@/service/api/course-structure';
import { loadCourseCatalog } from '@/views/course-assets/catalog';
import { usePageTracker } from '@/hooks/common/use-tracker';

import CoursePicker from './modules/course-picker.vue';
import PathOutlineView from './modules/path-outline.vue';
import { buildPathOutline } from './path-outline';
import { describeCondition } from './condition-description';
import { collectResources, contentCounts, nodeConnections, questionResources, questionTypeLabel } from './presentation';

defineOptions({ name: 'CourseStructure' });

usePageTracker('course-structure');

const message = useMessage();
const route = useRoute();
const router = useRouter();

type PathFilter = 'all' | 'questions';
type CodePreviewKind = 'project' | 'answer';
type AnswerCodeViewMode = 'diff' | 'plain';
type CodeDiffLineKind = 'same' | 'add' | 'remove';
type MaterialFilter = 'all' | 'video' | 'h5' | 'boards' | 'resources';

interface CodePreviewState {
  loading: boolean;
  data: CourseAssetPreview | null;
  error: string;
}

interface CodeDiffLine {
  kind: CodeDiffLineKind;
  beforeLine: number | null;
  afterLine: number | null;
  text: string;
}

interface CodeDiffResult {
  status: 'ready' | 'missing' | 'large' | 'same';
  lines: CodeDiffLine[];
  message: string;
  truncated: boolean;
}

interface ChoiceDisplayOption {
  index: number;
  label: string;
  isAnswer: boolean;
  audioUrl: string;
  resourceUrls: string[];
}

const subjectId = ref<number | null>(19);
const unitId = ref<number | null>(146685);
const chapterId = ref<number | null>(null);
const pendingChapterId = ref<number | null>(null);
const failedChapterId = ref<number | null>(null);
let committingLoadedChapter = false;
const chapters = ref<CourseStructureChapter[]>([]);
const chaptersLoading = ref(false);
const selectedTemplateId = ref<number | null>(5944);
const operationError = ref('');
const chaptersError = ref('');
const metaError = ref('');
const initializing = ref(true);
const expandedResources = ref<Record<string, boolean>>({});
let selectionVersion = 0;
const selectedNodeId = ref<number | null>(null);
const pathFilter = ref<PathFilter>('all');
const materialFilter = ref<MaterialFilter>('all');
const loading = ref(false);
const checking = ref(false);
const filterDrawerVisible = ref(false);

const structure = ref<CourseStructureResult | null>(null);
const courseMeta = ref<CourseStructureMetaResult | null>(null);
const codePreviewStates = ref<Record<string, CodePreviewState>>({});
const codePreviewModes = ref<Record<number, CodePreviewKind>>({});
const answerCodeViewModes = ref<Record<number, AnswerCodeViewMode>>({});
const judgeJsDownloading = ref<Record<number, boolean>>({});
const maxVisibleCodeLines = 500;
const maxDiffCompareLines = 700;
const codeDiffCache = new Map<number, { project: string; answer: string; value: CodeDiffResult }>();

const nodeKindMeta: Record<string, { label: string; icon: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  video: { label: '视频', icon: 'mdi:play-circle-outline', type: 'info' },
  'dialog-video': { label: '对话视频', icon: 'mdi:message-video', type: 'info' },
  dialog: { label: '对话', icon: 'mdi:message-text-outline', type: 'default' },
  stage: { label: '关卡', icon: 'mdi:code-braces', type: 'success' },
  share: { label: '分享', icon: 'mdi:share-variant-outline', type: 'warning' },
  exam: { label: '测试', icon: 'mdi:clipboard-check-outline', type: 'error' },
  unknown: { label: '节点', icon: 'mdi:circle-outline', type: 'default' },
};

const chapterOptions = computed(() => chapters.value.map(chapter => ({
  value: chapter.id,
  label: `${chapter.partName ? `${chapter.partName} · ` : ''}${chapter.name} (${chapter.id})${chapter.hasCourseware ? '' : ' · 无课件'}`,
  disabled: !chapter.hasCourseware,
})));
const chapterSwitchOptions = computed(() => chapters.value.map(chapter => ({
  value: chapter.id,
  label: `${chapter.partName && chapter.partName !== chapter.name ? `${chapter.partName} · ` : ''}${chapter.name}${chapter.hasCourseware ? '' : ' · 无课件'}`,
  disabled: !chapter.hasCourseware,
})));

const nodes = computed(() => structure.value?.nodes || []);
const preferPathList = ref(false);
const pathOutline = computed(() => buildPathOutline(nodes.value, structure.value?.graph));
const showPathList = computed(() => preferPathList.value || !pathOutline.value.supported);
const questionNodeIds = computed(() => nodes.value.filter(hasQuestionContent).map(node => node.nodeId));
const course = computed(() => structure.value?.course || courseMeta.value?.course || null);
const source = computed(() => structure.value?.source || null);
const cacheMeta = computed(() => courseMeta.value?.cache || null);
const visibleNodes = computed(() => {
  if (pathFilter.value === 'all') return nodes.value;
  return nodes.value.filter(node => hasQuestionContent(node));
});
const selectedNode = computed(() => visibleNodes.value.find(node => node.nodeId === selectedNodeId.value) || visibleNodes.value[0] || null);
const selectedVideos = computed(() => selectedNode.value?.videos || []);
const selectedBoards = computed(() => selectedNode.value?.boards || []);
const selectedH5Objects = computed(() => selectedNode.value?.h5Objects || []);
const selectedQuestions = computed(() => selectedBoards.value.flatMap(board => board.checkpoint?.questions || []));
const hasStructureError = computed(() => structure.value?.status === 'error');
const selectedResources = computed(() => collectResources(selectedNode.value));
const nodeCounts = computed(() => contentCounts(selectedNode.value ? [selectedNode.value] : []));
const courseCounts = computed(() => contentCounts(nodes.value));
const connections = computed(() => nodeConnections(selectedNode.value, nodes.value, structure.value?.graph)
  .map(edge => ({ ...edge, condition: describeCondition(edge.conditionCodeScript) })));
const outgoingCounts = computed(() => {
  const counts = new Map<string, number>();
  structure.value?.graph?.edges.forEach(edge => counts.set(String(edge.sourceNodeId), (counts.get(String(edge.sourceNodeId)) || 0) + 1));
  return counts;
});
const remainingResources = computed(() => {
  if (materialFilter.value === 'resources') return selectedResources.value;
  const shown = new Set(selectedBoards.value.flatMap(board => [
    ...(board.checkpoint?.questions.some(isCodeQuestion) ? board.resourceRefs || [] : []).map(item => item.url),
    ...(board.checkpoint?.questions || []).flatMap(question => getQuestionResources(question).map(item => item.url)),
  ]));
  return selectedResources.value.filter(item => !shown.has(item.url));
});
const headerStats = computed(() => [
  { label: '节点', value: courseCounts.value.nodes },
  { label: '视频', value: courseCounts.value.videos },
  { label: '关卡', value: courseCounts.value.checkpoints },
  { label: '题目', value: courseCounts.value.questions },
]);
const materialFilterItems = computed<Array<{ key: MaterialFilter; label: string; icon: string; count?: string }>>(() => [
  { key: 'all', label: '全部', icon: 'mdi:view-dashboard-outline' },
  { key: 'video', label: '视频', icon: 'mdi:play-circle-outline', count: String(selectedVideos.value.length) },
  { key: 'h5', label: 'H5', icon: 'mdi:web', count: String(selectedH5Objects.value.length) },
  { key: 'boards', label: '关卡与题目', icon: 'mdi:code-braces', count: `${nodeCounts.value.checkpoints} 关卡 · ${nodeCounts.value.questions} 题` },
  { key: 'resources', label: '素材', icon: 'mdi:paperclip', count: String(selectedResources.value.length) },
].filter(item => item.key === 'all' || (item.key === 'boards' ? selectedBoards.value.length > 0 : item.count !== '0')) as Array<{ key: MaterialFilter; label: string; icon: string; count?: string }>);
const updateAvailable = computed(() => Boolean(source.value?.resourceListIncomplete || (cacheMeta.value?.updateAvailable ?? source.value?.updateAvailable)));
const canView = computed(() => Boolean(subjectId.value && unitId.value && chapterId.value && !chaptersLoading.value && !chaptersError.value));
const actionLabel = computed(() => loading.value ? '正在加载…' : operationError.value ? '重试查看' : updateAvailable.value ? '更新并查看' : '查看结构');
const selectionStatus = computed(() => {
  if (loading.value) return '正在加载课程内容…';
  if (chaptersLoading.value) return '正在读取课程路径…';
  if (checking.value) return '正在检查课包版本…';
  if (chaptersError.value || operationError.value) return '加载失败，可以重试或选择其他课程';
  if (metaError.value) return '暂时无法检查版本，仍可尝试查看结构';
  if (!unitId.value) return '请选择一个 Unit';
  if (!chapterId.value && !initializing.value) return '此 Unit 暂无可解析课件';
  if (updateAvailable.value) return source.value?.resourceListIncomplete ? '可重新解析，补齐旧结果的素材' : '有新版课包，点击“更新并查看”加载最新内容';
  if (cacheMeta.value?.exists) return '已有解析结果，版本已核对';
  if (courseMeta.value) return '首次查看时将自动解析课包';
  return '尚未检查课包版本';
});

function resourcePage<T>(items: T[], key: string, limit = 8) {
  return expandedResources.value[key] ? items : items.slice(0, limit);
}
function toggleResources(key: string) { expandedResources.value[key] = !expandedResources.value[key]; }
function jumpToNode(node: CourseStructureNode) {
  if (pathFilter.value === 'questions' && !hasQuestionContent(node)) pathFilter.value = 'all';
  selectedNodeId.value = node.nodeId;
}
function supplementaryResources(board: CourseStructureBoard, question: CourseStructureQuestion) {
  const pictures = new Set(getQuestionPictureResources(question).map(item => item.url));
  return getBoardPreviewResources(board, question).filter(item => !pictures.has(item.url));
}

function getQueryNumber(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  const numeric = Number(raw);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function isAutoLoadQuery(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === '1' || raw === 'true';
}

function applyRouteQuery() {
  const querySubjectId = getQueryNumber(route.query.subjectId);
  const queryUnitId = getQueryNumber(route.query.unitId);
  const queryChapterId = getQueryNumber(route.query.chapterId);

  if (querySubjectId && queryUnitId) {
    subjectId.value = querySubjectId;
    unitId.value = queryUnitId;
    chapterId.value = queryChapterId;
    structure.value = null;
    courseMeta.value = null;
  }

  return Boolean(querySubjectId && queryUnitId && isAutoLoadQuery(route.query.auto));
}

watch([subjectId, unitId, chapterId], () => {
  if (committingLoadedChapter) return;
  pendingChapterId.value = null;
  failedChapterId.value = null;
  preferPathList.value = false;
  selectionVersion += 1;
  structure.value = null;
  courseMeta.value = null;
  operationError.value = '';
  metaError.value = '';
  loading.value = false;
  checking.value = false;
}, { flush: 'sync' });

watch([subjectId, unitId], () => {
  if (!initializing.value) { chapterId.value = null; void loadChapters(); }
});
watch(chapterId, () => {
  if (structure.value?.course?.chapterId === chapterId.value) return;
  if (!initializing.value && !chaptersLoading.value && chapterId.value) void checkUnitMeta();
});

watch(visibleNodes, value => {
  if (!value.length) {
    selectedNodeId.value = null;
    return;
  }

  if (!value.some(node => node.nodeId === selectedNodeId.value)) {
    selectedNodeId.value = value[0].nodeId;
  }
});

watch(selectedQuestions, questions => {
  questions.forEach(question => {
    loadQuestionCodePreviews(question);
  });
});

watch(selectedNode, () => {
  materialFilter.value = 'all';
});

watch(
  () => route.query,
  async () => {
    if (initializing.value) return;
    if (structure.value && getQueryNumber(route.query.subjectId) === subjectId.value
      && getQueryNumber(route.query.unitId) === unitId.value && getQueryNumber(route.query.chapterId) === chapterId.value) return;
    initializing.value = true;
    const auto = applyRouteQuery();
    await loadChapters();
    initializing.value = false;
    if (auto) await loadStructure(false);
    else if (chapterId.value) void checkUnitMeta();
  }
);

function getNodeMeta(node: CourseStructureNode | null) {
  if (!node) return nodeKindMeta.unknown;
  return nodeKindMeta[node.kind] || nodeKindMeta.unknown;
}

function hasQuestionContent(node: CourseStructureNode) {
  return node.boards.some(board => {
    const checkpoint = board.checkpoint;
    return Boolean(checkpoint?.questions?.length || checkpoint?.questionIds?.length);
  });
}

function hasH5Object(node: CourseStructureNode) {
  return node.objectTypes.some(type => String(type).toLowerCase().includes('h5')) || Boolean(node.h5Objects?.length);
}

function getQuestionAssetCount(question: CourseStructureQuestion) {
  return getQuestionResources(question).length;
}

function getPrimaryQuestionUrl(question: CourseStructureQuestion) {
  return question.projectUrl || question.answerUrl || question.playerUrl || '';
}

function handleSelectNode(node: CourseStructureNode) {
  selectedNodeId.value = node.nodeId;
}

function isMaterialSectionVisible(section: Exclude<MaterialFilter, 'all'>) {
  return materialFilter.value === 'all' || materialFilter.value === section;
}

function stringifyValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseJsonLike(value: unknown) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text || !/^[[{]/.test(text)) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function buildUrlFromObject(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';

  const item = value as Record<string, unknown>;
  const httpPre = typeof item.httpPre === 'string' ? item.httpPre : '';
  const relativePath = typeof item.relativePath === 'string' ? item.relativePath : '';
  const suffix = typeof item.suffix === 'string' ? item.suffix : '';
  return `${httpPre}${relativePath}${suffix}`;
}

function getContentFromValue(value: unknown) {
  const parsed = parseJsonLike(value);
  if (!parsed || typeof parsed !== 'object') return stringifyValue(parsed);

  const item = parsed as Record<string, unknown>;
  return stringifyValue(item.content || item.text || item.title || item.name || item.value || '');
}

function getAudioUrlFromValue(value: unknown) {
  const parsed = parseJsonLike(value);
  if (!parsed || typeof parsed !== 'object') return '';

  const item = parsed as Record<string, unknown>;
  return buildUrlFromObject(item.audioUrl || item.audio || item.voiceUrl || item.url);
}

function getMortonSpace(board?: CourseStructureBoard | null) {
  const key = board?.calculusKey || selectedBoards.value[0]?.calculusKey || '';
  const match = key.match(/^([A-Za-z]+Morton)-/);
  if (match?.[1]) return match[1];

  const subject = course.value?.subjectId || subjectId.value || 0;
  if (subject === 17) return 'ScratchMorton';
  if (subject === 19) return 'PythonMorton';
  if (subject === 21) return 'CPPMorton';
  return 'ScratchMorton';
}

function getQuestionManagerUrl(question: CourseStructureQuestion) {
  return `https://morton.hetao101.com/fe_morton/morton/examManager/${encodeURIComponent(question.questionType || 'CUSTOM')}`;
}

function getLevelManagerUrl(board: CourseStructureBoard) {
  return `https://morton.hetao101.com/fe_morton/morton/levelManager/${encodeURIComponent(getMortonSpace(board))}`;
}

function getSceneManagerUrl(node: CourseStructureNode) {
  return `https://morton.hetao101.com/fe_morton/morton/senseManger/${encodeURIComponent(getMortonSpace(node.boards[0]))}`;
}

async function copyText(text: string, label: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    message.success(`${label} 已复制`);
  } catch {
    message.warning(`${label} 复制失败，已打开页面`);
  }
}

async function copyAndOpen(text: string, label: string, url: string) {
  await copyText(text, label);
  openUrl(url);
}

function isCodeQuestion(question: CourseStructureQuestion) {
  const type = question.questionType.toUpperCase();
  return ['PYTHON', 'CPP'].includes(type) || /\.(py|cpp|cc|cxx|c|h|hpp)(?:$|\?)/i.test(`${question.answerUrl} ${question.projectUrl}`);
}

function getCodePreviewKey(question: CourseStructureQuestion, kind: CodePreviewKind) {
  return JSON.stringify([question.questionId, kind, getCodePreviewUrl(question, kind), question.defaultOpenFile || '']);
}

function getCodePreviewUrl(question: CourseStructureQuestion, kind: CodePreviewKind) {
  return kind === 'project' ? question.projectUrl : question.answerUrl;
}

function getAvailableCodeKinds(question: CourseStructureQuestion) {
  const kinds: CodePreviewKind[] = [];
  if (question.projectUrl) kinds.push('project');
  if (question.answerUrl) kinds.push('answer');
  return kinds;
}

function getCodePreviewMode(question: CourseStructureQuestion) {
  const saved = codePreviewModes.value[question.questionId];
  if (saved && getCodePreviewUrl(question, saved)) return saved;
  return question.projectUrl ? 'project' : 'answer';
}

function setCodePreviewMode(question: CourseStructureQuestion, value: string | number | boolean) {
  const kind: CodePreviewKind = value === 'answer' ? 'answer' : 'project';
  if (!getCodePreviewUrl(question, kind)) return;

  codePreviewModes.value = {
    ...codePreviewModes.value,
    [question.questionId]: kind,
  };
  void loadCodePreview(question, kind);
}

function getAnswerCodeViewMode(question: CourseStructureQuestion) {
  return answerCodeViewModes.value[question.questionId] || 'plain';
}

function setAnswerCodeViewMode(question: CourseStructureQuestion, value: string | number | boolean) {
  const mode: AnswerCodeViewMode = value === 'plain' ? 'plain' : 'diff';
  answerCodeViewModes.value = {
    ...answerCodeViewModes.value,
    [question.questionId]: mode,
  };
}

function setCodePreviewState(key: string, state: CodePreviewState) {
  codePreviewStates.value = {
    ...codePreviewStates.value,
    [key]: state,
  };
}

function getCodePreviewState(question: CourseStructureQuestion, kind: CodePreviewKind) {
  return codePreviewStates.value[getCodePreviewKey(question, kind)];
}

async function loadCodePreview(question: CourseStructureQuestion, kind: CodePreviewKind) {
  const url = getCodePreviewUrl(question, kind);
  if (!url || !isCodeQuestion(question)) return;

  const key = getCodePreviewKey(question, kind);
  const current = codePreviewStates.value[key];
  if (current?.loading || current?.data?.status === 'ready') return;

  setCodePreviewState(key, { loading: true, data: null, error: '' });
  const { data, error } = await fetchCourseAssetPreview({
    url,
    defaultOpenFile: question.defaultOpenFile || undefined,
  });

  if (error || data?.status === 'error') {
    setCodePreviewState(key, {
      loading: false,
      data: data || null,
      error: data?.error?.message || error?.message || '代码预览失败',
    });
    return;
  }

  setCodePreviewState(key, {
    loading: false,
    data: data || null,
    error: '',
  });
}

function loadQuestionCodePreviews(question: CourseStructureQuestion) {
  if (!isCodeQuestion(question)) return;
  void loadCodePreview(question, 'project');
  void loadCodePreview(question, 'answer');
}

function getCodePreviewTitle(kind: CodePreviewKind) {
  return kind === 'project' ? '项目初始代码' : '答案代码';
}

async function copyCodePreview(question: CourseStructureQuestion, kind: CodePreviewKind) {
  const content = getCodePreviewState(question, kind)?.data?.content || '';
  await copyText(content, getCodePreviewTitle(kind));
}

function getJudgeJsFileName(question: CourseStructureQuestion) {
  const remoteName = getFileNameFromUrl(question.grammarJudgementUrl);
  const suffix = remoteName.endsWith('.js') ? remoteName : 'judge.js';
  return `${question.questionType.toLowerCase()}-${question.questionId}-${suffix}`;
}

function isJudgeJsDownloading(question: CourseStructureQuestion) {
  return Boolean(judgeJsDownloading.value[question.questionId]);
}

async function downloadJudgeJs(question: CourseStructureQuestion) {
  if (!question.grammarJudgementUrl) {
    message.warning('这个题目没有判定 JS 地址');
    return;
  }

  judgeJsDownloading.value = {
    ...judgeJsDownloading.value,
    [question.questionId]: true,
  };

  try {
    const { data, error } = await fetchCourseAssetPreview({
      url: question.grammarJudgementUrl,
    });

    if (error || data?.status === 'error' || !data?.content) {
      message.error(data?.error?.message || error?.message || '判定 JS 下载失败');
      return;
    }

    const blob = new Blob([data.content], { type: 'text/javascript;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = getJudgeJsFileName(question);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    message.success('判定 JS 已下载');
  } finally {
    judgeJsDownloading.value = {
      ...judgeJsDownloading.value,
      [question.questionId]: false,
    };
  }
}

function getCurrentCodePreviewState(question: CourseStructureQuestion) {
  return getCodePreviewState(question, getCodePreviewMode(question));
}

function getCurrentCodePreviewTitle(question: CourseStructureQuestion) {
  return getCodePreviewTitle(getCodePreviewMode(question));
}

function getCodeLines(content = '') {
  const lines = normalizeCodeContent(content).split('\n');
  return lines.slice(0, maxVisibleCodeLines).map((text, index) => ({
    line: index + 1,
    text: text || ' ',
  }));
}

function isCodeLineLimited(content = '') {
  return normalizeCodeContent(content).split('\n').length > maxVisibleCodeLines;
}

function getFileNameFromUrl(url: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
  } catch {
    return url.split('/').filter(Boolean).pop() || '';
  }
}

function getCurrentCodeFileName(question: CourseStructureQuestion) {
  const kind = getCodePreviewMode(question);
  return getCurrentCodePreviewState(question)?.data?.fileName || question.defaultOpenFile || getFileNameFromUrl(getCodePreviewUrl(question, kind));
}

function normalizeCodeContent(content = '') {
  return content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function getPreviewContent(question: CourseStructureQuestion, kind: CodePreviewKind) {
  return getCodePreviewState(question, kind)?.data?.content || '';
}

function createCodeDiff(projectContent: string, answerContent: string): CodeDiffResult {
  const projectLines = normalizeCodeContent(projectContent).split('\n');
  const answerLines = normalizeCodeContent(answerContent).split('\n');

  if (!projectContent || !answerContent) {
    return {
      status: 'missing',
      lines: [],
      message: '初始代码或答案代码尚未加载完成',
      truncated: false,
    };
  }

  if (projectLines.length > maxDiffCompareLines || answerLines.length > maxDiffCompareLines) {
    return {
      status: 'large',
      lines: [],
      message: `代码超过 ${maxDiffCompareLines} 行，已切回纯答案阅读`,
      truncated: true,
    };
  }

  if (projectContent === answerContent) {
    return {
      status: 'same',
      lines: answerLines.slice(0, maxVisibleCodeLines).map((text, index) => ({
        kind: 'same',
        beforeLine: index + 1,
        afterLine: index + 1,
        text: text || ' ',
      })),
      message: '答案代码与初始代码一致',
      truncated: answerLines.length > maxVisibleCodeLines,
    };
  }

  const rowCount = projectLines.length + 1;
  const colCount = answerLines.length + 1;
  const table = Array.from({ length: rowCount }, () => Array(colCount).fill(0) as number[]);

  for (let i = projectLines.length - 1; i >= 0; i -= 1) {
    for (let j = answerLines.length - 1; j >= 0; j -= 1) {
      table[i][j] = projectLines[i] === answerLines[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const lines: CodeDiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < projectLines.length || j < answerLines.length) {
    if (i < projectLines.length && j < answerLines.length && projectLines[i] === answerLines[j]) {
      lines.push({
        kind: 'same',
        beforeLine: i + 1,
        afterLine: j + 1,
        text: projectLines[i] || ' ',
      });
      i += 1;
      j += 1;
    } else if (j < answerLines.length && (i >= projectLines.length || table[i][j + 1] >= table[i + 1][j])) {
      lines.push({
        kind: 'add',
        beforeLine: null,
        afterLine: j + 1,
        text: answerLines[j] || ' ',
      });
      j += 1;
    } else if (i < projectLines.length) {
      lines.push({
        kind: 'remove',
        beforeLine: i + 1,
        afterLine: null,
        text: projectLines[i] || ' ',
      });
      i += 1;
    }
  }

  const truncated = lines.length > maxVisibleCodeLines;
  return {
    status: 'ready',
    lines: lines.slice(0, maxVisibleCodeLines),
    message: '',
    truncated,
  };
}

function getCodeDiffResult(question: CourseStructureQuestion) {
  const project = getPreviewContent(question, 'project');
  const answer = getPreviewContent(question, 'answer');
  const cached = codeDiffCache.get(question.questionId);

  if (cached?.project === project && cached.answer === answer) return cached.value;

  const value = createCodeDiff(project, answer);
  codeDiffCache.set(question.questionId, { project, answer, value });
  return value;
}

function shouldShowCodeDiff(question: CourseStructureQuestion) {
  return getCodePreviewMode(question) === 'answer' && getAnswerCodeViewMode(question) === 'diff';
}

function shouldFallbackToPlainAnswer(question: CourseStructureQuestion) {
  const diff = getCodeDiffResult(question);
  return shouldShowCodeDiff(question) && (diff.status === 'missing' || diff.status === 'large');
}

function getCodeDiffLineClass(line: CodeDiffLine) {
  return {
    'fake-code-line--add': line.kind === 'add',
    'fake-code-line--remove': line.kind === 'remove',
  };
}

function getCodeDiffMarker(line: CodeDiffLine) {
  if (line.kind === 'add') return '+';
  if (line.kind === 'remove') return '-';
  return ' ';
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|svg)(?:$|\?)/i.test(url);
}

function isAudioUrl(url: string) {
  return /\.(mp3|wav|ogg|m4a|aac)(?:$|\?)/i.test(url);
}

function getQuestionResources(question: CourseStructureQuestion) { return questionResources(question); }

function getQuestionPictureResources(question: CourseStructureQuestion) {
  return getQuestionResources(question).filter(item => item.kind === 'picture' || isImageUrl(item.url));
}

function getBoardPreviewResources(board: CourseStructureBoard, question: CourseStructureQuestion) {
  const merged = [
    ...(board.resourceRefs || []),
    ...getQuestionResources(question),
  ];
  const seen = new Set<string>();

  return merged.filter(item => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function getBoardInfoItems(board: CourseStructureBoard, question: CourseStructureQuestion) {
  return [
    { label: '关卡', value: board.objectName || board.calculusKey },
    { label: '关卡ID', value: board.checkpointId || board.calculusKey },
    { label: '题目ID', value: question.questionId },
    { label: '题型', value: questionTypeLabel(question.questionType) },
    { label: '判题', value: question.correctType === 'AUTO' ? '自动判题' : question.correctType ? '见配置详情' : '-' },
    { label: '运行环境', value: question.ideType === 'SKULPT' ? '浏览器 Python' : question.ideType ? '见配置详情' : '-' },
    { label: '难度', value: board.difficulty ?? question.difficulty ?? '-' },
    { label: '类型', value: board.checkpoint?.writeCheckpointType === 'IDE' ? '编程关卡' : '其他关卡' },
    { label: '资源', value: getBoardPreviewResources(board, question).length },
  ].filter(item => item.value !== '' && item.value !== null && item.value !== undefined);
}

function getResourceIcon(resource: { kind: string; url: string }) {
  if (isImageUrl(resource.url)) return 'mdi:image-outline';
  if (isAudioUrl(resource.url)) return 'mdi:volume-high';
  if (resource.kind === 'board') return 'mdi:cube-outline';
  return 'mdi:link-variant';
}

function isChoiceQuestion(question: CourseStructureQuestion) {
  return question.questionType === 'CHOICE';
}

function getChoiceStem(question: CourseStructureQuestion) {
  const content = getContentFromValue(question.stem) || question.description || question.name || '';
  const audioUrl = getAudioUrlFromValue(question.stem)
    || getQuestionResources(question).find(item => item.kind === 'audio' || isAudioUrl(item.url))?.url
    || '';

  return {
    content,
    audioUrl,
  };
}

function getChoiceOptions(question: CourseStructureQuestion): ChoiceDisplayOption[] {
  return (question.options || []).map((option, index) => {
    const optionRecord = option as unknown as Record<string, unknown>;
    const labelValue = optionRecord.label ?? optionRecord.content ?? optionRecord.text ?? optionRecord.value;
    const content = getContentFromValue(labelValue) || `选项 ${index + 1}`;
    const audioUrl = getAudioUrlFromValue(labelValue);
    const resourceUrls = [
      audioUrl,
      ...((option.resourceUrls || []) as string[]),
    ].filter(Boolean);

    return {
      index,
      label: content,
      isAnswer: Boolean(option.isAnswer),
      audioUrl,
      resourceUrls,
    };
  });
}

let metaRequest = 0;
async function loadStructure(forceRefresh = false, targetChapterId = chapterId.value) {
  if (!canView.value || loading.value) return;
  if (!targetChapterId) return;
  const version = selectionVersion;
  const changingChapter = targetChapterId !== chapterId.value;
  const targetChapter = chapters.value.find(chapter => chapter.id === targetChapterId);
  if (changingChapter && !targetChapter?.hasCourseware) return;
  loading.value = true;
  pendingChapterId.value = changingChapter ? targetChapterId : null;
  failedChapterId.value = null;
  operationError.value = '';
  metaError.value = '';
  ++metaRequest;
  checking.value = false;
  try {
    const { data, error } = await fetchCourseStructureUnit({
      subjectId: subjectId.value!, unitId: unitId.value!, chapterId: targetChapterId, forceRefresh,
    });
    if (version !== selectionVersion) return;
    if (error || !data || data.status === 'error') {
      failedChapterId.value = changingChapter ? targetChapterId : null;
      operationError.value = `${changingChapter ? `切换至“${targetChapter?.name}”失败，仍显示原路径。` : ''}${error?.message || data?.error?.message || '课程结构加载失败，请重试'}`;
      return;
    }
    if (changingChapter && data.course?.chapterId !== targetChapterId) throw new Error('返回的路径与所选路径不一致，请重新选择课程后重试');
    if (changingChapter) {
      // 成功后一次性提交路径与内容，等待和失败期间保留原工作区。
      committingLoadedChapter = true;
      chapterId.value = targetChapterId;
      committingLoadedChapter = false;
      selectedNodeId.value = null;
      pathFilter.value = 'all';
      preferPathList.value = false;
      expandedResources.value = {};
      codePreviewStates.value = {};
      codeDiffCache.clear();
    }
    structure.value = data;
    filterDrawerVisible.value = false;
    courseMeta.value = {
      status: 'ready', course: data.course,
      cache: data.course ? {
        exists: true, cacheKey: data.source?.cacheKey || '', status: data.source?.cacheStatus || 'fresh',
        updateAvailable: Boolean(data.source?.updateAvailable), parsedAt: data.source?.cachedAt || '', updatedAt: data.source?.checkedAt || '',
        cachedZipMd5: data.course.zipMd5, currentZipMd5: data.course.zipMd5, structureBytes: 0, course: data.course,
      } : undefined,
    };
    if (changingChapter) void router.replace({ query: { ...route.query, subjectId: String(subjectId.value),
      unitId: String(unitId.value), chapterId: String(targetChapterId), auto: '1' } });
  } catch (error) {
    if (version === selectionVersion) {
      failedChapterId.value = changingChapter ? targetChapterId : null;
      operationError.value = `${changingChapter ? `切换至“${targetChapter?.name}”失败，仍显示原路径。` : ''}${error instanceof Error ? error.message : '加载失败，请重试'}`;
    }
  } finally {
    if (version === selectionVersion) { loading.value = false; pendingChapterId.value = null; }
  }
}

function switchWorkspaceChapter(value: number) {
  if (value !== chapterId.value) void loadStructure(false, value);
}

function retryStructure() {
  return loadStructure(failedChapterId.value ? false : updateAvailable.value, failedChapterId.value || chapterId.value);
}

async function checkUnitMeta() {
  if (!canView.value || loading.value) return;
  const version = selectionVersion;
  const requestId = ++metaRequest;
  checking.value = true;
  metaError.value = '';
  try {
    const { data, error } = await fetchCourseStructureUnitMeta({ subjectId: subjectId.value!, unitId: unitId.value!, chapterId: chapterId.value! });
    if (version !== selectionVersion || requestId !== metaRequest) return;
    if (error || !data || data.status === 'error') metaError.value = error?.message || data?.error?.message || '版本检查失败';
    else courseMeta.value = data;
  } catch {
    if (version === selectionVersion && requestId === metaRequest) metaError.value = '版本检查失败';
  } finally {
    if (version === selectionVersion && requestId === metaRequest) checking.value = false;
  }
}

let chapterRequest = 0;
async function loadChapters() {
  const requestId = ++chapterRequest;
  chapters.value = [];
  chaptersError.value = '';
  if (!subjectId.value || !unitId.value) { chaptersLoading.value = false; return; }
  const requestSubjectId = subjectId.value;
  const requestUnitId = unitId.value;
  chaptersLoading.value = true;
  try {
    const { data, error } = await fetchCourseStructureChapters({ subjectId: requestSubjectId, unitId: requestUnitId });
    if (requestId !== chapterRequest || requestSubjectId !== subjectId.value || requestUnitId !== unitId.value) return;
    if (error || !data || data.status === 'error') {
      chaptersError.value = error?.message || data?.error?.message || '课程路径加载失败';
      return;
    }
    chapters.value = data.chapters || [];
    const selectable = chapters.value.filter(chapter => chapter.hasCourseware);
    if (!selectable.some(chapter => chapter.id === chapterId.value)) chapterId.value = selectable[0]?.id || null;
  } catch {
    if (requestId === chapterRequest) chaptersError.value = '课程路径加载失败';
  } finally {
    if (requestId === chapterRequest) chaptersLoading.value = false;
  }
  if (!initializing.value && requestId === chapterRequest && chapterId.value) void checkUnitMeta();
}

async function retrySelection() {
  if (chaptersError.value) await loadChapters();
  else if (operationError.value) await retryStructure();
  else await checkUnitMeta();
}

function openUrl(url: string) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

onMounted(async () => {
  await loadCourseCatalog('structure');
  const shouldAutoLoad = applyRouteQuery();
  await loadChapters();
  initializing.value = false;
  if (shouldAutoLoad) await loadStructure(false);
  else if (chapterId.value) void checkUnitMeta();
});
</script>

<template>
  <div class="course-structure-page">
    <NDrawer v-model:show="filterDrawerVisible" :width="560" placement="right">
      <NDrawerContent title="选择课程结构" closable>
        <CoursePicker
            v-model:subject-id="subjectId" v-model:unit-id="unitId" v-model:template-id="selectedTemplateId"
            v-model:chapter-id="chapterId" :chapters="chapterOptions" :chapters-loading="chaptersLoading"
            :busy="loading" :status="selectionStatus" :error="chaptersError || operationError || metaError"
            :action-label="actionLabel" :can-view="canView"
            @view="loadStructure(updateAvailable)" @force="loadStructure(true)" @check="checkUnitMeta" @retry="retrySelection"
          />
      </NDrawerContent>
    </NDrawer>

    <NSpin :show="loading">
      <section v-if="!structure" class="structure-landing">
        <div class="landing-intro">
          <span>课程结构解析</span>
          <h1>选择一个 Unit 查看路径与内容资源</h1>
          <p>先选课包，再进入路径结构、视频、关卡、题目和素材预览。</p>
        </div>

        <section class="landing-filter-card">
          <CoursePicker
            v-model:subject-id="subjectId" v-model:unit-id="unitId" v-model:template-id="selectedTemplateId"
            v-model:chapter-id="chapterId" :chapters="chapterOptions" :chapters-loading="chaptersLoading"
            :busy="loading" :status="selectionStatus" :error="chaptersError || operationError || metaError"
            :action-label="actionLabel" :can-view="canView"
            @view="loadStructure(updateAvailable)" @force="loadStructure(true)" @check="checkUnitMeta" @retry="retrySelection"
          />
        </section>
      </section>

      <section v-else class="workspace">
        <aside class="path-panel">
          <div class="workspace-course-picker">
            <div class="workspace-unit-heading">
              <strong :title="course?.unitName">{{ course?.unitName }}</strong>
              <NButton text size="tiny" :disabled="loading" @click="filterDrawerVisible = true">切换课程</NButton>
            </div>
            <label class="workspace-chapter-label" for="workspace-chapter">当前路径</label>
            <NSelect :input-props="{ id: 'workspace-chapter', 'aria-label': '当前路径' }" :value="pendingChapterId ?? chapterId" :options="chapterSwitchOptions"
              :loading="loading || chaptersLoading" :disabled="loading || chaptersLoading" filterable
              placeholder="选择路径" @update:value="switchWorkspaceChapter" />
            <small v-if="pendingChapterId">正在切换路径…</small>
            <small v-else-if="chapters.filter(item => item.hasCourseware).length === 1">此课程只有一条可查看路径</small>
          </div>
          <div class="panel-header">
            <span>路径结构</span>
            <div class="path-header-tools">
              <NRadioGroup v-model:value="pathFilter" size="small">
                <NRadioButton value="all">全部</NRadioButton>
                <NRadioButton value="questions">只看题</NRadioButton>
              </NRadioGroup>
              <NTag size="small" :bordered="false">{{ visibleNodes.length }} / {{ nodes.length }}</NTag>
            </div>
          </div>
          <div class="path-summary-mini" title="关卡与题目按 ID 去重计数；视频按出现次数计数">
            <div v-for="item in headerStats" :key="item.label" class="path-summary-item">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>

          <div class="path-view-tools">
            <span>{{ showPathList ? '列表视图' : '分支视图' }}</span>
            <NButton v-if="pathOutline.supported" text size="tiny" @click="preferPathList = !preferPathList">
              {{ showPathList ? '切换分支视图' : '切回原列表' }}
            </NButton>
          </div>
          <p class="structure-hint">{{ showPathList
            ? `${pathOutline.supported ? '' : pathOutline.reason + '，已使用原列表。'}点击节点查看右侧连接关系。`
            : '按连接展示，展开条件查看分支；共用内容通过“转至”定位。分支排列不代表执行优先级。' }}</p>
          <NEmpty v-if="!visibleNodes.length" description="暂无结构数据" />
          <PathOutlineView v-else-if="!showPathList" :outline="pathOutline" :selected-id="selectedNode?.nodeId ?? null"
            :questions-only="pathFilter === 'questions'" :question-ids="questionNodeIds" @select="jumpToNode" />
          <div v-else class="node-list">
            <button
              v-for="node in visibleNodes"
              :key="node.nodeId"
              class="node-item"
              :class="{ 'node-item--active': node.nodeId === selectedNode?.nodeId }"
              type="button"
              @click="handleSelectNode(node)"
            >
              <span class="node-rail">
                <span class="node-dot">
                  <SvgIcon :icon="getNodeMeta(node).icon" />
                </span>
              </span>
              <span class="node-main">
                <span class="node-title-row">
                  <span class="node-sequence">{{ node.sequenceNo || '-' }}</span>
                  <span class="node-title">{{ node.nodeName }}</span>
                </span>
                <span class="node-meta-row">
                  <NTag size="tiny" :type="getNodeMeta(node).type" :bordered="false">
                    {{ getNodeMeta(node).label }}
                  </NTag>
                  <NTag v-if="hasH5Object(node)" size="tiny" type="warning" :bordered="false">H5</NTag>
                  <span v-if="node.videos.length">{{ node.videos.length }} 视频</span>
                  <span v-if="node.boards.length">{{ node.boards.length }} 关卡</span>
                  <NTag v-if="(outgoingCounts.get(String(node.nodeId)) || 0) > 1" size="tiny" type="warning" :bordered="false">分支 {{ outgoingCounts.get(String(node.nodeId)) }}</NTag>
                  <NTag v-if="node.isSideNode" size="tiny" :bordered="false">分支节点</NTag>
                </span>
              </span>
            </button>
          </div>
        </aside>

        <main class="detail-panel">
          <div class="alert-stack">
            <NAlert
              v-if="updateAvailable"
              type="warning"
              class="error-alert"
              :show-icon="false"
            >
              {{ source?.resourceListIncomplete ? '旧解析结果中的素材可能不完整，重新解析可补齐。' : '课包有新版本，当前显示上次解析的内容。' }}
              <NButton text type="warning" :loading="loading" @click="loadStructure(true)">更新并查看</NButton>
            </NAlert>

            <NAlert v-if="operationError || hasStructureError" type="error" class="error-alert" :show-icon="false">
              {{ operationError || structure?.error?.message || '课程结构解析失败' }}
              <NButton text @click="retryStructure">重试</NButton>
              <NButton text @click="filterDrawerVisible = true">选择其他课程</NButton>
            </NAlert>
          </div>

          <NEmpty v-if="!selectedNode" description="当前没有可显示的节点">
            <template #extra><NButton @click="filterDrawerVisible = true">选择其他课程</NButton><NButton @click="loadStructure(updateAvailable)">重新加载</NButton></template>
          </NEmpty>
          <template v-else>
            <section class="material-content-panel">
              <section class="node-overview content-section">
                <div class="detail-header">
                  <div class="detail-title-block">
                    <div class="detail-eyebrow">
                      <NTag :type="getNodeMeta(selectedNode).type" :bordered="false">
                        {{ getNodeMeta(selectedNode).label }}
                      </NTag>
                      <NTag v-if="hasH5Object(selectedNode)" type="warning" :bordered="false">H5</NTag>
                    </div>
                    <h2>{{ selectedNode.sequenceNo }} · {{ selectedNode.nodeName }}</h2>
                    <p v-if="course">{{ course.unitName }} · {{ course.chapterName }}</p>
                  </div>
                </div>

                <NCollapse class="node-details">
                  <NCollapseItem title="编号与配置" name="technical">
                    <div class="node-technical">
                      <NButton text @click="copyText(String(selectedNode.nodeId), '节点 ID')">节点 ID {{ selectedNode.nodeId }}</NButton>
                      <NButton v-if="selectedNode.senseId" text @click="copyAndOpen(String(selectedNode.senseId), '场景 ID', getSceneManagerUrl(selectedNode))">场景 ID {{ selectedNode.senseId }}</NButton>
                      <span v-if="course">Unit {{ course.unitId }} · 路径 {{ course.chapterId }}</span>
                      <template v-for="board in selectedBoards" :key="'ids:' + board.objectId">
                        <NButton text @click="copyAndOpen(String(board.checkpointId || board.calculusKey), '关卡 ID', getLevelManagerUrl(board))">关卡 ID {{ board.checkpointId || board.calculusKey }}</NButton>
                        <template v-for="question in board.checkpoint?.questions || []" :key="question.questionId">
                          <NButton text @click="copyAndOpen(String(question.questionId), '题目 ID', getQuestionManagerUrl(question))">题目 ID {{ question.questionId }}</NButton>
                          <span>题型配置：{{ question.questionType }}；运行环境：{{ question.ideType || '未配置' }}；判题配置：{{ question.correctType || '未配置' }}</span>
                        </template>
                      </template>
                      <span v-for="board in selectedBoards.filter(item => item.answerStatus)" :key="board.objectId">{{ board.objectName }}：课包配置值 answerStatus = {{ board.answerStatus }}（不是学生答题结果，含义待确认）</span>
                    </div>
                  </NCollapseItem>
                </NCollapse>
                <section v-if="showPathList && connections.length" class="connections">
                  <div class="connection-heading">节点连接 <small>前序 {{ connections.filter(item => item.direction === '前序').length }} · 后续 {{ connections.filter(item => item.direction === '后续').length }}</small></div>
                  <div v-for="edge in connections" :key="edge.key" class="connection-row">
                    <span>{{ edge.direction }}</span>
                    <NButton v-if="edge.target" text type="primary" @click="jumpToNode(edge.target)">{{ edge.targetLabel }}</NButton>
                    <span v-else>{{ edge.targetLabel }}（无内容预览）</span>
                    <span>{{ edge.name || (edge.conditionCodeScript ? '条件跳转' : '连接') }}</span>
                    <div v-if="edge.conditionCodeScript" class="condition-description">
                      <div>{{ edge.condition.translated ? edge.condition.text : '暂不支持解释此条件' }}</div>
                      <small v-for="note in edge.condition.notes" :key="note">{{ note }}</small>
                    </div>
                  </div>
                </section>
                <NEmpty v-if="!selectedVideos.length && !selectedH5Objects.length && !selectedBoards.length && !selectedResources.length" description="此节点没有可预览内容，可通过连接关系继续查看" />

                <div class="material-filter-tabs">
                  <button
                    v-for="item in materialFilterItems"
                    :key="item.key"
                    type="button"
                    class="material-filter-item"
                    :class="{ 'material-filter-item--active': materialFilter === item.key }"
                    @click="materialFilter = item.key"
                  >
                    <SvgIcon :icon="item.icon" />
                    <span>{{ item.label }}</span>
                    <strong v-if="item.count">{{ item.count }}</strong>
                  </button>
                </div>
              </section>
            <section v-if="isMaterialSectionVisible('video') && selectedVideos.length" class="content-section">
              <div class="panel-header">
                <span>视频</span>
                <NTag size="small" :bordered="false">{{ selectedVideos.length }}</NTag>
              </div>
              <NEmpty v-if="!selectedVideos.length" description="无视频对象" />
              <div v-else class="video-grid">
                <article v-for="video in selectedVideos" :key="video.objectId" class="video-item">
                  <video :src="video.url" controls preload="metadata" />
                  <div class="video-meta">
                    <strong>{{ video.objectName || `Video ${video.objectId}` }}</strong>
                    <NButton text size="tiny" @click="openUrl(video.url)">打开源文件</NButton>
                  </div>
                </article>
              </div>
            </section>

            <section v-if="isMaterialSectionVisible('h5') && selectedH5Objects.length" class="content-section">
              <div class="panel-header">
                <span>H5</span>
                <NTag size="small" :bordered="false">{{ selectedH5Objects.length }}</NTag>
              </div>
              <div class="asset-list">
                <button
                  v-for="item in selectedH5Objects"
                  :key="item.objectId"
                  type="button"
                  class="asset-chip"
                  @click="openUrl(item.h5Url || item.kanbanUrl)"
                >
                  <SvgIcon icon="mdi:web" />
                  <span>{{ item.objectName || item.objectId }}</span>
                </button>
              </div>
            </section>

            <section v-if="isMaterialSectionVisible('boards') && selectedBoards.length" class="content-section">
              <div class="panel-header">
                <span>关卡与题目</span>
                <NTag size="small" :bordered="false">{{ nodeCounts.checkpoints }} 关卡 · {{ nodeCounts.questions }} 题</NTag>
              </div>
              <NEmpty v-if="!selectedBoards.length" description="无关卡对象" />
              <div v-else class="board-list">
                <article v-for="board in selectedBoards" :key="board.objectId" class="board-item">
                  <div v-if="!(board.checkpoint?.questions?.length && board.checkpoint.questions.every(isCodeQuestion))" class="board-header">
                    <div>
                      <strong v-if="selectedBoards.length > 1 || board.objectName !== selectedNode.nodeName">{{ board.objectName }}</strong>
                      <span>
                        <NButton
                          text
                          size="tiny"
                          @click="copyAndOpen(String(board.checkpointId || board.calculusKey), '关卡ID', getLevelManagerUrl(board))"
                        >
                          关卡 {{ board.checkpointId || board.calculusKey }}
                        </NButton>
                      </span>
                    </div>
                    <NTag size="small" type="success" :bordered="false">
                      {{ board.checkpoint?.writeCheckpointType === 'IDE' ? '编程关卡' : '关卡' }}
                    </NTag>
                  </div>
                  <div class="board-meta">
                    <span v-if="board.difficulty !== null && !board.checkpoint?.questions?.every(isCodeQuestion)">难度 {{ board.difficulty }}</span>

                    <span v-if="stringifyValue(board.successfulGoal)">目标 {{ stringifyValue(board.successfulGoal) }}</span>
                    <span v-if="board.checkpoint?.targetLearningTime">目标时长 {{ board.checkpoint.targetLearningTime }}s</span>
                  </div>
                  <div class="question-list">
                    <article
                      v-for="question in board.checkpoint?.questions || []"
                      :key="question.questionId"
                      class="question-item"
                    >
                      <div v-if="!isCodeQuestion(question)" class="question-main">
                        <strong>{{ question.name || `题目 ${question.questionId}` }}</strong>
                        <span>
                          题目
                          <NButton
                            text
                            size="tiny"
                            @click="copyAndOpen(String(question.questionId), '题目ID', getQuestionManagerUrl(question))"
                          >
                            {{ question.questionId }}
                          </NButton>
                          · {{ questionTypeLabel(question.questionType) }}
                        </span>
                      </div>
                      <div v-if="!isCodeQuestion(question)" class="question-tags">
                        <NTag v-if="question.correctType === 'AUTO'" size="tiny" :bordered="false">自动判题</NTag>
                        <NTag v-if="question.isHomework" size="tiny" type="warning" :bordered="false">作业</NTag>
                        <NTag v-if="getQuestionAssetCount(question)" size="tiny" type="info" :bordered="false">
                          {{ getQuestionAssetCount(question) }} 素材
                        </NTag>
                      </div>
                      <section v-if="isChoiceQuestion(question)" class="choice-question-card">
                        <div class="choice-stem">
                          <div class="choice-stem-title">
                            <SvgIcon icon="mdi:help-circle-outline" />
                            <strong>{{ getChoiceStem(question).content || '选择题' }}</strong>
                          </div>
                          <audio
                            v-if="getChoiceStem(question).audioUrl"
                            :src="getChoiceStem(question).audioUrl"
                            controls
                            preload="metadata"
                          />
                        </div>

                        <div class="choice-options">
                          <button
                            v-for="option in getChoiceOptions(question)"
                            :key="option.index"
                            type="button"
                            class="choice-option"
                            :class="{ 'choice-option--answer': option.isAnswer }"
                          >
                            <span class="choice-option-index">{{ option.index + 1 }}</span>
                            <span class="choice-option-label">{{ option.label }}</span>
                            <NTag v-if="option.isAnswer" size="tiny" type="success" :bordered="false">答案</NTag>
                          </button>
                        </div>
                      </section>
                      <div v-if="!isChoiceQuestion(question) && (question.stem || question.description || question.learningTarget)" class="question-text">
                        <p v-if="question.stem">{{ stringifyValue(question.stem) }}</p>
                        <p v-if="question.description">{{ question.description }}</p>
                        <p v-if="question.learningTarget">{{ question.learningTarget }}</p>
                      </div>
                      <div
                        v-if="!isChoiceQuestion(question) && ((question.options || []).length || (question.drags || []).length || (question.hotAreas || []).length)"
                        class="question-config"
                      >
                        <span v-if="(question.options || []).length">选项 {{ (question.options || []).length }}</span>
                        <span v-if="(question.drags || []).length">拖拽项 {{ (question.drags || []).length }}</span>
                        <span v-if="(question.hotAreas || []).length">热区 {{ (question.hotAreas || []).length }}</span>
                        <template v-if="(question.options || []).length">
                          <NTag
                            v-for="option in (question.options || []).slice(0, 4)"
                            :key="option.index"
                            size="tiny"
                            :type="option.isAnswer ? 'success' : 'default'"
                            :bordered="false"
                          >
                            {{ option.label }}
                          </NTag>
                        </template>
                      </div>
                      <div v-if="getQuestionResources(question).length && !isCodeQuestion(question)" class="question-resources">
                        <article
                          v-for="resource in resourcePage(getQuestionResources(question), 'question:' + question.questionId)"
                          :key="`${question.questionId}-${resource.url}`"
                          class="resource-preview"
                        >
                          <img v-if="isImageUrl(resource.url)" :src="resource.url" :alt="resource.label" loading="lazy" />
                          <audio v-else-if="isAudioUrl(resource.url)" :src="resource.url" controls preload="metadata" />
                          <button v-else type="button" @click="openUrl(resource.url)">
                            <SvgIcon icon="mdi:link-variant" />
                            <span>{{ resource.label }}</span>
                          </button>
                          <div class="resource-caption">
                            <strong>{{ resource.label }}</strong>
                          </div>
                        </article>
                      </div>
                      <NButton v-if="!isCodeQuestion(question) && getQuestionResources(question).length > 8" text
                        @click="toggleResources('question:' + question.questionId)">
                        {{ expandedResources['question:' + question.questionId] ? '收起素材' : `查看全部 ${getQuestionResources(question).length} 项素材` }}
                      </NButton>
                      <section v-if="isCodeQuestion(question)" class="fake-ide-shell">
                        <div class="fake-ide-topbar">
                          <div class="fake-ide-window-controls" aria-hidden="true">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                          <div class="fake-ide-title">
                            <strong>{{ question.name || `题目 ${question.questionId}` }}</strong>
                            <span>{{ getCurrentCodeFileName(question) || question.questionType }}</span>
                          </div>
                          <div class="fake-ide-actions">
                            <NRadioGroup
                              :value="getCodePreviewMode(question)"
                              size="small"
                              @update:value="value => setCodePreviewMode(question, value)"
                            >
                              <NRadioButton
                                v-for="kind in getAvailableCodeKinds(question)"
                                :key="kind"
                                :value="kind"
                              >
                                {{ getCodePreviewTitle(kind) }}
                              </NRadioButton>
                            </NRadioGroup>
                            <NButton
                              v-if="question.grammarJudgementUrl"
                              type="primary"
                              size="small"
                              :loading="isJudgeJsDownloading(question)"
                              @click="downloadJudgeJs(question)"
                            >
                              <template #icon><SvgIcon icon="mdi:download" /></template>
                              下载判定 JS
                            </NButton>
                            <NButton
                              v-if="getCurrentCodePreviewState(question)?.data?.content"
                              size="small"
                              secondary
                              @click="copyCodePreview(question, getCodePreviewMode(question))"
                            >
                              <template #icon><SvgIcon icon="mdi:content-copy" /></template>
                              复制代码
                            </NButton>
                          </div>
                        </div>

                        <div class="fake-ide-body">
                          <aside class="fake-ide-task">
                            <div class="fake-panel-title">
                              <SvgIcon icon="mdi:image-outline" />
                              <span>任务目标</span>
                            </div>
                            <div v-if="getQuestionPictureResources(question).length" class="fake-task-pictures">
                              <img
                                v-for="resource in getQuestionPictureResources(question)"
                                :key="`${question.questionId}-fake-${resource.url}`"
                                :src="resource.url"
                                :alt="resource.label"
                                loading="lazy"
                              />
                            </div>
                            <div v-else class="fake-task-picture-empty">
                              <SvgIcon icon="mdi:image-off-outline" />
                              <span>暂无任务图片</span>
                            </div>
                          </aside>

                          <section class="fake-ide-code">
                            <div class="fake-panel-title">
                              <SvgIcon icon="mdi:code-braces" />
                              <span>{{ getCurrentCodePreviewTitle(question) }}</span>
                              <NTag
                                v-if="getCodePreviewMode(question) === 'answer'"
                                size="tiny"
                                type="warning"
                                :bordered="false"
                              >
                                答案
                              </NTag>
                              <NRadioGroup
                                v-if="getCodePreviewMode(question) === 'answer'"
                                class="fake-code-view-toggle"
                                :value="getAnswerCodeViewMode(question)"
                                size="small"
                                @update:value="value => setAnswerCodeViewMode(question, value)"
                              >
                                <NRadioButton value="plain">原代码</NRadioButton>
                                <NRadioButton value="diff">差异</NRadioButton>
                              </NRadioGroup>
                            </div>
                            <NSpin :show="Boolean(getCurrentCodePreviewState(question)?.loading)">
                              <NAlert
                                v-if="getCurrentCodePreviewState(question)?.error"
                                type="warning"
                                :show-icon="false"
                              >
                                {{ getCurrentCodePreviewState(question)?.error }}
                              </NAlert>
                              <div
                                v-else-if="shouldShowCodeDiff(question) && getCodeDiffResult(question).status === 'same'"
                                class="fake-code-notice"
                              >
                                {{ getCodeDiffResult(question).message }}
                              </div>
                              <div
                                v-else-if="shouldShowCodeDiff(question) && getCodeDiffResult(question).status === 'ready'"
                                class="fake-code-editor fake-code-editor--diff"
                              >
                                <div
                                  v-for="(line, index) in getCodeDiffResult(question).lines"
                                  :key="`${line.kind}-${line.beforeLine || '-'}-${line.afterLine || '-'}-${index}`"
                                  class="fake-code-line"
                                  :class="getCodeDiffLineClass(line)"
                                >
                                  <span class="fake-code-diff-marker">{{ getCodeDiffMarker(line) }}</span>
                                  <span class="fake-code-line-no">{{ line.beforeLine || '' }}</span>
                                  <span class="fake-code-line-no">{{ line.afterLine || '' }}</span>
                                  <code>{{ line.text }}</code>
                                </div>
                                <div
                                  v-if="getCodeDiffResult(question).truncated"
                                  class="fake-code-more"
                                >
                                  仅展示前 {{ maxVisibleCodeLines }} 行 diff
                                </div>
                              </div>
                              <template v-else-if="shouldFallbackToPlainAnswer(question)">
                                <NAlert
                                  type="warning"
                                  :show-icon="false"
                                >
                                  {{ getCodeDiffResult(question).message }}
                                </NAlert>
                                <div v-if="getCurrentCodePreviewState(question)?.data?.content" class="fake-code-editor">
                                  <div
                                    v-for="line in getCodeLines(getCurrentCodePreviewState(question)?.data?.content)"
                                    :key="line.line"
                                    class="fake-code-line"
                                  >
                                    <span class="fake-code-line-no">{{ line.line }}</span>
                                    <code>{{ line.text }}</code>
                                  </div>
                                  <div
                                    v-if="isCodeLineLimited(getCurrentCodePreviewState(question)?.data?.content || '')"
                                    class="fake-code-more"
                                  >
                                    仅展示前 {{ maxVisibleCodeLines }} 行
                                  </div>
                                </div>
                              </template>
                              <div v-else-if="getCurrentCodePreviewState(question)?.data?.content" class="fake-code-editor">
                                <div
                                  v-for="line in getCodeLines(getCurrentCodePreviewState(question)?.data?.content)"
                                  :key="line.line"
                                  class="fake-code-line"
                                >
                                  <span class="fake-code-line-no">{{ line.line }}</span>
                                  <code>{{ line.text }}</code>
                                </div>
                                <div
                                  v-if="isCodeLineLimited(getCurrentCodePreviewState(question)?.data?.content || '')"
                                  class="fake-code-more"
                                >
                                  仅展示前 {{ maxVisibleCodeLines }} 行
                                </div>
                              </div>
                              <div v-else class="code-empty">等待加载</div>
                            </NSpin>
                            <NTag
                              v-if="getCurrentCodePreviewState(question)?.data?.truncated"
                              size="tiny"
                              type="warning"
                              :bordered="false"
                            >
                              已截断
                            </NTag>
                          </section>

                          <aside class="fake-ide-output">
                            <div class="fake-panel-title">
                              <SvgIcon icon="mdi:map-marker-path" />
                              <span>关卡信息</span>
                              <NTag size="tiny" :bordered="false">只读</NTag>
                            </div>

                            <div class="fake-level-card">
                              <div
                                v-for="item in getBoardInfoItems(board, question)"
                                :key="`${question.questionId}-${item.label}`"
                                class="fake-level-row"
                              >
                                <span>{{ item.label }}</span>
                                <strong>{{ item.value }}</strong>
                              </div>
                            </div>

                            <div class="fake-resource-thumbs">
                              <button
                                v-for="resource in resourcePage(supplementaryResources(board, question), 'code:' + question.questionId)"
                                :key="`${question.questionId}-preview-${resource.url}`"
                                type="button"
                                class="fake-resource-thumb"
                                @click="openUrl(resource.url)"
                              >
                                <img v-if="isImageUrl(resource.url)" :src="resource.url" :alt="resource.label" loading="lazy" />
                                <span v-else class="fake-resource-icon">
                                  <SvgIcon :icon="getResourceIcon(resource)" />
                                </span>
                                <span>{{ resource.label || resource.kind }}</span>
                              </button>
                              <div v-if="!supplementaryResources(board, question).length" class="fake-output-placeholder">
                                <SvgIcon icon="mdi:paperclip-off" />
                                <strong>暂无资源引用</strong>
                                <span>这里仅展示关卡与题目素材，不加载真实运行环境。</span>
                              </div>
                            </div>
                            <NButton v-if="supplementaryResources(board, question).length > 8" text
                              @click="toggleResources('code:' + question.questionId)">
                              {{ expandedResources['code:' + question.questionId] ? '收起素材' : `查看全部 ${supplementaryResources(board, question).length} 项素材` }}
                            </NButton>
                            <div class="fake-output-links">
                              <NButton v-if="question.runResultShowUrl" size="tiny" @click="openUrl(question.runResultShowUrl)">
                                打开展示页
                              </NButton>
                              <NButton v-if="getPrimaryQuestionUrl(question)" text size="tiny" @click="openUrl(getPrimaryQuestionUrl(question))">
                                源链接
                              </NButton>
                            </div>
                          </aside>
                        </div>
                      </section>
                      <div class="question-actions">
                        <NButton
                          v-if="question.projectUrl && !isCodeQuestion(question)"
                          size="tiny"
                          @click="openUrl(question.projectUrl)"
                        >
                          项目包
                        </NButton>
                        <NButton
                          v-if="question.answerUrl && !isCodeQuestion(question)"
                          size="tiny"
                          @click="openUrl(question.answerUrl)"
                        >
                          答案
                        </NButton>
                        <NButton
                          v-if="question.runResultShowUrl && !isCodeQuestion(question)"
                          size="tiny"
                          @click="openUrl(question.runResultShowUrl)"
                        >
                          展示页
                        </NButton>
                        <NButton
                          v-if="getPrimaryQuestionUrl(question) && !isCodeQuestion(question)"
                          text
                          size="tiny"
                          @click="openUrl(getPrimaryQuestionUrl(question))"
                        >
                          源链接
                        </NButton>
                      </div>
                    </article>
                  </div>
                </article>
              </div>
            </section>

            <section v-if="isMaterialSectionVisible('resources') && remainingResources.length" class="content-section">
              <div class="panel-header">{{ materialFilter === 'resources' ? '全部素材' : '其他节点素材' }} · {{ remainingResources.length }}</div>
              <p class="structure-hint">按文件链接去重；同一素材的使用位置合并显示。</p>
              <div class="resource-catalog">
                <div v-for="asset in resourcePage(remainingResources, 'node:' + selectedNode.nodeId, 12)" :key="asset.url" class="resource-catalog-item">
                  <NButton text type="primary" @click="openUrl(asset.url)">{{ asset.label }}</NButton>
                  <small>{{ asset.sources.join(' / ') }}</small>
                </div>
              </div>
              <NButton v-if="remainingResources.length > 12" text @click="toggleResources('node:' + selectedNode.nodeId)">
                {{ expandedResources['node:' + selectedNode.nodeId] ? '收起' : `查看全部 ${remainingResources.length} 项素材` }}
              </NButton>
            </section>
            </section>
          </template>
        </main>
      </section>
    </NSpin>
  </div>
</template>

<style scoped>
.structure-hint { margin: 8px 12px; font-size: 12px; opacity: .65; }
.path-view-tools { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px 0; font-size: 12px; }
.workspace-course-picker { padding: 12px; border-bottom: 1px solid rgb(var(--border-color)); }
.workspace-unit-heading { display: flex; align-items: baseline; gap: 10px; justify-content: space-between; margin-bottom: 10px; }
.workspace-unit-heading strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.workspace-chapter-label { display: block; margin-bottom: 5px; font-size: 12px; opacity: .7; }
.workspace-course-picker > small { display: block; margin-top: 6px; font-size: 11px; opacity: .65; }
.node-details { margin: 8px 0; }
.node-technical { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; }
.connections { margin: 12px 0; padding: 12px; border: 1px solid rgba(128,128,128,.2); border-radius: 8px; }
.connection-heading { margin-bottom: 8px; font-weight: 600; }
.connection-heading small { font-weight: 400; opacity: .65; margin-left: 12px; }
.connection-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 5px 0; font-size: 12px; }
.condition-description { width: 100%; line-height: 1.8; overflow-wrap: anywhere; }
.condition-description small { display: block; opacity: 0.65; }
.resource-catalog { display: grid; gap: 10px; }
.resource-catalog-item { display: flex; flex-direction: column; align-items: flex-start; overflow-wrap: anywhere; }
.resource-catalog-item small { opacity: .65; }

.course-structure-page {
  display: flex;
  min-height: calc(100vh - 120px);
  flex-direction: column;
  padding: 16px;
  color: rgb(var(--text-color-1));
}

.structure-landing {
  display: flex;
  min-height: calc(100vh - 120px);
  flex-direction: column;
  justify-content: center;
  gap: 24px;
  padding: 8vh min(8vw, 96px);
}

.landing-intro {
  max-width: 720px;
}

.landing-intro span {
  color: rgb(var(--primary-color));
  font-size: 14px;
  font-weight: 700;
}

.landing-intro h1 {
  margin: 12px 0 10px;
  color: rgb(var(--text-color-1));
  font-size: 40px;
  line-height: 1.15;
}

.landing-intro p {
  margin: 0;
  color: rgb(var(--text-color-2));
  font-size: 16px;
}

.landing-filter-card {
  width: min(760px, 100%);
  border: 1px solid rgb(var(--border-color));
  border-radius: 8px;
  background: rgb(var(--card-color));
  box-shadow: 0 22px 54px rgba(15, 23, 42, 0.08);
  padding: 18px;
}

.filter-form {
  display: grid;
  gap: 14px;
}

.filter-form--drawer {
  padding-top: 6px;
}

.filter-id-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.filter-actions,
.filter-status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.course-select {
  min-width: 0;
}

.id-input {
  width: 100%;
}

.error-alert {
  border-radius: 8px;
}

.alert-stack {
  display: grid;
  gap: 8px;
  padding: 14px 14px 0;
}

.alert-stack:empty {
  display: none;
}

.workspace {
  display: grid;
  min-height: calc(100vh - 120px);
  grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  border: 1px solid rgb(var(--border-color));
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.035);
  padding: 12px;
}

.path-panel,
.detail-panel,
.content-section {
  border: 1px solid rgb(var(--border-color));
  border-radius: 8px;
  background: rgb(var(--card-color));
}

.path-panel {
  position: sticky;
  top: 12px;
  grid-column: 1;
  display: flex;
  min-height: 0;
  height: calc(100vh - 144px);
  max-height: 820px;
  flex-direction: column;
  border-color: rgba(24, 160, 88, 0.22);
  background: linear-gradient(180deg, rgba(24, 160, 88, 0.07), rgba(24, 160, 88, 0.025));
  overflow: hidden;
}

.path-panel .panel-header {
  background: rgba(24, 160, 88, 0.08);
}

.detail-panel {
  grid-column: 2;
  box-shadow: inset 0 4px 0 rgba(24, 160, 88, 0.12);
}

.dark .workspace {
  background: rgba(255, 255, 255, 0.035);
}

.dark .path-panel {
  border-color: rgba(99, 226, 183, 0.22);
  background: linear-gradient(180deg, rgba(99, 226, 183, 0.12), rgba(99, 226, 183, 0.045));
}

.dark .path-panel .panel-header {
  background: rgba(99, 226, 183, 0.1);
}

.panel-header {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgb(var(--border-color));
  padding: 0 14px;
  font-weight: 650;
}

.path-header-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-summary-mini {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  border-bottom: 1px solid rgba(24, 160, 88, 0.14);
  padding: 10px;
}

.path-summary-item {
  min-width: 0;
  border-radius: 8px;
  background: rgba(24, 160, 88, 0.075);
  padding: 7px 8px;
}

.path-summary-item span {
  display: block;
  color: rgb(var(--text-color-3));
  font-size: 11px;
  line-height: 1;
}

.path-summary-item strong {
  display: block;
  margin-top: 5px;
  color: rgb(var(--text-color-1));
  font-size: 16px;
  line-height: 1;
}

.node-list {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 8px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 10px;
}

.node-item {
  display: grid;
  width: 100%;
  grid-template-columns: 42px minmax(0, 1fr);
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 8px 12px 8px 0;
  text-align: left;
}

.node-item:hover,
.node-item--active {
  border-color: rgba(24, 160, 88, 0.18);
  background: rgba(24, 160, 88, 0.09);
}

.node-rail {
  position: relative;
  display: flex;
  justify-content: center;
}

.node-rail::before {
  position: absolute;
  top: -8px;
  bottom: -8px;
  left: 50%;
  width: 1px;
  background: rgb(var(--border-color));
  content: '';
}

.node-dot {
  z-index: 1;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 1px solid rgb(var(--border-color));
  border-radius: 999px;
  background: rgb(var(--card-color));
  color: rgb(var(--primary-color));
  font-size: 15px;
}

.node-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.node-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.node-sequence {
  display: inline-flex;
  width: 28px;
  height: 22px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgb(var(--body-color));
  color: rgb(var(--text-color-2));
  font-size: 12px;
  font-weight: 650;
}

.node-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 650;
}

.node-meta-row {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 6px;
  color: rgb(var(--text-color-3));
  font-size: 12px;
}

.detail-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: visible;
  padding: 0;
}

.material-content-panel {
  min-width: 0;
  min-height: 0;
}

.material-content-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: visible;
  padding: 14px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
}

.detail-title-block {
  min-width: 0;
}

.detail-eyebrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: rgb(var(--text-color-3));
  font-size: 12px;
}

.detail-header h2 {
  margin: 8px 0 0;
  font-size: 24px;
  line-height: 1.25;
}

.detail-header p {
  margin: 6px 0 0;
  color: rgb(var(--text-color-2));
  font-size: 13px;
}

.structure-search-button {
  flex: none;
}

.node-overview {
  overflow: hidden;
}

.material-filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-top: 1px solid rgb(var(--border-color));
  padding: 12px 14px 14px;
}

.material-filter-item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: rgb(var(--body-color));
  color: inherit;
  cursor: pointer;
  padding: 9px 10px;
  text-align: left;
}

.material-filter-item:hover,
.material-filter-item--active {
  border-color: rgba(24, 160, 88, 0.32);
  background: rgba(24, 160, 88, 0.08);
  color: rgb(var(--primary-color));
}

.material-filter-item strong {
  color: inherit;
  font-size: 13px;
}

.content-section {
  overflow: hidden;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  padding: 14px;
}

.video-item {
  overflow: hidden;
  border: 1px solid rgb(var(--border-color));
  border-radius: 8px;
  background: rgb(var(--body-color));
}

.video-item video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #05070a;
}

.video-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
}

.video-meta strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.board-list,
.question-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.board-list {
  padding: 14px;
}

.board-item,
.question-item {
  border: 1px solid rgb(var(--border-color));
  border-radius: 8px;
  background: rgb(var(--body-color));
}

.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
}

.board-header div,
.question-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.board-header span,
.question-main span {
  color: rgb(var(--text-color-3));
  font-size: 12px;
}

.board-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-top: 1px solid rgb(var(--border-color));
  padding: 9px 12px;
  color: rgb(var(--text-color-3));
  font-size: 12px;
}

.board-resource-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 12px 12px;
}

.question-list {
  padding: 0 12px 12px;
}

.question-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  padding: 12px;
}

.question-actions,
.question-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.question-actions {
  grid-column: 1 / -1;
}

.question-text,
.question-config,
.question-resources,
.code-preview-grid,
.choice-question-card {
  grid-column: 1 / -1;
}

.question-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: rgb(var(--text-color-2));
  font-size: 13px;
  line-height: 1.55;
}

.question-text p {
  margin: 0;
  overflow-wrap: anywhere;
}

.question-config {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: rgb(var(--text-color-3));
  font-size: 12px;
}

.choice-question-card {
  display: grid;
  gap: 12px;
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.055);
  padding: 12px;
}

.choice-stem {
  display: grid;
  gap: 8px;
}

.choice-stem-title {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: rgb(var(--text-color-1));
  line-height: 1.5;
}

.choice-stem-title .svg-icon {
  flex: none;
  margin-top: 2px;
  color: #2563eb;
  font-size: 18px;
}

.choice-stem audio {
  width: min(420px, 100%);
}

.choice-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.choice-option {
  display: grid;
  min-width: 0;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
  background: rgb(var(--card-color));
  color: inherit;
  padding: 9px 10px;
  text-align: left;
}

.choice-option--answer {
  border-color: rgba(24, 160, 88, 0.42);
  background: rgba(24, 160, 88, 0.08);
}

.choice-option-index {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 999px;
  background: rgb(var(--body-color));
  color: rgb(var(--text-color-2));
  font-size: 12px;
  font-weight: 700;
}

.choice-option-label {
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 650;
}

.question-resources {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.resource-preview {
  overflow: hidden;
  border: 1px solid rgb(var(--border-color));
  border-radius: 8px;
  background: rgb(var(--card-color));
}

.resource-preview img {
  display: block;
  width: 100%;
  max-height: 220px;
  object-fit: contain;
  background: rgb(var(--body-color));
}

.resource-preview audio {
  display: block;
  width: 100%;
  padding: 10px;
}

.resource-preview button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 6px;
  border: 0;
  background: rgb(var(--body-color));
  color: inherit;
  cursor: pointer;
  padding: 12px;
}

.resource-caption {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid rgb(var(--border-color));
  padding: 7px 9px;
  font-size: 12px;
}

.resource-caption span {
  color: rgb(var(--text-color-3));
}

.resource-caption strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

.code-preview {
  overflow: hidden;
  border: 1px solid rgb(var(--border-color));
  border-radius: 8px;
  background: rgb(var(--card-color));
}

.code-preview-header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid rgb(var(--border-color));
  padding: 8px 10px;
}

.code-preview-header div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.code-preview-header span {
  overflow: hidden;
  color: rgb(var(--text-color-3));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-preview pre {
  max-height: 360px;
  margin: 0;
  overflow: auto;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.55;
  padding: 12px;
  tab-size: 2;
}

.code-preview code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
}

.code-empty {
  padding: 18px 12px;
  color: rgb(var(--text-color-3));
  font-size: 12px;
}

.fake-ide-shell {
  grid-column: 1 / -1;
  overflow: hidden;
  border: 1px solid rgba(51, 65, 85, 0.22);
  border-radius: 8px;
  background: #f7fafc;
}

.fake-ide-topbar {
  display: grid;
  min-height: 48px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(51, 65, 85, 0.18);
  background: linear-gradient(180deg, #ffffff, #edf2f7);
  padding: 8px 12px;
}

.fake-ide-window-controls {
  display: flex;
  gap: 6px;
}

.fake-ide-window-controls span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.fake-ide-window-controls span:nth-child(1) {
  background: #ef4444;
}

.fake-ide-window-controls span:nth-child(2) {
  background: #f59e0b;
}

.fake-ide-window-controls span:nth-child(3) {
  background: #10b981;
}

.fake-ide-title {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.fake-ide-title strong,
.fake-ide-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fake-ide-title span {
  color: #64748b;
  font-size: 12px;
}

.fake-ide-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fake-ide-body {
  display: grid;
  min-height: 420px;
  grid-template-columns: minmax(190px, 0.78fr) minmax(320px, 1.25fr) minmax(220px, 0.85fr);
  background: #dbe5ee;
}

.fake-ide-task,
.fake-ide-code,
.fake-ide-output {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.fake-ide-task {
  background: #f8fafc;
}

.fake-ide-code {
  border-right: 1px solid rgba(15, 23, 42, 0.12);
  border-left: 1px solid rgba(15, 23, 42, 0.12);
  background: #111827;
  color: #e5e7eb;
}

.fake-ide-output {
  background: #eef4f8;
}

.fake-panel-title {
  display: flex;
  min-height: 28px;
  align-items: center;
  gap: 7px;
  color: inherit;
  font-size: 13px;
  font-weight: 700;
}

.fake-code-view-toggle {
  margin-left: auto;
}

.fake-ide-task .fake-panel-title,
.fake-ide-output .fake-panel-title {
  color: #334155;
}

.fake-task-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font-size: 13px;
  line-height: 1.55;
  padding: 10px;
}

.fake-task-text p {
  margin: 0;
  overflow-wrap: anywhere;
}

.fake-task-text.muted {
  color: #94a3b8;
}

.fake-task-pictures {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.fake-task-pictures img {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: contain;
  object-position: top center;
}

.fake-task-picture-empty {
  display: grid;
  min-height: 180px;
  place-items: center;
  border: 1px dashed rgba(148, 163, 184, 0.42);
  border-radius: 8px;
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
}

.fake-task-picture-empty .svg-icon {
  display: block;
  margin: 0 auto 6px;
  font-size: 30px;
}

.fake-code-editor {
  overflow: auto;
  min-height: 340px;
  max-height: 460px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.65;
  tab-size: 2;
}

.fake-code-line {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  min-height: 22px;
}

.fake-code-editor--diff .fake-code-line {
  grid-template-columns: 24px 42px 42px minmax(0, 1fr);
}

.fake-code-line:hover {
  background: rgba(255, 255, 255, 0.04);
}

.fake-code-line--add {
  background: rgba(34, 197, 94, 0.14);
}

.fake-code-line--remove {
  background: rgba(239, 68, 68, 0.14);
}

.fake-code-line--add:hover {
  background: rgba(34, 197, 94, 0.2);
}

.fake-code-line--remove:hover {
  background: rgba(239, 68, 68, 0.2);
}

.fake-code-diff-marker {
  border-right: 1px solid rgba(148, 163, 184, 0.16);
  color: #94a3b8;
  text-align: center;
  user-select: none;
}

.fake-code-line--add .fake-code-diff-marker {
  color: #4ade80;
}

.fake-code-line--remove .fake-code-diff-marker {
  color: #f87171;
}

.fake-code-line-no {
  border-right: 1px solid rgba(148, 163, 184, 0.16);
  color: #64748b;
  padding-right: 10px;
  text-align: right;
  user-select: none;
}

.fake-code-line code {
  min-width: max-content;
  padding: 0 12px;
  color: #dbeafe;
  white-space: pre;
}

.fake-code-more {
  border-top: 1px solid rgba(148, 163, 184, 0.16);
  color: #facc15;
  padding: 8px 12px;
}

.fake-code-notice {
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
  background: rgba(34, 197, 94, 0.08);
  color: #86efac;
  padding: 12px;
}

.fake-output-stage {
  display: grid;
  min-height: 250px;
  flex: 1;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
  background:
    linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
    #ffffff;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0;
  background-size: 20px 20px;
}

.fake-output-stage img {
  display: block;
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
}

.fake-output-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #64748b;
  padding: 20px;
  text-align: center;
}

.fake-output-placeholder .svg-icon {
  color: #94a3b8;
  font-size: 34px;
}

.fake-output-placeholder span {
  font-size: 12px;
}

.fake-level-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.fake-level-row {
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  padding: 8px 9px;
}

.fake-level-row span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.fake-level-row strong {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: #0f172a;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fake-resource-thumbs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.fake-resource-thumb {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: inherit;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.fake-resource-thumb:hover {
  border-color: #38bdf8;
}

.fake-resource-thumb img {
  display: block;
  width: 100%;
  height: 88px;
  object-fit: contain;
  background: #f8fafc;
}

.fake-resource-icon {
  display: grid;
  height: 88px;
  place-items: center;
  background: #f8fafc;
  color: #64748b;
  font-size: 28px;
}

.fake-resource-thumb > span:last-child {
  overflow: hidden;
  color: #475569;
  font-size: 12px;
  padding: 7px 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fake-output-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dark .fake-ide-shell {
  border-color: rgba(148, 163, 184, 0.22);
  background: #0f172a;
}

.dark .fake-ide-topbar {
  border-bottom-color: rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, #1e293b, #111827);
}

.dark .fake-ide-title span {
  color: #94a3b8;
}

.dark .fake-ide-body {
  background: #111827;
}

.dark .fake-ide-task,
.dark .fake-ide-output {
  background: #0f172a;
}

.dark .fake-ide-task .fake-panel-title,
.dark .fake-ide-output .fake-panel-title {
  color: #cbd5e1;
}

.dark .fake-task-text,
.dark .fake-task-picture-empty {
  border-color: rgba(148, 163, 184, 0.28);
  color: #64748b;
}

.dark .fake-output-stage {
  border-color: rgba(148, 163, 184, 0.2);
  background:
    linear-gradient(45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.08) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.08) 75%),
    #020617;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0;
  background-size: 20px 20px;
}

.dark .fake-level-row,
.dark .fake-resource-thumb {
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.72);
}

.dark .fake-level-row strong {
  color: #e2e8f0;
}

.dark .fake-resource-thumb img,
.dark .fake-resource-icon {
  background: #020617;
}

.dark .fake-resource-thumb > span:last-child {
  color: #cbd5e1;
}

.asset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px;
}

.asset-chip {
  display: inline-flex;
  max-width: 260px;
  align-items: center;
  gap: 6px;
  border: 1px solid rgb(var(--border-color));
  border-radius: 8px;
  background: rgb(var(--body-color));
  color: inherit;
  cursor: pointer;
  padding: 7px 9px;
}

.asset-chip:hover {
  border-color: rgb(var(--primary-color));
  color: rgb(var(--primary-color));
}

.asset-chip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1180px) {
  .structure-landing {
    padding: 56px 24px;
  }

  .workspace {
    height: auto;
    min-height: 0;
    grid-template-columns: 1fr;
  }

  .path-panel,
  .detail-panel {
    grid-column: 1;
    grid-row: auto;
  }

  .path-panel {
    position: static;
    height: 360px;
    min-height: 360px;
    max-height: none;
  }

  .detail-panel,
  .material-content-panel {
    overflow: visible;
  }
}

@media (max-width: 760px) {
  .course-structure-page {
    padding: 10px;
  }

  .landing-intro h1 {
    font-size: 30px;
  }

  .filter-id-grid {
    grid-template-columns: 1fr;
  }

  .detail-header {
    align-items: stretch;
    flex-direction: column;
  }

  .path-summary-mini {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .question-item {
    grid-template-columns: 1fr;
  }
}
</style>
