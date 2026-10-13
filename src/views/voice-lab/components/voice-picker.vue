<script setup lang="ts">
import { computed, ref } from 'vue';
import type { VoiceCloneItem } from '@/service/api/voice-lab';
import { commonVoices, voiceChoiceLabel } from '@/service/api/voice-selection';
import { voiceModelOptions } from '@/service/api/voice-models';

const props = defineProps<{
  value?: string | null;
  voices: VoiceCloneItem[];
  loading?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}>();
const emit = defineEmits<{ 'update:value': [value: string | null] }>();
const expanded = ref(false);
const model = ref<string | null>('qwen-audio-3.0-tts-flash');
const gender = ref<string | null>(null);
const shortList = computed(() => commonVoices(props.voices, props.value ? [props.value] : []));
const candidates = computed(() => expanded.value
  ? props.voices.filter(v => (!model.value || v.targetModel === model.value) && (!gender.value || v.gender === gender.value))
  : shortList.value);
const options = computed(() => {
  const list = [...candidates.value];
  const current = props.voices.find(v => v.voice === props.value);
  if (current && !list.some(v => v.voice === current.voice)) list.unshift(current);
  return list.map(v => ({ label: voiceChoiceLabel(v), value: v.voice,
    disabled: v.modelSupported === false || Boolean(v.status && v.status !== 'OK') }));
});
</script>

<template>
  <div class="voice-picker">
    <div class="voice-picker__switch">
      <span>{{ expanded ? '更多音色' : '常用声音' }}</span>
      <NButton text size="tiny" :disabled="disabled" @click="expanded = !expanded">
        {{ expanded ? '收起，回到常用' : '更多音色' }}
      </NButton>
    </div>
    <div v-if="expanded" class="voice-picker__filters">
      <NSelect v-model:value="model" size="small" :options="voiceModelOptions" clearable placeholder="全部模型" :disabled="disabled" aria-label="声音模型筛选" />
      <NSelect v-model:value="gender" size="small" :options="[{ label: '女声', value: '女' }, { label: '男声', value: '男' }]" clearable placeholder="全部声线" :disabled="disabled" aria-label="声音性别筛选" />
    </div>
    <NSelect
      :value="value || null"
      :options="options"
      :loading="loading"
      :disabled="disabled"
      :aria-label="ariaLabel || '选择声音'"
      filterable
      clearable
      :placeholder="expanded ? '搜索名称或声线特点' : '先选已有角色，或试听少量候选'"
      @update:value="value => emit('update:value', value)"
    />
    <div class="voice-picker__hint">{{ expanded ? '先按模型、声线缩小范围，再搜索。' : '已有角色优先；完整目录按需展开。' }}</div>
  </div>
</template>

<style scoped>
.voice-picker { width: 100%; min-width: 0; }
.voice-picker__switch { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; }
.voice-picker__filters { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 6px; margin-bottom: 6px; }
.voice-picker__hint { margin-top: 5px; color: #888; font-size: 11px; line-height: 1.5; }
</style>
