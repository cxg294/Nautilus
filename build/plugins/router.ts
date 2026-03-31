import type { RouteMeta } from 'vue-router';
import ElegantVueRouter from '@elegant-router/vue/vite';
import type { RouteKey } from '@elegant-router/types';

export function setupElegantRouter() {
  return ElegantVueRouter({
    layouts: {
      base: 'src/layouts/base-layout/index.vue',
      blank: 'src/layouts/blank-layout/index.vue'
    },
    routePathTransformer(routeName, routePath) {
      const key = routeName as RouteKey;

      if (key === 'login') {
        const modules: UnionKey.LoginModule[] = ['pwd-login', 'code-login', 'register', 'reset-pwd', 'bind-wechat'];

        const moduleReg = modules.join('|');

        return `/login/:module(${moduleReg})?`;
      }

      return routePath;
    },
    onRouteMetaGen(routeName) {
      const key = routeName as RouteKey;

      // 内置路由：框架和系统页面
      const constantRoutes: RouteKey[] = ['login', '403', '404', '500'];
      // 需要在侧边栏显示的内置页面（其余工具由 plugin-scanner 管理）
      const builtinVisibleRoutes: RouteKey[] = ['home'];
      // 虽然不在菜单显示但需要特殊处理的内置路由
      const builtinHiddenRoutes: RouteKey[] = ['iframe-page', 'locked'];

      const meta: Partial<RouteMeta> = {
        title: key,
        i18nKey: `route.${key}` as App.I18n.I18nKey
      };

      if (constantRoutes.includes(key)) {
        meta.constant = true;
        meta.hideInMenu = true;
      } else if (builtinVisibleRoutes.includes(key)) {
        // home 等内置页面正常显示
      } else if (builtinHiddenRoutes.includes(key)) {
        meta.hideInMenu = true;
      } else {
        // 所有工具模块路由由 plugin-scanner 管理，
        // Elegant Router 自动生成的扁平路由需隐藏，避免侧边栏重复
        meta.hideInMenu = true;
      }

      return meta;
    }
  });
}
