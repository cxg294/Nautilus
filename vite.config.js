import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],

  // 前端代码根目录
  root: './client',

  // 路径别名
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
    },
  },

  // 开发服务器配置
  server: {
    port: 5173,
    // API 请求代理到后端
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  // 构建输出
  build: {
    outDir: '../client/dist',
    emptyOutDir: true,
  },
});
