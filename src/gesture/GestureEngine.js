// Real-time gesture inference using MediaPipe landmarks and a lightweight KNN classifier.

import GestureStorage from './GestureStorage';
import LandmarkClassifier from './LandmarkClassifier';
import {GESTURE_DEFS, getGestureDef} from './GestureDefs';

let _hands = null;
const AI_ROOT = './vendor/ai/';

async function loadLibs () {
    if (_hands) {
        return {Hands: _hands};
    }
    await loadScript(AI_ROOT + 'mediapipe/hands.js');
    _hands = window.Hands;
    return {Hands: _hands};
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
const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17]];

export default class GestureEngine {
    constructor () {
        this.knn = null;
        this.stream = null;
        this.videoEl = null;
        this.running = false;
        this.lastTrigger = 0;
        this.streakLabel = null;
        this.streakCount = 0;
        this.onDetect = null;
        this.hands = null;
        this.overlayCanvas = null;
        this.handDetected = false;
        this.handTracking = false;
        this.lastHandFrame = 0;
        this.extendedFingerCount = null;
        this.latestFeature = null;
    }

    onGestureDetected (cb) {
        this.onDetect = cb;
    }

    async startCameraOnly (videoEl, overlayCanvas) {
        const libs = await loadLibs();
        this.videoEl = videoEl;
        this.stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'user'}});
        videoEl.srcObject = this.stream;
        await videoEl.play();
        await this._startHandTracking(libs.Hands, overlayCanvas);
    }

    async start (projectId, videoEl, overlayCanvas) {
        const libs = await loadLibs();
        this.knn = new LandmarkClassifier();
        const stored = await GestureStorage.load(projectId);
        if (stored && !stored.legacy) {
            const filtered = {};
            for (const label of Object.keys(stored.dataset)) {
                if (VALID_GESTURE_IDS.indexOf(label) > -1) {
                    filtered[label] = stored.dataset[label];
                }
            }
            this.knn.fromJSON(filtered);
        }

        if (!this.stream) {
            this.stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'user'}});
            videoEl.srcObject = this.stream;
            await videoEl.play();
        }
        this.videoEl = videoEl;
        await this._startHandTracking(libs.Hands, overlayCanvas);
        this.running = true;
        this._loop();
    }

    async _loop () {
        while (this.running) {
            try {
                if (this.knn && this.knn.getNumClasses() > 0) {
                    const feature = this.latestFeature;
                    if (!feature) {
                        this.streakLabel = null;
                        this.streakCount = 0;
                        await new Promise(r => setTimeout(r, 120));
                        continue;
                    }
                    const result = this.knn.predict(feature);
                    const label = this._resolveLabel(result);
                    const conf = result.confidences[label] || 0;
                    if (conf >= CONFIDENCE_THRESHOLD) {
                        if (this.streakLabel === label) {
                            this.streakCount++;
                        } else {
                            this.streakLabel = label;
                            this.streakCount = 1;
                        }
                        if (this.streakCount >= STABLE_FRAMES &&
                            Date.now() - this.lastTrigger > COOLDOWN_MS) {
                            this.lastTrigger = Date.now();
                            this.streakCount = 0;
                            if (this.onDetect) {
                                this.onDetect(label, conf);
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

    // KNN confidence alone can confuse 1-finger vs 2-finger gestures
    // when both are trained, since their silhouettes can look similar from
    // some angles. When the landmark-based finger count is unambiguous (1
    // or 2), prefer the highest-confidence KNN label whose GESTURE_DEFS
    // finger count agrees with it, falling back to the raw KNN winner
    // otherwise.
    _resolveLabel (result) {
        const fingerCount = this.extendedFingerCount;
        if (fingerCount !== 1 && fingerCount !== 2) {
            return result.label;
        }
        let bestLabel = null;
        let bestConf = -1;
        for (const label of Object.keys(result.confidences)) {
            const def = getGestureDef(label);
            if (!def || def.fingers !== fingerCount) continue;
            const conf = result.confidences[label];
            if (conf > bestConf) {
                bestConf = conf;
                bestLabel = label;
            }
        }
        return bestLabel || result.label;
    }

    stop () {
        this.running = false;
        this.stopCamera();
    }

    async _startHandTracking (Hands, overlayCanvas) {
        this.overlayCanvas = overlayCanvas || this.overlayCanvas;
        if (!this.hands) {
            this.hands = new Hands({locateFile: file => AI_ROOT + 'mediapipe/' + file});
            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.72,
                minTrackingConfidence: 0.72
            });
            this.hands.onResults(results => this._drawHand(results));
        }
        if (this.handTracking) return;
        this.handTracking = true;
        const track = async () => {
            if (!this.handTracking || !this.videoEl || !this.videoEl.srcObject) return;
            if (Date.now() - this.lastHandFrame > 90 && this.videoEl.readyState >= 2) {
                this.lastHandFrame = Date.now();
                try {
                    await this.hands.send({image: this.videoEl});
                } catch (e) {
                    window.console.warn('[GestureEngine] hand tracking error', e);
                }
            }
            window.requestAnimationFrame(track);
        };
        track();
    }

    // Counts fingers held straight (index/middle/ring/pinky) using the
    // classic "tip is farther from the wrist than its own middle joint"
    // heuristic on MediaPipe's 21 hand landmarks. This is independent of
    // the KNN vote, so it disambiguates 1-finger vs 2-finger
    // gestures even when their overall hand silhouettes look similar to
    // the KNN classifier.
    static countExtendedFingers (landmarks) {
        if (!landmarks) return null;
        const wrist = landmarks[0];
        const dist2 = (a, b) => {
            const dx = a.x - b.x, dy = a.y - b.y;
            return (dx * dx) + (dy * dy);
        };
        const FINGER_JOINTS = [
            [5, 6, 8],   // index: mcp, pip, tip
            [9, 10, 12], // middle
            [13, 14, 16], // ring
            [17, 18, 20]  // pinky
        ];
        let count = 0;
        FINGER_JOINTS.forEach(([mcp, pip, tip]) => {
            const tipDist = dist2(landmarks[tip], wrist);
            const pipDist = dist2(landmarks[pip], wrist);
            const mcpDist = dist2(landmarks[mcp], wrist);
            if (tipDist > pipDist && tipDist > mcpDist * 1.15) {
                count++;
            }
        });
        return count;
    }

    _drawHand (results) {
        const landmarks = results.multiHandLandmarks && results.multiHandLandmarks[0];
        const handedness = results.multiHandedness && results.multiHandedness[0];
        this.handDetected = Boolean(landmarks);
        this.latestFeature = LandmarkClassifier.featureFromLandmarks(landmarks, handedness);
        this.extendedFingerCount = landmarks ? GestureEngine.countExtendedFingers(landmarks) : null;
        const overlay = this.overlayCanvas;
        if (overlay) {
            overlay.width = this.videoEl.videoWidth || 640;
            overlay.height = this.videoEl.videoHeight || 480;
            const ctx = overlay.getContext('2d');
            ctx.clearRect(0, 0, overlay.width, overlay.height);
            if (landmarks) {
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = Math.max(3, overlay.width / 180);
                ctx.lineCap = 'round';
                HAND_CONNECTIONS.forEach(pair => {
                    ctx.beginPath();
                    ctx.moveTo(landmarks[pair[0]].x * overlay.width, landmarks[pair[0]].y * overlay.height);
                    ctx.lineTo(landmarks[pair[1]].x * overlay.width, landmarks[pair[1]].y * overlay.height);
                    ctx.stroke();
                });
                ctx.fillStyle = '#ffe75a';
                landmarks.forEach(point => {
                    ctx.beginPath();
                    ctx.arc(point.x * overlay.width, point.y * overlay.height,
                        Math.max(4, overlay.width / 120), 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        }
    }

    stopCamera () {
        this.handTracking = false;
        this.handDetected = false;
        this.latestFeature = null;
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
        }
        this.stream = null;
        if (this.videoEl) {
            this.videoEl.srcObject = null;
        }
    }
}
