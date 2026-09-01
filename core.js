/* =====================================================================
 * core.js — 共享工具 / 渲染聚合 / 弹窗
 * ---------------------------------------------------------------------
 * 仅定义函数与常量，不在顶层读取其它文件的 let/const（运行时再读，安全）。
 * 依赖全局：state(storage)、settings/pageSize/todoPagingMode(app)、
 *          renderTodo(reviews/weeklies/reminders/notes 各模块)
 * ===================================================================== */
"use strict";

/* ---------- 工具 ---------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function pad2(n) { return String(n).padStart(2, "0"); }
function fmt(d) { const y = d.getFullYear(); const m = pad2(d.getMonth() + 1); const da = pad2(d.getDate()); return y + "-" + m + "-" + da; }
function todayStr() { return fmt(new Date()); }
function nowLocalDT() { const d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
function parse(s) { return new Date(s + "T00:00:00"); }
function shiftDate(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); }
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function priClass(p) { return p === "高" ? "h" : p === "中" ? "m" : "l"; }
function taskStatus(x, t) { if (x.done) return "已完成"; if (x.end < t) return "逾期"; if (x.start > t) return "未开始"; return "进行中"; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function totalCount() { return state.todos.length + state.reviews.length + state.weeklies.length + state.reminders.length + state.notes.length; }

/* ---------- 定时任务工具 ---------- */
function recurMatches(r, dateStr) {
  if (!r) return false;
  const d = parse(dateStr);
  if (r.freq === "weekly") {
    const dow = (d.getDay() + 6) % 7; /* 周一=0 .. 周日=6 */
    return r.days.indexOf(dow) >= 0;
  }
  if (r.freq === "monthly") {
    return r.days.indexOf(d.getDate()) >= 0;
  }
  return false;
}
function recurLabel(r) {
  if (!r) return "";
  if (r.freq === "weekly") {
    const names = ["一", "二", "三", "四", "五", "六", "日"];
    return "每" + r.days.map(function (d) { return "周" + names[d]; }).join("、");
  }
  if (r.freq === "monthly") {
    return "每月 " + r.days.slice().sort(function (a, b) { return a - b; }).join("、") + " 日";
  }
  return "";
}
function recurDoneToday(x) {
  const t = todayStr();
  return x.recurrence && (x.doneDates || []).indexOf(t) >= 0;
}
function doneTodoRecurrence(id) {
  const x = state.todos.find(function (t) { return t.id === id; });
  if (!x || !x.recurrence) return;
  const t = todayStr();
  x.doneDates = x.doneDates || [];
  if (x.doneDates.indexOf(t) < 0) x.doneDates.push(t);
  save(); renderAll();
}
function renderRecurChips() {
  const freqEl = document.querySelector("#recurFreq .seg-btn.on");
  const freq = freqEl ? freqEl.dataset.freq : "weekly";
  const box = document.getElementById("recurDays");
  const lbl = document.getElementById("recurDaysLabel");
  if (!box || !lbl) return;
  if (freq === "weekly") {
    lbl.textContent = "选择星期几（可多选）";
    const names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    box.innerHTML = names.map(function (n, i) { return '<button type="button" class="chip" data-d="' + i + '">' + n + '</button>'; }).join("");
  } else {
    lbl.textContent = "选择日期（可多选）";
    let html = "";
    for (let i = 1; i <= 31; i++) { html += '<button type="button" class="chip" data-d="' + i + '">' + i + '</button>'; }
    box.innerHTML = html;
  }
}
function syncTodoDateDisabled() {
  const on = document.getElementById("todoRecur").checked;
  document.getElementById("todoStart").disabled = on;
  document.getElementById("todoEnd").disabled = on;
  document.getElementById("todoDateHint").style.display = on ? "" : "none";
}

/* ---------- 图表 ---------- */
function ring(pct, size) {
  size = size || 72; const r = (size - 12) / 2; const c = 2 * Math.PI * r; const off = c * (1 - pct / 100);
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
    '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" fill="none" stroke="#eef2f7" stroke-width="7"/>' +
    '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" fill="none" stroke="var(--primary)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" transform="rotate(-90 ' + (size / 2) + ' ' + (size / 2) + ')"/>' +
    '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" fill="var(--text)">' + pct + '%</text></svg>';
}
function weekBars() {
  const t = todayStr(); let bars = "";
  for (let i = 6; i >= 0; i--) {
    const d = shiftDate(t, -i);
    const done = state.todos.filter(x => x.start <= d && x.end >= d && x.done).length;
    const h = Math.max(6, done * 16);
    const lbl = (i === 0 ? "今" : parse(d).getMonth() + 1 + "." + parse(d).getDate());
    bars += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">' +
      '<div style="width:60%;background:' + (done > 0 ? "var(--primary)" : "#e9eef5") + ';border-radius:5px;height:' + h + 'px;min-height:6px"></div>' +
      '<div style="font-size:10px;color:var(--muted)">' + lbl + '</div></div>';
  }
  return '<div style="display:flex;align-items:flex-end;gap:4px;height:82px;padding:0 2px">' + bars + '</div>';
}

