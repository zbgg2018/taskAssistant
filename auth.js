/* =====================================================================
 * auth.js — Auth（自研 Token 鉴权客户端封装）
 * ---------------------------------------------------------------------
 *  - 依赖全局：window.tcb（tcb-js-sdk，由 index.html 的 CDN <script> 注入）
 *             window.CLOUD（cloud.config.js）
 *  - 登录：调用 auth 云函数 → 拿到 token → 存 localStorage；不依赖 CloudBase 内置登录
 *  - 恢复：init() 读取本地 token，本地校验未过期即视为已登录（无需联网）
 *  - 未启用云（CLOUD.enabled=false 或 tcb 未加载）时：enabled=false，纯本地模式
 * 业务层通过 Auth.enabled / Auth.currentUser() 判断，storage.js 据此决定是否触发同步
 * ===================================================================== */
"use strict";

const Auth = {
  enabled: false,
  user: null,          // { uid, username }
  _app: null,
  _auth: null,         // CloudBase 匿名登录实例（调云函数的"门票"）
  _token: null,
  _initError: "",      // 云初始化失败原因（登录时给出准确提示）

  async init() {
    this.enabled = false; this.user = null; this._app = null; this._token = null; this._initError = "";
    /* 2.x SDK 全局变量是 cloudbase；旧 tcb-js-sdk（1.x）是 tcb，已被 CloudBase 停用（ACCESS_TOKEN_DISABLED） */
    const sdk = window.cloudbase || window.tcb;
    if (!window.CLOUD || !window.CLOUD.enabled || !window.CLOUD.envId || !sdk) {
      this._initError = "cloudbase-js-sdk 未加载（检查网络能否访问 static.cloudbase.net）";
      console.info("[auth] 云未启用（CLOUD.enabled=false 或 cloudbase-js-sdk 未加载），使用纯本地模式");
      return;
    }
    try {
      this._app = sdk.init({ env: window.CLOUD.envId });
    } catch (e) {
      this._initError = "tcb.init 失败：" + (e.message || e);
      console.warn("[auth] " + this._initError, e);
      return;
    }
    /* CloudBase 客户端调云函数前必须先有登录态，否则 callFunction 报
       "Cannot read properties of undefined (reading 'send')"。
       业务鉴权仍用我们自己的 token（云函数内校验），这里只做匿名"门票"。
       前置条件：控制台「认证 → 登录方式」中已开启「匿名登录」。 */
    try {
      this._auth = this._app.auth({ persistence: "local" });
      if (typeof this._auth.hasLoginState !== "function" || !this._auth.hasLoginState()) {
        await this._auth.signInAnonymously();
      }
    } catch (e) {
      this._initError = "CloudBase 匿名登录失败：" + (e.message || e) + "（请到控制台「认证 → 登录方式」开启匿名登录）";
      console.warn("[auth] " + this._initError, e);
      this._app = null;
      return;
    }
    // 尝试用本地 token 恢复登录态（仅做过期校验，不联网）
    try {
      const raw = localStorage.getItem("wb_gzt_token");
      if (raw) {
        const p = JSON.parse(atob(raw.split(".")[0]));
        if (p && p.uid && (!p.exp || Date.now() <= p.exp)) {
          this._token = raw;
          this.user = { uid: p.uid, username: p.username || "" };
          this.enabled = true;
          if (window.SyncEngine) { SyncEngine.enabled = true; SyncEngine._app = this._app; SyncEngine._token = raw; }
        } else {
          localStorage.removeItem("wb_gzt_token");
        }
      }
    } catch (e) { try { localStorage.removeItem("wb_gzt_token"); } catch (e2) { } }
  },

  async login(username, password) {
    if (!this._app) throw new Error(this._initError || "云环境未就绪");
    const r = await this._app.callFunction({ name: "auth", data: { action: "login", username: username, password: password } });
    const res = (r && r.result) || r || {};
    if (res.code !== 0 || !res.token) throw new Error(res.msg || "登录失败");
    this._token = res.token;
    this.user = { uid: res.uid, username: username };
    this.enabled = true;
    try { localStorage.setItem("wb_gzt_token", res.token); } catch (e) { }
    if (window.SyncEngine) { SyncEngine.enabled = true; SyncEngine._app = this._app; SyncEngine._token = res.token; }
    return this.user;
  },

  logout() {
    this._token = null; this.user = null; this.enabled = false;
    if (window.SyncEngine) { SyncEngine.enabled = false; SyncEngine._token = null; }
    try { localStorage.removeItem("wb_gzt_token"); } catch (e) { }
  },

  currentUser() { return this.user; }
};
