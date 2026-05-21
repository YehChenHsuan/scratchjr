// Web.js - Browser-only replacement for iOS.js / Android.js bridge.
// Provides the SAME method signatures used by OS.js, backed by IndexedDB,
// Web Audio, getUserMedia, and MediaRecorder. All callbacks return a string
// (JSON-stringified when appropriate) to mirror the original native bridge.

const DB_NAME = 'scratchjr';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_USERSHAPES = 'usershapes';
const STORE_USERBKGS = 'userbkgs';
const STORE_MEDIA = 'media';
const STORE_FILES = 'files';
const STORE_GESTURES = 'gestures';

let dbPromise = null;
function openDB () {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            [STORE_PROJECTS, STORE_USERSHAPES, STORE_USERBKGS].forEach(name => {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name, {keyPath: 'id', autoIncrement: true});
                }
            });
            if (!db.objectStoreNames.contains(STORE_MEDIA)) db.createObjectStore(STORE_MEDIA, {keyPath: 'md5'});
            if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES, {keyPath: 'name'});
            if (!db.objectStoreNames.contains(STORE_GESTURES)) db.createObjectStore(STORE_GESTURES, {keyPath: 'projectId'});
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

function tx (name, mode = 'readonly') {
    return openDB().then(db => db.transaction(name, mode).objectStore(name));
}
function p (request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
function cb (fcn, value) {
    if (fcn) setTimeout(() => fcn(typeof value === 'string' ? value : JSON.stringify(value)), 0);
}

// --- Tiny SQL parser. ScratchJr only issues a handful of shapes. ---
function parseSQL (stmt, values) {
    const s = stmt.trim(); let m;
    if ((m = /^insert\s+into\s+(\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i.exec(s))) {
        return {op: 'insert', table: m[1], cols: m[2].split(',').map(c => c.trim()), values};
    }
    if ((m = /^update\s+(\w+)\s+set\s+(.+?)\s+where\s+(.+)$/i.exec(s))) {
        return {op: 'update', table: m[1],
            setCols: m[2].split(',').map(p => p.trim().split('=')[0].trim()),
            where: m[3], values};
    }
    if ((m = /^select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(.+))?$/i.exec(s))) {
        return {op: 'select', table: m[2], cols: m[1].trim(), where: m[3] || null, order: m[4] || null, values};
    }
    if ((m = /^delete\s+from\s+(\w+)\s+where\s+(.+)$/i.exec(s))) {
        return {op: 'delete', table: m[1], where: m[2], values};
    }
    return null;
}

function matchWhere (row, where, values) {
    if (!where) return true;
    const parts = where.split(/\s+and\s+/i);
    let vi = 0;
    for (const part of parts) {
        const t = part.trim();
        let mm;
        if ((mm = /^(\w+)\s*=\s*\?$/.exec(t))) {
            if (String(row[mm[1]]) !== String(values[vi++])) return false;
        } else if ((mm = /^(\w+)\s*=\s*'?([^']*)'?$/.exec(t))) {
            if (String(row[mm[1]]) !== mm[2]) return false;
        } else if (/is\s+null$/i.test(t)) {
            const col = t.split(/\s+/)[0]; if (row[col] != null) return false;
        } else if (/is\s+not\s+null$/i.test(t)) {
            const col = t.split(/\s+/)[0]; if (row[col] == null) return false;
        }
    }
    return true;
}

async function execSQL (parsed) {
    const db = await openDB();
    if (!db.objectStoreNames.contains(parsed.table)) return parsed.op === 'select' ? [] : 0;
    const mode = parsed.op === 'select' ? 'readonly' : 'readwrite';
    const store = db.transaction(parsed.table, mode).objectStore(parsed.table);
    if (parsed.op === 'insert') {
        const row = {};
        parsed.cols.forEach((c, i) => row[c] = parsed.values[i]);
        return await p(store.add(row));
    }
    if (parsed.op === 'select') {
        let rows = (await p(store.getAll())).filter(r => matchWhere(r, parsed.where, parsed.values || []));
        if (parsed.order) {
            const [col, dir] = parsed.order.split(/\s+/);
            rows.sort((a, b) => {
                if (a[col] === b[col]) return 0;
                return (a[col] > b[col] ? 1 : -1) * (dir && dir.toLowerCase() === 'desc' ? -1 : 1);
            });
        }
        if (parsed.cols !== '*') {
            const cols = parsed.cols.split(',').map(c => c.trim());
            rows = rows.map(r => { const o = {}; cols.forEach(c => o[c] = r[c]); return o; });
        }
        return rows;
    }
    if (parsed.op === 'update') {
        const m = /id\s*=\s*(\d+)/i.exec(parsed.where);
        if (m) {
            const id = parseInt(m[1]);
            const row = await p(store.get(id));
            if (row) {
                parsed.setCols.forEach((c, i) => row[c] = parsed.values[i]);
                await p(store.put(row));
            }
        }
        return 1;
    }
    if (parsed.op === 'delete') {
        const all = await p(store.getAll());
        const matched = all.filter(r => matchWhere(r, parsed.where, parsed.values || []));
        for (const r of matched) await p(store.delete(r.id));
        return matched.length;
    }
}

