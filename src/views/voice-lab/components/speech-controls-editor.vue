<script setup lang="ts">
import { computed } from 'vue';
import { compileSpeech, type SpeechControl } from '../../../../shared/speech-controls';
const props = defineProps<{ modelValue?: SpeechControl[]; text: string; disabled?: boolean; available?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: SpeechControl[]] }>();
const items = computed(() => props.modelValue || []);
const validation = computed(() => {
  try { compileSpeech(props.text, items.value); return ''; }
  catch (error) { return (error as Error).message; }
});
function add(kind: SpeechControl['kind']) {
  emit('update:modelValue', [...items.value, kind === 'pause' ? { kind, after: '', occurrence: 1, timeMs: 500 } : { kind, text: '', alias: '' }]);
}
function change(index: number, key: string, value: string | number | null) {
  emit('update:modelValue', items.value.map((item, i) => i === index ? { ...item, [key]: value ?? '' } as SpeechControl : item));
}
function remove(index: number) { emit('update:modelValue', items.value.filter((_, i) => i !== index)); }
</script>

<template>
  <NCollapse :default-expanded-names="items.length ? ['reading'] : []">
    <NCollapseItem name="reading" :title="`停顿与指定读法${items.length ? `（${items.length}项）` : ''}`">
      <p class="hint">只影响朗读，字幕保留原文。指定读法应用到每一处匹配文字；停顿可以选择第几处。</p>
      <NAlert v-if="available === false" type="warning" :show-icon="false">此声音暂不支持这些设置，请选择复刻音色或基础音色。</NAlert>
      <div v-for="(item, index) in items" :key="index" class="control-row">
        <template v-if="item.kind === 'pause'">
          <span>停顿</span>
          <NInput :value="item.after" placeholder="停在这段文字之后" aria-label="停顿定位文字" :disabled="disabled" @update:value="v => change(index, 'after', v)" />
          <NInputNumber :value="item.occurrence" :min="1" :max="100" prefix="第" suffix="处" aria-label="停顿出现位置" :disabled="disabled" @update:value="v => change(index, 'occurrence', v)" />
          <NInputNumber :value="item.timeMs" :min="50" :max="10000" :step="50" suffix="毫秒" aria-label="停顿时长" :disabled="disabled" @update:value="v => change(index, 'timeMs', v)" />
        </template>
        <template v-else>
          <span>读法</span>
          <NInput :value="item.text" placeholder="原文，例如：W3C" aria-label="指定读法原文" :disabled="disabled" @update:value="v => change(index, 'text', v)" />
          <NInput :value="item.alias" placeholder="读成，例如：网络协议标准" aria-label="指定读法内容" :disabled="disabled" @update:value="v => change(index, 'alias', v)" />
        </template>
        <NButton size="small" quaternary :disabled="disabled" @click="remove(index)">移除</NButton>
      </div>
      <NSpace class="buttons">
        <NButton size="small" secondary :disabled="disabled || available === false || items.length >= 30" @click="add('pause')">添加停顿</NButton>
        <NButton size="small" secondary :disabled="disabled || available === false || items.length >= 30" @click="add('reading')">指定读法</NButton>
      </NSpace>
      <p v-if="validation" class="error">{{ validation }}</p>
    </NCollapseItem>
  </NCollapse>
</template>

<style scoped>
.hint { font-size: 12px; color: #7b8496; margin: 4px 0 12px; }
.control-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.control-row > :deep(.n-input) { flex: 1 1 160px; }
.control-row > :deep(.n-input-number) { flex: 1 1 110px; }
.buttons { margin-top: 12px; }
.error { color: #d45555; font-size: 12px; }
</style>
