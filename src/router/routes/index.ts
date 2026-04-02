import type { CustomRoute, ElegantConstRoute } from '@elegant-router/types';
import { generatedRoutes } from '../elegant/routes';
import { layouts, views } from '../elegant/imports';
import { transformElegantRoutesToVueRoutes } from '../elegant/transform';
import { getPluginRoutes, getPluginViews } from '../plugin-scanner';

/**
 * custom routes
 *
 * @link https://github.com/soybeanjs/elegant-router?tab=readme-ov-file#custom-route
 */
const customRoutes: CustomRoute[] = [];

/** create routes when the auth route mode is static */
export function createStaticRoutes() {
  const constantRoutes: ElegantConstRoute[] = [];

  const authRoutes: ElegantConstRoute[] = [];

  // 合并内置路由 + 插件路由
  const pluginRoutes = getPluginRoutes();
  ([...customRoutes, ...generatedRoutes, ...pluginRoutes] as ElegantConstRoute[]).forEach(item => {
    if (item.meta?.constant) {
      constantRoutes.push(item);
    } else {
      authRoutes.push(item);
    }
  });

  return {
    constantRoutes,
    authRoutes
  };
}

/**
 * Get auth vue routes
 *
 * @param routes Elegant routes
 */
export function getAuthVueRoutes(routes: ElegantConstRoute[]) {
  // 合并内置视图 + 插件视图，使插件路由能正确解析组件
  const allViews = { ...views, ...getPluginViews() };
  return transformElegantRoutesToVueRoutes(routes, layouts, allViews);
}
