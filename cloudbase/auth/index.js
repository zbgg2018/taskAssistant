/* =====================================================================
 * auth/index.js — 登录 / 首次注册（自研 Token 鉴权）
 * 请求 data：{ action:"login", username, password }
 * 返回：{ code:0, token, uid } 或 { code, msg }
 *   - 首次使用该用户名 → 自动创建账号（密码 scrypt 哈希存储）
 *   - 已存在 → 校验密码
 *   - 成功 → 签发 30 天有效 token（HMAC，AUTH_SECRET 见环境变量）
 * 控制台前置：环境变量 AUTH_SECRET 必填
 * ===================================================================== */
"use strict";
const { db, crypto, newSalt, hashPassword, makeToken, fail } = require("./ctx");

exports.main = async (event) => {
  const { action = "login", username, password } = event || {};
  if (action !== "login") return { code: 400, msg: "未知操作" };
  if (!username || !password) return { code: 400, msg: "请输入用户名和密码" };
  const uname = String(username).trim().slice(0, 30);
  if (uname.length < 2) return { code: 400, msg: "用户名至少 2 个字符" };
  if (String(password).length < 6) return { code: 400, msg: "密码至少 6 位" };

  const users = db.collection("users");
  const res = await users.where({ username: uname }).get();
  let uid;
  if (!res.data.length) {
    uid = "u_" + crypto.randomBytes(8).toString("hex");
    const salt = newSalt();
    await users.add({
      _id: uid, username: uname,
      pwSalt: salt, pwHash: hashPassword(password, salt),
      createdAt: Date.now(), lastActiveAt: Date.now()
    });
  } else {
    const u = res.data[0];
    uid = u._id;
    if (u.pwHash !== hashPassword(password, u.pwSalt)) return { code: 401, msg: "密码错误" };
    await users.doc(uid).update({ lastActiveAt: Date.now() });
  }

  try {
    const token = makeToken(uid, uname);
    return { code: 0, token, uid };
  } catch (e) {
    return { code: e.code || 500, msg: e.message };
  }
};
