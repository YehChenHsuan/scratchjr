/* global self, caches, fetch, Response */
importScripts('./precache-manifest.js');

const CACHE_PREFIX = 'scratchjr-ai-';
const CACHE_NAME = CACHE_PREFIX + self.__SCRATCHJR_PRECACHE_VERSION;
const PRECACHE_URLS = self.__SCRATCHJR_PRECACHE_URLS || [];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
        .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys
        .filter(key => key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
        .then(() => self.clients.claim()));
});

// App code (HTML shell + JS bundle) must always be fetched from the network
// first so a rebuilt app.bundle.js is picked up immediately - falling back to
// cache only when offline. Everything else (images, sounds, etc.) is safe to
// serve cache-first since those assets don't change without also changing
// their filename/md5.
function isAppCode (url) {
    return url.pathname.endsWith('/index.html') || url.pathname.endsWith('/aitrainer.html') ||
        url.pathname.endsWith('/app.bundle.js') || url.pathname.endsWith('/');
}

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (isAppCode(url) || request.mode === 'navigate') {
        event.respondWith(fetch(request).then(response => {
            if (!response || response.status !== 200) return response;
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
            return response;
        }).catch(() => caches.match(request, {ignoreSearch: true})
            .then(cached => cached || caches.match('./index.html'))));
        return;
    }

    event.respondWith(caches.match(request)
        .then(cached => cached || fetch(request).then(response => {
            if (!response || response.status !== 200) return response;
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
            return response;
        }).catch(() => new Response('', {status: 503, statusText: 'Offline'}))));
});

