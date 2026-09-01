/* =====================================================================
 * app.js — 设置 / 备份恢复 / 导航 / 模态框 / 初始化
 * 依赖全局：state/settings/pageSize(save/storage)、各模块渲染与操作函数
 * 本文件在所有模块之后加载，负责把 DOM 事件与业务逻辑接起来，并启动初始化。
 * ===================================================================== */
"use strict";

/* ---------- 个性化设置（按用户隔离） ---------- */
function getSettingsKey() {
  var uid = (typeof Auth !== "undefined" && Auth.enabled && Auth.user && Auth.user.uid) || "";
  return uid ? ("wb_gzt_settings_" + uid) : "wb_gzt_settings";
}

/* ---------- 外观/字体方案（字体·字号·背景色预设，按用户隔离） ---------- */
var THEMES = {
  default: { name: "舒适（默认）", font: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif', zoom: 1, vars: { "--bg": "#f5f7fb", "--card": "#ffffff", "--text": "#1f2937", "--muted": "#6b7280", "--border": "#e5e7eb" } },
  eye: { name: "护眼（米黄）", font: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif', zoom: 1, vars: { "--bg": "#f3efe3", "--card": "#fbf9f2", "--text": "#3a3327", "--muted": "#8a7f66", "--border": "#e3dcc7" } },
  dark: { name: "夜间（深色）", font: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif', zoom: 1, vars: { "--bg": "#1e1f24", "--card": "#2a2c33", "--text": "#e5e7eb", "--muted": "#9aa0aa", "--border": "#3a3d45" } },
  serif: { name: "传统（宋体）", font: '"Songti SC","SimSun","Noto Serif SC",serif', zoom: 1, vars: { "--bg": "#f5f7fb", "--card": "#ffffff", "--text": "#1f2937", "--muted": "#6b7280", "--border": "#e5e7eb" } },
  large: { name: "大字号", font: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif', zoom: 1.18, vars: { "--bg": "#f5f7fb", "--card": "#ffffff", "--text": "#1f2937", "--muted": "#6b7280", "--border": "#e5e7eb" } }
};
var currentThemeKey = "default";
function applyFontScheme(key) {
  if (!document.body) return;
  var th = THEMES[key] || THEMES.default;
  var root = document.documentElement;
  for (var k in th.vars) { if (Object.prototype.hasOwnProperty.call(th.vars, k)) root.style.setProperty(k, th.vars[k]); }
  document.body.style.fontFamily = th.font;
  document.body.style.zoom = th.zoom;
  currentThemeKey = key;
}
function persistTheme() {
  try { localStorage.setItem(getSettingsKey(), JSON.stringify(settings)); } catch (e) { }
}
function buildThemeBtns() {
  var box = document.getElementById("themeBtns"); if (!box) return;
  box.innerHTML = "";
  Object.keys(THEMES).forEach(function (key) {
    var th = THEMES[key];
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = th.name;
    b.dataset.theme = key;
    b.style.cssText = "font-size:13px;padding:6px 12px;border-radius:999px;border:1px solid var(--border);background:#fff;color:var(--text);cursor:pointer";
    b.onclick = function () { settings.theme = key; applyFontScheme(key); persistTheme(); highlightThemeBtns(); };
    box.appendChild(b);
  });
  highlightThemeBtns();
}
function highlightThemeBtns() {
  var box = document.getElementById("themeBtns"); if (!box) return;
  var cur = settings.theme || currentThemeKey || "default";
  box.querySelectorAll("button").forEach(function (b) {
    if (b.dataset.theme === cur) { b.style.background = "var(--primary)"; b.style.color = "#fff"; b.style.borderColor = "var(--primary)"; }
    else { b.style.background = "#fff"; b.style.color = "var(--text)"; b.style.borderColor = "var(--border)"; }
  });
}
function loadSettings() {
  try {
    var raw = localStorage.getItem(getSettingsKey());
    if (raw) {
      var d = JSON.parse(raw);
      settings = Object.assign({ userName: "", pageSize: 8, categories: ["工作", "生活"] }, d);
      if (!Array.isArray(settings.categories) || !settings.categories.length) settings.categories = ["工作", "生活"];
    }
  } catch (e) { }
  pageSize = settings.pageSize || 8;
  if (!settings.theme || !THEMES[settings.theme]) settings.theme = "default";
  applyFontScheme(settings.theme);
  /* 迁移：早期版本曾把"使用人"误存为旧应用名"个人工作台"，
     会被拼成"个人工作台-任务助手"误导用户。该值非真实用户名，自动清空并写回。 */
  if (settings.userName === "个人工作台") {
    settings.userName = "";
    try { localStorage.setItem(getSettingsKey(), JSON.stringify(settings)); } catch (e) { }
  }
}
function saveSettings() {
  var name = (document.getElementById("userNameInput").value || "").trim().slice(0, 20);
  var ps = parseInt(document.getElementById("pageSizeInput").value, 10);
  if (isNaN(ps) || ps < 3) ps = 3; if (ps > 50) ps = 50;
  collectCategorySettings();
  settings = { userName: name, pageSize: ps, categories: settings.categories, theme: settings.theme || currentThemeKey || "default" };
  localStorage.setItem(getSettingsKey(), JSON.stringify(settings));
  var oldSize = pageSize;
  pageSize = ps;
  applyTitle();
  if (oldSize !== ps) { todoPage = 1; todayPage = 1; renderTodo(); renderToday(); }
  renderCategorySelect();
  showSaveToast();
}
function applyTitle() {
  var t = settings.userName ? (settings.userName + '-任务助手') : '任务助手';
  document.title = t;
  var h1 = document.querySelector('.topbar h1');
  if (h1) {
    for (var i = h1.childNodes.length - 1; i >= 0; i--) { if (h1.childNodes[i].nodeType === 3) h1.removeChild(h1.childNodes[i]); }
    h1.appendChild(document.createTextNode(' ' + t));
  }
}
function fillSettingsForm() {
  var ui = document.getElementById('userNameInput'); if (ui) ui.value = settings.userName || '';
  var pi = document.getElementById('pageSizeInput'); if (pi) pi.value = pageSize;
  renderCategorySettings();
  buildThemeBtns();
}
function renderCategorySelect() {
  var sel = document.getElementById('todoCategory');
  if (!sel) return;
  sel.innerHTML = '';
  (settings.categories || []).forEach(function (cat) {
    var o = document.createElement('option'); o.value = cat; o.textContent = cat; sel.appendChild(o);
  });
}
function renderCategorySettings() {
  var box = document.getElementById('categoryList');
  if (!box) return;
  box.innerHTML = '';
  (settings.categories || []).forEach(function (cat, i) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
    var inp = document.createElement('input');
    inp.type = 'text'; inp.value = cat; inp.maxLength = 10; inp.dataset.idx = String(i);
    inp.style.cssText = 'flex:1;padding:5px 10px;font-size:13px;border:1px solid var(--border);border-radius:6px';
    var del = document.createElement('button');
    del.className = 'btn sm danger'; del.textContent = '删除'; del.style.cssText = 'min-height:30px;padding:0 10px;font-size:12px';
    del.onclick = function () { settings.categories.splice(i, 1); renderCategorySettings(); };
    row.appendChild(inp); row.appendChild(del); box.appendChild(row);
  });
  var add = document.createElement('button');
  add.className = 'btn sm ghost'; add.textContent = '+ 添加分类'; add.style.css = 'margin-top:4px';
  add.onclick = function () {
    var v = (prompt('输入新分类名（最多10个字）') || '').trim().slice(0, 10);
    if (!v) return;
    if (settings.categories.indexOf(v) >= 0) { alert('分类已存在'); return; }
    settings.categories.push(v); renderCategorySettings();
  };
  box.appendChild(add);
}
function collectCategorySettings() {
  var box = document.getElementById('categoryList');
  if (!box) return;
  var inputs = box.querySelectorAll('input[data-idx]');
  var arr = [];
  inputs.forEach(function (inp) { var v = (inp.value || '').trim(); if (v) arr.push(v.slice(0, 10)); });
  if (!arr.length) arr = ['工作', '生活'];
  settings.categories = arr;
}
function showSaveToast() {
  var old = document.getElementById('saveToast');
  if (old) old.remove();
  var t = document.createElement('div');
  t.id = 'saveToast';
  t.textContent = '✓ 设置已保存';
  t.style.cssText = 'position:fixed;left:50%;top:24px;transform:translateX(-50%);background:#0a7d33;color:#fff;padding:8px 18px;border-radius:8px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,.18);z-index:9999;opacity:0;transition:opacity .2s';
  document.body.appendChild(t);
  setTimeout(function () { t.style.opacity = '1'; }, 10);
  setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 250); }, 2200);
}

