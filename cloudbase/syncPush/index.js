/* =====================================================================
 * syncPush/index.js — 增量上传本地数据（LWW 按 updatedAt 覆盖，user_id 过滤）
 * 请求 data：{ token, state:{ todos,reviews,weeklies,reminders,notes,settings } }
 * 返回：{ code:0, serverTime, count }
 * 安全：所有写操作强制 where user_id=uid；未登录/Token 失效 → 401
 * ===================================================================== */
"use strict";
const { db, _, COLLS, TYPES, getUid } = require("./ctx");

const ALLOWED_FIELDS = {
  todos: ["content", "start", "end", "category", "priority", "done", "note", "createdAt", "sample", "recurrence", "doneDates"],
  reviews: ["date", "text", "createdAt", "sample"],
  weeklies: ["start", "end", "last", "plan", "createdAt", "sample"],
  reminders: ["title", "time", "content", "done", "createdAt", "sample"],
  notes: ["title", "content", "createdAt"]
};
function pick(type, it) {
  const out = {};
  (ALLOWED_FIELDS[type] || []).forEach(f => { if (it[f] !== undefined) out[f] = it[f]; });
  return out;
}

exports.main = async (event) => {
  let uid;
  try { uid = await getUid(event); } catch (e) { return { code: e.code || 401, msg: e.message }; }

  const state = event.state || {};
  const now = Date.now();
  let count = 0;

  for (const type of TYPES) {
    const items = Array.isArray(state[type]) ? state[type] : [];
    const coll = db.collection(COLLS[type]);
    for (const it of items) {
      if (!it || !it.id) continue;
      const _id = uid + "_" + it.id;
      const updatedAt = it.updatedAt || now;
      const ex = await coll.doc(_id).get();
      const cur = ex.data && ex.data[0];
      if (cur && cur.updatedAt > updatedAt) continue; // LWW：远端更新则跳过（owner 本人，极少触发）
      const fields = pick(type, it);
      await coll.doc(_id).set(Object.assign({
        id: it.id, user_id: uid, updatedAt, deleted: !!it.deleted,
        rev: (cur ? (cur.rev || 0) : 0) + 1
      }, fields));
      count++;
    }
  }

  if (state.settings && typeof state.settings === "object") {
    const s = state.settings;
    const updatedAt = s.updatedAt || now;
    const curS = await db.collection("settings").doc(uid).get();
    const cur = curS.data && curS.data[0];
    if (!cur || updatedAt >= (cur.updatedAt || 0)) {
      const so = { user_id: uid, updatedAt };
      ["userName", "pageSize", "categories"].forEach(k => { if (s[k] !== undefined) so[k] = s[k]; });
      await db.collection("settings").doc(uid).set(so);
    }
  }

  return { code: 0, serverTime: now, count };
};
