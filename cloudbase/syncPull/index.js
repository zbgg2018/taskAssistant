/* =====================================================================
 * syncPull/index.js — 拉取该用户全部数据（含 deleted 软删标记）
 * 请求 data：{ token }
 * 返回：{ code:0, items:{todos,reviews,weeklies,reminders,notes}, settings, serverTime }
 * 说明：个人单用户量级小，采用「全量拉取 + 客户端 LWW 合并」，简单稳健。
 * ===================================================================== */
"use strict";
const { db, COLLS, TYPES, getUid } = require("./ctx");

function strip(d) {
  if (!d) return d;
  const { _id, user_id, rev, _openid, ...rest } = d;
  return rest; // 保留 id / updatedAt / deleted / 实体字段
}
function stripSettings(d) {
  if (!d) return null;
  const { _id, user_id, rev, updatedAt, _openid, ...rest } = d;
  return Object.assign({ updatedAt }, rest);
}

exports.main = async (event) => {
  let uid;
  try { uid = await getUid(event); } catch (e) { return { code: e.code || 401, msg: e.message }; }

  const items = {};
  for (const type of TYPES) {
    const q = await db.collection(COLLS[type]).where({ user_id: uid }).limit(1000).get();
    items[type] = (q.data || []).map(strip);
  }
  const s = await db.collection("settings").doc(uid).get();
  const settings = (s.data && s.data[0]) ? stripSettings(s.data[0]) : null;

  return { code: 0, items, settings, serverTime: Date.now() };
};
