# Nautilus 部署待办 — 阿里云 ECS

> 创建时间：2026-03-30
> 状态：待启动

## 前置准备

- [ ] 购买/确认阿里云 ECS 实例（建议 2C4G 起步）
- [ ] 安全组开放端口：80（HTTP）、443（HTTPS）、22（SSH）
- [ ] ECS 安装 Docker + Docker Compose
- [ ] （可选）准备域名并完成备案

## 方案选择

### 方案 A：Docker + 手动部署（推荐起步）

> 每次更新在 ECS 上执行 `git pull && docker compose up -d --build`

- [ ] 编写 `Dockerfile`（Node.js 多阶段构建：前端 build + 后端运行）
- [ ] 编写 `docker-compose.yml`（含环境变量配置）
- [ ] 编写 `nginx.conf`（反向代理 + 静态文件服务）
- [ ] 修复 `server/index.js` 中生产模式静态文件路径（`client/dist` → `dist`）
- [ ] ECS 上 `git clone` 项目并首次部署验证

### 方案 B：Docker + GitHub Actions 自动部署（进阶）

> push 代码自动部署，无需 SSH 操作

- [ ] 在 GitHub 仓库 Settings → Secrets 中配置加密凭证：
  - `ECS_HOST`（服务器 IP）
  - `ECS_USER`（登录用户，一般为 root）
  - `ECS_SSH_KEY`（SSH 私钥，非密码）
- [ ] 编写 `.github/workflows/deploy.yml` 自动化流程
- [ ] 测试 push → 自动部署流程

## 注意事项

| 关注点 | 说明 |
|---|---|
| **better-sqlite3** | C++ 原生模块，需在 Linux 环境重新编译（Docker 构建时自动处理） |
| **环境变量** | 生产环境通过 `docker-compose.yml` 注入，无需在服务器创建 `.env` 文件 |
| **数据持久化** | SQLite 数据库文件需通过 Docker Volume 挂载，防止容器重启丢失数据 |
| **HTTPS** | 可通过 Nginx + Let's Encrypt 免费配置，或使用阿里云 CDN/SLB |
| **GitHub Secrets 安全性** | 加密存储、不可查看、不进代码、日志自动脱敏，业界标准做法 |
