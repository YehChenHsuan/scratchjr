const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

export function registerPWA () {
    if (!('serviceWorker' in navigator)) return;
    const secure = window.location.protocol === 'https:' ||
        LOCAL_HOSTS.indexOf(window.location.hostname) > -1;
    if (!secure) return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.localStorage.setItem('scratchjr_pwa_updated_at', new Date().toISOString());
        if (window.scratchJrPage !== 'editor' && window.scratchJrPage !== 'aitrainer') {
            window.location.reload();
        }
    });
    navigator.serviceWorker.addEventListener('message', event => {
        const data = event.data || {};
        if (data.type === 'AI_CACHE_PROGRESS' || data.type === 'AI_CACHE_COMPLETE') {
            window.localStorage.setItem('scratchjr_ai_cache_status', JSON.stringify(data));
        }
    });
    navigator.serviceWorker.register('./service-worker.js', {updateViaCache: 'none'}).then(registration => {
        registration.update();
        return navigator.serviceWorker.ready;
    }).then(registration => {
        const worker = registration.active || navigator.serviceWorker.controller;
        if (worker) worker.postMessage({type: 'CACHE_AI'});
    }).catch(error => window.console.warn('[PWA] service worker registration failed', error));
}

export function requestPersistentStorage () {
    if (!navigator.storage || !navigator.storage.persist) {
        return Promise.resolve(false);
    }
    const estimate = navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve({});
    return Promise.all([navigator.storage.persist(), estimate]).then(([granted, storage]) => {
        window.localStorage.setItem('scratchjr_storage_persistent', granted ? '1' : '0');
        window.localStorage.setItem('scratchjr_storage_status', JSON.stringify({
            persistent: granted,
            usage: storage.usage || 0,
            quota: storage.quota || 0,
            checkedAt: new Date().toISOString()
        }));
        return granted;
    }).catch(() => false);
}
