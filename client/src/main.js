import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router/index.js';
import App from './App.vue';

// 导入设计系统
import './shared/design-tokens.css';

const app = createApp(App);

// 注册插件
app.use(createPinia());
app.use(router);

// 挂载
app.mount('#app');
