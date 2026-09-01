/* =====================================================================
 * modules/todos.js — 待办任务 / 定时任务 / 分页 / 今日列表
 * 依赖全局：state(save)、uid/todayStr/…(core)、renderAll(core)
 * ===================================================================== */
"use strict";

const TODO_PAGE = 8;
let todoFilter = "all";
let todoPage = 1;
let todayPage = 1;
let todoPagingMode = (function () { try { return localStorage.getItem("wb_gzt_todo_mode") || "scroll"; } catch (e) { return "scroll"; } })();
let noteEditingId = null;

/* ---------- 通用区间汇总（复盘/总结共用） ---------- */
function autoSummary(start, end, label) {
  const items = state.todos.filter(x => !x.deleted && x.start <= end && x.end >= start);
  const done = items.filter(x => x.done).length;
  const rate = items.length ? Math.round(done / items.length * 100) : 0;
  const head = label || ("本区间（" + start + " ~ " + end + "）");
  let s = head + "共记录待办 " + items.length + " 项，完成 " + done + " 项（完成率 " + rate + "%）。";
  const dn = items.filter(x => x.done).map(x => x.content);
  const un = items.filter(x => !x.done).map(x => x.content);
  if (dn.length) s += "\n已完成：" + dn.join("、") + "。";
  if (un.length) s += "\n未完成：" + un.join("、") + "。";
  return s;
}

/* ---------- 操作 ---------- */
function doneTodo(id) { const x = state.todos.find(t => t.id === id); if (x) { x.done = true; save(); renderAll(); } }
function toggleTodo(id) { const x = state.todos.find(t => t.id === id); if (x) { x.done = !x.done; save(); renderAll(); } }
function delTodo(id) { 
  askConfirm("删除待办", "确定删除这条待办吗？", () => { 
    const x = state.todos.find(t => t.id === id); 
    if (x) { x.deleted = true; x.updatedAt = Date.now(); }
    save(); renderAll(); 
  }); 
}
function editNote(id) { noteEditingId = id; renderTodo(); }
function saveNote(id) {
  const ta = document.getElementById("noteInput");
  const x = state.todos.find(t => t.id === id);
  if (x) x.note = (ta ? ta.value : "").trim();
  noteEditingId = null; save(); renderTodo();
}
function cancelNote() { noteEditingId = null; renderTodo(); }