/* ---------- 图标 ---------- */
const I = {
  check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  flag: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>'
};

/* ---------- 确认弹窗 DOM 句柄（body 末尾已渲染） ---------- */
let confirmCb = null;
const confirmMask = document.getElementById("confirmMask");
const choiceMask = document.getElementById("choiceMask");
document.getElementById("confirmNo").onclick = function () { confirmMask.classList.remove("show"); };
document.getElementById("confirmYes").onclick = function () { confirmMask.classList.remove("show"); if (confirmCb) confirmCb(); };

/* ---------- 渲染：今天要处理 ---------- */
function renderToday() {
  const t = todayStr();
  const rows = [];
  const noteOf = x => x.note ? '<div class="bc">过程：' + esc(x.note) + '</div>' : "";
  const recurSub = x => x.recurrence
    ? '<span class="sub">' + recurLabel(x.recurrence) + (x.priority ? ' · ' + x.priority : '') + '</span>'
    : '<span class="sub">' + x.start + ' 至 ' + x.end + (x.category ? ' · ' + esc(x.category) : '') + (x.priority ? ' · ' + x.priority : '') + '</span>';
  const row = (x, color, extra) => {
    const dn = recurDoneToday(x);
    const actHtml = dn
      ? '<span class="pill done">今日已完</span>'
      : '<button class="btn sm" onclick="' + (x.recurrence ? 'doneTodoRecurrence(\'' + x.id + '\')' : 'doneTodo(\'' + x.id + '\')') + '">' + (x.recurrence ? '完成今日' : '完成') + '</button>';
    return '<div class="row"><div class="ic" style="color:' + color + '">' + I.flag + '</div><div class="rb"><div class="t" style="color:' + color + '">' + esc(x.content) + extra + recurSub(x) + '</div>' + noteOf(x) + '</div><div class="act">' + actHtml + '</div></div>';
  };
  const overdue = state.todos.filter(x => !x.done && !x.recurrence && x.end < t).sort((a, b) => cmp(a.end, b.end));
  overdue.forEach(x => rows.push(row(x, "var(--red)", '<span class="pill h">逾期</span>')));
  const todayList = state.todos.filter(x => {
    if (x.done) return false;
    if (x.recurrence) return recurMatches(x.recurrence, t) && !recurDoneToday(x);
    return x.start <= t && x.end >= t;
  }).sort((a, b) => cmp(b.priority, a.priority));
  todayList.forEach(x => rows.push(row(x, "var(--primary)", '<span class="pill ' + (x.recurrence ? 'l' : priClass(x.priority)) + '">' + (x.recurrence ? '定时' : x.priority) + '</span>')));
  const soon = state.todos.filter(x => !x.done && !x.recurrence && x.start > t).sort((a, b) => cmp(a.start, b.start)).slice(0, 2);
  soon.forEach(x => rows.push(row(x, "var(--amber)", '<span class="pill soon">即将开始</span>')));
  const now = new Date();
  const dueRem = state.reminders.filter(r => !r.done && new Date(r.time) <= now).sort((a, b) => cmp(a.time, b.time));
  dueRem.forEach(r => rows.push('<div class="banner rem"><div class="ic" style="color:var(--amber)">' + I.bell + '</div><div class="rb"><div class="bt">' + esc(r.title) + '</div>' + (r.content ? '<div class="bc">' + esc(r.content) + '</div>' : '') + '<div class="bd">提醒时间 ' + r.time.replace('T', ' ') + '</div></div><div class="act"><button class="btn sm" onclick="doneReminder(\'' + r.id + '\')">知道了</button></div></div>'));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (todayPage > totalPages) todayPage = totalPages;
  var _s, _e;
  if (todoPagingMode === "scroll") { _s = 0; _e = todayPage * pageSize; } else { _s = (todayPage - 1) * pageSize; _e = todayPage * pageSize; }
  const shown = rows.slice(_s, _e);
  let html = shown.join("");
  if (!html) html = '<div class="empty">今天没有待处理事项，去「待办任务」加一条吧</div>';
  if (todoPagingMode === "scroll") {
    if (total > _e) { var left = total - _e; html += '<button class="btn block more" onclick="todayLoadMore()">加载更多（还剩 ' + left + ' 条）</button>'; }
  } else if (totalPages > 1) {
    var mk = function (dis, onclick, txt, on) { return '<button class="pg-btn' + (on ? ' on' : '') + '"' + (dis ? ' disabled' : '') + (onclick ? ' onclick="' + onclick + '"' : '') + '>' + txt + '</button>'; };
    var disF = todayPage === 1, disL = todayPage === totalPages;
    var pg = '<div class="pager">';
    pg += mk(disF, 'todayGoPage(1)', '« 首页');
    pg += mk(disF, 'todayGoPage(' + Math.max(1, todayPage - 1) + ')', '‹ 上一页');
    var maxB = 5; var sp = Math.max(1, Math.min(todayPage - 2, totalPages - maxB + 1)); var ep = Math.min(totalPages, sp + maxB - 1); if (ep - sp < maxB - 1) sp = Math.max(1, ep - maxB + 1);
    for (var pi = sp; pi <= ep; pi++) pg += mk(false, 'todayGoPage(' + pi + ')', "" + pi, pi === todayPage);
    pg += mk(disL, 'todayGoPage(' + Math.min(totalPages, todayPage + 1) + ')', '下一页 ›');
    pg += mk(disL, 'todayGoPage(' + totalPages + ')', '末页 »');
    pg += '<span class="pager-info">第 ' + todayPage + ' / ' + totalPages + ' 页 · 共 ' + total + ' 条</span>';
    pg += '</div>';
    html += pg;
  }
  document.getElementById("todayList").innerHTML = html;
}

