// service-worker.js

const CACHE_NAME = "ai-reply-coach-v2";

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// 설치: 처음 접속할 때 필요한 파일들 캐시에 저장
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// 활성화: 예전 캐시 버전 지우기
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 요청 가로채기
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 페이지 이동(네비게이션)일 때: 캐시된 index.html로 처리
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("/index.html").then((cached) => {
        if (cached) return cached;
        return fetch(req).catch(() => caches.match("/index.html"));
      })
    );
    return;
  }

  // 그 외: 캐시 우선, 없으면 네트워크
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached);
    })
  );
});
