/**
 * 插件扫描器
 *
 * 利用 Vite 的 import.meta.glob() 在编译时扫描 src/views/\*\/manifest.json，
 * 自动生成路由配置、视图导入映射和 i18n 补充数据。
 *
 * 这是插件化架构的核心：工具开发者只需在自己目录内放 manifest.json + index.vue，
 * 无需修改任何全局共享文件。
 */

import type { RouteComponent } from 'vue-router';

// ==================== 类型定义 ====================

/** manifest.json 的结构 */
interface PluginManifest {
  /** 工具唯一标识，kebab-case，需与目录名一致 */
  name: string;
  /** 所属分类标识 */
  category: string;
  /** 菜单图标，Iconify 格式 */
  icon: string;
  /** 在分类内的排列顺序 */
  order: number;
  /** 分类在侧边栏中的排列顺序 */
  categoryOrder?: number;
  /** 访问权限级别 */
  access: 'guest' | 'user' | 'admin';
  /** 是否为锁定占位工具 */
  locked?: boolean;
  /** 多语言翻译 */
  i18n: Record<
    string,
    {
      route: string;
      category: string;
      categoryIcon?: string;
    }
  >;
}

/** 分类信息（从工具 manifest 聚合而来） */
interface CategoryInfo {
  /** 分类标识 */
  name: string;
  /** 分类排序 */
  order: number;
  /** 分类图标（从 i18n 中提取 categoryIcon） */
  icon: string;
  /** 分类下的工具列表 */
  tools: PluginManifest[];
}

// ==================== Glob 扫描 ====================

// 编译时扫描所有 manifest.json（eager 模式，同步获取）
// JSON 文件在 eager 模式下直接返回其内容对象
const manifestModules = import.meta.glob<PluginManifest>('/src/views/*/manifest.json', {
  eager: true,
  import: 'default'
});

// 编译时扫描所有工具的 index.vue（懒加载模式）
const viewModules = import.meta.glob<RouteComponent>('/src/views/*/index.vue');

// 锁定页面的懒加载导入
const lockedView = () => import('@/views/_builtin/locked/index.vue');

// ==================== 解析与分组 ====================

/** 解析所有 manifest，返回按分类分组的结果 */
function parseManifests(): CategoryInfo[] {
  const categoryMap = new Map<string, CategoryInfo>();

  for (const [path, manifest] of Object.entries(manifestModules)) {
    // 从路径提取目录名（如 /src/views/image-compressor/manifest.json → image-compressor）
    const dirMatch = path.match(/\/src\/views\/([^/]+)\/manifest\.json$/);
    if (!dirMatch) continue;

    const dirName = dirMatch[1];

    // 跳过内置目录
    if (dirName.startsWith('_')) continue;

    // 验证 manifest 的 name 与目录名一致
    if (manifest.name !== dirName) {
      console.warn(
        `[插件扫描器] manifest.name "${manifest.name}" 与目录名 "${dirName}" 不一致，已跳过`
      );
      continue;
    }

    const { category } = manifest;

    if (!categoryMap.has(category)) {
      // 从第一个工具的 manifest 获取分类信息
      const zhI18n = manifest.i18n['zh-CN'] || manifest.i18n['en-US'];
      categoryMap.set(category, {
        name: category,
        order: manifest.categoryOrder ?? 99,
        icon: zhI18n?.categoryIcon || 'mdi:folder-outline',
        tools: []
      });
    }

    categoryMap.get(category)!.tools.push(manifest);
  }

  // 按分类排序，分类内工具也排序
  const categories = Array.from(categoryMap.values());
  categories.sort((a, b) => a.order - b.order);
  for (const cat of categories) {
    cat.tools.sort((a, b) => a.order - b.order);
  }

  return categories;
}

// 缓存解析结果（只需解析一次）
let _cachedCategories: CategoryInfo[] | null = null;

