/* global self, caches, fetch, Response */
importScripts('./precache-manifest.js');

const CACHE_PREFIX = 'scratchjr-';
const CORE_CACHE = CACHE_PREFIX + 'core-' + self.__SCRATCHJR_PRECACHE_VERSION;
const AI_CACHE = CACHE_PREFIX + 'ai-' + self.__SCRATCHJR_PRECACHE_VERSION;
const CORE_URLS = self.__SCRATCHJR_CORE_URLS || [];
const AI_URLS = self.__SCRATCHJR_AI_URLS || [];
const CRITICAL_URLS = ['./index.html', './home.html', './editor.html', './app.bundle.js', './settings.json'];

function cleanResponse (response) {
    if (!response || !response.ok) return Promise.resolve(response);
    return response.blob().then(body => new Response(body, {
        status: 200,
        headers: {'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream'}
    }));
}

function cacheFiles (cacheName, urls, notify) {
    return caches.open(cacheName).then(cache => {
        let completed = 0;
        let next = 0;
        const results = [];
        const worker = () => {
            const index = next++;
            if (index >= urls.length) return Promise.resolve();
            const url = urls[index];
            return fetch(url, {credentials: 'same-origin', cache: 'no-store'}).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return cleanResponse(r); }).then(clean => cache.put(url, clean)).then(() => ({url, ok: true}))
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
    event.waitUntil(cacheFiles(CORE_CACHE, CORE_URLS, (completed, total) => {
        if (completed === total || completed % 5 === 0) {
            notifyClients({type: 'CORE_CACHE_PROGRESS', completed, total});
        }
    }).then(results => {
        const failed = results.filter(item => !item.ok).length;
        return notifyClients({type: 'CORE_CACHE_COMPLETE', total: results.length, failed}).then(() => results);
    }).then(results => {
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

// App code (HTML shell, JS bundle and stylesheets) must always be fetched
// from the network first so a rebuilt app.bundle.js or an updated CSS file is
// picked up immediately - falling back to cache only when offline. Everything
// else (images, sounds, etc.) is safe to serve cache-first since those assets
// don't change without also changing their filename/md5.
function isAppCode (url) {
    return url.pathname.endsWith('.html') || url.pathname.endsWith('.css') ||
        url.pathname.endsWith('/app.bundle.js') || url.pathname.endsWith('/') ||
        url.pathname.endsWith('/media.json') || url.pathname.endsWith('/settings.json');
}

function notifyClients (message) {
    return self.clients.matchAll({includeUncontrolled: true}).then(clients => {
        clients.forEach(client => client.postMessage(message));
    });
}

function cacheAI () {
    return caches.open(AI_CACHE).then(cache => cache.keys().then(keys => {
        if (keys.length >= AI_URLS.length) return null;
        return cacheFiles(AI_CACHE, AI_URLS, (completed, total) => {
            if (completed === total || completed % 5 === 0) {
                notifyClients({type: 'AI_CACHE_PROGRESS', completed, total});
            }
        }).then(results => {
            const failed = results.filter(item => !item.ok).length;
            return notifyClients({type: 'AI_CACHE_COMPLETE', total: results.length, failed});
        });
    }));
}

self.addEventListener('message', event => {
    if (!event.data) return;
    if (event.data.type === 'CACHE_AI') {
        event.waitUntil(cacheAI());
    } else if (event.data.type === 'GET_CACHE_STATUS') {
        event.waitUntil(Promise.all([
            caches.open(CORE_CACHE).then(cache => cache.keys()).then(keys => keys.length),
            caches.open(AI_CACHE).then(cache => cache.keys()).then(keys => keys.length)
        ]).then(([coreCached, aiCached]) => {
            const message = {
                type: 'CACHE_STATUS',
                coreCached,
                coreTotal: CORE_URLS.length,
                aiCached,
                aiTotal: AI_URLS.length
            };
            if (event.source) event.source.postMessage(message);
            else return notifyClients(message);
        }));
    }
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const range = request.headers.get('range');
    if (range) {
        event.respondWith(caches.match(request.url, {ignoreSearch: true, ignoreVary: true}).then(cached => {
            if (!cached) return fetch(request);
            const match = /^bytes=(\d+)-(\d*)$/.exec(range);
            if (!match) return cached;
            return cached.blob().then(blob => {
                const total = blob.size;
                const start = Number(match[1]);
                const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
                if (start >= total || start > end) {
                    return new Response(null, {status: 416, headers: {'Content-Range': 'bytes */' + total}});
                }
                const chunk = blob.slice(start, end + 1);
                return new Response(chunk, {
                    status: 206,
                    headers: {
                        'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
                        'Content-Length': String(end - start + 1),
                        'Content-Type': cached.headers.get('Content-Type') || 'application/octet-stream',
                        'Accept-Ranges': 'bytes'
                    }
                });
            });
        }));
        return;
    }

    if (isAppCode(url) || request.mode === 'navigate') {
        event.respondWith(fetch(request).then(response => {
            if (!response || response.status !== 200) return response;
            const copy = response.clone();
            cleanResponse(copy).then(clean => caches.open(CORE_CACHE).then(cache => cache.put(request, clean)));
            return response;
        }).catch(() => caches.match(request, {ignoreSearch: true, ignoreVary: true})
            .then(cached => cached || caches.match('./index.html', {ignoreVary: true}))));
        return;
    }

    const targetCache = url.pathname.indexOf('/vendor/ai/') > -1 ? AI_CACHE : CORE_CACHE;
    event.respondWith(caches.match(request, {ignoreVary: true})
        .then(cached => cached || caches.match(request, {ignoreSearch: true, ignoreVary: true}))
        .then(cached => cached || fetch(request).then(response => {
            if (!response || response.status !== 200) return response;
            const copy = response.clone();
            cleanResponse(copy).then(clean => caches.open(targetCache).then(cache => cache.put(request, clean)));
            return response;
        }).catch(() => new Response('', {status: 503, statusText: 'Offline'}))));
});
