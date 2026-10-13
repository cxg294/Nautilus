<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CourseAssetPath } from '@/service/api/course-assets';
import type { CourseUnit } from '../data';

const props = defineProps<{ unit: CourseUnit; kind: 'live' | 'practice'; canParse: boolean }>();
const emit = defineEmits<{ parse: [path: CourseAssetPath]; copy: [id: number] }>();
const expanded = ref(false);
const paths = computed<CourseAssetPath[]>(() => {
  if (props.unit.paths) return props.unit.paths.filter(path => props.kind === 'live'
    ? path.itemType === 'LIVE_STREAMING' : path.itemType !== 'LIVE_STREAMING');
  const id = props.kind === 'live' ? props.unit.livePathId : props.unit.practicePathId;
  const name = props.kind === 'live' ? props.unit.livePathName : props.unit.practicePathName;
  return id ? [{ chapterId: 0, arrangementId: id, name: name || '-', itemType: '', hasCourseware: false }] : [];
});
const visiblePaths = computed(() => expanded.value ? paths.value : paths.value.slice(0, 1));
</script>

<template>
  <div v-if="paths.length" class="paths">
    <div v-for="path in visiblePaths" :key="`${path.chapterId}:${path.arrangementId}`" class="path">
      <strong>{{ path.name }}</strong>
      <div class="path-actions">
        <span>{{ path.arrangementId || '-' }}</span>
        <NButton v-if="path.arrangementId" text size="tiny" @click="emit('copy', path.arrangementId)">复制</NButton>
        <NButton v-if="canParse && path.chapterId && path.hasCourseware" text type="primary" size="tiny" @click="emit('parse', path)">解析</NButton>
        <small v-if="path.chapterId && !path.hasCourseware">无课件</small>
      </div>
    </div>
    <NButton v-if="paths.length > 1" text type="primary" size="tiny" :aria-expanded="expanded" @click="expanded = !expanded">
      {{ expanded ? '收起' : `展开其余 ${paths.length - 1} 条` }}
    </NButton>
  </div>
  <span v-else>-</span>
</template>

<style scoped>
.paths, .path { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.paths { gap: 8px; }
.path-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; }
.path-actions > span, small { opacity: .65; }
</style>
