<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchCourseAssetTemplateCache,
  fetchCourseAssetTemplateCheck,
  type CourseAssetPath,
  fetchCourseAssetTemplateDetails,
  type CourseAssetTemplateDetail,
} from '@/service/api/course-assets';
import { useAuth } from '@/hooks/business/auth';
import { usePageTracker } from '@/hooks/common/use-tracker';
import {
  languageLabels,
  lineageLabels,
  projectLabels,
  type CourseLanguage,
  type CourseTemplate,
  type CourseUnit,
  typeLabels,
} from './data';

import { courseCatalog, loadCourseCatalog, saveCatalogTemplate, toCourseUnits } from './catalog';
import UnitPaths from './modules/unit-paths.vue';

defineOptions({ name: 'CourseAssets' });

usePageTracker('course-assets');

type GroupMode = 'language' | 'project';
type DetailViewMode = 'list' | 'card';
type ProjectGroupKey = 'regular' | 'gene' | 'mid-price' | 'other';
type TemplateGroupKey = CourseLanguage | ProjectGroupKey;
type UnitCategory = 'prep' | 'soft' | 'hardware' | 'ai' | 'contest' | 'other';

interface TemplateGroupDefinition {
  key: TemplateGroupKey;
  label: string;
  description: string;
  icon: string;
  mark: string;
}

interface TemplateGroup extends TemplateGroupDefinition {
  templates: CourseTemplate[];
}

interface TemplateDetailsState {
  loading: boolean;
  name: string;
  units: CourseUnit[];
  error: string;
  syncedAt: string;
}

interface UnitLevelGroup {
  levelNo: number;
  label: string;
  units: CourseUnit[];
}

const STRUCTURE_PERMISSION = 'module:course-structure:access';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const { hasAuth } = useAuth();

const groupMode = ref<GroupMode>('language');
const expandedGroupKey = ref<TemplateGroupKey | null>(null);
const showAllEntryTemplates = ref(false);
const detailViewMode = ref<DetailViewMode>('list');
const templateKeyword = ref('');
const templateDetails = ref<Record<number, TemplateDetailsState>>({});
const templateChecks = ref<Record<number, { status: string; message?: string }>>({});
const refreshVersions = new Map<number, number>();
onMounted(() => { void loadCourseCatalog('assets'); });

const mortonSubjectIds: Record<CourseLanguage, number> = {
  graphical: 17,
  python: 19,
  c: 21,
};

const languageVisuals: Record<CourseLanguage, { mark: string; icon: string }> = {
  graphical: { mark: 'SC', icon: 'mdi:puzzle-outline' },
  python: { mark: 'Py', icon: 'mdi:language-python' },
  c: { mark: 'C++', icon: 'mdi:code-tags' },
};

const languageGroupDefinitions: TemplateGroupDefinition[] = [
  {
    key: 'graphical',
    label: languageLabels.graphical,
    description: '低龄启蒙',
    icon: languageVisuals.graphical.icon,
    mark: languageVisuals.graphical.mark,
  },
  {
    key: 'python',
    label: languageLabels.python,
    description: '文字编程',
    icon: languageVisuals.python.icon,
    mark: languageVisuals.python.mark,
  },
  {
    key: 'c',
    label: languageLabels.c,
    description: '算法进阶',
    icon: languageVisuals.c.icon,
    mark: languageVisuals.c.mark,
  },
];

const projectGroupDefinitions: TemplateGroupDefinition[] = [
  {
    key: 'regular',
    label: '常规体验课',
    description: '体验 / 导流',
    icon: 'mdi:rocket-launch-outline',
    mark: 'L1',
  },
  {
    key: 'gene',
    label: '基因项目',
    description: '基因模板',
    icon: 'mdi:dna',
    mark: 'Gene',
  },
  {
    key: 'mid-price',
    label: '中价课',
    description: '转化衔接',
    icon: 'mdi:ticket-percent-outline',
    mark: 'Mid',
  },
  {
    key: 'other',
    label: '其他',
    description: '见面会',
    icon: 'mdi:shape-outline',
    mark: 'Etc',
  },
];

const contentTypeLabels: Record<CourseUnit['contentType'], string> = {
  STAGE: '准备课',
  SOFT_PROJECT: '代码编程',
  HARDWARE_PROJECT: '硬件编程',
  CONTEST: '赛考',
};

const unitCategoryMeta: Record<UnitCategory, { label: string; icon: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  prep: { label: '准备课', icon: 'mdi:flag-outline', type: 'default' },
  soft: { label: '软编项目', icon: 'mdi:code-braces', type: 'info' },
  hardware: { label: '硬件项目', icon: 'mdi:chip', type: 'warning' },
  ai: { label: 'AI公益课', icon: 'mdi:creation-outline', type: 'success' },
  contest: { label: '赛考', icon: 'mdi:trophy-outline', type: 'error' },
  other: { label: '课程', icon: 'mdi:book-open-page-variant-outline', type: 'default' },
};

const activeGroupDefinitions = computed(() => (groupMode.value === 'language' ? languageGroupDefinitions : projectGroupDefinitions));

const displayTemplates = computed(() => courseCatalog.value.filter(template => template.project !== 'standard-year'));

const selectedTemplateId = computed(() => {
  const raw = Array.isArray(route.query.templateId) ? route.query.templateId[0] : route.query.templateId;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
});

