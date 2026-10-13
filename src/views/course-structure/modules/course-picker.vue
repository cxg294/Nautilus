<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { courseCatalog } from '@/views/course-assets/catalog';
const props = defineProps<{
  subjectId: number | null; unitId: number | null; templateId: number | null;
  chapterId: number | null; chapters: { value: number; label: string; disabled: boolean }[];
  chaptersLoading: boolean; busy: boolean; status: string; error: string; actionLabel: string; canView: boolean;
}>();
const emit = defineEmits<{
  'update:subjectId': [value: number | null]; 'update:unitId': [value: number | null];
  'update:templateId': [value: number | null]; 'update:chapterId': [value: number | null];
  view: []; check: []; force: []; retry: [];
}>();
const manualSubject = ref(props.subjectId);
const manualUnit = ref(props.unitId);
watch([() => props.subjectId, () => props.unitId], () => {
  manualSubject.value = props.subjectId; manualUnit.value = props.unitId;
});
function applyManual() {
  emit('update:subjectId', manualSubject.value);
  emit('update:unitId', manualUnit.value);
}
const subjects = [{ label: '图形化', value: 17 }, { label: 'Python', value: 19 }, { label: 'C++', value: 21 }];
const subjectMap = { graphical: 17, python: 19, c: 21 };
const templates = computed(() => courseCatalog.value.filter(item => subjectMap[item.language] === props.subjectId));
const templateOptions = computed(() => templates.value.map(item => ({ label: `${item.name}（${item.id}）`, value: item.id })));
const selectedTemplate = computed(() => templates.value.find(item => item.id === props.templateId));
const units = computed(() => selectedTemplate.value?.units.map(unit => ({
  label: `L${unit.levelNo} / U${unit.unitNo} · ${unit.title}（${unit.unitId}）`, value: unit.unitId,
})) || []);
watch([() => props.subjectId, () => props.unitId, courseCatalog], () => {
  if (selectedTemplate.value?.units.some(unit => unit.unitId === props.unitId)) return;
  emit('update:templateId', templates.value.find(item => item.units.some(unit => unit.unitId === props.unitId))?.id || null);
}, { immediate: true });
function selectSubject(value: number) {
  emit('update:subjectId', value);
  emit('update:templateId', null);
  emit('update:unitId', null);
}
function selectTemplate(value: number) {
  emit('update:templateId', value);
  emit('update:unitId', templates.value.find(item => item.id === value)?.units[0]?.unitId || null);
}
</script>

<template>
  <div class="picker">
    <label>学科<NSelect :value="subjectId" :options="subjects" @update:value="selectSubject" /></label>
    <label>课程模板<NSelect :value="templateId" :options="templateOptions" filterable placeholder="选择课程模板" @update:value="selectTemplate" /></label>
    <label>Unit<NSelect :value="units.some(item => item.value === unitId) ? unitId : null" :options="units" :disabled="!templateId" filterable placeholder="选择 Unit" @update:value="emit('update:unitId', $event)" /></label>
    <label>路径<NSelect :value="chapterId" :options="chapters" :loading="chaptersLoading" :disabled="!unitId || chaptersLoading" filterable placeholder="选择路径" @update:value="emit('update:chapterId', $event)" /></label>
    <div class="picker-status" role="status">{{ status }}</div>
    <NAlert v-if="error" type="error" :show-icon="false">{{ error }} <NButton text @click="emit('retry')">重试</NButton></NAlert>
    <NButton type="primary" :loading="busy" :disabled="!canView" @click="emit('view')">{{ actionLabel }}</NButton>
    <NCollapse>
      <NCollapseItem title="高级入口" name="advanced">
        <div class="advanced">
          <label>学科<NSelect v-model:value="manualSubject" :options="subjects" /></label>
          <label>Unit ID<NInputNumber v-model:value="manualUnit" :min="1" :precision="0" :show-button="false" placeholder="填写 Unit ID" /></label>
          <NButton :disabled="busy || !manualSubject || !manualUnit" @click="applyManual">按编号查找</NButton>
          <small v-if="unitId && !templateId">当前 Unit 不在已收录模板中，将按所选学科直接查询。</small>
          <div class="advanced-actions">
            <NButton size="small" :disabled="busy || !canView" @click="emit('check')">检查更新</NButton>
            <NButton size="small" :disabled="busy || !canView" @click="emit('force')">强制重新解析</NButton>
          </div>
        </div>
      </NCollapseItem>
    </NCollapse>
  </div>
</template>

<style scoped>
.picker, .advanced { display: flex; flex-direction: column; gap: 12px; }
label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
.picker-status { font-size: 12px; opacity: .75; }
.advanced-actions { display: flex; gap: 8px; }
</style>
