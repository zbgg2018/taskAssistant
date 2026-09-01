/* =====================================================================
 * common/ctx.js — CloudBase 云函数共享上下文（被各云函数同目录引用）
 * ---------------------------------------------------------------------
 * 职责：
 *  - 初始化 cloud / db / command
 *  - 密码哈希（scrypt）
 *  - Token 校验（HMAC-SHA256，AUTH_SECRET 来自云函数环境变量）
 *  - 集合常量
 * 部署说明：本文件需与各云函数放在同一目录（已在 auth/syncPush/syncPull 各复制一份）。
 * 控制台前置：① 建云开发环境 ② 建集合 users/todos/reviews/weeklies/reminders/notes/settings
 *           ③ 在「环境 → 环境配置 → 环境变量」设置 AUTH_SECRET（任意长随机串）
 * ===================================================================== */
"use strict";
const tcb = require("@cloudbase/node-sdk");
const cloud = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const crypto = require("crypto");

const COLLS = {
  todos: "todos",
  reviews: "reviews",
  weeklies: "weeklies",
  reminders: "reminders",
  notes: "notes"
};
const TYPES = Object.keys(COLLS);

function newSalt() { return crypto.randomBytes(16).toString("hex"); }
function hashPassword(pw, salt) { return crypto.scryptSync(String(pw), salt, 32).toString("hex"); }

function fail(code, msg) {
  const e = new Error(msg);
  e.code = code;
  return e;
}

/* 从请求中取出已登录 uid；失败抛带 code 的异常 */
async function getUid(event) {
  const token = event && event.token;
  if (!token || typeof token !== "string") throw fail(401, "未登录");
  const parts = token.split(".");
  if (parts.length !== 2) throw fail(401, "登录态无效");
  const payloadB64 = parts[0];
  const sig = parts[1];
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw fail(500, "服务端未配置 AUTH_SECRET 环境变量");
  const expect = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  let a, b;
  try { a = Buffer.from(sig); b = Buffer.from(expect); } catch (e) { throw fail(401, "登录态签名异常"); }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw fail(401, "登录态校验失败");
  let payload;
  try { payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")); }
  catch (e) { throw fail(401, "登录态解析失败"); }
  if (!payload.uid) throw fail(401, "登录态缺少 uid");
  if (payload.exp && Date.now() > payload.exp) throw fail(401, "登录已过期，请重新登录");
  return payload.uid;
}

/* 生成登录 token：<payloadB64>.<sigB64> */
function makeToken(uid, username) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw fail(500, "服务端未配置 AUTH_SECRET 环境变量");
  const payload = { uid, username: username || "", exp: Date.now() + 1000 * 60 * 60 * 24 * 30 };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return payloadB64 + "." + sig;
}

module.exports = { cloud, db, _, crypto, COLLS, TYPES, newSalt, hashPassword, fail, getUid, makeToken };
