// service-worker.js

const CACHE_NAME = "ai-reply-coach-v1";

// 오프라인에서도 기본 화면이 뜨도록 캐시할 파일들
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// 설치 단계: 처음 한 번 캐시
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // 대기 없이 바로 활성화 시도
  self.skipWaiting();
});

// 활성화 단계: 오래된 캐시 정리
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

// 네트워크 요청 가로채기
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // 네비게이션(페이지 이동) 요청이면, 캐시된 index.html로 대응
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match("/index.html").then((cached) => {
        return (
          cached ||
          fetch(request).catch(() => caches.match("/index.html"))
        );
      })
    );
    return;
  }

  // 그 외 요청은 캐시 우선 + 네트워크 백업
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => cached);
    })
  );
});