/* ---------- 渲染：待办列表 ---------- */
function renderTodo() {
  const t = todayStr();
  const activeTodos = state.todos.filter(x => !x.deleted);
  const todayAll = activeTodos.filter(x => x.recurrence ? recurMatches(x.recurrence, t) : (x.start <= t && x.end >= t));
  const td = todayAll.filter(x => x.recurrence ? recurDoneToday(x) : x.done).length;
  const tt = todayAll.length;
  const pct = tt ? Math.round(td / tt * 100) : 0;
  document.getElementById("todoStat").innerHTML = ring(pct, 72) +
    '<div class="num">今日 <b>' + td + '/' + tt + '</b> 完成<br><span style="font-size:12px">共 ' + activeTodos.length + ' 条待办任务</span></div>';
  document.getElementById("weekBars").innerHTML = weekBars();

  let list = state.todos.filter(x => !x.deleted).slice().sort((a, b) => cmp(b.start, a.start) || cmp(b.createdAt, a.createdAt));
  if (todoFilter === "today") {
    list = list.filter(x => x.recurrence ? recurMatches(x.recurrence, t) : (x.start <= t && x.end >= t));
  }
  if (todoFilter === "undone") {
    list = list.filter(x => x.recurrence ? !recurDoneToday(x) : !x.done);
  }
  var todoList = document.getElementById("todoList");
  todoList.innerHTML = '';
  if (!list.length) {
    var emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-s';
    emptyDiv.textContent = '暂无待办任务';
    todoList.appendChild(emptyDiv);
  } else {
    var frag = document.createDocumentFragment();
    var totalPages = Math.max(1, Math.ceil(list.length / pageSize)); if (todoPage > totalPages) todoPage = totalPages; var _s, _e;
    if (todoPagingMode === "scroll") { _s = 0; _e = todoPage * pageSize; } else { _s = (todoPage - 1) * pageSize; _e = todoPage * pageSize; }
    var shown = list.slice(_s, _e);
    shown.forEach(function (x) {
      var st, metaLine, pc;
      if (x.recurrence) {
        var dn = recurDoneToday(x);
        if (dn) { st = '今日已完成'; pc = 'done'; }
        else if (recurMatches(x.recurrence, t)) { st = '今日进行中'; pc = 'active'; }
        else { st = '等待下一次'; pc = 'l'; }
        metaLine = recurLabel(x.recurrence) + (x.category ? ' · <span class="pill cat">' + esc(x.category) + '</span>' : '') + ' · <span class="pill l">定时</span>' + (dn ? ' · <span class="pill done">今日已完</span>' : '');
      } else {
        st = taskStatus(x, t);
        pc = st === '进行中' ? 'active' : st === '逾期' ? 'h' : st === '未开始' ? 'l' : 'done';
        metaLine = esc(x.start) + ' 至 ' + esc(x.end) + (x.category ? ' · <span class="pill cat">' + esc(x.category) + '</span>' : '') + ' · <span class="pill ' + priClass(x.priority) + '">' + esc(x.priority) + '</span>' + (x.done ? ' · <span class="pill done">已完成</span>' : '');
      }
      var editing = noteEditingId === x.id;
      var noteHtml = '';
      if (editing) {
        noteHtml = '<textarea id="noteInput" class="note-input" placeholder="记录工作过程…">' + esc(x.note || '') + '</textarea>' +
          '<div class="note-act"><button class="btn xs" data-act="save-note">保存</button>' +
          '<button class="btn xs ghost" data-act="cancel-note">取消</button></div>';
      } else if (x.note) {
        noteHtml = '<div class="li-note">' + esc(x.note) + '</div>' +
          '<button class="linkbtn" data-act="edit-note">编辑过程</button>';
      } else {
        noteHtml = '<button class="linkbtn" data-act="edit-note">记过程</button>';
      }
      var chkOn = x.recurrence ? recurDoneToday(x) : x.done;
      var chkClick = x.recurrence ? ('doneTodoRecurrence(\'' + x.id + '\')') : ('toggleTodo(\'' + x.id + '\')');
      var recurCls = x.recurrence ? ' recurring' : '';

      var li = document.createElement('div');
      li.className = 'list-item' + (chkOn ? ' done' : '') + recurCls;
      li.setAttribute('data-todo-id', x.id);

      var chk = document.createElement('div');
      chk.className = 'chk' + (chkOn ? ' on' : '');
      chk.setAttribute('data-act', 'toggle');
      if (chkOn) chk.innerHTML = I.check;
      li.appendChild(chk);

      var body = document.createElement('div');
      body.className = 'li-body';
      body.innerHTML =
        '<div class="li-t">' + esc(x.content) + '<span class="pill ' + pc + '">' + st + '</span></div>' +
        '<div class="li-meta">' + metaLine + '</div>' +
        noteHtml;
      Array.prototype.forEach.call(body.querySelectorAll('[data-act=edit-note]'), function (b) { b.setAttribute('onclick', 'editNote(\'' + x.id + '\')'); });
      Array.prototype.forEach.call(body.querySelectorAll('[data-act=save-note]'), function (b) { b.setAttribute('onclick', 'saveNote(\'' + x.id + '\')'); });
      Array.prototype.forEach.call(body.querySelectorAll('[data-act=cancel-note]'), function (b) { b.setAttribute('onclick', 'cancelNote()'); });
      li.appendChild(body);

      var act = document.createElement('div');
      act.className = 'li-act';
      var btn = document.createElement('button');
      btn.className = 'iconbtn sm del-btn';
      btn.setAttribute('title', '删除');
      btn.setAttribute('data-act', 'del');
      btn.innerHTML = I.trash + '<span class="txt">删除</span>';
      act.appendChild(btn);
      li.appendChild(act);

      frag.appendChild(li);
    });
    if (todoPagingMode === "scroll") {
      if (list.length > _e) { var left = list.length - _e; var more = document.createElement("button"); more.className = "btn block more"; more.setAttribute("onclick", "todoLoadMore()"); more.textContent = "加载更多（还剩 " + left + " 条）"; frag.appendChild(more); }
    } else if (totalPages > 1) {
      var pg = document.createElement("div"); pg.className = "pager";
      var mk = function (dis, onclick, txt, on) { var e = document.createElement("button"); e.className = "pg-btn" + (on ? " on" : ""); e.disabled = !!dis; if (onclick) e.setAttribute("onclick", onclick); e.textContent = txt; return e; };
      var disF = todoPage === 1, disL = todoPage === totalPages;
      pg.appendChild(mk(disF, "todoGoPage(1)", "« 首页"));
      pg.appendChild(mk(disF, "todoGoPage(" + Math.max(1, todoPage - 1) + ")", "‹ 上一页"));
      var maxB = 5, sp = Math.max(1, Math.min(todoPage - 2, totalPages - maxB + 1)), ep = Math.min(totalPages, sp + maxB - 1); if (ep - sp < maxB - 1) sp = Math.max(1, ep - maxB + 1);
      for (var pi = sp; pi <= ep; pi++) pg.appendChild(mk(false, "todoGoPage(" + pi + ")", "" + pi, pi === todoPage));
      pg.appendChild(mk(disL, "todoGoPage(" + Math.min(totalPages, todoPage + 1) + ")", "下一页 ›"));
      pg.appendChild(mk(disL, "todoGoPage(" + totalPages + ")", "末页 »"));
      var info = document.createElement("span"); info.className = "pager-info"; info.textContent = "第 " + todoPage + " / " + totalPages + " 页 · 共 " + list.length + " 条"; pg.appendChild(info);
      frag.appendChild(pg);
    }
    todoList.appendChild(frag);
    Array.prototype.forEach.call(todoList.querySelectorAll('.chk[data-act=toggle]'), function (c) {
      var li = c.closest('.list-item');
      var id = li ? li.getAttribute('data-todo-id') : null;
      if (!id) return;
      var x = state.todos.find(function (y) { return y.id === id; });
      if (!x) return;
      var fn = x.recurrence ? 'doneTodoRecurrence' : 'toggleTodo';
      c.setAttribute('onclick', fn + '(\'' + id + '\')');
    });
    Array.prototype.forEach.call(todoList.querySelectorAll('.del-btn[data-act=del]'), function (b) {
      var li = b.closest('.list-item');
      var id = li ? li.getAttribute('data-todo-id') : null;
      if (id) b.setAttribute('onclick', 'delTodo(\'' + id + '\')');
    });
  }
}
function todoLoadMore() { todoPage++; renderTodo(); }
function todoGoPage(p) { if (p < 1) return; todoPage = p; renderTodo(); }
function todayLoadMore() { todayPage++; renderToday(); }
function todayGoPage(p) { if (p < 1) return; todayPage = p; renderToday(); }
function setTodoPagingMode(m) {
  todoPagingMode = m; todoPage = 1; todayPage = 1;
  try { localStorage.setItem("wb_gzt_todo_mode", m); } catch (e) { }
  updatePagingToggle(); renderTodo(); renderToday();
}
function updatePagingToggle() {
  document.querySelectorAll("#todoPagingToggle .f,#todayPagingToggle .f").forEach(function (x) {
    if (x.dataset.m === todoPagingMode) x.classList.add("on"); else x.classList.remove("on");
  });
  ["todoList", "todayList"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { if (todoPagingMode === "scroll") el.classList.add("todo-list-scroll"); else el.classList.remove("todo-list-scroll"); }
  });
}

