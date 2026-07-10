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

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(caches.match(request, {ignoreSearch: request.mode === 'navigate'})
        .then(cached => cached || fetch(request).then(response => {
            if (!response || response.status !== 200) return response;
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
            return response;
        }).catch(() => {
            if (request.mode === 'navigate') {
                return caches.match('./index.html');
            }
            return new Response('', {status: 503, statusText: 'Offline'});
        })));
});