function getCategories(): CategoryInfo[] {
  if (!_cachedCategories) {
    _cachedCategories = parseManifests();
  }
  return _cachedCategories;
}

// ==================== 路由生成 ====================

/**
 * 生成插件路由配置
 *
 * 输出格式兼容 Elegant Router 的 GeneratedRoute（多级路由），
 * 可直接与 generatedRoutes 合并使用。
 */
export function getPluginRoutes(): any[] {
  const categories = getCategories();
  const routes: any[] = [];

  for (const category of categories) {
    const children = category.tools.map(tool => {
      const routeKey = `${category.name}_${tool.name}`;

      // 将 access 级别映射为前端 roles
      const accessRolesMap: Record<string, string[]> = {
        guest: [], // 空数组 = 无角色限制
        user: ['R_USER', 'R_ADMIN', 'R_SUPER'],
        admin: ['R_ADMIN', 'R_SUPER']
      };

      return {
        name: routeKey,
        path: `/${category.name}/${tool.name}`,
        component: `view.${routeKey}`,
        meta: {
          title: routeKey,
          i18nKey: `route.${routeKey}`,
          icon: tool.icon,
          order: tool.order,
          guestAccessible: tool.access === 'guest',
          roles: accessRolesMap[tool.access] || []
        }
      };
    });

    routes.push({
      name: category.name,
      path: `/${category.name}`,
      component: 'layout.base',
      meta: {
        title: category.name,
        i18nKey: `route.${category.name}`,
        icon: category.icon,
        order: category.order,
        guestAccessible: true
      },
      children
    });
  }

  return routes;
}

// ==================== 视图导入映射 ====================

/**
 * 生成插件的视图导入映射
 *
 * 返回 Record<routeKey, () => Promise<Component>>，
 * 可与 imports.ts 中的 views 对象合并。
 */
export function getPluginViews(): Record<string, RouteComponent | (() => Promise<RouteComponent>)> {
  const categories = getCategories();
  const pluginViews: Record<string, RouteComponent | (() => Promise<RouteComponent>)> = {};

  for (const category of categories) {
    for (const tool of category.tools) {
      const routeKey = `${category.name}_${tool.name}`;
      const viewPath = `/src/views/${tool.name}/index.vue`;

      if (tool.locked) {
        // 锁定工具指向通用 locked 页面
        pluginViews[routeKey] = lockedView;
      } else if (viewModules[viewPath]) {
        // 正常工具使用 glob 扫描到的懒加载函数
        pluginViews[routeKey] = viewModules[viewPath] as () => Promise<RouteComponent>;
      } else {
        console.warn(
          `[插件扫描器] 工具 "${tool.name}" 没有找到 index.vue (${viewPath})，已跳过`
        );
      }
    }
  }

  return pluginViews;
}

// ==================== i18n 数据 ====================

/**
 * 生成插件的 i18n 补充数据
 *
 * 返回 { 'zh-CN': { route: {...} }, 'en-US': { route: {...} } }，
 * 可在系统初始化时通过 i18n.mergeLocaleMessage() 注入。
 */
export function getPluginI18n(): Record<string, { route: Record<string, string> }> {
  const categories = getCategories();
  const result: Record<string, { route: Record<string, string> }> = {};

  for (const category of categories) {
    for (const tool of category.tools) {
      const routeKey = `${category.name}_${tool.name}`;

      for (const [lang, translations] of Object.entries(tool.i18n)) {
        if (!result[lang]) {
          result[lang] = { route: {} };
        }

        // 工具路由名称的翻译
        result[lang].route[routeKey] = translations.route;

        // 分类名称的翻译（可能被多个工具重复设置，但值一致）
        result[lang].route[category.name] = translations.category;
      }
    }
  }

  return result;
}

// ==================== 调试导出 ====================

/** 获取所有已注册的插件列表（供调试用） */
export function getRegisteredPlugins() {
  return getCategories();
}
