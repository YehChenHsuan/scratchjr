// Drives the training UX using normalized MediaPipe landmark samples.

import GestureEngine from './GestureEngine';
import GestureStorage from './GestureStorage';
import LandmarkClassifier from './LandmarkClassifier';
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
        this.legacy = false;
        this.sampleCounts = {};
        this.collectingTimer = null;
    }

    async init () {
        await this.engine.startCameraOnly(document.getElementById('gesture-trainer-video'),
            document.getElementById('gesture-trainer-overlay'));
        this.knn = new LandmarkClassifier();
        const stored = await GestureStorage.load(this.projectId);
        if (!stored) return;
        this.legacy = Boolean(stored.legacy);
        if (this.legacy) return;
        const filtered = {};
        Object.keys(stored.dataset).forEach(label => {
            if (VALID_GESTURE_IDS.indexOf(label) > -1) {
                filtered[label] = stored.dataset[label];
                this.sampleCounts[label] = stored.dataset[label].length;
            }
        });
        this.knn.fromJSON(filtered);
    }

    getSampleCount (gestureId) { return this.sampleCounts[gestureId] || 0; }

    resetGesture (gestureId) {
        this.stopCollecting();
        if (this.knn) this.knn.clearClass(gestureId);
        this.sampleCounts[gestureId] = 0;
    }

    startCollecting (gestureId, onTick) {
        this.stopCollecting();
        const target = MAX_SAMPLES;
        this.collectingTimer = setInterval(() => {
            if ((this.sampleCounts[gestureId] || 0) >= target) {
                this.stopCollecting();
                if (onTick) onTick(this.sampleCounts[gestureId], target, true);
                return;
            }
            const feature = this.engine.latestFeature;
            if (feature && this.knn.addExample(feature, gestureId)) {
                this.sampleCounts[gestureId] = (this.sampleCounts[gestureId] || 0) + 1;
                if (onTick) onTick(this.sampleCounts[gestureId], target, false);
            }
        }, SAMPLE_INTERVAL_MS);
    }

    stopCollecting () {
        if (this.collectingTimer) clearInterval(this.collectingTimer);
        this.collectingTimer = null;
    }

    async testOnce () {
        if (this.knn.getNumClasses() === 0 || !this.engine.latestFeature) return null;
        const result = this.knn.predict(this.engine.latestFeature);
        result.label = this.engine._resolveLabel(result);
        return result;
    }

    async saveModel () {
        const dataset = this.knn.toJSON();
        const filtered = {};
        Object.keys(dataset).forEach(label => {
            if (VALID_GESTURE_IDS.indexOf(label) > -1 &&
                    (this.sampleCounts[label] || 0) >= MIN_SAMPLES) filtered[label] = dataset[label];
        });
        const classifier = LandmarkClassifier.fromJSON(filtered);
        await GestureStorage.save(this.projectId, classifier, {trained: Object.keys(filtered)});
        this.legacy = false;
        return Object.keys(filtered);
    }

    dispose () {
        this.stopCollecting();
        this.engine.stopCamera();
    }
}
