<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue';
import { NButton, NTag, useMessage, type DataTableColumns } from 'naive-ui';
import { usePageTracker, useActionTracker } from '@/hooks/common/use-tracker';

defineOptions({ name: 'RegexWorkflow' });

usePageTracker('regex-workflow');
const { trackAction } = useActionTracker('regex-workflow');
const message = useMessage();

type RuleType = 'N' | 'Y';
type TestState = 'idle' | 'match' | 'miss' | 'error';

interface RegexRule {
  id: string;
  type: RuleType;
  dimension: string;
  description: string;
  trigger: string;
  coreHint: string;
  hint: string;
  regex: string;
  flags: string;
  errorExample: string;
  testStatus?: {
    state: TestState;
    message: string;
  } | null;
}

interface ParsedPayload {
  moduleKey?: string;
  language?: string;
  rules: Partial<RegexRule>[];
  meta?: Record<string, unknown>;
}

const STORAGE_KEY = 'nautilus_regex_workflow_v1';

const typeOptions = [
  { label: 'N 禁止规则', value: 'N' },
  { label: 'Y 必须规则', value: 'Y' }
];

const languageOptions = [
  { label: 'Python', value: 'Python' },
  { label: 'C++', value: 'C++' }
];

const dimensionOptions = [
  '存在性',
  '函数名拼写',
  '赋值结构',
  '括号',
  '引号',
  '函数名与括号间距',
  '引号内空格',
  '逗号/分隔符',
  '参数值',
  '行内位置',
  '行间位置',
  '缩进',
  '整体结构'
].map(item => ({ label: item, value: item }));

const moduleKey = ref('');
const language = ref('Python');
const rules = ref<RegexRule[]>([]);
const activeRuleId = ref('');
const testCode = ref('');
const frontCode = ref('');
const rearCode = ref('');
const generatedJS = ref('');
const pasteModalVisible = ref(false);
const pasteText = ref('');
const aiTextModalVisible = ref(false);
const aiTextTitle = ref('');
const aiText = ref('');
const baseline = ref<RegexRule[]>([]);
const activeTab = ref('rules');

const builtInPrompt = [
  '# 正则规则生成器提示词',
  '',
  '你是编程教育平台的正则规则设计助手。目标用户不需要懂正则，只需要描述学生代码应该长什么样、哪些错误需要提示。',
  '',
  '固定机制：',
  '- ruleRegN 是禁止规则：从上到下依次匹配，命中第一条就停止，匹配到表示有错误。',
  '- ruleRegY 是必须规则：仅当所有 N 规则都未命中后执行；不匹配表示有错误。',
  '- 正则匹配学生可编辑代码区域；front_end_code 只用于最终 JS 包装。',
  '- 行尾空格、括号内参数前后空格，若不影响运行，直接算对。',
  '- 多余行检测需要拆成上方和下方两条，不能合并为笼统提示。',
  '- 单行检测使用 ^ 和 $ 配合 m 标志；行内空白用 [ \\t]*，不要用 \\s* 吞掉换行。',
  '- Y1 的行尾通常用 [ \\t]*(?:#[^\\n]*)?$，不要用 \\s*$。',
  '',
  '阶段一：先问信息。必须收集语言、初始代码模板、学生任务、合法输入范围、锁定行。然后再追问注释/空行/空格是否允许、快捷输入面板、学生学过的概念、是否允许重复赋值。',
  '',
  '阶段二：先输出中文规则描述表，不写正则。每条规则包含 id、type、dimension、description、trigger、coreHint。规则按存在性、拼写、结构、位置、参数值排序。',
  '',
  '阶段三：用户确认后再补 regex、flags、errorExample。只输出 JSON，不输出解释。',
  '',
  '阶段四：生成面向儿童的 hint。提示语要短、具体、亲切，避免“函数、参数、正则”等专业词。',
  '',
  '阶段五：最终 JSON 格式：',
  '{',
  '  "moduleKey": "模块 key",',
  '  "language": "Python",',
  '  "rules": [',
  '    {',
  '      "id": "N1",',
  '      "type": "N",',
  '      "dimension": "存在性",',
  '      "description": "规则说明",',
  '      "trigger": "什么代码会触发",',
  '      "coreHint": "引导孩子做什么",',
  '      "hint": "最终提示语",',
  '      "regex": "^...$",',
  '      "flags": "m",',
  '      "errorExample": "能触发此规则的代码"',
  '    }',
  '  ]',
  '}'
].join('\n');

