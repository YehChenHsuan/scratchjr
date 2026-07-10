// Drives the training UX: collects activation samples, manages KNN classifier,
// and produces a model that GestureEngine can later load.

import GestureEngine from './GestureEngine';
import GestureStorage from './GestureStorage';
import {GESTURE_DEFS} from './GestureDefs';

export const MIN_SAMPLES = 20;
export const MAX_SAMPLES = 50;
const SAMPLE_INTERVAL_MS = 500;
const VALID_GESTURE_IDS = GESTURE_DEFS.map(def => def.id);

export default class GestureTrainer {
    constructor (projectId) {
        this.projectId = projectId;
        this.engine = new GestureEngine();
        this.knn = null;
        this.tf = null;
        this.mobilenet = null;
        this.knnClassifier = null;
        this.sampleCounts = {};
        this.collectingTimer = null;
    }

    async init () {
        // engine.startCameraOnly loads tf/mobilenet/knnClassifier from CDN
        // AND already calls `mobilenet.load()` to produce a usable model
        // instance. Reuse that instance (it has .infer()) — the global
        // `window.mobilenet` is only the namespace and has no infer fn.
        await this.engine.startCameraOnly(document.getElementById('gesture-trainer-video'));
        this.tf = window.tf;
        this.knnClassifier = window.knnClassifier;
        this.mobilenet = this.engine.mobilenetModel;  // loaded model
        if (!this.mobilenet && window.mobilenet && window.mobilenet.load) {
            this.mobilenet = await window.mobilenet.load();
            this.engine.mobilenetModel = this.mobilenet;
        }
        this.knn = this.knnClassifier.create();

        // Restore previous samples if any.
        const stored = await GestureStorage.load(this.projectId, this.tf);
        if (stored) {
            const filtered = {};
            for (const label of Object.keys(stored.tensors)) {
                if (VALID_GESTURE_IDS.indexOf(label) > -1) {
                    filtered[label] = stored.tensors[label];
                    this.sampleCounts[label] = stored.tensors[label].shape[0];
                }
            }
            this.knn.setClassifierDataset(filtered);
        }
    }

    getSampleCount (gestureId) {
        return this.sampleCounts[gestureId] || 0;
    }

    resetGesture (gestureId) {
        this.stopCollecting();
        if (this.knn && this.knn.clearClass) {
            this.knn.clearClass(gestureId);
        }
        this.sampleCounts[gestureId] = 0;
    }

    startCollecting (gestureId, videoEl, onTick) {
        this.stopCollecting();
        const target = MAX_SAMPLES;
        this.collectingTimer = setInterval(async () => {
            if ((this.sampleCounts[gestureId] || 0) >= target) {
                this.stopCollecting();
                if (onTick) {
                    onTick(this.sampleCounts[gestureId], target, true);
                }
                return;
            }
            const act = this.mobilenet ? this.mobilenet.infer(videoEl, 'conv_preds') : null;
            if (act) {
                this.knn.addExample(act, gestureId);
                act.dispose();
                this.sampleCounts[gestureId] = (this.sampleCounts[gestureId] || 0) + 1;
                if (onTick) {
                    onTick(this.sampleCounts[gestureId], target, false);
                }
            }
        }, SAMPLE_INTERVAL_MS);
    }

    stopCollecting () {
        if (this.collectingTimer) {
            clearInterval(this.collectingTimer);
        }
        this.collectingTimer = null;
    }

    async testOnce (videoEl) {
        if (this.knn.getNumClasses() === 0) return null;
        const act = this.mobilenet.infer(videoEl, 'conv_preds');
        const res = await this.knn.predictClass(act);
        act.dispose();
        return res;
    }

    async saveModel () {
        // Filter out under-trained gestures so they don't pollute prediction.
        const dataset = this.knn.getClassifierDataset();
        const filtered = {};
        for (const label of Object.keys(dataset)) {
            if ((VALID_GESTURE_IDS.indexOf(label) > -1) &&
                    ((this.sampleCounts[label] || 0) >= MIN_SAMPLES)) {
                filtered[label] = dataset[label];
            }
        }
        const tmp = this.knnClassifier.create();
        tmp.setClassifierDataset(filtered);
        await GestureStorage.save(this.projectId, tmp, {trained: Object.keys(filtered)});
        return Object.keys(filtered);
    }

    dispose () {
        this.stopCollecting();
        this.engine.stopCamera();
    }
}
