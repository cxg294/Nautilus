import type { App } from 'vue';
import { createI18n } from 'vue-i18n';
import { localStg } from '@/utils/storage';
import { getPluginI18n } from '@/router/plugin-scanner';
import messages from './locale';

// 合并插件的 i18n 翻译到消息对象
const pluginI18n = getPluginI18n();
for (const [lang, data] of Object.entries(pluginI18n)) {
  const langKey = lang as App.I18n.LangType;
  if (messages[langKey]) {
    // 将插件的 route 翻译合并到全局 route 翻译中
    Object.assign(messages[langKey].route, data.route);
  }
}

const i18n = createI18n({
  locale: localStg.get('lang') || 'zh-CN',
  fallbackLocale: 'en',
  messages,
  legacy: false
});

/**
 * Setup plugin i18n
 *
 * @param app
 */
export function setupI18n(app: App) {
  app.use(i18n);
}

export const $t = i18n.global.t as App.I18n.$T;

export function setLocale(locale: App.I18n.LangType) {
  i18n.global.locale.value = locale;

  document?.querySelector('html')?.setAttribute('lang', locale);
}

export function getLocale(): App.I18n.LangType {
  return i18n.global.locale.value as App.I18n.LangType;
}
