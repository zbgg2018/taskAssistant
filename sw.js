/* =====================================================================
 * sw.js — Service Worker（App Shell 缓存，支持离线打开）
 * 策略：HTML 导航请求「网络优先」（在线永远拿最新版，离线回退缓存）；
 *       其余静态资源「缓存优先 + 后台静默更新」（下次刷新生效）。
 *       发新版只需覆盖上传，无需改 CACHE 版本号。
 * ===================================================================== */
const CACHE = "gzt-online-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./storage.js",
  "./core.js",
  "./modules/todos.js",
  "./modules/reviews.js",
  "./modules/weeklies.js",
  "./modules/reminders.js",
  "./modules/notes.js",
  "./sync.js",
  "./auth.js",
  "./app.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  /* HTML 导航：网络优先，保证在线时永远拿到最新部署版本 */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
        }
        return res;
      }).catch(function () { return caches.match("./index.html"); })
    );
    return;
  }
  /* 其余资源：缓存优先 + 后台静默更新（stale-while-revalidate） */
  e.respondWith(
    caches.match(req).then(function (hit) {
      const net = fetch(req).then(function (res) {
        if (res && res.status === 200 && (res.type === "basic" || res.type === "default")) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit || new Response("", { status: 404 }); });
      return hit || net;
    })
  );
});
