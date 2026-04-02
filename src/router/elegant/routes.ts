/* eslint-disable */
/* prettier-ignore */
// 基于 elegant-router 格式，仅保留内置路由
// 工具路由由插件扫描器 (plugin-scanner.ts) 自动生成

import type { GeneratedRoute } from '@elegant-router/types';

export const generatedRoutes: GeneratedRoute[] = [
  {
    name: '403',
    path: '/403',
    component: 'layout.blank$view.403',
    meta: {
      title: '403',
      i18nKey: 'route.403',
      constant: true,
      hideInMenu: true
    }
  },
  {
    name: '404',
    path: '/404',
    component: 'layout.blank$view.404',
    meta: {
      title: '404',
      i18nKey: 'route.404',
      constant: true,
      hideInMenu: true
    }
  },
  {
    name: '500',
    path: '/500',
    component: 'layout.blank$view.500',
    meta: {
      title: '500',
      i18nKey: 'route.500',
      constant: true,
      hideInMenu: true
    }
  },
  {
    name: 'base64-converter',
    path: '/base64-converter',
    component: 'layout.base$view.base64-converter',
    meta: {
      title: 'base64-converter',
      i18nKey: 'route.base64-converter',
      hideInMenu: true
    }
  },
  {
    name: 'btc-course-flow',
    path: '/btc-course-flow',
    component: 'layout.base$view.btc-course-flow',
    meta: {
      title: 'btc-course-flow',
      i18nKey: 'route.btc-course-flow',
      hideInMenu: true
    }
  },
  {
    name: 'effects-generator',
    path: '/effects-generator',
    component: 'layout.base$view.effects-generator',
    meta: {
      title: 'effects-generator',
      i18nKey: 'route.effects-generator',
      hideInMenu: true
    }
  },
  {
    name: 'home',
    path: '/home',
    component: 'layout.base$view.home',
    meta: {
      title: 'home',
      i18nKey: 'route.home',
      icon: 'mdi:monitor-dashboard',
      order: 1,
      guestAccessible: true
    }
  },
  {
    name: 'iframe-page',
    path: '/iframe-page/:url',
    component: 'layout.base$view.iframe-page',
    props: true,
    meta: {
      title: 'iframe-page',
      i18nKey: 'route.iframe-page',
      constant: true,
      hideInMenu: true,
      keepAlive: true
    }
  },
  {
    name: 'image-compressor',
    path: '/image-compressor',
    component: 'layout.base$view.image-compressor',
    meta: {
      title: 'image-compressor',
      i18nKey: 'route.image-compressor',
      hideInMenu: true
    }
  },
  {
    name: 'image-matting',
    path: '/image-matting',
    component: 'layout.base$view.image-matting',
    meta: {
      title: 'image-matting',
      i18nKey: 'route.image-matting',
      hideInMenu: true
    }
  },
  {
    name: 'locked',
    path: '/locked',
    component: 'layout.base$view.locked',
    meta: {
      title: 'locked',
      i18nKey: 'route.locked',
      constant: true,
      hideInMenu: true
    }
  },
  {
    name: 'login',
    path: '/login/:module(pwd-login|code-login|register|reset-pwd|bind-wechat)?',
    component: 'layout.blank$view.login',
    props: true,
    meta: {
      title: 'login',
      i18nKey: 'route.login',
      constant: true,
      hideInMenu: true
    }
  },
  {
    name: 'material-studio',
    path: '/material-studio',
    component: 'layout.base$view.material-studio',
    meta: {
      title: 'material-studio',
      i18nKey: 'route.material-studio',
      hideInMenu: true
    }
  },
  {
    name: 'qrcode-generator',
    path: '/qrcode-generator',
    component: 'layout.base$view.qrcode-generator',
    meta: {
      title: 'qrcode-generator',
      i18nKey: 'route.qrcode-generator',
      hideInMenu: true
    }
  },
  {
    name: 'quick-links',
    path: '/quick-links',
    component: 'layout.base$view.quick-links',
    meta: {
      title: 'quick-links',
      i18nKey: 'route.quick-links',
      hideInMenu: true
    }
  },
  {
    name: 'role-manager',
    path: '/role-manager',
    component: 'layout.base$view.role-manager',
    meta: {
      title: 'role-manager',
      i18nKey: 'route.role-manager',
      hideInMenu: true
    }
  },
  {
    name: 'sb3-compressor',
    path: '/sb3-compressor',
    component: 'layout.base$view.sb3-compressor',
    meta: {
      title: 'sb3-compressor',
      i18nKey: 'route.sb3-compressor',
      hideInMenu: true
    }
  },
  {
    name: 'sb3-studio',
    path: '/sb3-studio',
    component: 'layout.base$view.sb3-studio',
    meta: {
      title: 'sb3-studio',
      i18nKey: 'route.sb3-studio',
      hideInMenu: true
    }
  },
  {
    name: 'timestamp-converter',
    path: '/timestamp-converter',
    component: 'layout.base$view.timestamp-converter',
    meta: {
      title: 'timestamp-converter',
      i18nKey: 'route.timestamp-converter',
      hideInMenu: true
    }
  },
  {
    name: 'tts-studio',
    path: '/tts-studio',
    component: 'layout.base$view.tts-studio',
    meta: {
      title: 'tts-studio',
      i18nKey: 'route.tts-studio',
      hideInMenu: true
    }
  },
  {
    name: 'user-manager',
    path: '/user-manager',
    component: 'layout.base$view.user-manager',
    meta: {
      title: 'user-manager',
      i18nKey: 'route.user-manager',
      hideInMenu: true
    }
  },
  {
    name: 'video-frame-extractor',
    path: '/video-frame-extractor',
    component: 'layout.base$view.video-frame-extractor',
    meta: {
      title: 'video-frame-extractor',
      i18nKey: 'route.video-frame-extractor',
      hideInMenu: true
    }
  }
];
