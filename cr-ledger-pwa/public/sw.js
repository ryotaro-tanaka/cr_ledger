self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  self.clients.claim();
});

// いまはキャッシュしない（後で拡張）
self.addEventListener("fetch", () => {});
