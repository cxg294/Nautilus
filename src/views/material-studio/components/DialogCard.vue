<script setup lang="ts">
/**
 * DialogCard — 单张对话卡片
 *
 * 展示一轮交互：用户原文 + AI 话术 + 选项
 */
import type { DialogCardData } from '../composables/use-material-studio';

const props = defineProps<{
  card: DialogCardData;
  expanded: boolean;
  isLatest: boolean;
}>();

const emit = defineEmits<{
  toggle: [id: string];
  selectOption: [cardId: string, option: string];
}>();

function getDimensionLabel(dim: string) {
  const map: Record<string, string> = {
    clarify_d1: '主体内容',
    clarify_d2: '呈现意图',
    clarify_d3: '用途场景',
    select_style: '风格选择',
  };
  return map[dim] || dim;
}
</script>

<template>
  <div class="dialog-card" :class="{ expanded, latest: isLatest, collapsed: !expanded }">
    <!-- 折叠态 -->
    <div v-if="!expanded" class="card-collapsed" @click="emit('toggle', card.id)">
      <div class="collapsed-dot" />
      <span class="collapsed-summary">
        {{ card.userInput.slice(0, 40) }}{{ card.userInput.length > 40 ? '...' : '' }}
      </span>
      <span class="collapsed-tag">{{ getDimensionLabel(card.dimension) }}</span>
      <span v-if="card.userChoice" class="collapsed-check">✓</span>
    </div>

    <!-- 展开态 -->
    <div v-else class="card-expanded">
      <!-- 用户原文 -->
      <div class="card-section user-section">
        <div class="section-label">你的描述</div>
        <div class="section-content user-text">{{ card.userInput }}</div>
      </div>

      <!-- AI 回复 -->
      <div class="card-section ai-section">
        <div class="section-label">
          <span class="ai-dot">✦</span>
          AI 助手
        </div>
        <div class="section-content ai-text">{{ card.aiReply }}</div>
      </div>

      <!-- 选项 -->
      <div v-if="card.options.length > 0 && isLatest && !card.userChoice" class="card-options">
        <button
          v-for="opt in card.options"
          :key="opt"
          class="option-btn"
          @click="emit('selectOption', card.id, opt)"
        >
          {{ opt }}
        </button>
      </div>

      <!-- 已选择标记 -->
      <div v-if="card.userChoice" class="card-chosen">
        <span class="chosen-label">已选择：</span>
        <span class="chosen-value">{{ card.userChoice }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-card {
  border-radius: 12px;
  transition: all 0.3s ease;
  overflow: hidden;
}

/* 折叠态 */
.card-collapsed {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.card-collapsed:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.collapsed-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #7c5cfc;
  flex-shrink: 0;
}

.collapsed-summary {
  flex: 1;
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collapsed-tag {
  font-size: 11px;
  color: #7c5cfc;
  background: rgba(124, 92, 252, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.collapsed-check {
  color: #2ed573;
  font-size: 14px;
}

/* 展开态 */
.card-expanded {
  padding: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.card-expanded .latest {
  border-color: rgba(124, 92, 252, 0.2);
}

.card-section {
  margin-bottom: 14px;
}

.card-section:last-child {
  margin-bottom: 0;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #888;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ai-dot {
  color: #7c5cfc;
  font-size: 12px;
}

.section-content {
  font-size: 14px;
  line-height: 1.6;
}

.user-text {
  color: #ddd;
  padding: 8px 12px;
  background: rgba(124, 92, 252, 0.06);
  border-radius: 8px;
  border-left: 3px solid rgba(124, 92, 252, 0.3);
}

.ai-text {
  color: #bbb;
  white-space: pre-line;
}

/* 选项 */
.card-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.option-btn {
  padding: 8px 16px;
  border: 1px solid rgba(124, 92, 252, 0.2);
  border-radius: 20px;
  background: rgba(124, 92, 252, 0.06);
  color: #c4b5fd;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.option-btn:hover {
  background: rgba(124, 92, 252, 0.15);
  border-color: rgba(124, 92, 252, 0.4);
  color: #e0d5ff;
  transform: translateY(-1px);
}

/* 已选择 */
.card-chosen {
  margin-top: 10px;
  padding: 6px 12px;
  background: rgba(46, 213, 115, 0.08);
  border-radius: 8px;
  font-size: 13px;
}

.chosen-label {
  color: #888;
}

.chosen-value {
  color: #2ed573;
}
</style>
