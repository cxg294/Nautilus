<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { getToken } from '@/store/modules/auth/shared';
import { uploadLibraryPortrait } from '@/service/api/character-library';
import { id, PLACEHOLDER, type WorkshopCharacter } from '../../sequence-player/workshop/model';
import PortraitEditor from './PortraitEditor.vue';
import VoiceSettings from './VoiceSettings.vue';
defineProps<{ disabled?: boolean }>();
const character = defineModel<WorkshopCharacter>('character', { required: true });
const message = useMessage();
const poseId = ref('');
const upload = ref<HTMLInputElement>();
const uploading = ref(false);
const copyTarget = ref<string | null>(null);
const pose = computed(() => character.value.poses.find(p => p.id === poseId.value) || character.value.poses[0]);
const poses = computed(() =>
  character.value.poses.map(p => ({
    label: `${p.name}${p.id === character.value.defaultPoseId ? ' · 默认' : ''}`,
    value: p.id
  }))
);
const targets = computed(() => poses.value.filter(p => p.value !== pose.value?.id));
const media = (url: string) =>
  /^\/api\/(sequence-player|character-library)\/assets\//.test(url)
    ? `${url}?_token=${encodeURIComponent(getToken())}`
    : url;
watch(
  () => character.value.id,
  () => {
    poseId.value = character.value.defaultPoseId;
    copyTarget.value = null;
  },
  { immediate: true }
);
async function uploadFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  const target = character.value;
  uploading.value = true;
  try {
    for (const file of files) {
      if (target.poses.length >= 60) throw new Error('每个人物最多 60 张立绘');
      const r = await uploadLibraryPortrait(file);
      if (r.error || !r.data) throw new Error('立绘上传失败');
      const newPose = {
        id: id('pose'),
        name: file.name.replace(/\.[^.]+$/, ''),
        imageUrl: r.data.url,
        layout: { x: target.position === 'left' ? 20 : 80, y: 93, height: 60 }
      };
      target.poses.push(newPose);
      if (character.value === target) poseId.value = newPose.id;
    }
  } catch (e: any) {
    message.error(e.message);
  } finally {
    uploading.value = false;
  }
}
function rename(value: string) {
  // 名称相同时一起修改；已有的独立稿件名保留在“稿件识别”中。
  if (character.value.name === character.value.displayName) character.value.name = value;
  character.value.displayName = value;
}
function duplicate() {
  if (!pose.value || character.value.poses.length >= 60) return;
  const copied = JSON.parse(JSON.stringify(pose.value));
  copied.id = id('pose');
  copied.name += ' 副本';
  character.value.poses.push(copied);
  poseId.value = copied.id;
}
function remove() {
  if (!pose.value || character.value.poses.length < 2) return;
  const removed = pose.value.id;
  character.value.poses = character.value.poses.filter(p => p.id !== removed);
  if (character.value.defaultPoseId === removed) character.value.defaultPoseId = character.value.poses[0].id;
  poseId.value = character.value.defaultPoseId;
}
function copyLayout() {
  const target = character.value.poses.find(p => p.id === copyTarget.value);
  if (!target || !pose.value?.layout) return;
  target.layout = { ...pose.value.layout };
  message.success(`已复制到「${target.name}」`);
}
</script>
<template>
  <div class="character-editor">
    <section class="portrait-section" aria-label="立绘编辑">
      <div class="section-heading">
        <strong>舞台预览</strong>
        <span>拖动位置 · 拉动右上角缩放</span>
      </div>
      <PortraitEditor
        v-if="pose"
        :key="pose.id"
        :pose="pose"
        :src="media(pose.imageUrl || PLACEHOLDER)"
        :position="character.position"
        :disabled="disabled"
        @change="
          value => {
            if (pose) pose.layout = value;
          }
        "
      />
      <div class="pose-library">
        <div class="pose-toolbar">
          <strong>
            立绘
            <span class="note">{{ character.poses.length }}</span>
          </strong>
          <NButton size="small" :loading="uploading" :disabled="disabled" @click="upload?.click()">＋ 添加立绘</NButton>
        </div>
        <div class="pose-thumbnails" role="group" aria-label="立绘选择">
          <NButton
            v-for="p in character.poses"
            :key="p.id"
            :type="pose?.id === p.id ? 'primary' : 'default'"
            :secondary="pose?.id === p.id"
            :aria-pressed="pose?.id === p.id"
            :aria-label="`选择立绘：${p.name}`"
            class="pose-thumbnail"
            @click="poseId = p.id"
          >
            <img :src="media(p.imageUrl || PLACEHOLDER)" alt="" draggable="false" />
            <span>{{ p.name }}</span>
            <small v-if="character.defaultPoseId === p.id">默认</small>
          </NButton>
        </div>
      </div>
    </section>
    <aside class="character-settings" aria-label="角色设置">
      <strong>角色设置</strong>
      <label class="name-field">
        人物名称
        <NInput
          :value="character.displayName"
          :disabled="disabled"
          :maxlength="40"
          aria-label="人物名称"
          @update:value="rename"
        />
      </label>
      <details class="identity-details">
        <summary>稿件识别</summary>
        <div class="identity-fields">
          <label>
            稿件中的人物名
            <NInput v-model:value="character.name" :disabled="disabled" :maxlength="40" aria-label="稿件人物名" />
          </label>
          <label>
            其他叫法
            <NDynamicTags v-model:value="character.aliases" :disabled="disabled" :max="20" />
          </label>
          <p class="note">例如“博士”和“艾博士”可以识别为同一个人物。</p>
        </div>
      </details>
      <div v-if="pose" class="pose-settings">
        <label>
          当前立绘
          <NInput
            v-model:value="pose.name"
            :disabled="disabled"
            size="small"
            aria-label="当前立绘名称"
            placeholder="立绘名称"
          />
        </label>
        <div class="pose-options">
          <NButton
            size="small"
            :disabled="disabled || pose.id === character.defaultPoseId"
            @click="character.defaultPoseId = pose.id"
          >
            {{ pose.id === character.defaultPoseId ? '默认立绘' : '设为默认' }}
          </NButton>
          <NPopover trigger="click" placement="bottom-end">
            <template #trigger><NButton size="small" quaternary :disabled="disabled">更多</NButton></template>
            <div class="pose-more">
              <NButton size="small" :disabled="disabled || character.poses.length >= 60" @click="duplicate">
                复制这张立绘
              </NButton>
              <label class="note">将当前位置复制给其他立绘</label>
              <NSelect
                v-model:value="copyTarget"
                :options="targets"
                placeholder="选择立绘"
                aria-label="复制位置到立绘"
                :disabled="disabled"
              />
              <NButton size="small" :disabled="disabled || !copyTarget || !pose.layout" @click="copyLayout">
                复制位置
              </NButton>
              <NPopconfirm @positive-click="remove">
                <template #trigger>
                  <NButton size="small" :disabled="disabled || character.poses.length < 2" type="error" quaternary>
                    移除此立绘
                  </NButton>
                </template>
                移除此立绘？使用它的台词会改用自动匹配。
              </NPopconfirm>
            </div>
          </NPopover>
        </div>
      </div>
      <div class="voice-section"><VoiceSettings v-model:character="character" :disabled="disabled" /></div>
    </aside>
    <input ref="upload" hidden type="file" accept="image/png,image/jpeg,image/webp" multiple @change="uploadFiles" />
  </div>
