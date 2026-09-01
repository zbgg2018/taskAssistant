# 任务助手 · 在线版（Task Assistant — Online）

基于腾讯云 CloudBase 的在线版个人效率工具。功能与离线版（单文件 HTML `mydesktop.html`）一致：待办、复盘、总结、提醒、随笔，支持**多设备云端同步**、Web 通知、外观方案自定义（舒适 / 护眼 / 夜间 / 传统宋体 / 大字号）。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `index.html` / `app.js` / `core.js` / `styles.css` | 前端主程序 |
| `modules/` | 各模块逻辑（todos / reviews / weeklies / reminders / notes） |
| `storage.js` / `sync.js` / `auth.js` | 本地存储、云端同步、登录鉴权 |
| `sw.js` / `manifest.webmanifest` / `launch.html` / `icon.svg` | PWA 与入口 |
| `cloud.config.js` | 云环境配置（envId） |
| `cloudbase/` | 云函数源码（auth / syncPush / syncPull） |

## 部署

1. **静态托管**：在 `online/` 目录执行 `tcb hosting deploy -e <envId> .`（需腾讯云 CloudBase CLI 并登录）。
2. **云函数**：在 `online/cloudbase/` 目录部署 `auth`、`syncPush`、`syncPull` 三个函数；并在 CloudBase 控制台：
   - 为三个函数开启**安全规则 `{"invoke": true}`**；
   - 开启**匿名登录**；
   - 将站点域名加入 **Web 安全域名白名单**。

## 密钥说明（重要）

- `cloudbase/cloudbaserc.json` **不入库**（已在 `.gitignore` 中），因为它包含 `AUTH_SECRET`。
- 请以 `cloudbase/cloudbaserc.example.json` 为模板，**自行生成 `AUTH_SECRET`** 并填入本地的 `cloudbaserc.json`，或在 CloudBase 控制台的函数环境变量中设置 `AUTH_SECRET`（三个函数需保持一致）。
- `cloud.config.js` 中的 `envId` 需替换为你的 CloudBase 环境 ID。

## 本地开发

- 直接用现代 Chrome / Edge 打开 `index.html` 即可使用（部分能力如「绑定本地文件」需较新浏览器）。
- 或起本地服务：`python -m http.server 8000`，再访问 `http://localhost:8000/`。
