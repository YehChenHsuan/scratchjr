// Persistence layer for trained KNN datasets.
// Backed by IndexedDB via OS.gesture_save/load (see Web.js).
// On native iOS/Android builds these calls will silently no-op since the
// gesture feature is web-only.

import OS from '../tablet/OS';

export default class GestureStorage {
    static save (projectId, classifier, metadata) {
        const payload = {
            version: 2,
            format: 'landmark-v1',
            dataset: classifier.toJSON(),
            metadata: metadata || {},
            mtime: Date.now()
        };
        return new Promise(resolve => {
            if (OS.gesture_save) {
                OS.gesture_save(projectId, payload, () => resolve(true));
            } else {
                try { localStorage.setItem('scratchjr_gesture_' + projectId, JSON.stringify(payload)); }
                catch (e) {}
                resolve(true);
            }
        });
    }

    static load (projectId) {
        return new Promise(resolve => {
            const finish = (raw) => {
                if (!raw) { resolve(null); return; }
                let payload;
                try { payload = typeof raw === 'string' ? JSON.parse(raw) : raw; }
                catch (e) { resolve(null); return; }
                if (!payload || !payload.dataset) { resolve(null); return; }
                if (payload.version !== 2 || payload.format !== 'landmark-v1') {
                    resolve({legacy: true, metadata: payload.metadata || {}});
                    return;
                }
                resolve({legacy: false, dataset: payload.dataset, metadata: payload.metadata || {}});
            };
            if (OS.gesture_load) {
                OS.gesture_load(projectId, finish);
            } else {
                finish(localStorage.getItem('scratchjr_gesture_' + projectId));
            }
        });
    }

    static hasModel (projectId) {
        return new Promise(resolve => {
            if (OS.gesture_metadata) {
                OS.gesture_metadata(projectId, (s) => {
                    try { resolve(JSON.parse(s).length > 0); }
                    catch (e) { resolve(false); }
                });
            } else {
                resolve(!!localStorage.getItem('scratchjr_gesture_' + projectId));
            }
        });
    }

    static getTrainedGestures (projectId) {
        return new Promise(resolve => {
            if (OS.gesture_metadata) {
                OS.gesture_metadata(projectId, (s) => {
                    try { resolve(JSON.parse(s) || []); }
                    catch (e) { resolve([]); }
                });
            } else {
                resolve([]);
            }
        });
    }
}