/* ---------- 添加待办（含定时任务） ---------- */
document.getElementById("addTodo").onclick = () => {
  const s = document.getElementById("todoStart").value || todayStr();
  const e = document.getElementById("todoEnd").value || todayStr();
  const c = document.getElementById("todoText").value.trim();
  const p = document.getElementById("todoPri").value;
  if (!c) { alert("请填写任务内容"); return; }
  if (s > e) { alert("开始日期不能晚于结束日期"); return; }
  const cat = document.getElementById("todoCategory").value || (settings.categories[0] || "工作");
  const item = { id: uid(), content: c, start: s, end: e, category: cat, priority: p, note: "", done: false, createdAt: Date.now() };
  if (document.getElementById("todoRecur").checked) {
    const freqEl = document.querySelector("#recurFreq .seg-btn.on");
    const freq = freqEl ? freqEl.dataset.freq : "weekly";
    const days = [].slice.call(document.querySelectorAll("#recurDays .chip.on")).map(function (x) { return +x.dataset.d; }).filter(function (n) { return !isNaN(n); }).sort(function (a, b) { return a - b; });
    if (!days.length) { alert("请至少选择一个重复日期"); return; }
    item.recurrence = { freq: freq, days: days };
    item.doneDates = [];
  }
  state.todos.push(item);
  document.getElementById("todoText").value = "";
  document.getElementById("todoStart").value = todayStr();
  document.getElementById("todoEnd").value = todayStr();
  document.getElementById("todoRecur").checked = false;
  document.getElementById("recurBox").style.display = "none";
  syncTodoDateDisabled();
  save(); todoPage = 1; renderAll();
};

/* ---------- 定时任务表单交互 ---------- */
document.getElementById("todoRecur").onchange = function (e) {
  const box = document.getElementById("recurBox");
  if (e.target.checked) { renderRecurChips(); box.style.display = ""; }
  else box.style.display = "none";
  syncTodoDateDisabled();
};
document.getElementById("recurFreq").onclick = function (e) {
  const b = e.target.closest(".seg-btn"); if (!b) return;
  document.querySelectorAll("#recurFreq .seg-btn").forEach(function (x) { x.classList.remove("on"); });
  b.classList.add("on"); renderRecurChips();
};
document.getElementById("recurDays").onclick = function (e) {
  const c = e.target.closest(".chip"); if (!c) return; c.classList.toggle("on");
};

/* ---------- 筛选 / 分页切换 ---------- */
document.getElementById("todoFilters").onclick = e => {
  if (e.target.classList.contains("f")) {
    document.querySelectorAll("#todoFilters .f").forEach(f => f.classList.remove("on"));
    e.target.classList.add("on"); todoFilter = e.target.dataset.f; todoPage = 1; renderTodo();
  }
};
document.getElementById("todoPagingToggle").onclick = e => { var f = e.target.closest(".f"); if (!f) return; setTodoPagingMode(f.dataset.m); };
document.getElementById("todayPagingToggle").onclick = e => { var f = e.target.closest(".f"); if (!f) return; setTodoPagingMode(f.dataset.m); };
