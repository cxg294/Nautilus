<script setup lang="ts">
import { computed } from 'vue';
import type { CharacterPose, CharacterPosition } from '../../sequence-player/types/sequence';
import { PLACEHOLDER } from '../../sequence-player/workshop/model';
import { portraitStyle } from '../layout';
const props = defineProps<{ pose?: CharacterPose; src: string; position?: CharacterPosition; name?: string }>();
const style = computed(() => (props.pose?.layout ? portraitStyle(props.pose.layout) : undefined));
function fallback(event: Event) {
  const img = event.target as HTMLImageElement;
  if (!img.src.endsWith(PLACEHOLDER)) img.src = PLACEHOLDER;
}
</script>
<template>
  <img
    v-if="pose?.layout"
    class="portrait-sprite"
    :style="style"
    :src="src"
    :alt="name || '角色'"
    draggable="false"
    @error="fallback"
  />
  <div v-else class="legacy-portrait" :class="position || 'right'">
    <img :src="src" :alt="name || '角色'" draggable="false" @error="fallback" />
  </div>
</template>
<style scoped>
.portrait-sprite {
  position: absolute;
  width: auto;
  max-width: none;
  pointer-events: none;
  object-fit: contain;
}
.legacy-portrait {
  position: absolute;
  bottom: 4%;
  width: 32%;
  height: 66%;
  pointer-events: none;
}
.legacy-portrait.left {
  left: 5%;
}
.legacy-portrait.right {
  right: 5%;
}
.legacy-portrait.center {
  left: 34%;
}
.legacy-portrait img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
}
</style>
