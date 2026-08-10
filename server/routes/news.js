import { Router } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { XMLParser } from 'fast-xml-parser';
import config from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

const execFileAsync = promisify(execFile);
const router = Router();

// ========== 飞书多维表格配置 ==========
const LARK_BASE_TOKEN = 'Az66bPYH0a0VsOsVNOJcxCddnwg';
const LARK_TABLE_ID = 'tblM5xDNiyCXHAUq';
const NEWS_LIMIT = 5;
const NEWS_SOURCES = new Set(['rss', 'lark', 'hybrid']);

const rssParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: false,
});

// ========== 缓存机制 ==========
let cachedNews = null;
let lastFetchAt = 0;
let lastFetchSource = '';

/**
 * 判断是否需要刷新缓存
 * - 无缓存时需要刷新
 * - RSS 更新频率较高，按分钟级 TTL 刷新
 */
function shouldRefresh() {
  if (!cachedNews || !lastFetchAt) return true;
  const refreshMinutes = Number.isFinite(config.news.refreshMinutes) ? config.news.refreshMinutes : 60;
  const refreshMs = Math.max(5, refreshMinutes) * 60 * 1000;
  return Date.now() - lastFetchAt >= refreshMs;
}

function getNewsSource() {
  const source = String(config.news.source || 'hybrid').toLowerCase();
  return NEWS_SOURCES.has(source) ? source : 'hybrid';
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractValue(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(extractValue).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    return value['#text'] || value.__cdata || value._text || '';
  }
  return '';
}

function stripHtml(html) {
  return extractValue(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<p[^>]*>\s*<a[^>]*>\s*阅读原文[\s\S]*?<\/p>/gi, '')
    .replace(/<p[^>]*>[\s\S]*?本文首发于[\s\S]*?<\/p>/gi, '')
    .replace(/<p[^>]*>[\s\S]*?保留所有权利[\s\S]*?<\/p>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function limitSummary(text, maxLength = 120) {
  const value = stripHtml(text);
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function formatTimeAgo(dateMs) {
  if (!dateMs) return '';
  const diff = Date.now() - dateMs;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function normalizeNewsItems(items) {
  return items
    .filter(item => item.title && item.url)
    .sort((a, b) => (b.date || 0) - (a.date || 0))
    .slice(0, NEWS_LIMIT)
    .map((item, index) => ({
      ...item,
      id: index + 1,
      rank: index + 1,
    }));
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const requestTimeoutMs = Number.isFinite(config.news.requestTimeoutMs) ? config.news.requestTimeoutMs : 8000;
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
        'User-Agent': 'Nautilus/0.2.0 (+https://llmposts.com/feed/)',
      },
    });

    if (!response.ok) {
      throw new Error(`RSS HTTP ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 从 RSS 源获取最新新闻
 */
async function fetchNewsFromRss() {
  const xml = await fetchWithTimeout(config.news.rssUrl);
  const feed = rssParser.parse(xml);
  const channel = feed?.rss?.channel;
  const items = asArray(channel?.item);

  if (!items.length) {
    throw new Error('RSS 中没有可用 item');
  }

  const news = items.map((item) => {
    const dateMs = Date.parse(extractValue(item.pubDate));
    const category = extractValue(item.category) || extractValue(channel?.title) || 'RSS';

    return {
      title: extractValue(item.title),
      summary: limitSummary(item.description || item['content:encoded']),
      source: category,
      url: extractValue(item.link),
      timeAgo: formatTimeAgo(dateMs),
      date: Number.isNaN(dateMs) ? 0 : dateMs,
      provider: 'rss',
    };
  });

  const finalNews = normalizeNewsItems(news);
  if (!finalNews.length) {
    throw new Error('RSS 解析后没有有效新闻');
  }

  return finalNews;
}

/**
 * 从飞书多维表格中获取最新新闻
 * 使用 search API（需要 base:record:retrieve 权限）
 */
async function fetchNewsFromLark() {
  const apiPath = `/open-apis/bitable/v1/apps/${LARK_BASE_TOKEN}/tables/${LARK_TABLE_ID}/records/search`;

  // 多拉一些记录，后面在代码里做"今天优先 + 历史补足"
  const body = JSON.stringify({
    page_size: 20,
    automatic_fields: true,
    sort: [{ field_name: '日期', desc: true }],
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

  // 今天 0 点时间戳
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // 转换为前端需要的格式
  const allNews = items.map((item, index) => {
    const fields = item.fields || {};
    const dateMs = fields['日期'];

    // 计算相对时间
    return {
      id: index + 1,
      title: extractText(fields['标题']),
      summary: extractText(fields['摘要']),
      source: extractValue(fields['分类']) || '',
      url: extractUrl(fields['链接']),
      timeAgo: formatTimeAgo(dateMs),
      rank: fields['排名'] || index + 1,
      date: dateMs || 0,
      provider: 'lark',
    };
  });

  // 策略：今天的优先，不足 NEWS_LIMIT 条时按日期倒序补历史
  const todayNews = allNews.filter(n => n.date >= todayStart);
  const olderNews = allNews.filter(n => n.date < todayStart);

  // 今天的按排名排序
  todayNews.sort((a, b) => a.rank - b.rank);

  let finalNews;
  if (todayNews.length >= NEWS_LIMIT) {
    finalNews = todayNews.slice(0, NEWS_LIMIT);
  } else {
    // 今天的全部保留，用历史按日期倒序补足
    finalNews = [...todayNews, ...olderNews.slice(0, NEWS_LIMIT - todayNews.length)];
  }

  return finalNews;
}

async function fetchFreshNews() {
  const source = getNewsSource();
  const errors = [];

  if (source === 'rss' || source === 'hybrid') {
    try {
      console.log(`[News] 从 RSS 获取最新新闻: ${config.news.rssUrl}`);
      return { source: 'rss', data: await fetchNewsFromRss() };
    } catch (error) {
      errors.push(`RSS: ${error.message}`);
      if (source === 'rss') {
        throw new Error(errors.join('; '));
      }
      console.warn(`[News] RSS 获取失败，准备回退飞书: ${error.message}`);
    }
  }

  if (source === 'lark' || source === 'hybrid') {
    try {
      console.log('[News] 从飞书多维表格获取最新新闻...');
      return { source: 'lark', data: await fetchNewsFromLark() };
    } catch (error) {
      errors.push(`Lark: ${error.message}`);
    }
  }

  throw new Error(errors.join('; ') || `未知新闻源: ${source}`);
}

// ========== API 路由 ==========

/**
 * GET /api/news
 * 返回缓存的 AI 新闻，按需从 RSS/飞书刷新
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    if (shouldRefresh()) {
      const result = await fetchFreshNews();
      cachedNews = result.data;
      lastFetchSource = result.source;
      lastFetchAt = Date.now();
      console.log(`[News] 成功获取 ${cachedNews.length} 条新闻，来源: ${lastFetchSource}`);
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
    } else {
      res.status(500).json({
        code: '5000',
        msg: `获取新闻失败: ${error.message}`,
        data: [],
      });
    }
  }
}));

/**
 * POST /api/news/refresh
 * 强制刷新新闻缓存
 */
router.post('/refresh', requireAuth, asyncHandler(async (req, res) => {
  try {
    console.log('[News] 强制刷新新闻缓存...');
    const result = await fetchFreshNews();
    cachedNews = result.data;
    lastFetchSource = result.source;
    lastFetchAt = Date.now();
    console.log(`[News] 刷新成功，获取 ${cachedNews.length} 条新闻，来源: ${lastFetchSource}`);

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
}));

export default router;
