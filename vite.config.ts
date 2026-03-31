import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { setupVitePlugins } from './build/plugins';
import { createViteProxy, getBuildTime } from './build/config';

export default defineConfig(configEnv => {
  const viteEnv = loadEnv(configEnv.mode, process.cwd()) as unknown as Env.ImportMeta;

  const buildTime = getBuildTime();

  const enableProxy = configEnv.command === 'serve' && !configEnv.isPreview;

  return {
    base: viteEnv.VITE_BASE_URL,
    resolve: {
      alias: {
        '~': fileURLToPath(new URL('./', import.meta.url)),
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          additionalData: `@use "@/styles/scss/global.scss" as *;`
        }
      }
    },
    plugins: setupVitePlugins(viteEnv, buildTime),
    define: {
      BUILD_TIME: JSON.stringify(buildTime)
    },
    server: {
      host: '0.0.0.0',
      port: 9527,
      open: true,
      proxy: {
        // Nautilus Express 后端 API 代理
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        // Qwen3 TTS Gradio 服务代理（剥离 iframe 限制头）
        '/tts-proxy': {
          target: 'http://10.64.128.6:8000',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/tts-proxy/, ''),
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              // 删除阻止 iframe 嵌入的响应头
              delete proxyRes.headers['x-frame-options'];
              delete proxyRes.headers['content-security-policy'];
            });
          }
        },
        // Soybean Admin 原有代理（Mock / 其他服务）
        ...(createViteProxy(viteEnv, enableProxy) || {})
      }
    },
    preview: {
      port: 9725
    },
    build: {
      reportCompressedSize: false,
      sourcemap: viteEnv.VITE_SOURCE_MAP === 'Y',
      commonjsOptions: {
        ignoreTryCatch: false
      }
    }
  };
});
