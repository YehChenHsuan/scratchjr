const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

export function registerPWA () {
    if (!('serviceWorker' in navigator)) return;
    const secure = window.location.protocol === 'https:' ||
        LOCAL_HOSTS.indexOf(window.location.hostname) > -1;
    if (!secure) return;
    navigator.serviceWorker.register('./service-worker.js').catch(error => {
        window.console.warn('[PWA] service worker registration failed', error);
    });
}

export function requestPersistentStorage () {
    if (!navigator.storage || !navigator.storage.persist) {
        return Promise.resolve(false);
    }
    return navigator.storage.persist().then(granted => {
        window.localStorage.setItem('scratchjr_storage_persistent', granted ? '1' : '0');
        return granted;
    }).catch(() => false);
}

