/* =====================================================================
 * modules/notes.js — 随笔 / 灵感
 * 依赖全局：state(save)、uid/pad2/esc(core)、renderAll(core)
 * ===================================================================== */
"use strict";

let noteVisible = TODO_PAGE;

function renderNote() {
  let list = state.notes.filter(x => !x.deleted).slice().sort((a, b) => cmp(b.createdAt, a.createdAt));
  let html = "";
  if (!list.length) html = '<div class="empty-s">还没有灵感记录，在上方随手记一笔吧。</div>';
  list.slice(0, noteVisible).forEach(x => {
    const d = new Date(x.createdAt);
    const ts = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    html += '<div class="list-item"><div class="li-body">' +
      (x.title ? '<div class="li-t">' + esc(x.title) + '</div>' : '') +
      '<div class="li-note">' + esc(x.content) + '</div>' +
      '<div class="li-meta">' + ts + '</div></div>' +
      '<div class="li-act"><button class="iconbtn sm del-btn" title="删除" onclick="delNote(\'' + x.id + '\')">' + I.trash + '<span class="txt">删除</span></button></div></div>';
  });
  if (list.length > noteVisible) html += '<button class="btn block more" onclick="noteLoadMore()">加载更多（还剩 ' + (list.length - noteVisible) + ' 条）</button>';
  document.getElementById("noteList").innerHTML = html;
}
function noteLoadMore() { noteVisible += TODO_PAGE; renderNote(); }

document.getElementById("addNote").onclick = () => {
  const ti = document.getElementById("noteTitle").value.trim();
  const co = document.getElementById("noteContent").value.trim();
  if (!co) { alert("请填写灵感内容"); return; }
  state.notes.push({ id: uid(), title: ti, content: co, createdAt: Date.now() });
  document.getElementById("noteTitle").value = "";
  document.getElementById("noteContent").value = "";
  noteVisible = TODO_PAGE;
  save(); renderAll();
};
document.getElementById("noteContent").addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); document.getElementById("addNote").click(); }
});
function delNote(id) { 
  askConfirm("删除灵感", "确定删除这条灵感吗？", () => { 
    const x = state.notes.find(t => t.id === id); 
    if (x) { x.deleted = true; x.updatedAt = Date.now(); }
    save(); renderAll(); 
  }); 
}