const selectedTemplate = computed(() => displayTemplates.value.find(item => item.id === selectedTemplateId.value) || null);

const isDetailMode = computed(() => Boolean(selectedTemplate.value));

const filteredTemplates = computed(() => {
  const query = templateKeyword.value.trim().toLowerCase();
  if (!query) return displayTemplates.value;

  return displayTemplates.value.filter(template => {
    const searchText = [
      template.id,
      template.name,
      languageLabels[template.language],
      typeLabels[template.type],
      lineageLabels[template.lineage],
      projectLabels[template.project],
      template.client,
      template.environment,
      template.note,
      ...template.units.map(unit => `${unit.unitId} ${unit.title} ${unit.levelName || ''} ${unit.pathSummary}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchText.includes(query);
  });
});

const entryGroups = computed(() => buildLanguageGroups(filteredTemplates.value).filter(group => group.templates.length));

const navigationGroups = computed(() => buildGroups(displayTemplates.value).filter(group => group.templates.length));

const selectedTemplateUnits = computed(() => selectedTemplate.value?.units || []);
const selectedTemplateLevelGroups = computed(() => buildUnitLevelGroups(selectedTemplateUnits.value));

const canOpenCourseStructure = computed(() => hasAuth(STRUCTURE_PERMISSION));

watch(
  () => route.query.groupMode,
  value => {
    const nextMode = normalizeGroupMode(value);
    if (nextMode !== groupMode.value) {
      groupMode.value = nextMode;
    }
  },
  { immediate: true }
);

watch(
  () => route.query.view,
  value => {
    const nextView = normalizeDetailViewMode(value);
    if (nextView !== detailViewMode.value) {
      detailViewMode.value = nextView;
    }
  },
  { immediate: true }
);

watch(entryGroups, groups => {
  const hasExpandedGroup = groups.some(group => group.key === expandedGroupKey.value);
  if (!hasExpandedGroup) {
    expandedGroupKey.value = null;
  }
});

watch(
  selectedTemplateId,
  templateId => {
    const template = displayTemplates.value.find(item => item.id === templateId);
    if (template) void loadTemplateDetails(template).then(() => checkTemplateUpdate(template));
  },
  { immediate: true }
);

function normalizeGroupMode(value: unknown): GroupMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'project' ? 'project' : 'language';
}

function normalizeDetailViewMode(value: unknown): DetailViewMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'card' ? 'card' : 'list';
}

function buildGroups(templates: CourseTemplate[]): TemplateGroup[] {
  return activeGroupDefinitions.value.map(definition => {
    const groupTemplates = templates.filter(template => getTemplateGroupKey(template) === definition.key);

    return {
      ...definition,
      templates: groupTemplates,
    };
  });
}

function buildLanguageGroups(templates: CourseTemplate[]): TemplateGroup[] {
  return languageGroupDefinitions.map(definition => {
    const groupTemplates = templates.filter(template => template.language === definition.key);

    return {
      ...definition,
      templates: groupTemplates,
    };
  });
}

function buildUnitLevelGroups(units: CourseUnit[]): UnitLevelGroup[] {
  const levelMap = new Map<number, CourseUnit[]>();
  units.forEach(unit => {
    const levelUnits = levelMap.get(unit.levelNo) || [];
    levelUnits.push(unit);
    levelMap.set(unit.levelNo, levelUnits);
  });

  return [...levelMap.entries()]
    .sort(([left], [right]) => left - right)
    .map(([levelNo, levelUnits]) => ({
      levelNo,
      label: levelUnits[0]?.levelName ? `Level ${levelNo} · ${levelUnits[0].levelName}` : `Level ${levelNo}`,
      units: levelUnits.sort((left, right) => left.order - right.order),
    }));
}

function getTemplateGroupKey(template: CourseTemplate): TemplateGroupKey {
  if (groupMode.value === 'language') return template.language;
  return getTemplateProjectGroup(template);
}

function getTemplateProjectGroup(template: CourseTemplate): ProjectGroupKey {
  if (template.project === 'mid-price') return 'mid-price';
  if (template.lineage !== 'none') return 'gene';
  if (template.project === 'trial' || template.project === 'diversion') return 'regular';
  return 'other';
}

function getProjectGroupDefinition(key: ProjectGroupKey) {
  return projectGroupDefinitions.find(item => item.key === key) || projectGroupDefinitions[projectGroupDefinitions.length - 1];
}

function getTemplateLanguageVisual(template: CourseTemplate) {
  return languageVisuals[template.language];
}

function getTemplateDeliveryLabel(template: CourseTemplate) {
  const hasLive = template.units.some(unit => unit.livePathId);
  const hasPractice = template.units.some(unit => unit.practicePathId);
  if (hasLive && hasPractice) return '直播+AI课';
  if (hasLive) return '直播课';
  return 'AI课';
}

function getTemplateSubtitle(template: CourseTemplate) {
  const groupLabel = getProjectGroupDefinition(getTemplateProjectGroup(template)).label;
  const lineageLabel = template.lineage === 'none' ? '' : lineageLabels[template.lineage];
  return [languageLabels[template.language], groupLabel, lineageLabel].filter(Boolean).join(' · ');
}

function setGroupMode(mode: GroupMode) {
  groupMode.value = mode;
  const firstGroup = (mode === 'language' ? languageGroupDefinitions : projectGroupDefinitions)[0];
  expandedGroupKey.value = firstGroup.key;
  showAllEntryTemplates.value = false;
  void router.replace({
    name: 'course-assets',
    query: {
      ...route.query,
      groupMode: mode,
    },
  });
}

function setDetailViewMode(mode: DetailViewMode) {
  detailViewMode.value = mode;
  void router.replace({
    name: 'course-assets',
    query: {
      ...route.query,
      groupMode: groupMode.value,
      view: mode,
    },
  });
}

function toggleEntryGroup(key: TemplateGroupKey) {
  expandedGroupKey.value = expandedGroupKey.value === key ? null : key;
  showAllEntryTemplates.value = false;
}

function showAllTemplates() {
  expandedGroupKey.value = null;
  showAllEntryTemplates.value = true;
}

function openTemplate(template: CourseTemplate) {
  detailViewMode.value = normalizeDetailViewMode(route.query.view);
  void router.push({
    name: 'course-assets',
    query: {
      templateId: String(template.id),
      groupMode: groupMode.value,
      view: detailViewMode.value,
    },
  });
}

function backToEntry() {
  void router.push({
    name: 'course-assets',
    query: {
      groupMode: groupMode.value,
    },
  });
}

function getMortonSubjectId(template: CourseTemplate) {
  return mortonSubjectIds[template.language];
}

function getUnitUrl(template: CourseTemplate, unit: CourseUnit) {
  const subjectId = getMortonSubjectId(template);
  const params = new URLSearchParams({
    subjectId: String(subjectId),
    syllabusId: `${subjectId}-1`,
    isEdit: 'false',
    unitId: String(unit.unitId),
  });

  return `https://morton.hetao101.com/fe_morton/currentEdit?${params.toString()}`;
}

function openUnit(template: CourseTemplate, unit: CourseUnit) {
  window.open(getUnitUrl(template, unit), '_blank', 'noopener,noreferrer');
}

function openMaterial(unit: CourseUnit) {
  if (!unit.materialUrl) return;
  window.open(unit.materialUrl, '_blank', 'noopener,noreferrer');
}

function openCourseStructure(template: CourseTemplate, unit: CourseUnit, path?: CourseAssetPath) {
  void router.push({
    name: 'course-structure',
    query: {
      subjectId: String(getMortonSubjectId(template)),
      unitId: String(unit.unitId),
      ...(path?.chapterId ? { chapterId: String(path.chapterId) } : {}),
      auto: '1',
    },
  });
}

async function copyText(value: string | number, label: string) {
  const text = String(value);
  try {
    await navigator.clipboard.writeText(text);
    message.success(`${label} 已复制`);
  } catch {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    message.success(`${label} 已复制`);
  }
}

function getUnitCategory(unit: CourseUnit): UnitCategory {
  if (unit.title.includes('AI通识')) return 'ai';
  if (unit.contentType === 'STAGE') return 'prep';
  if (unit.contentType === 'CONTEST') return 'contest';
  if (unit.contentType === 'HARDWARE_PROJECT') return 'hardware';
  if (unit.contentType === 'SOFT_PROJECT') return 'soft';
  return 'other';
}

function getUnitCategoryClass(unit: CourseUnit) {
  return `unit-category-${getUnitCategory(unit)}`;
}

function getUnitCategoryMeta(unit: CourseUnit) {
  return unitCategoryMeta[getUnitCategory(unit)];
}

function getUnitLessonLabel(unit: CourseUnit) {
  return `L${unit.levelNo} / U${unit.unitNo}`;
}

function getLiveLabel(unit: CourseUnit) {
  return unit.livePathId ? '直播' : '';
}

function getCoverUrl(unit: CourseUnit) {
  return unit.coverUrl || '';
}

function updateTemplateDetails(template: CourseTemplate, detail: CourseAssetTemplateDetail, syncedAt = '') {
  saveCatalogTemplate(detail, syncedAt);
  templateDetails.value = {
    ...templateDetails.value,
    [template.id]: {
      loading: false,
      name: detail.name,
      units: toCourseUnits(detail),
      error: '',
      syncedAt,
    },
  };
}

async function loadTemplateDetails(template: CourseTemplate) {
  const current = templateDetails.value[template.id];
  if (current?.loading) return;

  templateDetails.value = {
    ...templateDetails.value,
    [template.id]: {
      loading: true,
      name: current?.name || '',
      units: current?.units || [],
      error: '',
      syncedAt: current?.syncedAt || '',
    },
  };

  const { data, error } = await fetchCourseAssetTemplateCache({
    subjectId: getMortonSubjectId(template),
    templateId: template.id,
  });

  if (!error && data?.status === 'ready' && data.template) {
    updateTemplateDetails(template, data.template, data.syncedAt || '');
    return;
  }

  templateDetails.value = {
    ...templateDetails.value,
    [template.id]: {
      loading: false,
      name: current?.name || '',
      units: current?.units || [],
      error: error?.message || data?.error?.message || '',
      syncedAt: current?.syncedAt || '',
    },
  };
}

function formatSyncTime(value?: string) {
  if (!value) return '尚未同步';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

async function checkTemplateUpdate(template: CourseTemplate) {
  if (templateChecks.value[template.id]?.status === 'checking') return;
  const version = refreshVersions.get(template.id) || 0;
  templateChecks.value[template.id] = { status: 'checking' };
  try {
    const { data, error } = await fetchCourseAssetTemplateCheck({ subjectId: getMortonSubjectId(template), templateId: template.id });
    if (version !== (refreshVersions.get(template.id) || 0)) return;
    templateChecks.value[template.id] = {
      status: error || !data ? 'error' : data.status,
      message: error?.message || data?.error?.message,
    };
  } catch {
    if (version === (refreshVersions.get(template.id) || 0)) templateChecks.value[template.id] = { status: 'error' };
  }
}

async function refreshTemplateDetails(template: CourseTemplate) {
  const current = templateDetails.value[template.id];
  if (current?.loading) return;
  refreshVersions.set(template.id, (refreshVersions.get(template.id) || 0) + 1);
  templateChecks.value[template.id] = { status: 'syncing' };

  templateDetails.value = {
    ...templateDetails.value,
    [template.id]: {
      loading: true,
      name: current?.name || '',
      units: current?.units || [],
      error: '',
      syncedAt: current?.syncedAt || '',
    },
  };

  const { data, error } = await fetchCourseAssetTemplateDetails({
    templates: [{ subjectId: getMortonSubjectId(template), templateId: template.id }],
  });
  const detail = data?.templates?.find(item => item.templateId === template.id);

  if (error || data?.status === 'error' || !detail || detail.error) {
    templateDetails.value = {
      ...templateDetails.value,
      [template.id]: {
        loading: false,
        name: current?.name || '',
        units: current?.units || [],
        error: error?.message || data?.error?.message || detail?.error?.message || '课程详情同步失败',
        syncedAt: current?.syncedAt || '',
      },
    };
    templateChecks.value[template.id] = { status: 'error', message: templateDetails.value[template.id].error };
    message.error(templateDetails.value[template.id].error);
    return;
  }

  updateTemplateDetails(template, detail, detail.syncedAt || data?.checkedAt || '');
  templateChecks.value[template.id] = { status: 'fresh' };
  message.success('已更新并保存最新课程数据');
}
</script>

<template>
  <div class="course-assets-page">
    <section v-if="!isDetailMode" class="entry-view">
      <header class="entry-header">
        <div>
          <p class="eyebrow">课程模板库</p>
          <h1>选择课程方向</h1>
          <p class="entry-description">
            先选方向，再从右侧进入模板。
          </p>
        </div>

        <div class="entry-actions">
          <NInput v-model:value="templateKeyword" clearable placeholder="搜索模板 ID / 名称 / Unit" />
        </div>
      </header>

      <template v-if="entryGroups.length">
        <div class="group-grid" :class="{ 'has-expanded': expandedGroupKey }">
          <article
            v-for="group in entryGroups"
            :key="group.key"
            class="group-card"
            :class="{ 'is-expanded': expandedGroupKey === group.key }"
          >
            <div class="group-card-inner">
              <button class="group-card-button" type="button" @click="toggleEntryGroup(group.key)">
                <span class="group-visual">
                  <span class="group-mark">
                    <SvgIcon :icon="group.icon" />
                  </span>
                  <span class="group-code">{{ group.mark }}</span>
                </span>
                <span class="group-main">
                  <small>学科</small>
                  <strong>{{ group.label }}</strong>
                  <em>{{ group.description }}</em>
                </span>
                <span class="group-hint">
                  {{ group.templates.length }} 个模板
                  <SvgIcon icon="mdi:chevron-right" />
                </span>
              </button>

              <div v-if="expandedGroupKey === group.key" class="template-list">
                <button
                  v-for="template in group.templates"
                  :key="template.id"
                  class="template-item"
                  type="button"
                  @click="openTemplate(template)"
                >
                  <span class="template-mark">{{ getTemplateLanguageVisual(template).mark }}</span>
                  <span class="template-copy">
                    <strong>{{ template.name }}</strong>
                    <small>{{ template.id }} · {{ getTemplateDeliveryLabel(template) }}</small>
                  </span>
                  <SvgIcon icon="mdi:chevron-right" />
                </button>
              </div>
            </div>
          </article>
        </div>

        <div class="entry-direct-actions">
          <NButton size="large" secondary type="primary" @click="showAllTemplates">
            直接查看全部
          </NButton>
        </div>

        <section v-if="showAllEntryTemplates" class="all-template-panel">
          <header class="all-template-panel-head">
            <div>
              <small>全部模板</small>
              <strong>{{ filteredTemplates.length }} 个模板</strong>
            </div>
          </header>

          <div class="all-template-list">
            <button
              v-for="template in filteredTemplates"
              :key="template.id"
              class="template-item"
              type="button"
              @click="openTemplate(template)"
            >
              <span class="template-mark">{{ getTemplateLanguageVisual(template).mark }}</span>
              <span class="template-copy">
                <strong>{{ template.name }}</strong>
                <small>{{ template.id }} · {{ getTemplateSubtitle(template) }} · {{ getTemplateDeliveryLabel(template) }}</small>
              </span>
              <SvgIcon icon="mdi:chevron-right" />
            </button>
          </div>
        </section>
      </template>

      <NEmpty v-else class="empty-state" description="暂无匹配模板" />
    </section>

    <section v-else-if="selectedTemplate" class="detail-view">
      <aside class="template-sidebar">
        <div class="sidebar-top">
          <NButton quaternary @click="backToEntry">
            <template #icon><SvgIcon icon="mdi:arrow-left" /></template>
            返回
          </NButton>
          <NButtonGroup>
            <NButton size="small" :type="groupMode === 'language' ? 'primary' : 'default'" @click="setGroupMode('language')">
              学科
            </NButton>
            <NButton size="small" :type="groupMode === 'project' ? 'primary' : 'default'" @click="setGroupMode('project')">
              项目
            </NButton>
          </NButtonGroup>
        </div>

        <div class="nav-groups">
          <section v-for="group in navigationGroups" :key="group.key" class="nav-group">
            <div class="nav-group-title">
              <SvgIcon :icon="group.icon" />
              <span>{{ group.label }}</span>
              <small>{{ group.templates.length }}</small>
            </div>
            <button
              v-for="template in group.templates"
              :key="template.id"
              class="nav-template"
              :class="{ active: template.id === selectedTemplate.id }"
              type="button"
              @click="openTemplate(template)"
            >
              <span>{{ template.id }}</span>
              <strong>{{ template.name }}</strong>
            </button>
          </section>
        </div>
      </aside>

      <main class="template-detail">
        <header class="detail-header">
          <div>
            <p class="eyebrow">{{ getTemplateSubtitle(selectedTemplate) }}</p>
            <h1>{{ selectedTemplate.name }}</h1>
            <div class="detail-tags">
              <NTag size="small" type="info">{{ selectedTemplate.id }}</NTag>
              <NTag size="small">{{ typeLabels[selectedTemplate.type] }}</NTag>
              <NTag size="small">{{ getTemplateDeliveryLabel(selectedTemplate) }}</NTag>
              <NTag v-if="selectedTemplate.client" size="small">{{ selectedTemplate.client }}</NTag>
            </div>
          </div>

          <div class="detail-actions">
            <NButton
              secondary
              type="primary"
              :loading="templateDetails[selectedTemplate.id]?.loading"
              @click="refreshTemplateDetails(selectedTemplate)"
            >
              <template #icon><SvgIcon icon="mdi:refresh" /></template>
              更新最新数据
            </NButton>
            <NButtonGroup>
              <NButton :type="detailViewMode === 'list' ? 'primary' : 'default'" @click="setDetailViewMode('list')">
                <template #icon><SvgIcon icon="mdi:format-list-bulleted" /></template>
                列表
              </NButton>
              <NButton :type="detailViewMode === 'card' ? 'primary' : 'default'" @click="setDetailViewMode('card')">
                <template #icon><SvgIcon icon="mdi:view-grid-outline" /></template>
                卡片
              </NButton>
            </NButtonGroup>
          </div>
        </header>

        <div class="sync-status" aria-live="polite">
          <span>最近同步：{{ formatSyncTime(templateDetails[selectedTemplate.id]?.syncedAt) }}</span>
          <span v-if="templateChecks[selectedTemplate.id]?.status === 'checking'">正在检查更新…</span>
          <span v-else-if="templateChecks[selectedTemplate.id]?.status === 'fresh'">已是最新</span>
          <NButton v-else-if="templateChecks[selectedTemplate.id]?.status === 'stale'" text type="warning"
            @click="refreshTemplateDetails(selectedTemplate)">有新数据，点击更新</NButton>
          <NButton v-else-if="templateChecks[selectedTemplate.id]?.status === 'missing'" text type="primary"
            @click="refreshTemplateDetails(selectedTemplate)">尚未同步，点击获取最新数据</NButton>
          <NButton v-else-if="templateChecks[selectedTemplate.id]?.status === 'error'" text type="warning"
            :title="templateChecks[selectedTemplate.id]?.message" @click="checkTemplateUpdate(selectedTemplate)">暂时无法检查更新，点击重试</NButton>
        </div>

        <section v-if="detailViewMode === 'list'" class="unit-list-panel">
          <div class="table-scroll">
            <table class="unit-table">
              <thead>
                <tr>
                  <th>课序</th>
                  <th>Unit</th>
                  <th>类型</th>
                  <th>直播路径</th>
                  <th>实操路径</th>
                  <th>资料</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="group in selectedTemplateLevelGroups" :key="group.levelNo">
                  <tr class="level-row">
                    <td colspan="7">
                      <strong>{{ group.label }}</strong>
                      <span>{{ group.units.length }} 个 Unit</span>
                    </td>
                  </tr>
                  <tr
                    v-for="unit in group.units"
                    :key="unit.unitId"
                    :class="getUnitCategoryClass(unit)"
                  >
                    <td>
                      <span class="lesson-pill">{{ getUnitLessonLabel(unit) }}</span>
                    </td>
                    <td>
                      <div class="unit-title-cell">
                        <strong>{{ unit.title }}</strong>
                        <span>
                          <a :href="getUnitUrl(selectedTemplate, unit)" target="_blank" rel="noopener noreferrer">
                            {{ unit.unitId }}
                          </a>
                          <NButton text size="tiny" @click="copyText(unit.unitId, 'Unit ID')">
                            复制
                          </NButton>
                        </span>
                      </div>
                    </td>
                    <td>
                      <NTag :type="getUnitCategoryMeta(unit).type" size="small">
                        {{ getUnitCategoryMeta(unit).label }}
                      </NTag>
                      <small v-if="contentTypeLabels[unit.contentType] !== getUnitCategoryMeta(unit).label" class="content-type">{{ contentTypeLabels[unit.contentType] }}</small>
                    </td>
                    <td>
                      <UnitPaths :unit="unit" kind="live" :can-parse="canOpenCourseStructure"
                        @parse="openCourseStructure(selectedTemplate, unit, $event)" @copy="copyText($event, '直播路径 ID')" />
                    </td>
                    <td>
                      <UnitPaths :unit="unit" kind="practice" :can-parse="canOpenCourseStructure"
                        @parse="openCourseStructure(selectedTemplate, unit, $event)" @copy="copyText($event, '实操路径 ID')" />
                    </td>
                    <td>
                      <NButton v-if="unit.materialUrl" text type="primary" @click="openMaterial(unit)">
                        {{ unit.materialLabel || '资料' }}
                      </NButton>
                      <span v-else class="muted">-</span>
                    </td>
                    <td>
                      <div class="row-actions">
                        <NButton
                          v-if="canOpenCourseStructure"
                          size="small"
                          type="primary"
                          secondary
                          @click="openCourseStructure(selectedTemplate, unit)"
                        >
                          <template #icon><SvgIcon icon="mdi:source-branch" /></template>
                          课包解析
                        </NButton>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </section>

        <section v-else class="unit-card-panel">
          <section v-for="group in selectedTemplateLevelGroups" :key="group.levelNo" class="unit-level-section">
            <header class="unit-level-header">
              <div>
                <small>课程分组</small>
                <strong>{{ group.label }}</strong>
              </div>
              <span>{{ group.units.length }} 个 Unit</span>
            </header>

            <div class="unit-card-grid">
              <article
                v-for="unit in group.units"
                :key="unit.unitId"
                class="unit-card"
                :class="getUnitCategoryClass(unit)"
              >
                <div class="cover-frame">
                  <img
                    v-if="getCoverUrl(unit)"
                    :src="getCoverUrl(unit)"
                    :alt="unit.title"
                    loading="lazy"
                  />
                  <div v-else class="cover-placeholder">
                    <SvgIcon :icon="getTemplateLanguageVisual(selectedTemplate).icon" />
                    <span>{{ getTemplateLanguageVisual(selectedTemplate).mark }}</span>
                  </div>
                </div>

                <div class="unit-card-body">
                  <div class="unit-card-tags">
                    <NTag :type="getUnitCategoryMeta(unit).type" size="small">
                      {{ getUnitCategoryMeta(unit).label }}
                    </NTag>
                    <NTag v-if="getLiveLabel(unit)" type="error" size="small">
                      {{ getLiveLabel(unit) }}
                    </NTag>
                  </div>

                  <h2>{{ unit.title }}</h2>
                  <p>{{ getUnitLessonLabel(unit) }} · Unit {{ unit.unitId }}</p>

                  <div class="card-paths">
                    <div><small>直播路径</small><UnitPaths :unit="unit" kind="live" :can-parse="canOpenCourseStructure"
                      @parse="openCourseStructure(selectedTemplate, unit, $event)" @copy="copyText($event, '直播路径 ID')" /></div>
                    <div><small>实操路径</small><UnitPaths :unit="unit" kind="practice" :can-parse="canOpenCourseStructure"
                      @parse="openCourseStructure(selectedTemplate, unit, $event)" @copy="copyText($event, '实操路径 ID')" /></div>
                  </div>

                  <div class="unit-card-actions">
                    <NButton size="small" secondary @click="openUnit(selectedTemplate, unit)">
                      Unit
                    </NButton>
                    <NButton size="small" secondary @click="copyText(unit.unitId, 'Unit ID')">
                      复制
                    </NButton>
                    <NButton v-if="unit.materialUrl" size="small" secondary type="primary" @click="openMaterial(unit)">
                      资料
                    </NButton>
                    <NButton
                      v-if="canOpenCourseStructure"
                      size="small"
                      secondary
                      type="primary"
                      @click="openCourseStructure(selectedTemplate, unit)"
                    >
                      课包解析
                    </NButton>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </section>
      </main>
    </section>
  </div>
</template>

<style scoped>
.sync-status { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 24px; font-size: 12px; }
.sync-status > span { opacity: .7; }
.card-paths { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
.card-paths small { opacity: .65; }

.course-assets-page {
  min-height: calc(100vh - 104px);
  padding: 24px;
  background:
    linear-gradient(180deg, rgba(246, 248, 252, 0.96), rgba(238, 242, 247, 0.96)),
    #eef2f7;
  color: #1f2937;
}

.entry-view,
.detail-view {
  width: min(1480px, 100%);
  margin: 0 auto;
}

.entry-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 8px 0 20px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

h1 {
  margin: 0;
  color: #111827;
  font-size: 28px;
  line-height: 1.22;
  letter-spacing: 0;
}

.entry-description {
  max-width: 700px;
  margin: 10px 0 0;
  color: #64748b;
  line-height: 1.7;
}

.entry-actions {
  display: flex;
  width: min(520px, 100%);
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.entry-actions :deep(.n-input) {
  width: 260px;
}

.template-copy small {
  color: #64748b;
}

.group-grid {
  display: grid;
  width: min(1480px, 100%);
  grid-template-columns: repeat(3, minmax(280px, 1fr));
  gap: 18px;
  align-items: start;
  justify-content: center;
  margin: 0 auto;
}

.group-grid.has-expanded {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-flow: dense;
}

.group-card {
  position: relative;
  overflow: hidden;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: linear-gradient(150deg, #ffffff 0%, #f8fbff 58%, #eff6ff 100%);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.group-card.is-expanded {
  grid-column: span 2;
  border-color: #60a5fa;
  box-shadow: 0 24px 52px rgba(37, 99, 235, 0.16);
  transform: translateY(-2px);
}

.group-card-inner {
  display: grid;
  min-height: 460px;
}

.group-card.is-expanded .group-card-inner {
  grid-template-columns: minmax(220px, 0.82fr) minmax(300px, 1.18fr);
}

.group-card-button {
  display: grid;
  width: 100%;
  min-height: 460px;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
  align-content: space-between;
  padding: 24px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.group-card.is-expanded .group-card-button {
  border-right: 1px solid rgba(148, 163, 184, 0.18);
}

.group-visual {
  display: flex;
  grid-column: 1 / -1;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.group-mark {
  display: grid;
  width: 68px;
  height: 68px;
  place-items: center;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 16px;
  background: rgba(239, 246, 255, 0.88);
  color: #2563eb;
  font-size: 34px;
}

.group-code {
  color: rgba(15, 23, 42, 0.14);
  font-size: 34px;
  font-weight: 900;
  line-height: 1;
}

.group-main {
  display: grid;
  grid-column: 1 / -1;
  gap: 8px;
  min-width: 0;
}

.group-main strong {
  display: block;
  color: #111827;
  font-size: 30px;
  line-height: 1.15;
}

.group-main small {
  display: block;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.group-main em {
  display: block;
  min-height: 52px;
  color: #475569;
  font-style: normal;
  line-height: 1.6;
}

.group-hint {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
  color: #2563eb;
  font-weight: 800;
}

.entry-direct-actions {
  display: flex;
  justify-content: center;
  padding: 18px 0 0;
}

.all-template-panel {
  overflow: hidden;
  margin-top: 16px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
}

.all-template-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #e5eaf2;
  background: #f8fafc;
}

.all-template-panel-head small {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.all-template-panel-head strong {
  display: block;
  color: #111827;
  font-size: 18px;
}

.all-template-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
  max-height: 460px;
  overflow: auto;
  padding: 16px;
}

.template-list {
  display: grid;
  gap: 8px;
  align-content: start;
  max-height: 460px;
  overflow: auto;
  padding: 22px 18px;
}

.template-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid #e5eaf2;
  border-radius: 8px;
  background: #f8fafc;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.template-item:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}

.template-mark {
  display: grid;
  min-width: 42px;
  height: 32px;
  place-items: center;
  border-radius: 6px;
  background: #ffffff;
  color: #0f766e;
  font-size: 13px;
  font-weight: 800;
}

.template-copy {
  min-width: 0;
}

.template-copy strong {
  display: block;
  overflow: hidden;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-copy small {
  display: block;
  overflow: hidden;
  margin-top: 4px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  padding: 60px 0;
}

.detail-view {
  display: grid;
  grid-template-columns: 292px minmax(0, 1fr);
  gap: 18px;
  align-items: stretch;
}

.template-sidebar,
.template-detail {
  min-height: calc(100vh - 152px);
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
}

.template-sidebar {
  position: sticky;
  top: 16px;
  display: flex;
  max-height: calc(100vh - 152px);
  flex-direction: column;
  overflow: hidden;
}

.sidebar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px;
  border-bottom: 1px solid #e5eaf2;
  background: #f8fafc;
}

.nav-groups {
  overflow: auto;
  padding: 12px;
}

.nav-group + .nav-group {
  margin-top: 14px;
}

.nav-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 800;
}

.nav-group-title small {
  margin-left: auto;
  color: #94a3b8;
}

.nav-template {
  display: grid;
  width: 100%;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  text-align: left;
  cursor: pointer;
}

.nav-template + .nav-template {
  margin-top: 4px;
}

.nav-template span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.nav-template strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-template:hover,
.nav-template.active {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.template-detail {
  overflow: hidden;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px;
  border-bottom: 1px solid #e5eaf2;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.detail-actions {
  flex-shrink: 0;
}

.unit-list-panel,
.unit-card-panel {
  padding: 18px 24px 24px;
}

.table-scroll {
  overflow: auto;
  border: 1px solid #e5eaf2;
  border-radius: 8px;
}

.unit-table {
  width: 100%;
  min-width: 1120px;
  border-collapse: collapse;
  background: #ffffff;
}

.unit-table th,
.unit-table td {
  padding: 12px;
  border-bottom: 1px solid #e5eaf2;
  vertical-align: top;
  text-align: left;
}

.unit-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 800;
}

.unit-table tr:last-child td {
  border-bottom: 0;
}

.level-row td {
  padding: 10px 14px;
  border-top: 1px solid #dbeafe;
  border-bottom: 1px solid #dbeafe;
  background: #f8fafc;
}

.level-row strong {
  margin-right: 10px;
  color: #1d4ed8;
  font-size: 13px;
}

.level-row span {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.lesson-pill {
  display: inline-flex;
  min-width: 64px;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 12px;
  font-weight: 800;
}

.unit-title-cell,
.path-cell {
  display: grid;
  gap: 5px;
}

.unit-title-cell strong,
.path-cell strong {
  color: #111827;
}

.unit-title-cell span,
.path-cell span,
.content-type,
.muted {
  color: #64748b;
  font-size: 12px;
}

.unit-title-cell a {
  color: #2563eb;
  font-weight: 800;
  text-decoration: none;
}

.row-actions,
.unit-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.unit-card-panel {
  display: grid;
  gap: 22px;
}

.unit-level-section {
  display: grid;
  gap: 12px;
}

.unit-level-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 14px;
  padding: 0 2px 10px;
  border-bottom: 1px solid #e5eaf2;
}

.unit-level-header small {
  display: block;
  margin-bottom: 3px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.unit-level-header strong {
  color: #111827;
  font-size: 20px;
}

.unit-level-header span {
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.unit-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 16px;
}

.unit-card {
  overflow: hidden;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
}

.cover-frame {
  position: relative;
  display: grid;
  aspect-ratio: 16 / 9;
  place-items: center;
  overflow: hidden;
  background: var(--unit-soft-bg, #f1f5f9);
}

.cover-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  display: grid;
  gap: 8px;
  place-items: center;
  color: var(--unit-accent, #475569);
  font-weight: 900;
}

.cover-placeholder :deep(.svg-icon) {
  font-size: 34px;
}

.unit-card-body {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.unit-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.unit-card h2 {
  min-height: 44px;
  margin: 0;
  color: #111827;
  font-size: 16px;
  line-height: 1.4;
}

.unit-card p {
  margin: 0;
  color: #64748b;
}

.unit-card-meta {
  display: flex;
  min-height: 24px;
  flex-wrap: wrap;
  gap: 6px;
}

.unit-card-meta span {
  padding: 3px 7px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
}

.unit-category-soft {
  --unit-accent: #2563eb;
  --unit-soft-bg: #eff6ff;
}

.unit-category-hardware {
  --unit-accent: #b45309;
  --unit-soft-bg: #fff7ed;
}

.unit-category-ai {
  --unit-accent: #059669;
  --unit-soft-bg: #ecfdf5;
}

.unit-category-prep {
  --unit-accent: #64748b;
  --unit-soft-bg: #f1f5f9;
}

.unit-category-contest {
  --unit-accent: #dc2626;
  --unit-soft-bg: #fef2f2;
}

.unit-table tr.unit-category-soft td:first-child,
.unit-table tr.unit-category-hardware td:first-child,
.unit-table tr.unit-category-ai td:first-child,
.unit-table tr.unit-category-prep td:first-child,
.unit-table tr.unit-category-contest td:first-child {
  box-shadow: inset 4px 0 0 var(--unit-accent);
}

.dark .course-assets-page {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.96)),
    #020617;
  color: #dbeafe;
}

.dark h1,
.dark .group-main strong,
.dark .template-copy strong,
.dark .unit-title-cell strong,
.dark .path-cell strong,
.dark .unit-card h2 {
  color: #f8fafc;
}

.dark .group-card,
.dark .all-template-panel,
.dark .template-sidebar,
.dark .template-detail,
.dark .unit-table,
.dark .unit-card {
  border-color: rgba(148, 163, 184, 0.24);
  background: #0f172a;
}

.dark .template-item,
.dark .all-template-panel-head,
.dark .sidebar-top,
.dark .detail-header,
.dark .unit-table th {
  border-color: rgba(148, 163, 184, 0.2);
  background: #111827;
}

.dark .table-scroll {
  border-color: rgba(148, 163, 184, 0.24);
}

.dark .template-mark,
.dark .lesson-pill,
.dark .unit-card-meta span {
  background: #1e293b;
}

.dark .group-card {
  background: linear-gradient(150deg, #0f172a 0%, #111827 58%, #172554 100%);
}

.dark .group-code {
  color: rgba(226, 232, 240, 0.16);
}

.dark .unit-level-header strong,
.dark .all-template-panel-head strong {
  color: #f8fafc;
}

.dark .level-row td {
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(37, 99, 235, 0.12);
}

.dark .template-item:hover,
.dark .nav-template:hover,
.dark .nav-template.active {
  border-color: #2563eb;
  background: rgba(37, 99, 235, 0.18);
}

@media (max-width: 1100px) {
  .entry-header,
  .detail-header {
    flex-direction: column;
  }

  .entry-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .detail-view {
    grid-template-columns: 1fr;
  }

  .template-sidebar {
    position: static;
    min-height: auto;
    max-height: none;
  }

  .group-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .group-card.is-expanded {
    grid-column: span 2;
  }
}

@media (max-width: 720px) {
  .course-assets-page {
    padding: 14px;
  }

  .group-grid,
  .group-card.is-expanded .group-card-inner {
    grid-template-columns: 1fr;
  }

  .group-card-button {
    min-height: 320px;
  }

  .group-card.is-expanded {
    grid-column: span 1;
  }

  .group-card.is-expanded .group-card-button {
    border-right: 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  }

  .entry-actions :deep(.n-input) {
    width: 100%;
  }
}
</style>
