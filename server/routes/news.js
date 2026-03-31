import { Router } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const router = Router();

// ========== 飞书多维表格配置 ==========
const LARK_BASE_TOKEN = 'Az66bPYH0a0VsOsVNOJcxCddnwg';
const LARK_TABLE_ID = 'tblM5xDNiyCXHAUq';
const NEWS_LIMIT = 5;

// ========== 缓存机制 ==========
let cachedNews = null;
let lastFetchDate = null; // 格式: 'YYYY-MM-DD'

/**
 * 获取今日日期字符串
 */
function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * 判断当前是否已过今天10点（可以执行更新）
 */
function isPastUpdateHour() {
  return new Date().getHours() >= 10;
}

/**
 * 判断是否需要刷新缓存
 * - 无缓存时需要刷新
 * - 新的一天且已过10点时需要刷新
 */
function shouldRefresh() {
  if (!cachedNews || !lastFetchDate) return true;
  const today = getTodayStr();
  if (lastFetchDate < today && isPastUpdateHour()) return true;
  return false;
}

/**
 * 从飞书多维表格中获取最新新闻
 * 使用 search API（需要 base:record:retrieve 权限）
 */
async function fetchNewsFromLark() {
  const apiPath = `/open-apis/bitable/v1/apps/${LARK_BASE_TOKEN}/tables/${LARK_TABLE_ID}/records/search`;
  const body = JSON.stringify({
    page_size: NEWS_LIMIT,
    automatic_fields: true,
  });

  const { stdout } = await execFileAsync('lark-cli', [
    'api', 'POST', apiPath,
    '--data', body,
  ]);

  const result = JSON.parse(stdout);

  if (result.code !== 0) {
    throw new Error(`Lark API error: ${result.msg}`);
  }

  const items = result.data?.items || [];

  // 转换为前端需要的格式
  const news = items.map((item, index) => {
    const fields = item.fields || {};

    // 提取 text 数组字段的纯文本
    const extractText = (field) => {
      if (!field) return '';
      if (typeof field === 'string') return field;
      if (Array.isArray(field)) {
        return field.map(seg => seg.text || '').join('');
      }
      return String(field);
    };

    // 提取 url 字段
    const extractUrl = (field) => {
      if (!field) return '';
      if (typeof field === 'string') return field;
      if (field.link) return field.link;
      if (Array.isArray(field)) {
        return field.map(seg => seg.text || '').join('');
      }
      return '';
    };

    // 计算相对时间
    const dateMs = fields['日期'];
    let timeAgo = '';
    if (dateMs) {
      const diff = Date.now() - dateMs;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 1) {
        timeAgo = `${Math.max(1, Math.floor(diff / (1000 * 60)))}m`;
      } else if (hours < 24) {
        timeAgo = `${hours}h`;
      } else {
        timeAgo = `${Math.floor(hours / 24)}d`;
      }
    }

    return {
      id: index + 1,
      title: extractText(fields['标题']),
      summary: extractText(fields['摘要']),
      source: fields['分类'] || '',
      url: extractUrl(fields['链接']),
      timeAgo,
      rank: fields['排名'] || index + 1,
      date: dateMs || 0,
    };
  });

  // 按排名排序
  news.sort((a, b) => a.rank - b.rank);

  return news;
}

// ========== API 路由 ==========

/**
 * GET /api/news
 * 返回缓存的 AI 新闻，按需从飞书刷新
 */
router.get('/', async (req, res) => {
  try {
    if (shouldRefresh()) {
      console.log('[News] 从飞书多维表格获取最新新闻...');
      cachedNews = await fetchNewsFromLark();
      lastFetchDate = getTodayStr();
      console.log(`[News] 成功获取 ${cachedNews.length} 条新闻，缓存日期: ${lastFetchDate}`);
    }

    res.json({
      code: '0000',
      msg: 'success',
      data: cachedNews || [],
    });
  } catch (error) {
    console.error('[News] 获取新闻失败:', error.message);
    // 如果有缓存，返回旧缓存
    if (cachedNews) {
      res.json({
        code: '0000',
        msg: 'success (cached)',
        data: cachedNews,
      });
    } else if (error.code === 'ENOENT') {
      // lark-cli 不存在，优雅降级返回空数据
      console.warn('[News] lark-cli 未安装，新闻功能不可用');
      res.json({
        code: '0000',
        msg: 'lark-cli not available',
        data: [],
      });
    } else {
      res.status(500).json({
        code: '5000',
        msg: `获取新闻失败: ${error.message}`,
        data: [],
      });
    }
  }
});

/**
 * POST /api/news/refresh
 * 强制刷新新闻缓存
 */
router.post('/refresh', async (req, res) => {
  try {
    console.log('[News] 强制刷新新闻缓存...');
    cachedNews = await fetchNewsFromLark();
    lastFetchDate = getTodayStr();
    console.log(`[News] 刷新成功，获取 ${cachedNews.length} 条新闻`);

    res.json({
      code: '0000',
      msg: 'refreshed',
      data: cachedNews,
    });
  } catch (error) {
    console.error('[News] 刷新失败:', error.message);
    res.status(500).json({
      code: '5000',
      msg: `刷新失败: ${error.message}`,
      data: [],
    });
  }
});

export default router;