/* ---------- 本地文件备份状态 ---------- */
function updateFsUI() {
  const el = document.getElementById("fsStatus");
  const ub = document.getElementById("unbindFileBtn");
  const bb = document.getElementById("bindFileBtn");
  const badge = document.getElementById("storeBadge");
  if (autoFileOn && boundHandle) {
    el.textContent = "● 已绑定本地文件，自动备份开启：" + (boundHandle.name || "未知文件");
    el.style.color = "#0a7d33"; ub.style.display = ""; bb.style.display = "none";
    if (badge) { badge.textContent = "已绑定·自动备份"; badge.style.background = "#e7f8ee"; badge.style.color = "#0a7d33"; badge.style.borderColor = "#b6e6c8"; }
  } else {
    el.textContent = "○ 未绑定：数据仅存浏览器。建议「绑定本地文件」自动备份，或定期「导出 JSON 备份」。";
    el.style.color = "#0f62fe"; ub.style.display = "none"; bb.style.display = "";
    if (badge) { badge.textContent = "本地存储"; badge.style.background = ""; badge.style.color = ""; badge.style.borderColor = ""; }
  }
}

/* ---------- 备份弹窗 ---------- */
const toolsMask = document.getElementById("toolsMask");
document.getElementById("toolsBtn").onclick = () => { updateFsUI(); if (!toolsMask.classList.contains("show")) fillSettingsForm(); toolsMask.classList.add("show"); };
document.getElementById("saveSettingsBtn").onclick = saveSettings;
document.getElementById("closeTools").onclick = () => toolsMask.classList.remove("show");
toolsMask.onclick = e => { if (e.target === toolsMask) toolsMask.classList.remove("show"); };