const demoRules: RegexRule[] = [
  normalizeRule({
    id: 'N1',
    type: 'N',
    dimension: '函数名拼写',
    description: 'voice 单词大小写错误',
    trigger: '写成 Voice、VOICE 等大小写不一致的形式',
    coreHint: '把单词改成小写 voice',
    hint: '这一行里，voice 要全部写成小写哦。\n\n示例：\nvoice(4)',
    regex: '^\\s*[Vv][Oo][Ii][Cc][Ee]\\s*\\(',
    flags: 'm',
    errorExample: 'Voice(4)'
  }),
  normalizeRule({
    id: 'N2',
    type: 'N',
    dimension: '参数值',
    description: 'voice 数字超出范围',
    trigger: '括号内数字不是 1 到 10',
    coreHint: '把括号里的数字改成 1 到 10',
    hint: '括号里的数字要在 1 到 10 之间哦。\n\n示例：\nvoice(4)',
    regex: '^\\s*voice\\s*\\(\\s*(?:0|1[1-9]|[2-9]\\d+)\\s*\\)',
    flags: 'm',
    errorExample: 'voice(12)'
  }),
  normalizeRule({
    id: 'Y1',
    type: 'Y',
    dimension: '整体结构',
    description: '存在一行正确的 voice 调用',
    trigger: '找不到 voice(1-10) 这样的正确写法',
    coreHint: '补上一行正确的 voice 代码',
    hint: '请写出一行正确的语音代码哦。\n\n示例：\nvoice(4)',
    regex: '^\\s*voice\\s*\\(\\s*(?:[1-9]|10)\\s*\\)[ \\t]*(?:#[^\\n]*)?$',
    flags: 'm',
    errorExample: 'print(4)'
  })
];

const activeRule = computed(() => rules.value.find(rule => rule.id === activeRuleId.value) || null);
const nCount = computed(() => rules.value.filter(rule => rule.type === 'N').length);
const yCount = computed(() => rules.value.filter(rule => rule.type === 'Y').length);
const syntaxErrorCount = computed(() => rules.value.filter(rule => validateRegex(rule).state === 'error').length);
const testedCount = computed(() => rules.value.filter(rule => rule.testStatus).length);

const evaluation = computed(() => evaluateCode(testCode.value));

const columns = computed<DataTableColumns<RegexRule>>(() => [
  {
    title: '编号',
    key: 'id',
    width: 78,
    render(row) {
      return h('span', { class: 'rule-id' }, row.id || '-');
    }
  },
  {
    title: '类型',
    key: 'type',
    width: 90,
    render(row) {
      return h(NTag, { type: row.type === 'N' ? 'error' : 'success', size: 'small', bordered: false }, {
        default: () => (row.type === 'N' ? '禁止' : '必须')
      });
    }
  },
  {
    title: '维度',
    key: 'dimension',
    width: 140,
    ellipsis: { tooltip: true }
  },
  {
    title: '规则描述',
    key: 'description',
    minWidth: 220,
    ellipsis: { tooltip: true }
  },
  {
    title: '正则',
    key: 'regex',
    minWidth: 260,
    ellipsis: { tooltip: true },
    render(row) {
      return h('code', { class: 'regex-code' }, row.regex || '未填写');
    }
  },
  {
    title: '状态',
    key: 'status',
    width: 110,
    render(row) {
      const status = row.testStatus || validateRegex(row);
      const tagType = status.state === 'error'
        ? 'warning'
        : status.state === 'match'
          ? row.type === 'N' ? 'error' : 'success'
          : status.state === 'miss'
            ? row.type === 'N' ? 'success' : 'error'
            : 'default';

      return h(NTag, { type: tagType as any, size: 'small', bordered: false }, {
        default: () => status.message
      });
    }
  }
]);

function normalizeRule(rule: Partial<RegexRule>): RegexRule {
  return {
    id: String(rule.id || ''),
    type: rule.type === 'Y' ? 'Y' : 'N',
    dimension: String(rule.dimension || ''),
    description: String(rule.description || ''),
    trigger: String(rule.trigger || ''),
    coreHint: String(rule.coreHint || ''),
    hint: String(rule.hint || ''),
    regex: String(rule.regex || ''),
    flags: String(rule.flags || 'm'),
    errorExample: String(rule.errorExample || ''),
    testStatus: rule.testStatus || null
  };
}

function parseInputJSON(text: string): ParsedPayload {
  let source = text.trim();
  const blockMatch = source.match(/```(?:json|javascript|js)?\s*([\s\S]*?)```/i);
  if (blockMatch) {
    source = blockMatch[1].trim();
  }

  const assignmentMatch = source.match(/(?:const|let|var)\s+\w+\s*=\s*([\s\S]*?);?\s*$/);
  if (assignmentMatch) {
    source = assignmentMatch[1].trim();
  }

  const data = JSON.parse(source);
  if (Array.isArray(data)) {
    return { rules: data };
  }
  if (data && typeof data === 'object' && 'id' in data) {
    return { rules: [data] };
  }
  if (data && typeof data === 'object' && Array.isArray(data.rules)) {
    return data;
  }

  throw new Error('没有找到 rules 数组或规则对象');
}

function importPayload(text: string) {
  try {
    const payload = parseInputJSON(text);
    const normalized = payload.rules.map(normalizeRule).filter(rule => rule.id);
    rules.value = normalized;
    moduleKey.value = payload.moduleKey || moduleKey.value;
    language.value = payload.language || language.value;
    activeRuleId.value = normalized[0]?.id || '';
    baseline.value = cloneRules(normalized);
    pasteModalVisible.value = false;
    pasteText.value = '';
    persist();
    message.success(`已导入 ${normalized.length} 条规则`);
    trackAction('import_json', 'success', { count: normalized.length });
  } catch (error: any) {
    message.error(`JSON 解析失败：${error.message}`);
  }
}

