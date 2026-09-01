/* =====================================================================
 * modules/weeklies.js — 总结（带时间区间，互不重叠/交叉）
 * 依赖全局：state(save)、uid/todayStr/shiftDate/cmp/esc(autoSummary core/todos)、renderAll(core)
 * ===================================================================== */
"use strict";

let weekVisible = TODO_PAGE;
let editingWeekId = null;

function initWeekForm() {
  const t = todayStr();
  const yesterday = shiftDate(t, -1);
  let defStart, defEnd = yesterday;
  const maxEnd = state.weeklies.reduce((m, s) => s.end > m ? s.end : m, "");
  if (maxEnd) { defStart = shiftDate(maxEnd, 1); if (defStart > yesterday) defStart = yesterday; }
  else defStart = shiftDate(yesterday, -6);
  document.getElementById("weekStart").value = defStart;
  document.getElementById("weekEnd").value = defEnd;
  document.getElementById("weekLast").value = autoSummary(defStart, defEnd);
  document.getElementById("weekPlan").value = "";
  editingWeekId = null;
  document.getElementById("weekEditHint").style.display = "none";
}
function editWeek(id) {
  const it = state.weeklies.find(x => x.id === id); if (!it) return;
  editingWeekId = id;
  document.getElementById("weekStart").value = it.start;
  document.getElementById("weekEnd").value = it.end;
  document.getElementById("weekLast").value = it.last;
  document.getElementById("weekPlan").value = it.plan;
  document.getElementById("weekEditHint").style.display = "block";
  document.getElementById("weekStart").scrollIntoView({ behavior: "smooth", block: "center" });
}
function autoFillWeek() {
  const s = document.getElementById("weekStart").value, e = document.getElementById("weekEnd").value;
  if (!s || !e) { alert("请先选择起止日期"); return; }
  if (s > e) { alert("开始日期不能晚于结束日期"); return; }
  document.getElementById("weekLast").value = autoSummary(s, e);
}

function renderWeek() {
  const t = todayStr();
  const yesterday = shiftDate(t, -1);
  const maxEnd = state.weeklies.reduce((m, s) => s.end > m ? s.end : m, "");
  let defStart = maxEnd ? shiftDate(maxEnd, 1) : shiftDate(yesterday, -6);
  if (defStart > yesterday) defStart = yesterday;
  document.getElementById("weekNote").innerHTML =
    "新建总结默认区间为「上次总结次日（" + defStart + "） ~ 昨天（" + yesterday + "）」。" +
    "<br>可手动调整起止日期；<b>各总结区间不可重复或交叉</b>。";
  let list = state.weeklies.filter(x => !x.deleted).slice().sort((a, b) => cmp(b.end, a.end));
  let html = "";
  if (!list.length) html = '<div class="empty-s">还没有总结记录</div>';
  list.slice(0, weekVisible).forEach(x => {
    html += '<div class="list-item"><div class="li-body"><div class="li-t" style="font-weight:600;font-size:14px">' + x.start + ' ~ ' + x.end + (editingWeekId === x.id ? " · 编辑中" : "") + '</div>' +
      (x.last ? '<div class="li-meta" style="white-space:pre-wrap;margin-top:5px;color:var(--text);line-height:1.6"><b>本期：</b>' + esc(x.last) + '</div>' : '') +
      (x.plan ? '<div class="li-meta" style="white-space:pre-wrap;margin-top:4px;color:var(--text);line-height:1.6"><b>下期：</b>' + esc(x.plan) + '</div>' : '') +
      '</div><div class="li-act"><button class="linkbtn" onclick="editWeek(\'' + x.id + '\')">编辑</button>' +
      '<button class="iconbtn sm del-btn" title="删除" onclick="delWeek(\'' + x.id + '\')">' + I.trash + '<span class="txt">删除</span></button></div></div>';
  });
  if (list.length > weekVisible) html += '<button class="btn block more" onclick="weekLoadMore()">加载更多（还剩 ' + (list.length - weekVisible) + ' 条）</button>';
  document.getElementById("weekList").innerHTML = html;
}
function weekLoadMore() { weekVisible += TODO_PAGE; renderWeek(); }

document.getElementById("saveWeek").onclick = () => {
  const start = document.getElementById("weekStart").value;
  const end = document.getElementById("weekEnd").value;
  const last = document.getElementById("weekLast").value.trim();
  const plan = document.getElementById("weekPlan").value.trim();
  if (!start || !end) { alert("请选择开始和结束日期"); return; }
  if (start > end) { alert("开始日期不能晚于结束日期"); return; }
  const exId = editingWeekId;
  const ov = state.weeklies.find(s => s.id !== exId && end >= s.start && start <= s.end);
  if (ov) { alert("时间区间与已有总结（" + ov.start + " ~ " + ov.end + "）重叠，请调整，避免重复或交叉。"); return; }
  if (exId) {
    const i = state.weeklies.findIndex(x => x.id === exId);
    if (i >= 0) state.weeklies[i] = { ...state.weeklies[i], start, end, last, plan };
  } else {
    state.weeklies.push({ id: uid(), start, end, last, plan, createdAt: Date.now() });
  }
  editingWeekId = null;
  if (!exId) weekVisible = TODO_PAGE;
  save(); initWeekForm(); renderAll(); alert(exId ? "总结已更新" : "总结已保存");
};
document.getElementById("newWeek").onclick = () => { initWeekForm(); };

function delWeek(id) { 
  askConfirm("删除总结", "确定删除这条总结吗？", () => { 
    const x = state.weeklies.find(t => t.id === id); 
    if (x) { x.deleted = true; x.updatedAt = Date.now(); }
    save(); renderAll(); 
  }); 
}