// Very lightweight content-addressed hash for media (not cryptographic).
function quickHash (str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const a = (h2 >>> 0).toString(16).padStart(8, '0');
    const b = (h1 >>> 0).toString(16).padStart(8, '0');
    return a + b + a + b;
}

const audioCtx = (typeof AudioContext !== 'undefined') ? new AudioContext() : null;
const soundBuffers = {};
const playingNodes = {};

let mediaStream = null;
let videoEl = null;
let mediaRecorder = null;
let recordedChunks = [];

export default class Web {
    // ---- Database ---------------------------------------------------------
    static stmt (json, fcn) {
        const parsed = parseSQL(json.stmt, json.values || []);
        if (!parsed) { cb(fcn, ''); return; }
        execSQL(parsed).then(r => cb(fcn, String(r == null ? '' : r)))
            .catch(e => { console.error('[Web.stmt]', e, json); cb(fcn, ''); });
    }
    static query (json, fcn) {
        const parsed = parseSQL(json.stmt, json.values || []);
        if (!parsed) { cb(fcn, '[]'); return; }
        execSQL(parsed).then(rows => cb(fcn, JSON.stringify(rows || [])))
            .catch(e => { console.error('[Web.query]', e, json); cb(fcn, '[]'); });
    }

    // ---- Settings / media files ------------------------------------------
    static getsettings (fcn) {
        // Format expected by IO.js: "path mode camera"
        cb(fcn, './ web YES');
    }
    static cleanassets (ft, fcn) { cb(fcn, '1'); }

    static getmedia (file, fcn) {
        tx(STORE_MEDIA).then(s => p(s.get(file))).then(rec => cb(fcn, rec ? rec.data : ''));
    }
    static setmedia (data, ext, fcn) {
        const name = quickHash(data).substr(0, 32) + '.' + ext;
        tx(STORE_MEDIA, 'readwrite').then(s => p(s.put({md5: name, data, ext})))
            .then(() => cb(fcn, name));
    }
    static setmedianame (data, name, ext, fcn) {
        const finalName = name + '.' + ext;
        tx(STORE_MEDIA, 'readwrite').then(s => p(s.put({md5: finalName, data, ext})))
            .then(() => cb(fcn, finalName));
    }
    static getmd5 (str, fcn) { cb(fcn, quickHash(str)); }
    static remove (file, fcn) {
        tx(STORE_MEDIA, 'readwrite').then(s => p(s.delete(file))).then(() => cb(fcn, '1'));
    }
    static getfile (name, fcn) {
        tx(STORE_FILES).then(s => p(s.get(name))).then(rec => cb(fcn, rec ? rec.data : ''));
    }
    static setfile (name, data, fcn) {
        tx(STORE_FILES, 'readwrite').then(s => p(s.put({name, data}))).then(() => cb(fcn, '1'));
    }

    // ---- Sound ------------------------------------------------------------
    static registerSound (dir, name, fcn) {
        if (!audioCtx) { cb(fcn, '0'); return; }
        fetch(dir + '/' + name).then(r => r.arrayBuffer())
            .then(buf => audioCtx.decodeAudioData(buf))
            .then(a => { soundBuffers[name] = a; cb(fcn, '1'); })
            .catch(() => cb(fcn, '0'));
    }
    static playSound (name, fcn) {
        const buf = soundBuffers[name];
        if (!buf || !audioCtx) { cb(fcn, '0'); return; }
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(audioCtx.destination);
        src.onended = () => { delete playingNodes[name]; OS_soundDone(name); };
        src.start();
        playingNodes[name] = src;
        cb(fcn, '1');
    }
    static stopSound (name, fcn) {
        const n = playingNodes[name];
        if (n) try { n.stop(); } catch (e) {}
        delete playingNodes[name];
        cb(fcn, '1');
    }

