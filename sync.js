/* =====================================================================
 * sync.js — SyncEngine（云端同步引擎，Phase③ 启用）
 * ---------------------------------------------------------------------
 *  - 依赖全局：window.tcb（tcb-js-sdk）、window.CLOUD（cloud.config.js）、Auth
 *  - push(state)：fire-and-forget，防抖后调用 syncPush 云函数（含 token）
 *  - pull()    ：调用 syncPull，返回 { todos,reviews,weeklies,reminders,notes,settings }
 *  - 未登录（Auth.enabled=false）→ 退化为纯本地，不触网
 *  - 网络/鉴权失败仅告警，本地数据不受影响（离线优先）
 * storage.js 的 save()→push()、load()→pull()+StorageAdapter.mergeRemote() 已对接
 * ===================================================================== */
"use strict";

const SyncEngine = {
  enabled: false,
  lastSync: 0,
  _app: null,
  _token: null,
  _pushTimer: null,

  init() {
    /* enabled/_app/_token 已由 Auth.init() 注入；这里做兜底同步 */
    if (typeof Auth !== "undefined" && Auth.enabled && Auth._app) {
      this.enabled = true; this._app = Auth._app; this._token = Auth._token;
    }
  },

  async push(snapshot) {
    if (!this.enabled || !this._app) return;
    const state = snapshot || window.state;
    if (!state) return;
    const payload = {
      token: this._token,
      state: {
        todos: state.todos || [],
        reviews: state.reviews || [],
        weeklies: state.weeklies || [],
        reminders: state.reminders || [],
        notes: state.notes || [],
        settings: Object.assign({}, window.settings || {}, { updatedAt: Date.now() })
      }
    };
    /* 轻量防抖，合并短时多次 save */
    if (this._pushTimer) clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => {
      this._pushTimer = null;
      this._doPush(payload);
    }, 600);
  },

  async _doPush(payload) {
    try {
      const r = await this._app.callFunction({ name: "syncPush", data: payload });
      const res = (r && r.result) || r || {};
      if (res && res.code === 0) { this.lastSync = res.serverTime || Date.now(); updateSyncBadge(); }
      else if (res && res.code === 401) this._onAuthFail();
      else console.warn("[sync] push 返回异常", res);
    } catch (e) { console.warn("[sync] push 失败（保留本地，下次再试）", e); }
  },

  async pull() {
    if (!this.enabled || !this._app) return null;
    try {
      const r = await this._app.callFunction({ name: "syncPull", data: { token: this._token } });
      const res = (r && r.result) || r || {};
      if (!res || res.code !== 0) {
        if (res && res.code === 401) this._onAuthFail();
        console.warn("[sync] pull 返回异常", res);
        return null;
      }
      this.lastSync = res.serverTime || Date.now();
      const items = res.items || {};
      return {
        todos: items.todos || [], reviews: items.reviews || [],
        weeklies: items.weeklies || [], reminders: items.reminders || [],
        notes: items.notes || [], settings: res.settings || null
      };
    } catch (e) { console.warn("[sync] pull 失败", e); return null; }
  },

  _onAuthFail() {
    console.warn("[sync] 登录态失效，已退化为本地模式，请重新登录");
    if (typeof Auth !== "undefined") Auth.logout();
    updateSyncBadge();
  }
};

/* 顶部 badges：本地存储 / 已同步·云端 */
function updateSyncBadge() {
  const badge = document.getElementById("storeBadge");
  if (!badge) return;
  if (SyncEngine.enabled) {
    badge.textContent = "已同步·云端";
    badge.style.background = "#e7f1ff"; badge.style.color = "#1d4ed8"; badge.style.borderColor = "#bcd3ff";
  } else {
    badge.textContent = "本地存储";
    badge.style.background = ""; badge.style.color = ""; badge.style.borderColor = "";
  }
}
