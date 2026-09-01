/* =====================================================================
 * modules/reviews.js — 当日复盘 / 历史复盘
 * 依赖全局：state(save)、uid/todayStr/cmp/esc(autoSummary core/todos)、renderAll(core)
 * ===================================================================== */
"use strict";

let reviewVisible = TODO_PAGE;

function renderReview() {
  const t = todayStr();
  document.getElementById("reviewDate").value = t;
  const cur = state.reviews.find(x => x.date === t);
  const ta = document.getElementById("reviewText");
  if (cur) { ta.value = cur.text; }
  else if (!ta.value.trim()) { ta.value = autoSummary(t, t, "【当日待办完成情况】"); }
  let list = state.reviews.filter(x => !x.deleted).slice().sort((a, b) => cmp(b.date, a.date));
  let html = "";
  if (!list.length) html = '<div class="empty-s">还没有复盘记录</div>';
  list.slice(0, reviewVisible).forEach(x => {
    html += '<div class="list-item"><div class="li-body"><div class="li-t" style="font-weight:600;font-size:14px">' + x.date + (x.date === t ? ' · 今天' : '') + '</div>' +
      '<div class="li-meta" style="white-space:pre-wrap;margin-top:5px;color:var(--text);line-height:1.6">' + esc(x.text) + '</div></div>' +
      '<div class="li-act"><button class="iconbtn sm del-btn" title="删除" onclick="delReview(\'' + x.id + '\')">' + I.trash + '<span class="txt">删除</span></button></div></div>';
  });
  if (list.length > reviewVisible) html += '<button class="btn block more" onclick="reviewLoadMore()">加载更多（还剩 ' + (list.length - reviewVisible) + ' 条）</button>';
  document.getElementById("reviewList").innerHTML = html;
}
function reviewLoadMore() { reviewVisible += TODO_PAGE; renderReview(); }

document.getElementById("saveReview").onclick = () => {
  const d = document.getElementById("reviewDate").value || todayStr();
  const c = document.getElementById("reviewText").value.trim();
  if (!c) { alert("请填写复盘内容"); return; }
  const i = state.reviews.findIndex(x => x.date === d);
  if (i >= 0) state.reviews[i] = { ...state.reviews[i], text: c };
  else state.reviews.push({ id: uid(), date: d, text: c, createdAt: Date.now() });
  save(); reviewVisible = TODO_PAGE; renderAll(); alert("复盘已保存");
};

function delReview(id) { 
  askConfirm("删除复盘", "确定删除这条复盘吗？", () => { 
    const x = state.reviews.find(t => t.id === id); 
    if (x) { x.deleted = true; x.updatedAt = Date.now(); }
    save(); renderAll(); 
  }); 
}