function renderAll() { renderToday(); renderTodo(); renderReview(); renderWeek(); renderReminder(); renderNote(); }

function refreshWarn() {
  var el = document.getElementById("backupWarn");
  var span = document.getElementById("backupWarnText");
  if (totalCount() < 30) { el.style.display = "none"; return; }
  var last = state.meta && state.meta._lastExportTime;
  var recent = false;
  if (last) { var days = (Date.now() - new Date(last).getTime()) / 86400000; recent = days < 7; }
  if (recent && span) { var stamp = state.meta._lastExportStamp || last.replace(/\D/g, "").slice(0, 14); span.textContent = "数据已累计 " + totalCount() + " 条，上次导出：" + stamp; }
  el.style.display = recent ? "none" : "flex";
}

/* ---------- 确认 / 多选弹窗 ---------- */
function askConfirm(title, text, cb) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmText").textContent = text;
  confirmCb = cb;
  confirmMask.classList.add("show");
}
function askChoice(title, text, opts, cb) {
  document.getElementById("choiceTitle").textContent = title;
  document.getElementById("choiceText").textContent = text;
  var box = document.getElementById("choiceBtns");
  box.innerHTML = "";
  opts.forEach(function (o) {
    var b = document.createElement("button");
    b.className = "btn " + (o.style || "");
    b.style.flex = "1";
    b.textContent = o.label;
    b.onclick = function () { choiceMask.classList.remove("show"); cb(o.value); };
    box.appendChild(b);
  });
  choiceMask.classList.add("show");
}

/* ---------- 轻量提示 toast（替代原生 alert，沙箱/iframe 下也可用） ---------- */
function toast(msg) {
  let wrap = document.getElementById("toastWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toastWrap";
    wrap.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:80;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none";
    document.body.appendChild(wrap);
  }
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "max-width:84vw;background:rgba(17,24,39,.92);color:#fff;font-size:13px;line-height:1.5;padding:9px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);white-space:pre-wrap;word-break:break-word;opacity:0;transition:opacity .2s ease,transform .2s ease;transform:translateY(6px)";
  wrap.appendChild(t);
  requestAnimationFrame(function () { t.style.opacity = "1"; t.style.transform = "translateY(0)"; });
  setTimeout(function () {
    t.style.opacity = "0"; t.style.transform = "translateY(6px)";
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 240);
  }, 2600);
  return t;
}
/* 沙箱 iframe 会屏蔽原生 alert()：把 alert 重定向到应用内 toast（del* 改用 askConfirm） */
window.alert = function (m) { try { toast(m); } catch (e) { console.warn(m); } };
