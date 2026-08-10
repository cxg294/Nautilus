/**
 * 图标搜索引擎 — 核心 Composable
 *
 * 特性：
 * - 调用 Iconify 公共 API 进行搜索
 * - 300ms 防抖实时搜索
 * - 分页加载更多
 * - 图标集筛选
 * - 搜索历史记录（localStorage）
 * - 中文关键词 → 英文映射（内置常用翻译表）
 */
import { ref, computed, watch, shallowRef } from 'vue';

// ============================================================
// 类型定义
// ============================================================

export interface IconResult {
  /** 完整图标名 prefix:name */
  fullName: string;
  /** 图标集前缀 */
  prefix: string;
  /** 图标名 */
  name: string;
}

export interface CollectionInfo {
  name: string;
  total: number;
  author?: { name: string; url?: string };
  license?: { title: string };
  category?: string;
}

export interface SearchState {
  /** 搜索结果 */
  icons: IconResult[];
  /** 总结果数 */
  total: number;
  /** 当前加载量 */
  loaded: number;
  /** 是否还有更多 */
  hasMore: boolean;
  /** 相关图标集 */
  collections: Record<string, CollectionInfo>;
}

// ============================================================
// 中文 → 英文 翻译表（常用图标关键词）
// ============================================================

const ZH_EN_MAP: Record<string, string> = {
  // 常规操作
  '搜索': 'search', '查找': 'search', '放大镜': 'magnify',
  '删除': 'delete', '移除': 'remove', '清除': 'clear',
  '添加': 'add', '新增': 'plus', '新建': 'create',
  '编辑': 'edit', '修改': 'pencil', '更改': 'change',
  '保存': 'save', '存储': 'save',
  '取消': 'cancel', '关闭': 'close',
  '确认': 'check', '确定': 'confirm',
  '刷新': 'refresh', '重新加载': 'reload',
  '复制': 'copy', '粘贴': 'paste', '剪切': 'cut',
  '撤销': 'undo', '重做': 'redo',
  '上传': 'upload', '下载': 'download',
  '分享': 'share', '转发': 'forward',
  '收藏': 'bookmark', '喜欢': 'heart', '点赞': 'thumb-up',
  '设置': 'settings', '配置': 'cog', '齿轮': 'gear',
  '帮助': 'help', '问号': 'question',
  '通知': 'notification', '提醒': 'bell', '铃铛': 'bell',
  '消息': 'message', '聊天': 'chat', '对话': 'comment',
  '筛选': 'filter', '过滤': 'filter', '漏斗': 'funnel',
  '排序': 'sort', '排列': 'sort',
  '拖拽': 'drag', '移动': 'move',
  '锁定': 'lock', '解锁': 'unlock',
  '显示': 'eye', '隐藏': 'eye-off', '可见': 'visible',
  '展开': 'expand', '折叠': 'collapse', '收起': 'chevron-up',
  '全屏': 'fullscreen', '最大化': 'maximize', '最小化': 'minimize',
  '返回': 'arrow-left', '前进': 'arrow-right', '后退': 'back',
  '菜单': 'menu', '列表': 'list', '网格': 'grid',
  '对齐': 'align',
  // 用户
  '用户': 'user', '账号': 'account', '头像': 'avatar',
  '登录': 'login', '注册': 'register', '登出': 'logout',
  '权限': 'shield', '角色': 'role', '管理员': 'admin',
  '团队': 'team', '群组': 'group',
  // 文件
  '文件': 'file', '文件夹': 'folder', '文档': 'document',
  '图片': 'image', '照片': 'photo', '相册': 'album',
  '视频': 'video', '电影': 'movie', '播放': 'play',
  '音频': 'audio', '音乐': 'music', '声音': 'volume',
  '链接': 'link', '附件': 'attachment',
  '代码': 'code', '程序': 'code-braces', '终端': 'terminal',
  // 设备
  '手机': 'cellphone', '电脑': 'monitor', '平板': 'tablet',
  '打印': 'printer', '扫描': 'scan', '相机': 'camera',
  // 箭头 / 方向
  '箭头': 'arrow', '向上': 'arrow-up', '向下': 'arrow-down',
  '向左': 'arrow-left', '向右': 'arrow-right',
  '双箭头': 'arrow-expand', '交换': 'swap',
  // 图形
  '圆形': 'circle', '方形': 'square', '三角': 'triangle',
  '星星': 'star', '五角星': 'star',
  '心形': 'heart', '闪电': 'flash', '火焰': 'fire',
  '太阳': 'sun', '月亮': 'moon', '云': 'cloud',
  // 状态
  '成功': 'check-circle', '失败': 'close-circle', '错误': 'alert-circle',
  '警告': 'alert', '信息': 'information', '提示': 'lightbulb',
  '加载': 'loading', '等待': 'clock',
  // 社交
  '微信': 'wechat', '邮件': 'email', '邮箱': 'mail',
  '电话': 'phone', '地址': 'map-marker', '位置': 'location',
  '日历': 'calendar', '时间': 'clock', '时钟': 'clock',
  // 电商
  '购物车': 'cart', '商品': 'shopping', '订单': 'receipt',
  '支付': 'credit-card', '钱包': 'wallet', '优惠券': 'ticket',
  // 数据
  '图表': 'chart', '柱状图': 'chart-bar', '折线图': 'chart-line',
  '饼图': 'chart-pie', '仪表盘': 'dashboard',
  '数据库': 'database', '表格': 'table',
  // 工具
  '剪刀': 'scissors', '画笔': 'brush', '调色板': 'palette',
  '放大': 'zoom-in', '缩小': 'zoom-out',
  '旋转': 'rotate', '裁剪': 'crop',
  // 导航
  '首页': 'home', '主页': 'home',
};