function mergePayload(text: string) {
  try {
    const payload = parseInputJSON(text);
    const incoming = payload.rules.map(normalizeRule).filter(rule => rule.id);
    const current = [...rules.value];
    const indexMap = new Map(current.map((rule, index) => [rule.id, index]));
    let updated = 0;
    let added = 0;

    for (const nextRule of incoming) {
      const index = indexMap.get(nextRule.id);
      if (index === undefined) {
        current.push(nextRule);
        added += 1;
      } else {
        current[index] = mergeRule(current[index], nextRule);
        updated += 1;
      }
    }

    rules.value = current;
    if (payload.moduleKey) moduleKey.value = payload.moduleKey;
    if (payload.language) language.value = payload.language;
    activeRuleId.value = incoming[0]?.id || activeRuleId.value || current[0]?.id || '';
    baseline.value = cloneRules(current);
    pasteModalVisible.value = false;
    pasteText.value = '';
    persist();
    message.success(`智能合并完成：更新 ${updated} 条，新增 ${added} 条`);
    trackAction('merge_json', 'success', { updated, added });
  } catch (error: any) {
    message.error(`JSON 解析失败：${error.message}`);
  }
}

function mergeRule(oldRule: RegexRule, nextRule: RegexRule): RegexRule {
  const merged = { ...oldRule, testStatus: null };
  const fields: (keyof RegexRule)[] = [
    'type',
    'dimension',
    'description',
    'trigger',
    'coreHint',
    'hint',
    'regex',
    'flags',
    'errorExample'
  ];

  for (const field of fields) {
    const value = nextRule[field];
    if (value !== undefined && value !== '') {
      (merged as any)[field] = value;
    }
  }

  return merged;
}

function addRule(type: RuleType = 'N') {
  const number = rules.value.filter(rule => rule.type === type).length + 1;
  const id = `${type}${number}`;
  rules.value.push(normalizeRule({ id, type, flags: 'm' }));
  activeRuleId.value = id;
  persist();
}

function duplicateActiveRule() {
  if (!activeRule.value) return;
  const copy = normalizeRule({
    ...activeRule.value,
    id: `${activeRule.value.id}_copy`,
    description: `${activeRule.value.description} 副本`
  });
  const index = rules.value.findIndex(rule => rule.id === activeRule.value?.id);
  rules.value.splice(index + 1, 0, copy);
  activeRuleId.value = copy.id;
  persist();
}

function deleteActiveRule() {
  if (!activeRule.value) return;
  const index = rules.value.findIndex(rule => rule.id === activeRule.value?.id);
  rules.value.splice(index, 1);
  activeRuleId.value = rules.value[Math.max(0, index - 1)]?.id || rules.value[0]?.id || '';
  persist();
}

function moveActiveRule(offset: number) {
  if (!activeRule.value) return;
  const index = rules.value.findIndex(rule => rule.id === activeRule.value?.id);
  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= rules.value.length) return;
  const [rule] = rules.value.splice(index, 1);
  rules.value.splice(nextIndex, 0, rule);
  persist();
}

function updateActiveRule(field: keyof RegexRule, value: string) {
  if (!activeRule.value) return;
  const index = rules.value.findIndex(rule => rule.id === activeRule.value?.id);
  if (index < 0) return;
  (rules.value[index] as any)[field] = value;
  rules.value[index].testStatus = null;
  if (field === 'id') {
    activeRuleId.value = value;
  }
  persist();
}

function onRowClick(row: RegexRule) {
  activeRuleId.value = row.id;
}

function validateRegex(rule: RegexRule) {
  if (!rule.regex) {
    return { state: 'idle' as TestState, message: '未填写' };
  }

  try {
    new RegExp(rule.regex, rule.flags || '');
    return { state: 'idle' as TestState, message: '可用' };
  } catch (error: any) {
    return { state: 'error' as TestState, message: error.message };
  }
}

function matchRule(rule: RegexRule, code: string) {
  if (!rule.regex) {
    return { state: 'error' as TestState, message: '正则为空', match: false };
  }

  try {
    const reg = new RegExp(rule.regex, rule.flags || '');
    const match = reg.test(code);
    return {
      state: match ? 'match' as TestState : 'miss' as TestState,
      message: match ? '触发' : '未匹配',
      match
    };
  } catch (error: any) {
    return { state: 'error' as TestState, message: error.message, match: false };
  }
}

function runAllTests() {
  rules.value = rules.value.map(rule => {
    const code = rule.errorExample || testCode.value;
    const result = matchRule(rule, code);
    return {
      ...rule,
      testStatus: {
        state: result.state,
        message: result.state === 'error'
          ? '语法错误'
          : result.match
            ? rule.type === 'N' ? '触发' : '满足'
            : rule.type === 'N' ? '安全' : '未满足'
      }
    };
  });
  persist();
  trackAction('run_tests', 'success', { count: rules.value.length });
}