document.getElementById("bindFileBtn").onclick = async () => {
  if (typeof window.showSaveFilePicker !== "function") {
    alert("当前环境不支持自动写回本地文件（需 Chrome/Edge，并通过 http://localhost 或 https 打开）。\n\n离线使用：在文件所在目录执行  python -m http.server 8000 ，再打开 http://localhost:8000/index.html\n\n也可继续使用「导出 JSON 备份」手动备份。");
    return;
  }
  try {
    const h = await window.showSaveFilePicker({ suggestedName: "任务助手数据.json", types: [{ description: "JSON 文件", accept: { "application/json": [".json"] } }] });
    boundHandle = h; autoFileOn = true; await fsPut(h); await writeHandle(h, JSON.stringify(state));
    updateFsUI(); toolsMask.classList.remove("show"); alert("已绑定本地文件，今后数据将自动保存到该文件（每次改动即时写回）。");
  } catch (e) { if (e && e.name !== "AbortError") alert("绑定失败：" + (e.message || e)); }
};
document.getElementById("unbindFileBtn").onclick = () => {
  askConfirm("解除绑定", "解除后不再自动写回文件，但文件已保存的数据仍在。确定？", async () => {
    autoFileOn = false; boundHandle = null; try { await fsDel(); } catch (e) { } updateFsUI(); toolsMask.classList.remove("show");
  });
};

document.getElementById("exportBtn").onclick = () => {
  var d = new Date();
  var stamp = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "_" + pad2(d.getHours()) + "-" + pad2(d.getMinutes()) + "-" + pad2(d.getSeconds());
  var snap = Object.assign({}, state, { meta: Object.assign({}, state.meta || {}, {}) });
  snap.meta._exportTime = d.toISOString();
  snap.meta._exportStamp = stamp;
  snap.meta._appName = "任务助手";
  snap.meta._kind = "gzt-snapshot";
  snap.meta._totalCount = totalCount();
  var blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
  var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "任务助手_" + stamp + ".json"; a.click(); URL.revokeObjectURL(a.href);
  state.meta = Object.assign({}, state.meta || {}, { _lastExportTime: new Date().toISOString(), _lastExportStamp: stamp });
  save(); refreshWarn();
  toolsMask.classList.remove("show");
};
const importFile = document.getElementById("importFile");
document.getElementById("importBtn").onclick = () => importFile.click();
importFile.onchange = () => {
  const f = importFile.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || typeof d !== "object") throw 0;
      const expTime = (d.meta && (d.meta._exportTime || d.meta._exportStamp)) || "未知";
      const expCount = d.meta && typeof d.meta._totalCount === "number" ? d.meta._totalCount : "未知";
      const info = "导入文件导出于：" + expTime + "\n导入文件含 " + expCount + " 条记录\n当前数据：" + totalCount() + " 条";
      askChoice("导入数据", info, [
        { label: "覆盖导入（替换当前数据）", value: "replace", style: "danger" },
        { label: "合并导入（按 id 去重）", value: "merge" },
        { label: "取消", value: "cancel", style: "ghost" }
      ], function (choice) {
        if (choice === "cancel" || !choice) return;
        if (choice === "replace") {
          state = Object.assign({ todos: [], reviews: [], weeklies: [], reminders: [], notes: [], meta: { sample: false } }, d);
          migrate(d); save(); renderAll();
          alert("覆盖完成，共 " + totalCount() + " 条");
        } else if (choice === "merge") {
          const before = totalCount();
          const merged = mergeSnapshotInto(state, d);
          state = Object.assign({ todos: [], reviews: [], weeklies: [], reminders: [], notes: [], meta: { sample: false } }, merged);
          migrate(d); save(); renderAll();
          const added = totalCount() - before;
          alert("合并完成：新增 " + added + " 条（重复 id 已跳过），现共 " + totalCount() + " 条");
        }
        toolsMask.classList.remove("show");
      });
    } catch (err) { alert("导入失败：文件格式不正确"); }
  };
  r.readAsText(f); importFile.value = "";
};

