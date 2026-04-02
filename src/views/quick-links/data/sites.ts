/**
 * 常用网站数据
 *
 * 维护说明：
 * - 新增网站只需在对应分组的 sites 数组中追加即可
 * - env 字段仅用于内部工具，标识生产/测试环境
 * - favicon 会自动从网站域名获取，加载失败时回退到 fallbackIcon
 */

export interface SiteItem {
  /** 网站名称 */
  name: string;
  /** 网站地址 */
  url: string;
  /** 备用 Iconify 图标（favicon 加载失败时使用） */
  fallbackIcon: string;
  /** 简短描述 */
  description?: string;
  /** 环境标识（仅内部工具） */
  env?: 'prod' | 'test';
}

export interface SiteGroup {
  /** 分组标识 */
  key: string;
  /** 分组名称 */
  label: string;
  /** 分组图标 */
  icon: string;
  /** 分组主题色 */
  accentColor: string;
  /** 网站列表 */
  sites: SiteItem[];
}

/**
 * 从 URL 中提取域名，用于获取 favicon
 */
export function getFaviconUrl(siteUrl: string): string {
  try {
    const { hostname } = new URL(siteUrl);
    // 使用 Google favicon 服务获取高质量图标
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return '';
  }
}

export const siteGroups: SiteGroup[] = [
  {
    key: 'internal',
    label: '内部工具',
    icon: 'mdi:office-building-cog',
    accentColor: '#6366f1',
    sites: [
      {
        name: 'CRM',
        url: 'https://crm.hetao101.com',
        fallbackIcon: 'mdi:account-group',
        description: '客户关系管理系统',
        env: 'prod'
      },
      {
        name: 'CRM（测试）',
        url: 'https://crm.testing.hetao101.com',
        fallbackIcon: 'mdi:account-group-outline',
        description: 'CRM 测试环境',
        env: 'test'
      },
      {
        name: '进校智慧教室',
        url: 'https://kp101.cn',
        fallbackIcon: 'mdi:school',
        description: '核桃编程学习平台',
        env: 'prod'
      },
      {
        name: '进校智慧教室（测试）',
        url: 'https://kp.codeclass888.com',
        fallbackIcon: 'mdi:school-outline',
        description: '智慧教室测试环境',
        env: 'test'
      },
      {
        name: 'S3 网页 IDE',
        url: 'https://s3-ide.hetao101.com',
        fallbackIcon: 'mdi:code-braces-box',
        description: '在线编程 IDE',
        env: 'prod'
      },
      {
        name: '核桃大数据平台',
        url: 'https://data.corp.hetao101.com',
        fallbackIcon: 'mdi:chart-areaspline',
        description: '数据分析与报表',
        env: 'prod'
      },
      {
        name: 'Dify',
        url: 'https://dify01.testing.hetao101.com',
        fallbackIcon: 'mdi:robot-outline',
        description: 'AI 应用开发平台',
        env: 'prod'
      }
    ]
  },
  {
    key: 'external',
    label: '外部工具',
    icon: 'mdi:wrench-outline',
    accentColor: '#10b981',
    sites: [
      {
        name: 'Convertio',
        url: 'https://convertio.co/zh/',
        fallbackIcon: 'mdi:swap-horizontal-circle-outline',
        description: '万能格式转换工具'
      },
      {
        name: '爱给网',
        url: 'https://www.aigei.com',
        fallbackIcon: 'mdi:music-box-multiple',
        description: '音效、配乐、视频素材'
      },
      {
        name: 'Regex101',
        url: 'https://regex101.com',
        fallbackIcon: 'mdi:regex',
        description: '正则表达式在线测试'
      },
      {
        name: 'TinyPNG',
        url: 'https://tinypng.com',
        fallbackIcon: 'mdi:image-size-select-small',
        description: '在线图片压缩'
      },
      {
        name: '金数据',
        url: 'https://jinshuju.net',
        fallbackIcon: 'mdi:form-select',
        description: '在线表单与数据收集'
      },
      {
        name: 'Suno',
        url: 'https://suno.com',
        fallbackIcon: 'mdi:music-circle-outline',
        description: 'AI 音乐生成平台'
      },
      {
        name: 'NotebookLM',
        url: 'https://notebooklm.google.com',
        fallbackIcon: 'mdi:notebook-outline',
        description: 'Google AI 笔记与研究助手'
      }
    ]
  },
  {
    key: 'media',
    label: '媒体平台',
    icon: 'mdi:broadcast',
    accentColor: '#f59e0b',
    sites: [
      {
        name: 'Way to AGI',
        url: 'https://www.waytoagi.com',
        fallbackIcon: 'mdi:head-lightbulb-outline',
        description: 'AGI 前沿资讯与社区'
      }
    ]
  }
];
