<script setup lang="ts">
/**
 * SB3 积木分析工作台 — 主页面
 *
 * 紧凑布局：顶栏贴合 + Tab 内容填满剩余空间
 */
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSb3Project } from './composables/use-sb3-project';
import DashboardPanel from './components/DashboardPanel.vue';
import SpritePanel from './components/SpritePanel.vue';
import DataPanel from './components/DataPanel.vue';
import LogicPanel from './components/LogicPanel.vue';
import DiffModal from './components/DiffModal.vue';

const { t } = useI18n();
const {
  isLoaded, load, loadSample, saveSB3, saveJSON,
  fileName, fileSize, loading, error,
  navigationTarget,
} = useSb3Project();

const activeTab = ref('overview');
const diffOpen = ref(false);

// 导航监听：广播→素材管理跳转
watch(navigationTarget, (nav) => {
  if (nav) {
    activeTab.value = 'assets';
  }
});

/** 格式化文件大小 */
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 处理文件上传 */
function handleFileUpload(options: { file: { file: File | null } }) {
  const file = options.file.file;
  if (file) load(file);
}
</script>

<template>
  <div class="sb3-studio">
    <!-- 顶部操作栏：紧凑单行 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <NTag v-if="isLoaded" type="info" size="small" round>
          {{ fileName }} ({{ formatSize(fileSize) }})
        </NTag>
      </div>
      <NSpace :size="6" align="center">
        <NButton size="small" @click="loadSample" :disabled="loading" quaternary>
          🔬 {{ t('page.sb3Studio.loadSample') }}
        </NButton>
        <NUpload
          :show-file-list="false"
          accept=".sb3,.json"
          :custom-request="() => {}"
          @change="handleFileUpload"
          style="display: inline-flex"
        >
          <NButton size="small" :disabled="loading" quaternary>
            📂 {{ t('page.sb3Studio.openFile') }}
          </NButton>
        </NUpload>
        <template v-if="isLoaded">
          <NDropdown
            trigger="click"
            :options="[
              { label: t('page.sb3Studio.saveSB3'), key: 'sb3' },
              { label: t('page.sb3Studio.saveJSON'), key: 'json' },
            ]"
            @select="(key: string) => key === 'sb3' ? saveSB3() : saveJSON()"
          >
            <NButton size="small" type="primary" ghost>
              💾 另存为
            </NButton>
          </NDropdown>
          <NButton size="small" type="warning" ghost @click="diffOpen = true">
            ⚡ {{ t('page.sb3Studio.versionDiff') }}
          </NButton>
        </template>
      </NSpace>
    </div>

    <!-- 加载/错误 -->
    <div v-if="loading" class="center-state">
      <NSpin size="large" />
      <NText depth="3">正在解析文件...</NText>
    </div>
    <NAlert v-if="error" type="error" :title="error" closable style="margin-bottom: 8px" />

    <!-- 空状态 -->
    <div v-if="!isLoaded && !loading" class="empty-state">
      <div class="empty-icon">🧩</div>
      <NH4 style="margin: 0">{{ t('page.sb3Studio.emptyTitle') }}</NH4>
      <NText depth="3" style="font-size: 13px">{{ t('page.sb3Studio.emptyDesc') }}</NText>
      <NSpace :size="8" style="margin-top: 16px">
        <NUpload
          :show-file-list="false"
          accept=".sb3,.json"
          :custom-request="() => {}"
          @change="handleFileUpload"
        >
          <NButton type="primary">📂 {{ t('page.sb3Studio.openFile') }}</NButton>
        </NUpload>
        <NButton @click="loadSample">🔬 {{ t('page.sb3Studio.loadSample') }}</NButton>
      </NSpace>
    </div>

    <!-- 主内容区 Tabs -->
    <NTabs v-if="isLoaded" v-model:value="activeTab" type="line" animated class="main-tabs">
      <NTabPane name="overview" :tab="`📊 ${t('page.sb3Studio.tabOverview')}`">
        <DashboardPanel />
      </NTabPane>
      <NTabPane name="assets" :tab="`🎨 ${t('page.sb3Studio.tabAssets')}`">
        <SpritePanel />
      </NTabPane>
      <NTabPane name="data" :tab="`📝 ${t('page.sb3Studio.tabData')}`">
        <DataPanel />
      </NTabPane>
      <NTabPane name="logic" :tab="`🔍 ${t('page.sb3Studio.tabLogic')}`">
        <LogicPanel />
      </NTabPane>
    </NTabs>

    <DiffModal v-model:visible="diffOpen" />
  </div>
</template>

<style scoped>
.sb3-studio {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  flex-shrink: 0;
}

.main-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.main-tabs :deep(.n-tabs-pane-wrapper) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.main-tabs :deep(.n-tab-pane) {
  padding-top: 8px;
}

.center-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 8px;
}
</style>