document.getElementById("clearSampleBtn").onclick = () => {
  askConfirm("清空示例数据", "将移除系统预置的示例待办/复盘/总结/提醒/随笔，你自己的数据保留。确定？", () => {
    state.todos = state.todos.filter(x => !x.sample);
    state.reviews = state.reviews.filter(x => !x.sample);
    state.reminders = state.reminders.filter(x => !x.sample);
    state.meta.sample = false; save(); renderAll(); toolsMask.classList.remove("show"); alert("示例数据已清空");
  });
};
document.getElementById("clearAllBtn").onclick = () => {
  askConfirm("清空全部数据", "将删除所有待办、复盘、总结、提醒、随笔，且无法恢复！确定要清空？", () => {
    state = { todos: [], reviews: [], weeklies: [], reminders: [], notes: [], meta: { sample: false } }; save(); renderAll(); toolsMask.classList.remove("show"); alert("已全部清空");
  });
};

/* ---------- 标签切换 ---------- */
document.getElementById("nav").onclick = e => {
  const b = e.target.closest(".tab"); if (!b) return;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  b.classList.add("active");
  document.getElementById("panel-" + b.dataset.tab).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

/* ---------- 账号与同步（多设备） ---------- */
function updateAcctUI() {
  const t = document.getElementById("acctText");
  if (!t) return;
  if (Auth.enabled && Auth.user) {
    t.textContent = Auth.user.username || "已登录";
    const lb = document.getElementById("logoutBtn"); if (lb) lb.style.display = "";
  } else {
    t.textContent = "未登录";
    const lb = document.getElementById("logoutBtn"); if (lb) lb.style.display = "none";
  }
}
const loginMask = document.getElementById("loginMask");
document.getElementById("acctBtn").onclick = () => {
  updateAcctUI();
  const u = document.getElementById("loginUser");
  if (Auth.user && Auth.user.username) u.value = Auth.user.username; else u.value = "";
  document.getElementById("loginPass").value = "";
  document.getElementById("loginErr").textContent = "";
  loginMask.classList.add("show");
  setTimeout(() => u.focus(), 50);
};
document.getElementById("loginCancel").onclick = () => loginMask.classList.remove("show");
loginMask.onclick = e => { if (e.target === loginMask) loginMask.classList.remove("show"); };
document.getElementById("loginPass").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
document.getElementById("loginSubmit").onclick = doLogin;
document.getElementById("logoutBtn").onclick = () => {
  Auth.logout(); SyncEngine.enabled = false; updateAcctUI(); updateSyncBadge();
  toast("已退出，数据仅存本地");
};
async function doLogin() {
  const u = (document.getElementById("loginUser").value || "").trim();
  const p = document.getElementById("loginPass").value || "";
  const err = document.getElementById("loginErr");
  err.textContent = "";
  if (u.length < 2) { err.textContent = "用户名至少 2 个字符"; return; }
  if (p.length < 6) { err.textContent = "密码至少 6 位"; return; }
  try {
    await Auth.login(u, p);
    /* 切换用户时清空本地 state，确保读取新用户的数据 */
    state = { todos: [], reviews: [], weeklies: [], reminders: [], notes: [], meta: { sample: false } };
    await load();              // 重新本地加载 + 云端拉取合并（已登录 → 触发同步）
    loadSettings(); applyTitle(); renderCategorySelect();
    renderAll(); updateAcctUI(); updateSyncBadge();
    loginMask.classList.remove("show");
    toast("登录成功，已开启多设备同步");
  } catch (e) {
    err.textContent = (e && e.message) || "登录失败";
  }
}

/* ---------- 初始化 ---------- */
(async function () {
  await Auth.init();           // 恢复本地登录态（不联网）
  SyncEngine.init();           // 同步启用状态与引用
  updateSyncBadge();
  updateAcctUI();
  await load();
  loadSettings(); applyTitle(); renderCategorySelect();
  document.getElementById("todoStart").value = todayStr();
  document.getElementById("todoEnd").value = todayStr();
  document.getElementById("reviewDate").value = todayStr();
  document.getElementById("remTime").value = nowLocalDT();
  initWeekForm();
  updateFsUI();
  renderRecurChips();
  syncTodoDateDisabled();
  updatePagingToggle();
  renderAll();
  refreshWarn();
  scheduleReminderCheck();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) scheduleReminderCheck(); });
  window.addEventListener("focus", scheduleReminderCheck);
  /* PWA 注册（离线可打开） */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function (e) { console.warn("SW 注册失败", e); });
  }
})();