function evaluateCode(code: string) {
  if (!code.trim()) {
    return {
      type: 'info',
      title: '等待测试代码',
      detail: '在测试面板粘贴学生代码后，会按平台执行顺序给出最终命中结果。'
    };
  }

  for (const rule of rules.value.filter(item => item.type === 'N')) {
    const result = matchRule(rule, code);
    if (result.state === 'error') {
      return { type: 'warning', title: `${rule.id} 正则不可用`, detail: result.message, rule };
    }
    if (result.match) {
      return {
        type: 'error',
        title: `命中禁止规则 ${rule.id}`,
        detail: rule.hint || rule.coreHint || rule.description || '该规则会阻止通过。',
        rule
      };
    }
  }

  for (const rule of rules.value.filter(item => item.type === 'Y')) {
    const result = matchRule(rule, code);
    if (result.state === 'error') {
      return { type: 'warning', title: `${rule.id} 正则不可用`, detail: result.message, rule };
    }
    if (!result.match) {
      return {
        type: 'error',
        title: `未满足必须规则 ${rule.id}`,
        detail: rule.hint || rule.coreHint || rule.description || '该规则要求没有满足。',
        rule
      };
    }
  }

  return {
    type: 'success',
    title: '平台模拟通过',
    detail: '没有命中禁止规则，且所有必须规则都已满足。'
  };
}

function generateJS() {
  generatedJS.value = buildJS();
  activeTab.value = 'generate';
  trackAction('generate_js', 'success', { rules: rules.value.length });
}

function buildJS() {
  const formatRules = (targetType: RuleType) => rules.value
    .filter(rule => rule.type === targetType)
    .map(rule => `            // ${rule.description || rule.id}\n            "${escapeJsKey(rule.hint || rule.coreHint || rule.description)}":\n                /${escapeRegexLiteral(rule.regex || 'TODO')}/${sanitizeFlags(rule.flags || 'm')},`)
    .join('\n');

  return `noticeDict = {
    "${escapeJsKey(moduleKey.value || 'MODULE_KEY')}":{
        "frontCode":\`\`,
        "rearCode": \`\`,
        "answer": [''],
        "ruleRegN": {
${formatRules('N')}
        },
        "ruleRegY": {
${formatRules('Y')}
        },
        "errReg": {},
        "noticeRegN": {},
        "noticeRegY": {

        }
    }
}
front_end_code = {
    "${escapeJsKey(moduleKey.value || 'MODULE_KEY')}":[\`
${escapeTemplateChunk(frontCode.value)}
\`,
\`
${escapeTemplateChunk(rearCode.value)}
\`,
\`

\`
    ]

}`;
}

function exportJSON() {
  downloadText(
    JSON.stringify({ moduleKey: moduleKey.value, language: language.value, rules: rules.value.map(cleanRule) }, null, 2),
    `${moduleKey.value || 'regex-rules'}.json`,
    'application/json'
  );
  trackAction('export_json', 'success', { count: rules.value.length });
}

function downloadJS() {
  const content = generatedJS.value || buildJS();
  downloadText(content, `${moduleKey.value || 'regex-workflow'}.js`, 'text/javascript;charset=utf-8');
  trackAction('download_js', 'success', { count: rules.value.length });
}

