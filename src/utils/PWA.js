const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

// Stylesheets are loaded with synchronous XHR (see lib.js preprocessAndLoad),
// which bypasses the service worker and fails offline. Prefetch every page's
// CSS into the same localStorage keys the sync loader falls back to, so any
// page can boot offline even if it was never visited online.
const PAGE_CSS = ['css/fixedviewport.css', 'css/font.css', 'css/base.css', 'css/start.css',
    'css/thumbs.css', 'css/editor.css', 'css/lobby.css', 'css/editorleftpanel.css',
    'css/editorstage.css', 'css/editormodal.css', 'css/librarymodal.css',
    'css/paintlook.css', 'css/gs.css', 'css/aitrainer.css'];

function prefetchCssForOffline () {
    PAGE_CSS.forEach(url => {
        window.fetch(url).then(res => (res.ok ? res.text() : null)).then(text => {
            if (text) {
                try {
                    window.localStorage.setItem('scratchjr_asset_' + url, text);
                } catch (e) {
                    // storage full - sync loader will still work online
                }
            }
        }).catch(() => {});
    });
}
let sawDownloading = false;
const SAW_DOWNLOADING_STATE = 'sawDownloading';

export function registerPWA () {
    if (!('serviceWorker' in navigator)) return;
    const secure = window.location.protocol === 'https:' ||
        LOCAL_HOSTS.indexOf(window.location.hostname) > -1;
    if (!secure) return;
    const progress = {
        core: {completed: 0, total: 0, complete: false},
        ai: {completed: 0, total: 0, complete: false}
    };
    let progressBar;
    const createProgressBar = () => {
        if (progressBar) return progressBar;
        const bar = document.createElement('div');
        const fill = document.createElement('div');
        const text = document.createElement('div');
        bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:24px;background:rgba(0,0,0,.78);z-index:2147483647;pointer-events:none;opacity:1;transition:opacity .45s ease;';
        fill.style.cssText = 'position:absolute;left:0;top:0;bottom:0;width:0;background:#00a8fc;transition:width .2s ease;';
        text.style.cssText = 'position:relative;color:#fff;text-align:center;font:13px/24px Arial,sans-serif;';
        text.textContent = '正在下載離線資料 0%';
        bar.appendChild(fill);
        bar.appendChild(text);
        document.body.appendChild(bar);
        progressBar = {bar, fill, text};
        return progressBar;
    };
    const updateProgressBar = () => {
        if (!progressBar) return;
        const completed = progress.core.completed + progress.ai.completed;
        const total = progress.core.total + progress.ai.total;
        const percent = total ? Math.min(100, Math.round(completed / total * 100)) : 0;
        progressBar.fill.style.width = percent + '%';
        progressBar.text.textContent = '正在下載離線資料 ' + percent + '%';
        if (sawDownloading && progress.core.complete && progress.ai.complete) {
            progressBar.fill.style.width = '100%';
            progressBar.text.textContent = '✓ 已完成下載，可離線使用';
            window.localStorage.setItem('scratchjr_offline_ready', '1');
            window.setTimeout(() => { progressBar.bar.style.opacity = '0'; }, 3000);
        }
    };
    const showProgressBar = () => {
        if (!sawDownloading && navigator.serviceWorker.controller !== null) return;
        const ui = createProgressBar();
        ui.bar.style.opacity = '1';
        updateProgressBar();
    };
    if (navigator.serviceWorker.controller === null) {
        showProgressBar();
    }
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
        if (data.type === 'CORE_CACHE_PROGRESS') {
            progress.core.completed = data.completed;
            progress.core.total = data.total;
            if (data.completed < data.total) sawDownloading = true;
            showProgressBar();
            updateProgressBar();
        } else if (data.type === 'CORE_CACHE_COMPLETE') {
            progress.core.completed = data.total;
            progress.core.total = data.total;
            progress.core.complete = true;
            if (sawDownloading) showProgressBar();
            updateProgressBar();
        } else if (data.type === 'AI_CACHE_PROGRESS') {
            progress.ai.completed = data.completed;
            progress.ai.total = data.total;
            if (data.completed < data.total) sawDownloading = true;
            window.localStorage.setItem('scratchjr_ai_cache_status', JSON.stringify(data));
            showProgressBar();
            updateProgressBar();
        } else if (data.type === 'AI_CACHE_COMPLETE') {
            if (data.failed > 0) {
                window.console.warn('[PWA] ' + SAW_DOWNLOADING_STATE + ': AI cache failed for ' + data.failed + ' file(s)');
                return;
            }
            progress.ai.completed = data.total;
            progress.ai.total = data.total;
            progress.ai.complete = true;
            window.localStorage.setItem('scratchjr_ai_cache_status', JSON.stringify(data));
            if (sawDownloading) showProgressBar();
            updateProgressBar();
        } else if (data.type === 'CACHE_STATUS') {
            progress.core.completed = data.coreCached;
            progress.core.total = data.coreTotal;
            progress.core.complete = data.coreCached >= data.coreTotal;
            progress.ai.completed = data.aiCached;
            progress.ai.total = data.aiTotal;
            progress.ai.complete = data.aiCached >= data.aiTotal;
            if (!progress.core.complete || !progress.ai.complete) {
                sawDownloading = true;
                showProgressBar();
            }
            updateProgressBar();
        }
    });
    navigator.serviceWorker.register('./service-worker.js', {updateViaCache: 'none'}).then(registration => {
        registration.update();
        return navigator.serviceWorker.ready;
    }).then(registration => {
        const worker = registration.active || navigator.serviceWorker.controller;
        if (worker) {
            worker.postMessage({type: 'CACHE_AI'});
            worker.postMessage({type: 'GET_CACHE_STATUS'});
        }
        prefetchCssForOffline();
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
