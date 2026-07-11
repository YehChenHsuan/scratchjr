// Web.js - Browser-only replacement for iOS.js / Android.js bridge.
// Provides the SAME method signatures used by OS.js, backed by IndexedDB,
// Web Audio, getUserMedia, and MediaRecorder. All callbacks return a string
// (JSON-stringified when appropriate) to mirror the original native bridge.

import JSZip from 'jszip';

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

function allRecords (storeName) {
    return tx(storeName).then(store => p(store.getAll()));
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
        // Format expected by editorMain/homeMain: "path,iOS-flag,record,camera".
        // - path: filesystem root for media (web stores in IDB, so unused; "./")
        // - iOS-flag: "0" means non-iOS (skip iOS path quirks)
        // - record: "YES" enables sound recording (getUserMedia)
        // - camera: "YES" enables camera tool in the paint editor
        cb(fcn, './,0,YES,YES');
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
        // Native bridges return base64-encoded contents; callers atob() it.
        // Default to base64("0") so callers parsing it as a number get 0.
        tx(STORE_FILES).then(s => p(s.get(name))).then(rec => cb(fcn, rec ? rec.data : 'MA=='));
    }
    static setfile (name, data, fcn) {
        // ScratchJr callers pass raw text (e.g. scrollTop as a number-string);
        // native bridges store the bytes and getfile returns base64.
        // Mirror that here so the round-trip via atob() works.
        let encoded;
        try { encoded = btoa(unescape(encodeURIComponent(String(data)))); }
        catch (e) { encoded = 'MA=='; }
        tx(STORE_FILES, 'readwrite').then(s => p(s.put({name, data: encoded}))).then(() => cb(fcn, '1'));
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
    // Paint.rightPalette checks `OS.camera == '1'` (string) so return that,
    // not a boolean.
    static hascamera () { return '1'; }

    // Native bridges overlay a hardware camera view at the given screen
    // coords. On web we mount a <video> covering the entire workspace
    // (mx, my, mw, mh) and lay the supplied mask image on top so only the
    // target shape's region shows live video, just like the iOS preview.
    static startfeed (data, fcn) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            cb(fcn, '0'); return;
        }
        const constraints = {video: {facingMode: data && data.direction === 'back' ? 'environment' : 'user'}};
        navigator.mediaDevices.getUserMedia(constraints).then(s => {
            mediaStream = s;
            // Remove any leftover preview/mask from a prior session.
            ['scratchjr-camera-video', 'scratchjr-camera-mask'].forEach(id => {
                const old = document.getElementById(id);
                if (old && old.parentNode) old.parentNode.removeChild(old);
            });

            // data.mx/my/mw/mh from Camera.startFeed are computed in the
            // pre-scale SVG userspace and don't account for CSS transforms
            // applied to the maincanvas, so trusting them produces either a
            // tiny preview or a viewport-sized overlay. Pull the real on-
            // screen rect of the painting canvas directly.
            const mc = document.getElementById('maincanvas');
            const rect = mc && mc.getBoundingClientRect();
            const mx = rect ? Math.round(rect.left) : (data.mx | 0);
            const my = rect ? Math.round(rect.top) : (data.my | 0);
            const mw = rect ? Math.round(rect.width) : ((data.mw | 0) || (data.width | 0));
            const mh = rect ? Math.round(rect.height) : ((data.mh | 0) || (data.height | 0));

            videoEl = document.createElement('video');
            videoEl.id = 'scratchjr-camera-video';
            videoEl.autoplay = true;
            videoEl.playsInline = true;
            videoEl.muted = true;
            videoEl.style.cssText = [
                'position:fixed',
                'left:' + mx + 'px',
                'top:' + my + 'px',
                'width:' + mw + 'px',
                'height:' + mh + 'px',
                'object-fit:cover',
                'z-index:10050',
                'pointer-events:none',
                'transform:scaleX(-1)',  // selfie-style mirror
                'background:#000'
            ].join(';');
            videoEl.srcObject = s;

            const host = document.getElementById('backdrop') || document.body;
            host.appendChild(videoEl);
            videoEl.play().catch(() => {});

            // Mask image hides every region except the target shape, so the
            // live video peeks through only the chosen outline.
            if (data.image) {
                const mask = document.createElement('img');
                mask.id = 'scratchjr-camera-mask';
                mask.src = data.image;
                mask.style.cssText = [
                    'position:fixed',
                    'left:' + mx + 'px',
                    'top:' + my + 'px',
                    'width:' + mw + 'px',
                    'height:' + mh + 'px',
                    'z-index:10060',
                    'pointer-events:none'
                ].join(';');
                host.appendChild(mask);
            }
            // Convert the target shape rect from workspace userspace
            // (Paint.workspaceWidth x workspaceHeight, e.g. 432x384) into
            // the actual on-screen pixel space (mw x mh) so the cropper
            // can pull the right region out of the camera frame.
            const wsUserW = (data.mw | 0) || Number(data.workspaceWidth) || 432;
            const wsUserH = (data.mh | 0) || Number(data.workspaceHeight) || 384;
            const sx = mw / wsUserW, sy = mh / wsUserH;
            videoEl.dataset.targetX = ((data.x | 0)) * sx;
            videoEl.dataset.targetY = ((data.y | 0)) * sy;
            videoEl.dataset.targetW = ((data.width | 0)) * sx;
            videoEl.dataset.targetH = ((data.height | 0)) * sy;
            videoEl.dataset.workspaceW = mw;
            videoEl.dataset.workspaceH = mh;

            cb(fcn, '1');
        }).catch((e) => {
            console.warn('[Web.startfeed]', e && e.message);
            cb(fcn, '0');
        });
    }
    static stopfeed (fcn) {
        if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
        ['scratchjr-camera-video', 'scratchjr-camera-mask'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        videoEl = null;
        cb(fcn, '1');
    }
    static choosecamera (mode, fcn) {
        // Switch between front (user) and back (environment) camera.
        if (!mediaStream) { cb(fcn, '0'); return; }
        const direction = (mode && mode.direction) || (mode === 'back' ? 'back' : 'front');
        mediaStream.getTracks().forEach(t => t.stop());
        navigator.mediaDevices.getUserMedia({
            video: {facingMode: direction === 'back' ? 'environment' : 'user'}
        }).then(s => {
            mediaStream = s;
            if (videoEl) videoEl.srcObject = s;
            cb(fcn, '1');
        }).catch(() => cb(fcn, '0'));
    }
    static captureimage (fcn) {
        if (!videoEl) {
            Web._invokeCallback(fcn, 'error getting a still');
            return;
        }
        // If video hasn't decoded a frame yet, wait up to 2s for it.
        if (!videoEl.videoWidth) {
            let waited = 0;
            const poll = setInterval(() => {
                waited += 50;
                if (videoEl && videoEl.videoWidth) {
                    clearInterval(poll);
                    Web._doCapture(fcn);
                } else if (waited >= 2000 || !videoEl) {
                    clearInterval(poll);
                    Web._invokeCallback(fcn, 'error getting a still');
                }
            }, 50);
            return;
        }
        // IMPORTANT: snapshot synchronously *before* the caller hides the
        // backdrop (Paint.cameraToolsOff). Once the backdrop turns
        // display:none, drawImage of the contained <video> can return an
        // empty frame in some browsers, so we grab the pixels first and
        // hand the result back via _invokeCallback's normal scheduling.
        // The preview covers the whole maincanvas; the target shape's
        // bounding box in workspace coordinates was stashed on the video
        // element. Crop the captured frame to that box so the photo fed to
        // SVGImage.addCameraFill matches what the user saw "inside" the
        // mask hole — otherwise the image is scaled to fill the shape's
        // viewbox and the subject appears shifted.
        Web._doCapture(fcn);
    }

    static _doCapture (fcn) {
        if (!videoEl || !videoEl.videoWidth) {
            Web._invokeCallback(fcn, 'error getting a still');
            return;
        }
        const targetX = Number(videoEl.dataset.targetX) || 0;
        const targetY = Number(videoEl.dataset.targetY) || 0;
        const targetW = Number(videoEl.dataset.targetW) || 0;
        const targetH = Number(videoEl.dataset.targetH) || 0;
        const wsW = Number(videoEl.dataset.workspaceW) || videoEl.videoWidth;
        const wsH = Number(videoEl.dataset.workspaceH) || videoEl.videoHeight;

        const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
        // object-fit:cover scaling — video frame is centered + cropped to
        // fill the preview rect. Match that math when picking source rect.
        const scale = Math.max(vw / wsW, vh / wsH);
        const coverW = vw / scale, coverH = vh / scale;
        const offX = (wsW - coverW) / 2;
        const offY = (wsH - coverH) / 2;

        // Map target rect from workspace coords -> video frame coords.
        let sx = (targetX - offX) * scale;
        let sy = (targetY - offY) * scale;
        let sw = targetW * scale;
        let sh = targetH * scale;
        if (!sw || !sh) { sx = 0; sy = 0; sw = vw; sh = vh; }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sw));
        canvas.height = Math.max(1, Math.round(sh));
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        const b64 = dataUrl.split(',')[1] || '';
        console.log('[Web.captureimage]', {videoW: vw, videoH: vh, src: {sx, sy, sw, sh}, b64len: b64.length});
        Web._invokeCallback(fcn, b64);
    }

    // Some legacy native APIs accept a callback as either a function or a
    // dotted global path string (e.g. "Camera.processimage"). The native
    // bridge eval'd the string; on web we resolve it through window.
    static _invokeCallback (fcn, value) {
        if (typeof fcn === 'function') { setTimeout(() => fcn(value), 0); return; }
        if (typeof fcn === 'string' && fcn) {
            const parts = fcn.split('.');
            let scope = window;
            for (let i = 0; i < parts.length - 1; i++) {
                scope = scope && scope[parts[i]];
            }
            const f = scope && scope[parts[parts.length - 1]];
            if (typeof f === 'function') {
                setTimeout(() => f.call(scope, value), 0);
            }
        }
    }

    // ---- Share & misc -----------------------------------------------------
    // Builds the .sjr zip blob for a project. Resolves with {blob, fileName}.
    static buildProjectZipBlob (projectData, name) {
        const safeName = (name || 'ScratchJrProject').replace(/[^a-z0-9_-]/gi, '_');
        const zip = new JSZip();
        const project = zip.folder('project');
        project.file('data.json', projectData);

        return Promise.all([
            allRecords(STORE_MEDIA),
            allRecords(STORE_USERSHAPES),
            allRecords(STORE_USERBKGS)
        ]).then(([media, userShapes, userBackgrounds]) => {
            const parsed = JSON.parse(projectData);
            const projectId = String(parsed.id || '');
            project.file('library/usershapes.json', JSON.stringify(userShapes));
            project.file('library/userbkgs.json', JSON.stringify(userBackgrounds));
            media.forEach(record => {
                if (record && record.md5 && record.data) {
                    project.file('media/' + record.md5, record.data, {base64: true});
                }
            });
            return tx(STORE_GESTURES).then(store => p(store.get(projectId)));
        }).then(gesture => {
            if (gesture && gesture.payload) {
                project.file('gestures/model.json', JSON.stringify(gesture.payload));
            }
            project.file('backup.json', JSON.stringify({
                format: 'scratchjr-web-backup',
                version: 1,
                createdAt: new Date().toISOString()
            }));
            return zip.generateAsync({type: 'blob', compression: 'DEFLATE'});
        }).then(blob => ({blob, fileName: safeName + '.sjr'}));
    }

    static createZipForProject (projectData, metadata, name, fcn) {
        Web.buildProjectZipBlob(projectData, name).then(({blob, fileName}) => {
            const a = document.createElement('a');
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = fileName;
            a.click();
            window.localStorage.setItem('scratchjr_last_backup', JSON.stringify({
                fileName,
                createdAt: new Date().toISOString(),
                size: blob.size
            }));
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            cb(fcn, fileName);
        }).catch(error => {
            console.error('[Web.createZipForProject]', error);
            cb(fcn, 'error');
        });
    }

    // Uses the OS-level share sheet (AirDrop, Mail, Messages, etc. on iPad Safari)
    // when the Web Share API with file support is available; otherwise falls back
    // to a plain download, same as createZipForProject.
    static shareProjectFile (projectData, metadata, name, emailSubject, fcn) {
        Web.buildProjectZipBlob(projectData, name).then(async ({blob, fileName}) => {
            const file = new File([blob], fileName, {type: 'application/zip'});
            const canShareFiles = typeof navigator.canShare === 'function' &&
                navigator.canShare({files: [file]});

            if (canShareFiles) {
                try {
                    await navigator.share({
                        files: [file],
                        title: emailSubject || fileName
                    });
                    cb(fcn, fileName);
                    return;
                } catch (error) {
                    // User cancelled the share sheet, or share failed - fall back to download.
                    if (error && error.name === 'AbortError') {
                        cb(fcn, 'cancelled');
                        return;
                    }
                }
            }

            const a = document.createElement('a');
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = fileName;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            cb(fcn, fileName);
        }).catch(error => {
            console.error('[Web.shareProjectFile]', error);
            cb(fcn, 'error');
        });
    }

    static canUseShareSheet () {
        return typeof navigator !== 'undefined' && typeof navigator.share === 'function' &&
            typeof navigator.canShare === 'function';
    }

    static importProjectArchive (file, fcn) {
        JSZip.loadAsync(file).then(async zip => {
            const dataEntry = zip.file('project/data.json');
            const markerEntry = zip.file('project/backup.json');
            if (!dataEntry) throw new Error('Missing project/data.json');
            if (markerEntry) {
                const marker = JSON.parse(await markerEntry.async('string'));
                if (marker.format !== 'scratchjr-web-backup') throw new Error('Unsupported backup');
            }
            const projectData = JSON.parse(await dataEntry.async('string'));
            delete projectData.id;
            projectData.deleted = 'NO';
            projectData.isgift = '0';
            projectData.mtime = Date.now().toString();

            const mediaFiles = Object.keys(zip.files)
                .filter(path => path.indexOf('project/media/') === 0 && !zip.files[path].dir);
            for (const path of mediaFiles) {
                const md5 = path.substring('project/media/'.length);
                const data = await zip.file(path).async('base64');
                const ext = md5.indexOf('.') > -1 ? md5.split('.').pop() : '';
                await tx(STORE_MEDIA, 'readwrite').then(store => p(store.put({md5, data, ext})));
            }

            const projectStore = await tx(STORE_PROJECTS, 'readwrite');
            const newProjectId = await p(projectStore.add(projectData));
            await Web._restoreLibrary(zip, STORE_USERSHAPES, 'project/library/usershapes.json');
            await Web._restoreLibrary(zip, STORE_USERBKGS, 'project/library/userbkgs.json');

            const gestureEntry = zip.file('project/gestures/model.json');
            if (gestureEntry) {
                const payload = JSON.parse(await gestureEntry.async('string'));
                const gestureStore = await tx(STORE_GESTURES, 'readwrite');
                await p(gestureStore.put({projectId: String(newProjectId), payload, mtime: Date.now()}));
            }
            cb(fcn, String(newProjectId));
        }).catch(error => {
            console.error('[Web.importProjectArchive]', error);
            cb(fcn, '');
        });
    }

    static async _restoreLibrary (zip, storeName, path) {
        const entry = zip.file(path);
        if (!entry) return;
        const records = JSON.parse(await entry.async('string'));
        if (!Array.isArray(records)) return;
        for (const original of records) {
            const record = Object.assign({}, original);
            delete record.id;
            await tx(storeName, 'readwrite').then(store => p(store.add(record)));
        }
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
