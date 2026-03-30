/**
 * SB3 项目状态管理 — Composable
 * 替代旧项目的 React Context (ProjectContext.jsx)
 */
import { ref, computed, shallowRef } from 'vue';
import { parseSB3, exportSB3, exportJSON } from '../core/sb3Parser';
import { analyzeProject } from '../core/analyzer';

/** 全局状态（模块级单例） */
const project = shallowRef<any>(null);
const assets = shallowRef<Map<string, Blob>>(new Map());
const fileName = ref('');
const fileSize = ref(0);
const analysis = shallowRef<any>(null);
const loading = ref(false);
const error = ref<string | null>(null);

/** 跨面板导航状态 */
const navigationTarget = ref<{
  targetName: string;    // 跳转到哪个角色
  broadcastName?: string; // 高亮哪个广播相关脚本
  timestamp?: number;     // 触发时间戳（防去重）
} | null>(null);

export function useSb3Project() {
  const isLoaded = computed(() => !!project.value);

  /** 加载 SB3 / JSON 文件 */
  async function load(file: File) {
    loading.value = true;
    error.value = null;
    try {
      const result = await parseSB3(file);
      project.value = result.project;
      assets.value = result.assets;
      fileName.value = result.fileName;
      fileSize.value = result.fileSize;
      analysis.value = analyzeProject(result.project);
    } catch (err: any) {
      error.value = err.message || '解析失败';
      console.error('Failed to load SB3:', err);
    } finally {
      loading.value = false;
    }
  }

  /** 加载内置示例数据 */
  function loadSample() {
    const sampleProject = {
      targets: [
        {
          isStage: true,
          name: 'Stage',
          variables: { 'var1': ['得分', 0], 'var2': ['生命', 3] },
          lists: {},
          broadcasts: { 'bc1': '游戏开始', 'bc2': '游戏结束' },
          blocks: {},
          costumes: [{ name: '背景1', dataFormat: 'svg' }],
          sounds: [],
          currentCostume: 0,
          volume: 100,
        },
        {
          isStage: false,
          name: '玩家',
          variables: {},
          lists: {},
          broadcasts: {},
          blocks: {
            'b1': { opcode: 'event_whenflagclicked', topLevel: true, next: 'b2', fields: {}, inputs: {} },
            'b2': { opcode: 'motion_movesteps', topLevel: false, next: null, parent: 'b1', fields: {}, inputs: { STEPS: [1, [4, '10']] } },
          },
          costumes: [
            { name: '造型1', dataFormat: 'svg' },
            { name: '造型2', dataFormat: 'svg' },
          ],
          sounds: [{ name: '喵', dataFormat: 'wav' }],
          x: 0,
          y: 0,
          size: 100,
          direction: 90,
          visible: true,
          currentCostume: 0,
          volume: 100,
        },
      ],
      extensions: [],
      meta: { semver: '3.0.0' },
    };

    project.value = sampleProject;
    assets.value = new Map();
    fileName.value = 'sample.sb3';
    fileSize.value = JSON.stringify(sampleProject).length;
    analysis.value = analyzeProject(sampleProject);
    error.value = null;
  }

  /** 修改 project 并重新分析 */
  function updateProject(updater: (prev: any) => any) {
    const updated = updater(project.value);
    project.value = updated;
    analysis.value = analyzeProject(updated);
  }

  /** 导出 .sb3 */
  function saveSB3() {
    if (!project.value) return;
    const name = fileName.value.replace(/\.json$/, '.sb3');
    exportSB3(project.value, assets.value, name);
  }

  /** 导出 .json */
  function saveJSON() {
    if (!project.value) return;
    const name = fileName.value.replace(/\.sb3$/, '.json');
    exportJSON(project.value, name);
  }

  /** 重置状态 */
  function reset() {
    project.value = null;
    assets.value = new Map();
    fileName.value = '';
    fileSize.value = 0;
    analysis.value = null;
    error.value = null;
    navigationTarget.value = null;
  }

  /** 跨面板导航：跳转到指定角色的指定广播脚本 */
  function navigateToScript(targetName: string, broadcastName?: string) {
    navigationTarget.value = {
      targetName,
      broadcastName,
      timestamp: Date.now(),
    };
  }

  return {
    // 状态
    project,
    assets,
    fileName,
    fileSize,
    analysis,
    loading,
    error,
    isLoaded,
    navigationTarget,
    // 方法
    load,
    loadSample,
    updateProject,
    saveSB3,
    saveJSON,
    reset,
    navigateToScript,
  };
}