// ============================================================
// 常量
// ============================================================

const API_BASE = 'https://api.iconify.design';
const PAGE_SIZE = 64;
const HISTORY_KEY = 'nautilus_icon_search_history';
const MAX_HISTORY = 20;

// ============================================================
// Composable
// ============================================================

export function useIconSearch() {
  // ---- 响应式状态 ----
  const query = ref('');
  const isSearching = ref(false);
  const prefixFilter = ref<string | null>(null);

  const searchState = shallowRef<SearchState>({
    icons: [],
    total: 0,
    loaded: 0,
    hasMore: false,
    collections: {},
  });

  const searchHistory = ref<string[]>(loadHistory());
  const errorMsg = ref<string | null>(null);

  /** 当前正在进行的搜索 ID（防并发） */
  let searchId = 0;

  // ---- 计算属性 ----

  /** 可用于筛选的图标集列表 */
  const availableCollections = computed(() => {
    const cols = searchState.value.collections;
    return Object.entries(cols).map(([prefix, info]) => ({
      prefix,
      name: info.name,
      total: info.total,
      category: info.category,
    })).sort((a, b) => b.total - a.total);
  });

  /** 按图标集筛选后的结果 */
  const filteredIcons = computed(() => {
    const filter = prefixFilter.value;
    if (!filter) return searchState.value.icons;
    return searchState.value.icons.filter(i => i.prefix === filter);
  });

  /** 结果统计文字 */
  const resultSummary = computed(() => {
    const s = searchState.value;
    if (s.total === 0) return '';
    const setCount = Object.keys(s.collections).length;
    return `找到 ${s.total} 个图标，来自 ${setCount} 个图标集`;
  });

  // ============================================================
  // 核心搜索
  // ============================================================

  /**
   * 翻译查询词：如果全是中文，尝试翻译
   */
  function translateQuery(q: string): string {
    const trimmed = q.trim();
    // 全中文，直接查表
    if (/^[\u4e00-\u9fa5]+$/.test(trimmed)) {
      return ZH_EN_MAP[trimmed] || trimmed;
    }
    // 混合输入，提取中文部分逐个翻译
    return trimmed.replace(/[\u4e00-\u9fa5]+/g, (match) => {
      return ZH_EN_MAP[match] || match;
    });
  }

  /**
   * 执行搜索
   */
  async function search(keyword?: string) {
    const raw = (keyword ?? query.value).trim();
    if (!raw) {
      clearResults();
      return;
    }

    const translated = translateQuery(raw);
    const currentId = ++searchId;

    isSearching.value = true;
    errorMsg.value = null;
    prefixFilter.value = null;

    try {
      const url = new URL(`${API_BASE}/search`);
      url.searchParams.set('query', translated);
      url.searchParams.set('limit', String(PAGE_SIZE));

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`API 请求失败: ${res.status}`);

      // 防止旧请求覆盖新结果
      if (currentId !== searchId) return;

      const data = await res.json();
      const icons: IconResult[] = (data.icons || []).map((name: string) => {
        const [prefix, ...rest] = name.split(':');
        return { fullName: name, prefix, name: rest.join(':') };
      });

      searchState.value = {
        icons,
        total: data.total || icons.length,
        loaded: icons.length,
        hasMore: icons.length < (data.total || 0),
        collections: data.collections || {},
      };

      // 保存搜索历史
      addToHistory(raw);
    } catch (err: any) {
      if (currentId !== searchId) return;
      errorMsg.value = `搜索失败: ${err.message}`;
      console.error('[IconSearch]', err);
    } finally {
      if (currentId === searchId) {
        isSearching.value = false;
      }
    }
  }

  /**
   * 加载更多结果
   */
  async function loadMore() {
    const raw = query.value.trim();
    if (!raw || !searchState.value.hasMore) return;

    const translated = translateQuery(raw);
    const currentId = searchId; // 不递增，保持当前搜索上下文
    isSearching.value = true;

    try {
      const url = new URL(`${API_BASE}/search`);
      url.searchParams.set('query', translated);
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('start', String(searchState.value.loaded));

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`API 请求失败: ${res.status}`);

      if (currentId !== searchId) return;

      const data = await res.json();
      const newIcons: IconResult[] = (data.icons || []).map((name: string) => {
        const [prefix, ...rest] = name.split(':');
        return { fullName: name, prefix, name: rest.join(':') };
      });

      const prev = searchState.value;
      const merged = [...prev.icons, ...newIcons];
      searchState.value = {
        icons: merged,
        total: data.total || prev.total,
        loaded: merged.length,
        hasMore: merged.length < (data.total || 0),
        collections: { ...prev.collections, ...(data.collections || {}) },
      };
    } catch (err: any) {
      if (currentId !== searchId) return;
      errorMsg.value = `加载更多失败: ${err.message}`;
    } finally {
      if (currentId === searchId) {
        isSearching.value = false;
      }
    }
  }

  /** 清空结果 */
  function clearResults() {
    searchState.value = { icons: [], total: 0, loaded: 0, hasMore: false, collections: {} };
    errorMsg.value = null;
    prefixFilter.value = null;
  }

  // ============================================================
  // 搜索历史
  // ============================================================

  function loadHistory(): string[] {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function addToHistory(keyword: string) {
    const list = searchHistory.value.filter(k => k !== keyword);
    list.unshift(keyword);
    if (list.length > MAX_HISTORY) list.length = MAX_HISTORY;
    searchHistory.value = list;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  }

  function removeFromHistory(keyword: string) {
    searchHistory.value = searchHistory.value.filter(k => k !== keyword);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
  }

  function clearHistory() {
    searchHistory.value = [];
    localStorage.removeItem(HISTORY_KEY);
  }

  // ============================================================
  // 复制工具
  // ============================================================

  /** 获取图标的 SVG URL */
  function getSvgUrl(icon: IconResult): string {
    return `${API_BASE}/${icon.prefix}/${icon.name}.svg`;
  }

  /** 复制文本到剪贴板 */
  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  /** 获取各种格式的复制文本 */
  function getCopyFormats(icon: IconResult) {
    return {
      /** Iconify 标准格式 prefix:name */
      iconify: icon.fullName,
      /** UnoCSS class 格式 */
      unocss: `i-${icon.prefix}-${icon.name}`,
      /** Vue 组件格式 */
      vue: `<Icon icon="${icon.fullName}" />`,
      /** SVG URL */
      svgUrl: getSvgUrl(icon),
      /** HTML img 标签 */
      img: `<img src="${getSvgUrl(icon)}" alt="${icon.name}" />`,
    };
  }

  return {
    // 状态
    query,
    isSearching,
    prefixFilter,
    searchState,
    searchHistory,
    errorMsg,
    // 计算属性
    availableCollections,
    filteredIcons,
    resultSummary,
    // 方法
    search,
    loadMore,
    clearResults,
    removeFromHistory,
    clearHistory,
    getSvgUrl,
    copyToClipboard,
    getCopyFormats,
  };
}
