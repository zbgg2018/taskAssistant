/* =====================================================================
 * storage.js — StorageAdapter（唯一改动接缝）
 * ---------------------------------------------------------------------
 * 职责：
 *  - 持久化 state：localStorage(同步) + 本地文件(IndexedDB 句柄, 防抖异步)
 *  - 云端同步：启用时 save→SyncEngine.push（fire-and-forget）、load→SyncEngine.pull（LWW 合并）
 *  - 对外暴露 save()/load()，业务模块零改动（Phase②③ 仅此一层不同）
 * 注意：本文件只依赖全局 state（core.js 等运行时已就绪），不读取其它文件的顶层 let/const。
 * ===================================================================== */
"use strict";

const KEY_BASE = "wb_gzt_data";
const SETTINGS_KEY_BASE = "wb_gzt_settings";

/* 获取当前用户的 localStorage key（未登录时用默认 key） */
function getDataKey() {
  const uid = (typeof Auth !== "undefined" && Auth.enabled && Auth.user && Auth.user.uid) || "";
  return uid ? (KEY_BASE + "_" + uid) : KEY_BASE;
}
function getSettingsKey() {
  const uid = (typeof Auth !== "undefined" && Auth.enabled && Auth.user && Auth.user.uid) || "";
  return uid ? (SETTINGS_KEY_BASE + "_" + uid) : SETTINGS_KEY_BASE;
}
function getSettingsKey() {
  const uid = (typeof Auth !== "undefined" && Auth.enabled && Auth.user && Auth.user.uid) || "";
  return uid ? (SETTINGS_KEY_BASE + "_" + uid) : SETTINGS_KEY_BASE;
}

/* 默认 state（load 时会整体覆盖） */
let state = { todos: [], reviews: [], weeklies: [], reminders: [], notes: [], meta: { sample: true } };

/* 个性化设置（app.js 读写，core/todos 读取 settings.categories） */
let settings = { userName: "", pageSize: 8, categories: ["工作", "生活"] };
let pageSize = 8;

/* 本地文件自动备份句柄状态 */
let boundHandle = null;
let autoFileOn = false;

/* 迁移：旧版「阶段工作」并入「待办任务」+ 清理遗留「项目评估」 */
function migrate(d) {
  if (Array.isArray(d.keyworks)) {
    d.keyworks.forEach(k => {
      state.todos.push({ id: k.id || uid(), content: k.title || "", start: k.start || todayStr(), end: k.end || todayStr(), priority: "中", done: false, note: k.note || "", createdAt: k.createdAt || Date.now(), sample: k.sample });
    });
    delete state.keyworks;
  }
  if (!state.meta._cleanedEval) {
    state.todos = state.todos.filter(x => !(x.content || "").includes("项目评估"));
    state.meta._cleanedEval = true;
  }
  if (!Array.isArray(state.notes)) state.notes = [];
  if (Array.isArray(state.todos)) state.todos.forEach(function (x) { if (!x.category) x.category = "工作"; });
}

/* ---------- 本地文件自动备份：FileSystemFileHandle + IndexedDB 持久化句柄 ---------- */
const FSDB = "wb_gzt_fs", FSSTORE = "handle";
function fsOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(FSDB);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(FSSTORE)) r.result.createObjectStore(FSSTORE); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function fsGet() {
  return new Promise((res, rej) => {
    fsOpen().then(db => {
      const t = db.transaction(FSSTORE, "readonly");
      const rq = t.objectStore(FSSTORE).get("cur");
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => rej(rq.error);
    }).catch(rej);
  });
}
function fsPut(h) {
  return new Promise((res, rej) => {
    fsOpen().then(db => {
      const t = db.transaction(FSSTORE, "readwrite");
      t.objectStore(FSSTORE).put(h, "cur");
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    }).catch(rej);
  });
}
function fsDel() {
  return new Promise((res, rej) => {
    fsOpen().then(db => {
      const t = db.transaction(FSSTORE, "readwrite");
      t.objectStore(FSSTORE).delete("cur");
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    }).catch(rej);
  });
}
async function writeHandle(h, text) { const w = await h.createWritable(); await w.write(text); await w.close(); }
async function readHandle(h) { const f = await h.getFile(); return await f.text(); }

