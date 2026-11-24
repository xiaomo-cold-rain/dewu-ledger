/* 砖记 · Service Worker
   单文件应用只需要缓存应用外壳：页面、manifest 和图标。
   页面采用「网络优先」保证更新能拿到；图标等静态资源用「缓存优先」保证离线可用。 */

const CACHE_PREFIX = 'dewu-ledger-';
const VERSION = 'v1';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const OFFLINE_PAGE = './index.html';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL.map(function (url) {
        return new Request(url, { cache: 'reload' });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME) return caches.delete(key);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.slice(-6) === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

function networkFirst(request) {
  return fetch(request).then(function (response) {
    if (response && response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(request, copy);
      }).catch(function () {});
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      return cached || caches.match(OFFLINE_PAGE);
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (response) {
      if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy);
        }).catch(function () {});
      }
      return response;
    });
  });
}