function downloadText(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeJsKey(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

function escapeRegexLiteral(value: string) {
  return value.replace(/\//g, '\\/').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

function escapeTemplateChunk(value: string) {
  return value.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function sanitizeFlags(value: string) {
  return Array.from(new Set(value.replace(/[^dgimsuvy]/g, '').split(''))).join('') || 'm';
}

function cleanRule(rule: RegexRule) {
  const { testStatus: _testStatus, ...rest } = rule;
  return rest;
}

function cloneRules(items: RegexRule[]) {
  return JSON.parse(JSON.stringify(items.map(cleanRule))) as RegexRule[];
}

function computeDiffText() {
  const before = new Map(baseline.value.map(rule => [rule.id, JSON.stringify(cleanRule(rule))]));
  const changed = rules.value.filter(rule => before.get(rule.id) !== JSON.stringify(cleanRule(rule)));
  const payload = changed.length > 0 ? changed : rules.value;
  const mode = changed.length > 0 ? '以下是用户在工作台中修改过的规则。' : '当前没有检测到差异，以下是完整规则。';

  return [
    mode,
    '请根据这些内容补齐空字段、修正正则或提示语，只输出需要更新的 JSON，格式为 {"rules":[...]}。',
    '',
    '```json',
    JSON.stringify({
      moduleKey: moduleKey.value,
      language: language.value,
      rules: payload.map(cleanRule)
    }, null, 2),
    '```'
  ].join('\n');
}

function showAIText(title: string, content: string) {
  aiTextTitle.value = title;
  aiText.value = content;
  aiTextModalVisible.value = true;
}

async function copyText(content: string, successText: string) {
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
  message.success(successText);
}

function copyPrompt() {
  showAIText('内置提示词', builtInPrompt);
  copyText(builtInPrompt, '提示词已复制');
  trackAction('copy_prompt', 'success');
}

function syncToAI() {
  const content = computeDiffText();
  showAIText('同步给 AI', content);
  copyText(content, '同步内容已复制');
  baseline.value = cloneRules(rules.value);
  persist();
  trackAction('sync_ai', 'success');
}

function loadDemo() {
  moduleKey.value = 'py_demo_voice';
  language.value = 'Python';
  rules.value = cloneRules(demoRules);
  baseline.value = cloneRules(demoRules);
  activeRuleId.value = rules.value[0]?.id || '';
  testCode.value = 'Voice(12)';
  persist();
  message.success('示例规则已载入');
}

function clearAll() {
  moduleKey.value = '';
  language.value = 'Python';
  rules.value = [];
  baseline.value = [];
  activeRuleId.value = '';
  testCode.value = '';
  frontCode.value = '';
  rearCode.value = '';
  generatedJS.value = '';
  localStorage.removeItem(STORAGE_KEY);
  message.success('工作台已清空');
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    moduleKey: moduleKey.value,
    language: language.value,
    rules: rules.value.map(cleanRule),
    baseline: baseline.value.map(cleanRule),
    activeRuleId: activeRuleId.value,
    testCode: testCode.value,
    frontCode: frontCode.value,
    rearCode: rearCode.value
  }));
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    moduleKey.value = data.moduleKey || '';
    language.value = data.language || 'Python';
    rules.value = Array.isArray(data.rules) ? data.rules.map(normalizeRule) : [];
    baseline.value = Array.isArray(data.baseline) ? data.baseline.map(normalizeRule) : cloneRules(rules.value);
    activeRuleId.value = data.activeRuleId || rules.value[0]?.id || '';
    testCode.value = data.testCode || '';
    frontCode.value = data.frontCode || '';
    rearCode.value = data.rearCode || '';
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

watch([moduleKey, language, testCode, frontCode, rearCode], persist);

onMounted(() => {
  restore();
});
</script>

<template>
  <div class="regex-page">
    <section class="hero-panel">
      <div class="hero-copy">
        <div class="eyebrow">
          <SvgIcon icon="mdi:regex" class="eyebrow-icon" />
          课程生产 · 正则验收
        </div>
        <h1>正则规则工作台</h1>
        <p>把 AI 生成的规则落到可编辑、可测试、可导出的生产流程里。</p>
        <NSpace :size="10" class="hero-actions">
          <NButton type="primary" size="large" @click="copyPrompt">
            <template #icon><SvgIcon icon="mdi:content-copy" /></template>
            复制提示词
          </NButton>
          <NButton size="large" @click="pasteModalVisible = true">
            <template #icon><SvgIcon icon="mdi:code-json" /></template>
            粘贴 JSON
          </NButton>
          <NButton size="large" quaternary @click="loadDemo">
            <template #icon><SvgIcon icon="mdi:play-circle-outline" /></template>
            载入示例
          </NButton>
        </NSpace>
      </div>

      <div class="hero-metrics">
        <div class="metric-block accent-green">
          <span>规则总数</span>
          <strong>{{ rules.length }}</strong>
        </div>
        <div class="metric-block accent-red">
          <span>禁止规则</span>
          <strong>{{ nCount }}</strong>
        </div>
        <div class="metric-block accent-blue">
          <span>必须规则</span>
          <strong>{{ yCount }}</strong>
        </div>
        <div class="metric-block accent-amber">
          <span>语法风险</span>
          <strong>{{ syntaxErrorCount }}</strong>
        </div>
      </div>
    </section>

    <section class="workspace-grid">
      <aside class="side-panel">
        <div class="panel-section project-panel">
          <div class="section-title">项目</div>
          <NForm label-placement="top" size="small">
            <NFormItem label="模块 Key">
              <NInput v-model:value="moduleKey" placeholder="py_demo_voice" clearable />
            </NFormItem>
            <NFormItem label="语言">
              <NSelect v-model:value="language" :options="languageOptions" />
            </NFormItem>
          </NForm>
          <div class="project-actions">
            <NButton block secondary @click="exportJSON">
              <template #icon><SvgIcon icon="mdi:download-outline" /></template>
              导出 JSON
            </NButton>
            <NButton block secondary type="warning" @click="clearAll">
              <template #icon><SvgIcon icon="mdi:broom" /></template>
              清空
            </NButton>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-title">规则焦点</div>
          <div v-if="activeRule" class="focus-card">
            <div class="focus-head">
              <NTag :type="activeRule.type === 'N' ? 'error' : 'success'" bordered size="small">
                {{ activeRule.id }}
              </NTag>
              <span>{{ activeRule.dimension || '未分组' }}</span>
            </div>
            <p>{{ activeRule.description || '这条规则还没有描述。' }}</p>
            <NSpace :size="8">
              <NButton size="tiny" @click="moveActiveRule(-1)">
                <template #icon><SvgIcon icon="mdi:arrow-up" /></template>
              </NButton>
              <NButton size="tiny" @click="moveActiveRule(1)">
                <template #icon><SvgIcon icon="mdi:arrow-down" /></template>
              </NButton>
              <NButton size="tiny" @click="duplicateActiveRule">
                <template #icon><SvgIcon icon="mdi:content-duplicate" /></template>
              </NButton>
              <NButton size="tiny" type="error" quaternary @click="deleteActiveRule">
                <template #icon><SvgIcon icon="mdi:delete-outline" /></template>
              </NButton>
            </NSpace>
          </div>
          <div v-else class="empty-side">还没有选中的规则。</div>
        </div>

        <div class="panel-section">
          <div class="section-title">AI 协作</div>
          <NSpace vertical :size="10">
            <NButton block type="primary" ghost @click="syncToAI">
              <template #icon><SvgIcon icon="mdi:robot-outline" /></template>
              同步给 AI
            </NButton>
            <NButton block secondary @click="showAIText('内置提示词', builtInPrompt)">
              <template #icon><SvgIcon icon="mdi:text-box-outline" /></template>
              查看提示词
            </NButton>
          </NSpace>
        </div>
      </aside>

      <main class="tool-surface">
        <NTabs v-model:value="activeTab" type="segment" animated>
          <NTabPane name="rules" tab="规则">
            <div class="tab-layout">
              <div class="toolbar-row">
                <NSpace>
                  <NButton type="primary" secondary @click="addRule('N')">
                    <template #icon><SvgIcon icon="mdi:plus" /></template>
                    禁止规则
                  </NButton>
                  <NButton type="success" secondary @click="addRule('Y')">
                    <template #icon><SvgIcon icon="mdi:plus" /></template>
                    必须规则
                  </NButton>
                </NSpace>
                <NTag v-if="testedCount" type="info" :bordered="false">
                  已测试 {{ testedCount }} 条
                </NTag>
              </div>

              <NDataTable
                :columns="columns"
                :data="rules"
                :row-key="row => row.id"
                :row-props="row => ({ class: row.id === activeRuleId ? 'active-data-row' : '', onClick: () => onRowClick(row) })"
                :pagination="{ pageSize: 8 }"
                size="small"
                class="rules-table"
              />

              <div v-if="activeRule" class="editor-panel">
                <div class="editor-head">
                  <div>
                    <span class="section-title">编辑 {{ activeRule.id }}</span>
                    <p>{{ activeRule.trigger || '补充触发条件后，AI 同步会更稳定。' }}</p>
                  </div>
                  <NButton size="small" @click="runAllTests">
                    <template #icon><SvgIcon icon="mdi:play-outline" /></template>
                    测试全部
                  </NButton>
                </div>

                <NGrid :x-gap="16" :y-gap="12" responsive="screen" item-responsive>
                  <NGi span="24 s:12 m:6">
                    <NFormItem label="编号">
                      <NInput :value="activeRule.id" @update:value="value => updateActiveRule('id', value)" />
                    </NFormItem>
                  </NGi>
                  <NGi span="24 s:12 m:6">
                    <NFormItem label="类型">
                      <NSelect :value="activeRule.type" :options="typeOptions" @update:value="value => updateActiveRule('type', value)" />
                    </NFormItem>
                  </NGi>
                  <NGi span="24 s:12 m:12">
                    <NFormItem label="维度">
                      <NSelect
                        :value="activeRule.dimension"
                        :options="dimensionOptions"
                        filterable
                        @update:value="value => updateActiveRule('dimension', value)"
                      />
                    </NFormItem>
                  </NGi>
                  <NGi span="24 m:12">
                    <NFormItem label="规则描述">
                      <NInput :value="activeRule.description" @update:value="value => updateActiveRule('description', value)" />
                    </NFormItem>
                  </NGi>
                  <NGi span="24 m:12">
                    <NFormItem label="触发条件">
                      <NInput :value="activeRule.trigger" @update:value="value => updateActiveRule('trigger', value)" />
                    </NFormItem>
                  </NGi>
                  <NGi span="24">
                    <NFormItem label="核心诉求">
                      <NInput
                        :value="activeRule.coreHint"
                        type="textarea"
                        :autosize="{ minRows: 2, maxRows: 4 }"
                        @update:value="value => updateActiveRule('coreHint', value)"
                      />
                    </NFormItem>
                  </NGi>
                  <NGi span="24 m:16">
                    <NFormItem label="正则表达式">
                      <NInput
                        :value="activeRule.regex"
                        type="textarea"
                        :autosize="{ minRows: 3, maxRows: 6 }"
                        class="mono-input"
                        @update:value="value => updateActiveRule('regex', value)"
                      />
                    </NFormItem>
                  </NGi>
                  <NGi span="24 m:8">
                    <NFormItem label="Flags">
                      <NInput :value="activeRule.flags" class="mono-input" @update:value="value => updateActiveRule('flags', value)" />
                    </NFormItem>
                    <NFormItem label="错误示例">
                      <NInput :value="activeRule.errorExample" class="mono-input" @update:value="value => updateActiveRule('errorExample', value)" />
                    </NFormItem>
                  </NGi>
                  <NGi span="24">
                    <NFormItem label="提示文本">
                      <NInput
                        :value="activeRule.hint"
                        type="textarea"
                        :autosize="{ minRows: 4, maxRows: 8 }"
                        @update:value="value => updateActiveRule('hint', value)"
                      />
                    </NFormItem>
                  </NGi>
                </NGrid>
              </div>
            </div>
          </NTabPane>

          <NTabPane name="test" tab="测试">
            <div class="test-layout">
              <NGrid :x-gap="18" :y-gap="18" responsive="screen" item-responsive>
                <NGi span="24 m:13">
                  <div class="plain-panel">
                    <div class="section-title">学生代码</div>
                    <NInput
                      v-model:value="testCode"
                      type="textarea"
                      class="code-input"
                      :autosize="{ minRows: 16, maxRows: 24 }"
                      placeholder="粘贴一段学生代码"
                    />
                  </div>
                </NGi>
                <NGi span="24 m:11">
                  <div class="plain-panel result-panel">
                    <div class="section-title">平台模拟</div>
                    <NAlert :type="evaluation.type as any" :title="evaluation.title" :bordered="false">
                      {{ evaluation.detail }}
                    </NAlert>
                    <div class="result-actions">
                      <NButton type="primary" @click="runAllTests">
                        <template #icon><SvgIcon icon="mdi:play-outline" /></template>
                        全部测试
                      </NButton>
                      <NButton @click="activeTab = 'rules'">
                        <template #icon><SvgIcon icon="mdi:table-edit" /></template>
                        回到规则
                      </NButton>
                    </div>
                    <div class="execution-list">
                      <div class="execution-title">执行顺序</div>
                      <div v-for="rule in rules" :key="rule.id" class="execution-item">
                        <NTag :type="rule.type === 'N' ? 'error' : 'success'" size="small" :bordered="false">
                          {{ rule.id }}
                        </NTag>
                        <span>{{ rule.description || '未命名规则' }}</span>
                      </div>
                    </div>
                  </div>
                </NGi>
              </NGrid>
            </div>
          </NTabPane>

          <NTabPane name="hints" tab="提示文本">
            <div class="hint-grid">
              <div v-for="rule in rules" :key="rule.id" class="hint-item" @click="activeRuleId = rule.id">
                <div class="hint-head">
                  <NTag :type="rule.type === 'N' ? 'error' : 'success'" size="small" :bordered="false">
                    {{ rule.id }}
                  </NTag>
                  <span>{{ rule.description || '未命名规则' }}</span>
                </div>
                <pre>{{ rule.hint || rule.coreHint || '还没有提示文本。' }}</pre>
              </div>
            </div>
          </NTabPane>

          <NTabPane name="generate" tab="生成 JS">
            <div class="generate-layout">
              <NGrid :x-gap="18" :y-gap="18" responsive="screen" item-responsive>
                <NGi span="24 m:10">
                  <div class="plain-panel">
                    <div class="section-title">front_end_code</div>
                    <NForm label-placement="top">
                      <NFormItem label="前置代码">
                        <NInput
                          v-model:value="frontCode"
                          type="textarea"
                          class="code-input"
                          :autosize="{ minRows: 8, maxRows: 14 }"
                        />
                      </NFormItem>
                      <NFormItem label="后置代码">
                        <NInput
                          v-model:value="rearCode"
                          type="textarea"
                          class="code-input"
                          :autosize="{ minRows: 6, maxRows: 10 }"
                        />
                      </NFormItem>
                    </NForm>
                    <NSpace>
                      <NButton type="primary" @click="generateJS">
                        <template #icon><SvgIcon icon="mdi:eye-outline" /></template>
                        生成预览
                      </NButton>
                      <NButton type="success" @click="downloadJS">
                        <template #icon><SvgIcon icon="mdi:download-outline" /></template>
                        下载 JS
                      </NButton>
                    </NSpace>
                  </div>
                </NGi>
                <NGi span="24 m:14">
                  <div class="plain-panel">
                    <div class="section-title">预览</div>
                    <pre class="code-preview">{{ generatedJS || buildJS() }}</pre>
                  </div>
                </NGi>
              </NGrid>
            </div>
          </NTabPane>
        </NTabs>
      </main>
    </section>

    <NModal v-model:show="pasteModalVisible" preset="card" title="粘贴 JSON" class="regex-modal">
      <NInput
        v-model:value="pasteText"
        type="textarea"
        :autosize="{ minRows: 12, maxRows: 18 }"
        class="mono-input"
        placeholder="支持完整 JSON、单条规则、规则数组、代码块包裹的 JSON"
      />
      <template #footer>
        <div class="modal-actions">
          <NButton @click="pasteModalVisible = false">取消</NButton>
          <NButton v-if="rules.length" type="success" @click="mergePayload(pasteText)">智能合并</NButton>
          <NButton type="primary" @click="importPayload(pasteText)">全量替换</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="aiTextModalVisible" preset="card" :title="aiTextTitle" class="regex-modal">
      <NInput
        :value="aiText"
        type="textarea"
        readonly
        :autosize="{ minRows: 14, maxRows: 22 }"
        class="mono-input"
      />
      <template #footer>
        <div class="modal-actions">
          <NButton @click="aiTextModalVisible = false">关闭</NButton>
          <NButton type="primary" @click="copyText(aiText, '内容已复制')">复制</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.regex-page {
  min-height: 100%;
  padding: 24px;
  color: #18202f;
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(360px, 0.7fr);
  gap: 24px;
  max-width: 1480px;
  margin: 0 auto 24px;
  padding: 28px;
  border: 1px solid rgba(100, 116, 139, 0.18);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.07);
}

.hero-copy h1 {
  margin: 12px 0 10px;
  font-size: 34px;
  line-height: 1.15;
  font-weight: 750;
  letter-spacing: 0;
}

.hero-copy p {
  max-width: 720px;
  margin: 0;
  color: #667085;
  font-size: 15px;
  line-height: 1.8;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 650;
}

.eyebrow-icon {
  font-size: 20px;
}

.hero-actions {
  margin-top: 26px;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.metric-block {
  min-height: 112px;
  padding: 18px;
  border: 1px solid rgba(100, 116, 139, 0.16);
  border-radius: 8px;
  background: #f8fafc;
}

.metric-block span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.metric-block strong {
  display: block;
  margin-top: 18px;
  font-size: 34px;
  line-height: 1;
  letter-spacing: 0;
}

.accent-green strong {
  color: #0f766e;
}

.accent-red strong {
  color: #dc2626;
}

.accent-blue strong {
  color: #2563eb;
}

.accent-amber strong {
  color: #b45309;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 24px;
  max-width: 1480px;
  margin: 0 auto;
}

.side-panel,
.tool-surface {
  min-width: 0;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-section,
.tool-surface,
.plain-panel,
.editor-panel {
  border: 1px solid rgba(100, 116, 139, 0.18);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.055);
}

.panel-section {
  padding: 18px;
}

.tool-surface {
  padding: 18px;
}

.section-title {
  display: block;
  margin-bottom: 14px;
  color: #111827;
  font-size: 14px;
  font-weight: 700;
}

.project-actions {
  display: grid;
  gap: 8px;
}

.focus-card {
  display: grid;
  gap: 14px;
}

.focus-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #667085;
  font-size: 12px;
}

.focus-card p,
.editor-head p {
  margin: 0;
  color: #64748b;
  line-height: 1.7;
}

.empty-side {
  padding: 18px;
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
  text-align: center;
}

.tab-layout,
.test-layout,
.generate-layout {
  padding-top: 18px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.rules-table {
  cursor: pointer;
}

:deep(.active-data-row td) {
  background: rgba(15, 118, 110, 0.08) !important;
}

.rule-id {
  color: #2563eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
}

.regex-code {
  color: #475569;
  font-size: 12px;
  white-space: nowrap;
}

.editor-panel {
  margin-top: 18px;
  padding: 18px;
}

.editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.plain-panel {
  min-height: 100%;
  padding: 18px;
}

.result-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.execution-list {
  display: grid;
  gap: 8px;
  padding-top: 8px;
}

.execution-title {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.execution-item,
.hint-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.execution-item {
  padding: 10px 0;
  border-bottom: 1px solid #edf2f7;
}

.hint-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding-top: 18px;
}

.hint-item {
  min-height: 160px;
  padding: 16px;
  border: 1px solid rgba(100, 116, 139, 0.18);
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.hint-item:hover {
  border-color: rgba(37, 99, 235, 0.35);
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.07);
}

.hint-item pre,
.code-preview {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.hint-item pre {
  margin: 14px 0 0;
  color: #334155;
  line-height: 1.7;
}

.code-preview {
  min-height: 520px;
  max-height: 720px;
  overflow: auto;
  margin: 0;
  padding: 16px;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.65;
}

.code-input :deep(textarea),
.mono-input :deep(textarea),
.mono-input :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:global(.regex-modal) {
  width: min(860px, 92vw);
}

:global(.dark) .regex-page {
  color: #e5e7eb;
}

:global(.dark) .hero-panel,
:global(.dark) .panel-section,
:global(.dark) .tool-surface,
:global(.dark) .plain-panel,
:global(.dark) .editor-panel,
:global(.dark) .hint-item {
  border-color: rgba(148, 163, 184, 0.2);
  background: #141b2d;
  box-shadow: none;
}

:global(.dark) .metric-block,
:global(.dark) .empty-side {
  border-color: rgba(148, 163, 184, 0.18);
  background: #101827;
}

:global(.dark) .hero-copy p,
:global(.dark) .focus-card p,
:global(.dark) .editor-head p,
:global(.dark) .execution-title,
:global(.dark) .empty-side {
  color: #94a3b8;
}

:global(.dark) .section-title,
:global(.dark) .hero-copy h1 {
  color: #f8fafc;
}

:global(.dark) .hint-item pre {
  color: #dbe4ef;
}

@media (max-width: 1180px) {
  .hero-panel,
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .side-panel {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .regex-page {
    padding: 16px;
  }

  .hero-panel {
    padding: 22px;
  }

  .hero-metrics,
  .side-panel,
  .hint-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-row,
  .editor-head {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
