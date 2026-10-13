/**
 * 脚本解析引擎
 *
 * 将教研逐字稿文本解析为结构化的 Step[] 和 Character[]。
 *
 * 支持的脚本格式：
 *   角色名：台词内容
 *   角色名(造型)：台词内容（括号中动作提示）
 *   【停顿2s】 或 【等待1.5秒】
 *   // 注释行（跳过）
 *   空行（跳过）
 *
 * 设计原则：
 * - 不依赖后端或 AI，纯前端规则引擎
 * - 解析失败的行降级为 direction 类型（保留原文）
 * - 自动发现脚本中出现的角色并分配颜色
 */
import { ref } from 'vue';
import type {
  Step,
  Character,
  CharacterPose,
} from '../types/sequence';
import {
  CHARACTER_COLORS,
  DEFAULT_TTS_CONFIG,
} from '../types/sequence';

// ============================================================
// 正则表达式
// ============================================================

/**
 * 对话行匹配：
 *   角色名(造型)：台词
 *   角色名：台词
 *   角色名(造型):台词
 * 中英文冒号都支持
 */
const RE_DIALOGUE = /^([^\s(（:：]+?)(?:[(（]([^)）]+)[)）])?\s*[：:]\s*(.+)$/;

/**
 * 停顿指令匹配：
 *   【停顿2s】【等待1.5秒】【pause 3s】
 */
const RE_WAIT = /^[【[](?:停顿|等待|暂停|pause)\s*([\d.]+)\s*(?:s|秒)?[】\]]\s*$/i;

/**
 * 括号内容匹配（动作提示）：
 *   （指着黑板）(挥手)
 */
const RE_PAREN_NOTE = /[（(]([^)）]+)[）)]/g;

/**
 * 注释行
 */
const RE_COMMENT = /^\s*(?:\/\/|#|--|%%)/;

// ============================================================
// 工具函数
// ============================================================

let _stepIdCounter = 0;

function genStepId(): string {
  return `step_${++_stepIdCounter}`;
}

function genCharId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * 从文本中提取括号内的动作/画面提示，返回提示文本和去除提示后的朗读文本
 */
function extractParenNotes(text: string): { speakText: string; notes: string[] } {
  const notes: string[] = [];
  const speakText = text.replace(RE_PAREN_NOTE, (_, note) => {
    notes.push(note.trim());
    return '';
  }).trim();
  return { speakText, notes };
}

// ============================================================
// Composable
// ============================================================

export function useScriptParser() {
  const parseErrors = ref<{ line: number; message: string }[]>([]);

  /**
   * 解析完整脚本文本
   * @returns 解析结果：步骤列表 + 自动发现的角色列表
   */
  function parseScript(rawText: string): { steps: Step[]; characters: Character[] } {
    _stepIdCounter = 0;
    parseErrors.value = [];

    const lines = rawText.split('\n');
    const steps: Step[] = [];
    const characterMap = new Map<string, Character>();
    let colorIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // 跳过空行和注释
      if (!line || RE_COMMENT.test(line)) continue;

      // 1. 尝试匹配停顿指令
      const waitMatch = line.match(RE_WAIT);
      if (waitMatch) {
        const seconds = parseFloat(waitMatch[1]);
        if (isNaN(seconds) || seconds <= 0) {
          parseErrors.value.push({ line: lineNum, message: `无效的停顿时长: ${waitMatch[1]}` });
          continue;
        }
        steps.push({
          id: genStepId(),
          type: 'wait',
          text: line,
          speakText: '',
          duration: seconds * 1000,
        });
        continue;
      }

      // 2. 尝试匹配对话行
      const dialogueMatch = line.match(RE_DIALOGUE);
      if (dialogueMatch) {
        const charName = dialogueMatch[1].trim();
        const poseName = dialogueMatch[2]?.trim() || undefined;
        const rawDialogue = dialogueMatch[3].trim();

        // 提取括号内动作提示
        const { speakText, notes } = extractParenNotes(rawDialogue);

        // 自动发现角色
        if (!characterMap.has(charName)) {
          const color = CHARACTER_COLORS[colorIndex % CHARACTER_COLORS.length];
          colorIndex++;

          const defaultPose: CharacterPose = {
            id: `pose_${charName}_default`,
            name: '默认',
            imageUrl: '', // 占位
          };

          characterMap.set(charName, {
            id: genCharId(),
            name: charName,
            displayName: charName,
            color,
            poses: [defaultPose],
            defaultPoseId: defaultPose.id,
            ttsConfig: { ...DEFAULT_TTS_CONFIG },
            position: characterMap.size === 0 ? 'right' : 'left',
            scale: 1.0,
          });
        }

        // 如果指定了新造型，自动注册
        const char = characterMap.get(charName)!;
        if (poseName && !char.poses.find(p => p.name === poseName)) {
          char.poses.push({
            id: `pose_${charName}_${poseName}`,
            name: poseName,
            imageUrl: '',
          });
        }

        steps.push({
          id: genStepId(),
          type: 'dialogue',
          characterName: charName,
          poseName,
          text: rawDialogue,
          speakText: speakText || rawDialogue,
          displayNote: notes.length > 0 ? notes.join('；') : undefined,
        });
        continue;
      }

      // 3. 无法识别的行 → direction（保留原文）
      steps.push({
        id: genStepId(),
        type: 'direction',
        text: line,
        speakText: '',
        displayNote: line,
      });
    }

    return {
      steps,
      characters: Array.from(characterMap.values()),
    };
  }

  /**
   * 快速统计脚本信息
   */
  function getScriptStats(steps: Step[], characters: Character[]) {
    const dialogueCount = steps.filter(s => s.type === 'dialogue').length;
    const waitCount = steps.filter(s => s.type === 'wait').length;
    const totalWaitMs = steps
      .filter(s => s.type === 'wait')
      .reduce((sum, s) => sum + (s.duration || 0), 0);

    return {
      totalSteps: steps.length,
      dialogueCount,
      waitCount,
      directionCount: steps.filter(s => s.type === 'direction').length,
      characterCount: characters.length,
      characterNames: characters.map(c => c.name),
      estimatedDurationSec: Math.round(
        dialogueCount * 4 + totalWaitMs / 1000 // 粗估：每句台词 ~4s
      ),
    };
  }

  return {
    parseScript,
    getScriptStats,
    parseErrors,
  };
}
