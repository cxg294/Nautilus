<script setup lang="ts">
/**
 * CardStack — 左侧对话卡片栈
 *
 * 最后一张展开，前面的折叠
 * 带底部输入框用于自由输入追问回复
 */
import { ref, nextTick, watch } from 'vue';
import { useMaterialStudio } from '../composables/use-material-studio';
import DialogCard from './DialogCard.vue';

const { state, sendMessage, selectOption } = useMaterialStudio();

const expandedCardId = ref('');
const freeInput = ref('');
const scrollContainer = ref<HTMLElement | null>(null);
const freeInputRef = ref<HTMLTextAreaElement | null>(null);
const isFlashing = ref(false);

// 自动展开最后一张卡片
watch(
  () => state.cards.length,
  () => {
    if (state.cards.length > 0) {
      expandedCardId.value = state.cards[state.cards.length - 1].id;
      nextTick(() => {
        scrollContainer.value?.scrollTo({
          top: scrollContainer.value.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  }
);

function toggleCard(id: string) {
  expandedCardId.value = expandedCardId.value === id ? '' : id;
}

function handleCustomInput() {
  if (freeInputRef.value) {
    freeInputRef.value.focus();
    isFlashing.value = true;
    setTimeout(() => { isFlashing.value = false; }, 1000); // end flash after 1s
    
    // Smooth scroll specifically to bottom
    setTimeout(() => {
      scrollContainer.value?.scrollTo({
        top: scrollContainer.value.scrollHeight,
        behavior: 'smooth',
      });
    }, 100);
  }
}


function handleFreeInput() {
  if (!freeInput.value.trim() || state.chatLoading) return;
  const msg = freeInput.value;
  freeInput.value = '';
  sendMessage(msg);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleFreeInput();
  }
}
</script>

<template>
  <div class="card-stack">
    <!-- 卡片列表 -->
    <div ref="scrollContainer" class="card-list">
      <DialogCard
        v-for="(card, idx) in state.cards"
        :key="card.id"
        :card="card"
        :expanded="expandedCardId === card.id"
        :is-latest="idx === state.cards.length - 1"
        @toggle="toggleCard"
        @select-option="selectOption"
        @custom-input="handleCustomInput"
      />

      <!-- 加载中指示 -->
      <div v-if="state.chatLoading" class="loading-indicator">
        <span class="loading-dot" />
        <span class="loading-dot" />
        <span class="loading-dot" />
        <span class="loading-text">{{ state.chatProgress || 'AI 正在分析...' }}</span>
      </div>
    </div>

    <!-- 底部自由输入框（仅在追问阶段且当前卡片无需选择时显示） -->
    <div v-if="state.phase === 'clarifying'" class="free-input-bar">
      <textarea
        ref="freeInputRef"
        v-model="freeInput"
        class="free-input"
        :class="{ 'focus-flash': isFlashing }"
        placeholder="或者直接输入你的描述..."
        rows="1"
        :disabled="state.chatLoading"
        @keydown="handleKeydown"
      />
      <button
        class="free-send"
        :class="{ active: freeInput.trim() && !state.chatLoading }"
        :disabled="!freeInput.trim() || state.chatLoading"
        @click="handleFreeInput"
      >
        ↑
      </button>
    </div>
  </div>
</template>

<style scoped>
.card-stack {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.card-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px;
  padding-bottom: 8px;
}

.card-list::-webkit-scrollbar {
  width: 4px;
}

.card-list::-webkit-scrollbar-thumb {
  background: var(--n-border-color);
  border-radius: 2px;
}

/* 加载指示 */
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  color: var(--n-text-color-3);
  font-size: 13px;
}

.loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #7c5cfc;
  animation: pulse 1.2s ease-in-out infinite;
}

.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

.loading-text {
  margin-left: 4px;
}

/* 底部输入框 */
.free-input-bar {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 8px 4px 4px;
  border-top: 1px solid var(--n-border-color);
}

.free-input {
  flex: 1;
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  background: var(--n-color-modal);
  color: var(--n-text-color);
  font-size: 13px;
  padding: 8px 12px;
  resize: none;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
}

.free-input:focus {
  border-color: rgba(124, 92, 252, 0.3);
}

.free-input.focus-flash {
  animation: bg-flash 1s;
}

@keyframes bg-flash {
  0% { box-shadow: 0 0 0 2px rgba(124, 92, 252, 0.5); border-color: #7c5cfc; }
  100% { box-shadow: 0 0 0 0px rgba(124, 92, 252, 0); border-color: rgba(124, 92, 252, 0.3); }
}

.free-input:disabled {
  opacity: 0.5;
}

.free-send {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: none;
  background: var(--n-color);
  color: var(--n-text-color-3);
  font-size: 16px;
  font-weight: 700;
  cursor: not-allowed;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  border: 1px solid var(--n-border-color);
}

.free-send.active {
  background: #7c5cfc;
  color: #fff;
  cursor: pointer;
}
</style>