    // ---- Sound recording --------------------------------------------------
    static sndrecord (fcn) {
        if (!navigator.mediaDevices) { cb(fcn, '0'); return; }
        navigator.mediaDevices.getUserMedia({audio: true}).then(stream => {
            recordedChunks = [];
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
            mediaRecorder.start();
            cb(fcn, '1');
        }).catch(() => cb(fcn, '0'));
    }
    static recordstop (fcn) {
        if (!mediaRecorder) { cb(fcn, ''); return; }
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks);
            const reader = new FileReader();
            reader.onloadend = () => {
                const b64 = (reader.result || '').split(',')[1] || '';
                const name = 'rec_' + Date.now() + '.wav';
                tx(STORE_MEDIA, 'readwrite').then(s => p(s.put({md5: name, data: b64, ext: 'wav'})))
                    .then(() => cb(fcn, name));
            };
            reader.readAsDataURL(blob);
            mediaRecorder.stream.getTracks().forEach(t => t.stop());
            mediaRecorder = null;
        };
        mediaRecorder.stop();
    }
    static volume (fcn) { cb(fcn, '0.5'); }
    static startplay (fcn) { cb(fcn, '1'); }
    static stopplay (fcn) { cb(fcn, '1'); }
    static recorddisappear (b, fcn) { cb(fcn, '1'); }

    // ---- Camera -----------------------------------------------------------
    static hascamera () { return true; }
    static startfeed (data, fcn) {
        if (!navigator.mediaDevices) { cb(fcn, '0'); return; }
        const constraints = {video: {facingMode: data && data.direction === 'back' ? 'environment' : 'user'}};
        navigator.mediaDevices.getUserMedia(constraints).then(s => {
            mediaStream = s;
            videoEl = document.createElement('video');
            videoEl.srcObject = s; videoEl.play();
            cb(fcn, '1');
        }).catch(() => cb(fcn, '0'));
    }
    static stopfeed (fcn) {
        if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null; videoEl = null;
        cb(fcn, '1');
    }
    static choosecamera (mode, fcn) { cb(fcn, '1'); }
    static captureimage (fcn) {
        if (!videoEl) { cb(fcn, ''); return; }
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth; canvas.height = videoEl.videoHeight;
        canvas.getContext('2d').drawImage(videoEl, 0, 0);
        const b64 = canvas.toDataURL('image/png').split(',')[1];
        const name = 'photo_' + Date.now() + '.png';
        tx(STORE_MEDIA, 'readwrite').then(s => p(s.put({md5: name, data: b64, ext: 'png'})))
            .then(() => cb(fcn, name));
    }

    // ---- Share & misc -----------------------------------------------------
    static createZipForProject (projectData, metadata, name, fcn) {
        // Simplified: download project JSON. A real zip implementation
        // (e.g. JSZip) can be added later if cross-device sharing is needed.
        const blob = new Blob([projectData], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name + '.sjr.json';
        a.click();
        cb(fcn, name + '.sjr.json');
    }
    static sendSjrToShareDialog () {}
    static deviceName (fcn) { cb(fcn, 'web'); }
    static analyticsEvent () {}
    static setAnalyticsPlacePref () {}
    static setAnalyticsPref () {}

    // ---- AI Gesture model persistence ------------------------------------
    // Used by GestureStorage in the AI trainer feature.
    static gesture_save (projectId, payload, fcn) {
        tx(STORE_GESTURES, 'readwrite')
            .then(s => p(s.put({projectId, payload, mtime: Date.now()})))
            .then(() => cb(fcn, '1'));
    }
    static gesture_load (projectId, fcn) {
        tx(STORE_GESTURES).then(s => p(s.get(projectId)))
            .then(rec => cb(fcn, rec ? JSON.stringify(rec.payload) : ''));
    }
    static gesture_metadata (projectId, fcn) {
        tx(STORE_GESTURES).then(s => p(s.get(projectId))).then(rec => {
            if (!rec) { cb(fcn, '[]'); return; }
            try { cb(fcn, JSON.stringify(Object.keys(rec.payload.dataset || {}))); }
            catch (e) { cb(fcn, '[]'); }
        });
    }
}

// Hook used by OS.js's soundDone bridge. Kept here so iOS/Android paths
// don't need to know about the web sound-end notification.
function OS_soundDone (name) {
    try {
        // Lazy import to avoid circular dependency at module init time.
        const OS = require('./OS').default;
        if (OS && OS.soundDone) OS.soundDone(name);
    } catch (e) {}
}
