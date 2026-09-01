/* =====================================================================
 * modules/reminders.js — 提醒 + 系统通知（档A：Web Notifications）
 * 依赖全局：state(save)、uid/todayStr/cmp/esc(core)、renderAll(core)
 * 注意：通知仅在页面进程存活时有效（含后台标签/最小化）；浏览器完全关闭不触发。
 * ===================================================================== */
"use strict";

let notifiedSet = new Set();
let reminderTimer = null;

function ensureNotifyPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") { Notification.requestPermission().catch(function () { }); }
}
function fireNotification(r) {
  try {
    const n = new Notification(r.title, { body: (r.content ? r.content + "\n" : "") + "提醒时间 " + r.time.replace("T", " "), tag: r.id });
    n.onclick = function () { try { window.focus(); } catch (e) { } try { n.close(); } catch (e) { } };
    setTimeout(function () { try { n.close(); } catch (e) { } }, 12000);
  } catch (e) { }
}
function checkReminders() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const now = new Date();
  state.reminders.forEach(function (r) {
    if (!r.done && new Date(r.time) <= now && !notifiedSet.has(r.id)) {
      notifiedSet.add(r.id);
      fireNotification(r);
    }
  });
}
/* 精准排程：立即检查一次，再为「最近一条未提醒的未来提醒」设一次性定时；
   比固定 30s 轮询更抗后台节流，并在回到前台/新增提醒时主动补检。
   权限未授权时只做即时检查、不排程，避免空转死循环。 */
function scheduleReminderCheck() {
  if (reminderTimer) { clearTimeout(reminderTimer); reminderTimer = null; }
  checkReminders();
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const now = Date.now();
  let next = null;
  state.reminders.forEach(function (r) {
    if (!r.done && !notifiedSet.has(r.id)) {
      const t = new Date(r.time).getTime();
      if (t > now && (next === null || t < next)) next = t;
    }
  });
  if (next !== null) {
    const delay = Math.min(Math.max(next - now, 500), 2147483647);
    reminderTimer = setTimeout(function () { checkReminders(); scheduleReminderCheck(); }, delay);
  }
}

function renderReminder() {
  const now = new Date();
  let list = state.reminders.filter(x => !x.deleted).slice().sort((a, b) => cmp(a.time, b.time));
  let html = "";
  if (!list.length) html = '<div class="empty-s">还没有提醒，在上方添加一条吧。</div>';
  list.forEach(r => {
    const due = !r.done && new Date(r.time) <= now;
    html += '<div class="list-item' + (r.done ? " done" : "") + '">' +
      '<div class="li-body"><div class="li-t">' + esc(r.title) + (due ? ' <span class="pill soon">待提醒</span>' : '') + '</div>' +
      '<div class="li-meta">提醒时间 ' + r.time.replace('T', ' ') + (r.done ? ' · <span class="pill done">已处理</span>' : '') + '</div>' +
      (r.content ? '<div class="li-note">' + esc(r.content) + '</div>' : '') +
      '</div>' +
      '<div class="li-act">' +
      (r.done ? '' : '<button class="iconbtn sm" style="border:none;color:var(--green)" onclick="doneReminder(\'' + r.id + '\')" title="标记已处理">' + I.check + '</button>') +
      '<button class="iconbtn sm del-btn" title="删除" onclick="delReminder(\'' + r.id + '\')">' + I.trash + '<span class="txt">删除</span></button></div></div>';
  });
  document.getElementById("reminderList").innerHTML = html;
}
function doneReminder(id) { const r = state.reminders.find(t => t.id === id); if (r) { r.done = true; notifiedSet.delete(id); save(); renderAll(); scheduleReminderCheck(); } }
function delReminder(id) { 
  askConfirm("删除提醒", "确定删除这条提醒吗？", () => { 
    const x = state.reminders.find(t => t.id === id); 
    if (x) { x.deleted = true; x.updatedAt = Date.now(); }
    save(); renderAll(); scheduleReminderCheck(); 
  }); 
}

document.getElementById("addReminder").onclick = () => {
  const ti = document.getElementById("remTitle").value.trim();
  const co = document.getElementById("remContent").value.trim();
  const tm = document.getElementById("remTime").value;
  if (!ti) { alert("请填写提醒标题"); return; }
  if (!tm) { alert("请选择提醒时间"); return; }
  ensureNotifyPermission();
  state.reminders.push({ id: uid(), title: ti, time: tm, content: co, done: false, createdAt: Date.now() });
  document.getElementById("remTitle").value = "";
  document.getElementById("remContent").value = "";
  document.getElementById("remTime").value = "";
  save(); renderAll(); scheduleReminderCheck(); alert("提醒已添加");
};