/* ---------- 加载：本地优先 + 云端合并（云端启用时） ---------- */
async function load() {
  const key = getDataKey();
  const raw = localStorage.getItem(key);
  let fromLS = false;
  if (raw) {
    try {
      const d = JSON.parse(raw);
      state = Object.assign({ todos: [], reviews: [], weeklies: [], reminders: [], notes: [], meta: { sample: false } }, d);
      migrate(d);
      fromLS = true;
    } catch (e) { }
  }
  let h = null;
  try { h = await fsGet(); } catch (e) { }
  if (h) {
    boundHandle = h; autoFileOn = true;
    if (!fromLS) {
      try {
        const c = await readHandle(h);
        const d = JSON.parse(c);
        state = Object.assign({ todos: [], reviews: [], weeklies: [], reminders: [], notes: [], meta: { sample: false } }, d);
        migrate(d);
      } catch (e) { seed(); }
    }
  }
  if (!fromLS && !boundHandle) seed();

  /* 云端合并（Phase③ 启用）：拉取服务端快照，按 LWW(updatedAt) 合并到本地 */
  if (typeof SyncEngine !== "undefined" && SyncEngine.enabled) {
    try {
      const remote = await SyncEngine.pull();
      if (remote) {
        state = StorageAdapter.mergeRemote(state, remote);
        /* 同步账号级设置（userName/pageSize/categories），个人场景最后写入者胜出 */
        if (remote.settings) {
          const rs = remote.settings;
          if (rs.userName !== undefined) settings.userName = rs.userName;
          if (rs.pageSize !== undefined) { settings.pageSize = rs.pageSize; pageSize = rs.pageSize || 8; }
          if (Array.isArray(rs.categories) && rs.categories.length) settings.categories = rs.categories;
          try { localStorage.setItem(getSettingsKey(), JSON.stringify(settings)); } catch (e) { }
        }
      }
    } catch (e) { console.warn("[sync] pull 失败，已回退本地数据", e); }
  }

  save();
}

/* ---------- 保存：localStorage 同步写 + 文件防抖 + 云端推送 ---------- */
function save() {
  const key = getDataKey();
  localStorage.setItem(key, JSON.stringify(state));
  refreshWarn();
  scheduleFileSave();
  /* 云端推送（Phase③ 启用）：fire-and-forget，不阻塞业务 */
  if (typeof SyncEngine !== "undefined" && SyncEngine.enabled) {
    SyncEngine.push(state).catch(e => console.warn("[sync] push 失败", e));
  }
}

function seed() {
  // 首次使用时初始化为空数据（示例数据已移除）
  state = {
    todos: [],
    reviews: [],
    weeklies: [],
    reminders: [],
    notes: [],
    meta: { sample: false }
  };
}

/* ---------- 自动备份节流 ---------- */
let _saveFileTimer = null;
const _SAVE_FILE_DELAY = 1500;
function scheduleFileSave() {
  if (!autoFileOn || !boundHandle) return;
  if (_saveFileTimer) clearTimeout(_saveFileTimer);
  _saveFileTimer = setTimeout(function () {
    _saveFileTimer = null;
    writeHandle(boundHandle, JSON.stringify(state)).catch(function (e) { console.warn("自动写回本地文件失败：", e); });
  }, _SAVE_FILE_DELAY);
}
function flushFileSave() {
  if (_saveFileTimer && autoFileOn && boundHandle) {
    clearTimeout(_saveFileTimer);
    _saveFileTimer = null;
    writeHandle(boundHandle, JSON.stringify(state)).catch(function (e) { });
  }
}
window.addEventListener("beforeunload", flushFileSave);
document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flushFileSave(); });

/* ---------- 合并导入 / 云端合并 ---------- */
function mergeSnapshotInto(cur, imp) {
  var out = {
    todos: cur.todos.slice(),
    reviews: cur.reviews.slice(),
    weeklies: cur.weeklies.slice(),
    reminders: cur.reminders.slice(),
    notes: cur.notes.slice(),
    meta: Object.assign({}, cur.meta, { sample: false })
  };
  var addMissing = function (a, b) {
    if (!Array.isArray(b)) return;
    var ids = {}; a.forEach(function (x) { if (x && x.id) ids[x.id] = 1; });
    b.forEach(function (x) { if (x && x.id && !ids[x.id]) a.push(x); });
  };
  addMissing(out.todos, imp.todos);
  addMissing(out.reviews, imp.reviews);
  addMissing(out.weeklies, imp.weeklies);
  addMissing(out.reminders, imp.reminders);
  addMissing(out.notes, imp.notes);
  return out;
}

/* StorageAdapter：统一对外 + 云端合并策略（LWW by updatedAt） */
const StorageAdapter = {
  KEY: getDataKey(),
  save: save,
  load: load,
  /* 将 remote 快照合并入 local：同 id 取 updatedAt 较大者；remote 的 deleted 标记软删除 */
  mergeRemote: function (local, remote) {
    const arrNames = ["todos", "reviews", "weeklies", "reminders", "notes"];
    const out = { meta: Object.assign({}, local.meta, { sample: false }) };
    arrNames.forEach(function (name) {
      const L = local[name] || [];
      const R = remote[name] || [];
      const map = {};
      L.forEach(x => { if (x && x.id) map[x.id] = Object.assign({}, x); });
      R.forEach(x => {
        if (!x || !x.id) return;
        if (x.deleted) { delete map[x.id]; return; }
        const cur = map[x.id];
        if (!cur || (x.updatedAt || 0) >= (cur.updatedAt || 0)) map[x.id] = Object.assign({}, x);
      });
      out[name] = Object.keys(map).map(k => map[k]);
    });
    return out;
  }
};