</template>
<style scoped>
.character-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 276px;
  gap: 24px;
  align-items: start;
}
.portrait-section {
  min-width: 0;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 30px;
  margin-bottom: 10px;
}
.section-heading span,
.note {
  color: rgb(var(--base-text-color) / 0.55);
  font-size: 12px;
}
.character-settings {
  min-width: 0;
  padding: 18px;
  border: 1px solid rgb(var(--base-text-color) / 0.08);
  border-radius: 10px;
  background: rgb(var(--container-bg-color));
}
.name-field {
  margin-top: 20px;
}
label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
.identity-details {
  margin-top: 12px;
  font-size: 12px;
  color: rgb(var(--base-text-color) / 0.6);
}
.identity-details summary {
  cursor: pointer;
}
.identity-fields {
  display: grid;
  gap: 12px;
  padding-top: 12px;
}
.voice-section {
  border-top: 1px solid rgb(var(--base-text-color) / 0.1);
  margin-top: 20px;
  padding-top: 20px;
}
.pose-library {
  margin-top: 20px;
}
.pose-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.pose-toolbar strong .note {
  margin-left: 6px;
  font-weight: 400;
}
.pose-thumbnails {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;
}
.pose-thumbnail {
  flex-shrink: 0;
  width: 88px;
  height: 92px;
  padding: 7px;
  position: relative;
}
.pose-thumbnail :deep(.n-button__content) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  min-width: 0;
}
.pose-thumbnail img {
  width: 100%;
  height: 50px;
  object-fit: contain;
  background: #fff;
  border-radius: 4px;
}
.pose-thumbnail span {
  font-size: 12px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pose-thumbnail small {
  position: absolute;
  right: 0;
  top: 0;
  background: rgb(var(--primary-color));
  color: white;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
}
.pose-options {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.pose-settings {
  border-top: 1px solid rgb(var(--base-text-color) / 0.1);
  margin-top: 18px;
  padding-top: 18px;
}
.pose-more {
  width: 224px;
  display: grid;
  gap: 12px;
}
@media (max-width: 1100px) {
  .character-editor {
    grid-template-columns: minmax(0, 1fr) 248px;
    gap: 16px;
  }
  .character-settings {
    padding: 14px;
  }
  .section-heading span {
    display: none;
  }
}
@media (max-width: 900px) {
  .character-editor {
    grid-template-columns: 1fr;
  }
  .character-settings {
    margin-top: 4px;
  }
}
</style>
