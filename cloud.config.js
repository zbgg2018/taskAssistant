/* =====================================================================
 * cloud.config.js — 在线版云环境配置（部署前改这里）
 * ---------------------------------------------------------------------
 *  - envId：在 CloudBase 控制台「环境」页复制环境 ID 填入
 *  - enabled：false 时整体退化为纯本地（等同离线版，不触网）
 * 前置条件：已将 online/ 静态托管到 CloudBase，且已部署 auth/syncPush/syncPull 三个云函数
 *           （见 cloudbase/cloudbaserc.json 与对话中的控制台搭建步骤）
 * ===================================================================== */
window.CLOUD = {
  envId: "mydesk-d5gq93fa0da98c717",   // ← 改成你的 CloudBase 环境 ID
  enabled: true
};
