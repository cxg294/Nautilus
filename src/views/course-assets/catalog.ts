import { computed, ref } from 'vue';
import { fetchCourseAssetCatalog, type CourseAssetTemplateDetail } from '@/service/api/course-assets';
import { courseTemplates, type CourseUnit } from './data';

const snapshots = ref<Record<number, CourseAssetTemplateDetail>>({});

export function toCourseUnits(detail: CourseAssetTemplateDetail): CourseUnit[] {
  return detail.levels.flatMap(level => level.units.map(unit => ({
    ...unit,
    levelName: level.name || '',
    contentType: unit.contentType as CourseUnit['contentType'],
  })));
}

export function saveCatalogTemplate(detail: CourseAssetTemplateDetail, syncedAt = detail.syncedAt || '') {
  const previous = snapshots.value[detail.templateId];
  if (previous?.syncedAt && syncedAt && previous.syncedAt > syncedAt) return;
  snapshots.value = { ...snapshots.value, [detail.templateId]: { ...detail, syncedAt } };
}

export const courseCatalog = computed(() => courseTemplates.map(template => {
  const detail = snapshots.value[template.id];
  return detail?.levels?.length
    ? { ...template, name: detail.name, units: toCourseUnits(detail) }
    : template;
}));

export async function loadCourseCatalog(context: 'assets' | 'structure') {
  const { data, error } = await fetchCourseAssetCatalog(context);
  if (!error && data?.status === 'ready') data.templates?.forEach(detail => saveCatalogTemplate(detail));
}
