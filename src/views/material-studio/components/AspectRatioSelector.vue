<script setup lang="ts">
/**
 * 比例选择器 — 药丸按钮组
 */
const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const ratios = [
  { value: '1:1', label: '1:1', icon: '⬜' },
  { value: '4:3', label: '4:3', icon: '🖥️' },
  { value: '3:4', label: '3:4', icon: '📱' },
  { value: '16:9', label: '16:9', icon: '🎬' },
  { value: '9:16', label: '9:16', icon: '📲' },
];
</script>

<template>
  <div class="ratio-selector">
    <span class="ratio-label">画面比例</span>
    <div class="ratio-pills">
      <button
        v-for="r in ratios"
        :key="r.value"
        class="ratio-pill"
        :class="{ active: props.modelValue === r.value }"
        @click="emit('update:modelValue', r.value)"
      >
        <span class="ratio-icon">{{ r.icon }}</span>
        {{ r.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ratio-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ratio-label {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
}

.ratio-pills {
  display: flex;
  gap: 4px;
}

.ratio-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  color: #aaa;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.ratio-pill:hover {
  background: rgba(124, 92, 252, 0.08);
  border-color: rgba(124, 92, 252, 0.2);
  color: #ccc;
}

.ratio-pill.active {
  background: rgba(124, 92, 252, 0.15);
  border-color: rgba(124, 92, 252, 0.4);
  color: #b8a5ff;
  font-weight: 600;
}

.ratio-icon {
  font-size: 11px;
}
</style>
