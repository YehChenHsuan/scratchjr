/* global self, caches, fetch, Response */
importScripts('./precache-manifest.js');

const CACHE_PREFIX = 'scratchjr-';
const CORE_CACHE = CACHE_PREFIX + 'core-' + self.__SCRATCHJR_PRECACHE_VERSION;
const AI_CACHE = CACHE_PREFIX + 'ai-' + self.__SCRATCHJR_PRECACHE_VERSION;
const CORE_URLS = self.__SCRATCHJR_CORE_URLS || [];
const AI_URLS = self.__SCRATCHJR_AI_URLS || [];
const CRITICAL_URLS = ['./index.html', './home.html', './editor.html', './app.bundle.js', './settings.json'];

function cacheFiles (cacheName, urls, notify) {
    return caches.open(cacheName).then(cache => {
        let completed = 0;
        let next = 0;
        const results = [];
        const worker = () => {
            const index = next++;
            if (index >= urls.length) return Promise.resolve();
            const url = urls[index];
            return cache.add(url).then(() => ({url, ok: true}))
                .catch(error => ({url, ok: false, error}))
                .then(result => {
                    results[index] = result;
                    completed++;
                    if (notify) notify(completed, urls.length);
                    return worker();
                });
        };
        const workers = [];
        const concurrency = Math.min(3, urls.length);
        for (let i = 0; i < concurrency; i++) workers.push(worker());
        return Promise.all(workers).then(() => results);
    });
}

self.addEventListener('install', event => {
    event.waitUntil(cacheFiles(CORE_CACHE, CORE_URLS).then(results => {
        const failedCritical = results.filter(item => !item.ok && CRITICAL_URLS.indexOf(item.url) > -1);
        if (failedCritical.length) throw new Error('Critical PWA files failed to cache');
        return self.skipWaiting();
    }));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys
        .filter(key => key.indexOf(CACHE_PREFIX) === 0 && key !== CORE_CACHE && key !== AI_CACHE)
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

function notifyClients (message) {
    return self.clients.matchAll({includeUncontrolled: true}).then(clients => {
        clients.forEach(client => client.postMessage(message));
    });
}

function cacheAI () {
    return cacheFiles(AI_CACHE, AI_URLS, (completed, total) => {
        if (completed === total || completed % 5 === 0) {
            notifyClients({type: 'AI_CACHE_PROGRESS', completed, total});
        }
    }).then(results => {
        const failed = results.filter(item => !item.ok).length;
        return notifyClients({type: 'AI_CACHE_COMPLETE', total: results.length, failed});
    });
}

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CACHE_AI') event.waitUntil(cacheAI());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (isAppCode(url) || request.mode === 'navigate') {
        event.respondWith(fetch(request).then(response => {
            if (!response || response.status !== 200) return response;
            const copy = response.clone();
            caches.open(CORE_CACHE).then(cache => cache.put(request, copy));
            return response;
        }).catch(() => caches.match(request, {ignoreSearch: true})
            .then(cached => cached || caches.match('./index.html'))));
        return;
    }

    const targetCache = url.pathname.indexOf('/vendor/ai/') > -1 ? AI_CACHE : CORE_CACHE;
    event.respondWith(caches.match(request)
        .then(cached => cached || fetch(request).then(response => {
            if (!response || response.status !== 200) return response;
            const copy = response.clone();
            caches.open(targetCache).then(cache => cache.put(request, copy));
            return response;
        }).catch(() => new Response('', {status: 503, statusText: 'Offline'}))));
});
