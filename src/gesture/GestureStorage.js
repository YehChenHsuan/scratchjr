// Persistence layer for trained KNN datasets.
// Backed by IndexedDB via OS.gesture_save/load (see Web.js).
// On native iOS/Android builds these calls will silently no-op since the
// gesture feature is web-only.

import OS from '../tablet/OS';

export default class GestureStorage {
    static save (projectId, knnClassifier, metadata) {
        // KNN tensors -> plain JS arrays so we can JSON-serialize.
        const dataset = knnClassifier.getClassifierDataset();
        const serial = {};
        for (const label of Object.keys(dataset)) {
            const t = dataset[label];
            serial[label] = {
                data: Array.from(t.dataSync()),
                shape: t.shape
            };
        }
        const payload = {
            version: 1,
            dataset: serial,
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

    static load (projectId, tf) {
        return new Promise(resolve => {
            const finish = (raw) => {
                if (!raw) { resolve(null); return; }
                let payload;
                try { payload = typeof raw === 'string' ? JSON.parse(raw) : raw; }
                catch (e) { resolve(null); return; }
                if (!payload || !payload.dataset) { resolve(null); return; }
                const tensors = {};
                for (const label of Object.keys(payload.dataset)) {
                    const v = payload.dataset[label];
                    tensors[label] = tf.tensor(v.data, v.shape);
                }
                resolve({tensors, metadata: payload.metadata || {}});
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
