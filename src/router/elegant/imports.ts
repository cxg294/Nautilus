/* eslint-disable */
/* prettier-ignore */
// 基于 elegant-router 格式
// 内置页面视图 + 插件工具视图（自动扫描）

import type { RouteComponent } from "vue-router";
import type { RouteLayout } from "@elegant-router/types";

import BaseLayout from "@/layouts/base-layout/index.vue";
import BlankLayout from "@/layouts/blank-layout/index.vue";
import { getPluginViews } from "../plugin-scanner";

export const layouts: Record<RouteLayout, RouteComponent | (() => Promise<RouteComponent>)> = {
  base: BaseLayout,
  blank: BlankLayout,
};

export const views: Record<string, RouteComponent | (() => Promise<RouteComponent>)> = {
  // 内置页面
  403: () => import("@/views/_builtin/403/index.vue"),
  404: () => import("@/views/_builtin/404/index.vue"),
  500: () => import("@/views/_builtin/500/index.vue"),
  "iframe-page": () => import("@/views/_builtin/iframe-page/[url].vue"),
  login: () => import("@/views/_builtin/login/index.vue"),
  home: () => import("@/views/home/index.vue"),
  // 插件工具视图（从 manifest.json 自动扫描）
  ...getPluginViews(),
};
