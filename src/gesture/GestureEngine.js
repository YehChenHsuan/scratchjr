// Real-time gesture inference using MobileNet + KNN classifier.
// All tf.js modules are loaded lazily from CDN to keep initial bundle small.

import GestureStorage from './GestureStorage';
import {GESTURE_DEFS} from './GestureDefs';

let _tf = null, _mobilenet = null, _knnClassifier = null;

async function loadLibs () {
    if (_tf) {
        return {tf: _tf, mobilenet: _mobilenet, knnClassifier: _knnClassifier};
    }
    // Pull from a CDN; users can self-host these by replacing the URLs.
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/knn-classifier@1.2.4/dist/knn-classifier.min.js');
    _tf = window.tf;
    _mobilenet = window.mobilenet;
    _knnClassifier = window.knnClassifier;
    return {tf: _tf, mobilenet: _mobilenet, knnClassifier: _knnClassifier};
}

function loadScript (src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const s = document.createElement('script');
        s.src = src; s.onload = () => resolve(); s.onerror = reject;
        document.head.appendChild(s);
    });
}

const CONFIDENCE_THRESHOLD = 0.75;
const STABLE_FRAMES = 3;
const COOLDOWN_MS = 1000;
const VALID_GESTURE_IDS = GESTURE_DEFS.map(def => def.id);

export default class GestureEngine {
    constructor () {
        this.tf = null;
        this.mobilenetModel = null;
        this.knn = null;
        this.stream = null;
        this.videoEl = null;
        this.running = false;
        this.lastTrigger = 0;
        this.streakLabel = null;
        this.streakCount = 0;
        this.onDetect = null;
    }

    onGestureDetected (cb) {
        this.onDetect = cb;
    }

    async startCameraOnly (videoEl) {
        const libs = await loadLibs();
        this.tf = libs.tf;
        this.videoEl = videoEl;
        this.stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'user'}});
        videoEl.srcObject = this.stream;
        await videoEl.play();
        if (!this.mobilenetModel) {
            this.mobilenetModel = await libs.mobilenet.load();
        }
    }

    async getActivation (videoEl) {
        if (!this.mobilenetModel) {
            const libs = await loadLibs();
            this.mobilenetModel = await libs.mobilenet.load();
        }
        return this.mobilenetModel.infer(videoEl, 'conv_preds');
    }

    async start (projectId, videoEl) {
        const libs = await loadLibs();
        this.tf = libs.tf;
        if (!this.mobilenetModel) {
            this.mobilenetModel = await libs.mobilenet.load();
        }
        this.knn = libs.knnClassifier.create();
        const stored = await GestureStorage.load(projectId, libs.tf);
        if (stored) {
            const filtered = {};
            for (const label of Object.keys(stored.tensors)) {
                if (VALID_GESTURE_IDS.indexOf(label) > -1) {
                    filtered[label] = stored.tensors[label];
                }
            }
            this.knn.setClassifierDataset(filtered);
        }

        if (!this.stream) {
            this.stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'user'}});
            videoEl.srcObject = this.stream;
            await videoEl.play();
        }
        this.videoEl = videoEl;
        this.running = true;
        this._loop();
    }

    async _loop () {
        while (this.running) {
            try {
                if (this.knn && this.knn.getNumClasses() > 0) {
                    const activation = this.mobilenetModel.infer(this.videoEl, 'conv_preds');
                    const result = await this.knn.predictClass(activation);
                    activation.dispose();
                    const conf = result.confidences[result.label] || 0;
                    if (conf >= CONFIDENCE_THRESHOLD) {
                        if (this.streakLabel === result.label) {
                            this.streakCount++;
                        } else {
                            this.streakLabel = result.label;
                            this.streakCount = 1;
                        }
                        if (this.streakCount >= STABLE_FRAMES &&
                            Date.now() - this.lastTrigger > COOLDOWN_MS) {
                            this.lastTrigger = Date.now();
                            this.streakCount = 0;
                            if (this.onDetect) {
                                this.onDetect(result.label, conf);
                            }
                        }
                    } else {
                        this.streakLabel = null; this.streakCount = 0;
                    }
                }
            } catch (e) {
                window.console.warn('[GestureEngine] inference error', e);
            }
            await new Promise(r => setTimeout(r, 200));
        }
    }

    stop () {
        this.running = false;
        this.stopCamera();
    }

    stopCamera () {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
        }
        this.stream = null;
        if (this.videoEl) {
            this.videoEl.srcObject = null;
        }
    }
}
