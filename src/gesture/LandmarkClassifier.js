const LANDMARK_COUNT = 21;
const FEATURE_LENGTH = LANDMARK_COUNT * 2;
const MIN_SCALE = 1e-4;

export default class LandmarkClassifier {
    constructor () { this.dataset = {}; }

    static featureFromLandmarks (landmarks, handedness) {
        if (!landmarks || landmarks.length < LANDMARK_COUNT) return null;
        const hand = Array.isArray(handedness) ? handedness[0] : handedness;
        if (hand && typeof hand.score === 'number' && hand.score < 0.5) return null;
        const wrist = landmarks[0];
        const middleMcp = landmarks[9];
        if (!this._validPoint(wrist) || !this._validPoint(middleMcp)) return null;
        const dx = middleMcp.x - wrist.x;
        const dy = middleMcp.y - wrist.y;
        const scale = Math.sqrt(dx * dx + dy * dy);
        if (!isFinite(scale) || scale < MIN_SCALE) return null;
        // MediaPipe Hands reports handedness for selfie-mirrored input.
        const mirror = hand && hand.label === 'Left' ? -1 : 1;
        const feature = new Array(FEATURE_LENGTH);
        for (let i = 0; i < LANDMARK_COUNT; i++) {
            const point = landmarks[i];
            if (!this._validPoint(point)) return null;
            feature[i * 2] = mirror * (point.x - wrist.x) / scale;
            feature[i * 2 + 1] = (point.y - wrist.y) / scale;
        }
        return feature;
    }

    static _validPoint (point) {
        return point && isFinite(point.x) && isFinite(point.y) &&
            (typeof point.visibility !== 'number' || point.visibility >= 0.5);
    }

    static _validVector (vec) {
        if (!vec || vec.length !== FEATURE_LENGTH) return false;
        for (let i = 0; i < FEATURE_LENGTH; i++) if (!isFinite(vec[i])) return false;
        return true;
    }

    addExample (vec, label) {
        if (!LandmarkClassifier._validVector(vec) || typeof label !== 'string') return false;
        if (!this.dataset[label]) this.dataset[label] = [];
        this.dataset[label].push(Array.from(vec));
        return true;
    }

    clearClass (label) { delete this.dataset[label]; }

    getNumClasses () {
        return Object.keys(this.dataset).filter(label => this.dataset[label].length > 0).length;
    }

    predict (vec, k = 5) {
        if (!LandmarkClassifier._validVector(vec)) return null;
        const distances = [];
        Object.keys(this.dataset).forEach(label => this.dataset[label].forEach(sample => {
            let distance = 0;
            for (let i = 0; i < FEATURE_LENGTH; i++) {
                const delta = vec[i] - sample[i];
                distance += delta * delta;
            }
            distances.push({label, distance});
        }));
        if (distances.length === 0) return null;
        distances.sort((a, b) => a.distance - b.distance);
        const neighborCount = Math.min(Math.max(1, k || 5), distances.length);
        const votes = {};
        for (let i = 0; i < neighborCount; i++) {
            const label = distances[i].label;
            votes[label] = (votes[label] || 0) + 1;
        }
        let label = distances[0].label;
        Object.keys(votes).forEach(candidate => {
            if (votes[candidate] > (votes[label] || 0)) label = candidate;
        });
        const confidences = {};
        Object.keys(this.dataset).forEach(candidate => {
            confidences[candidate] = (votes[candidate] || 0) / neighborCount;
        });
        return {label, confidences};
    }

    toJSON () {
        const result = {};
        Object.keys(this.dataset).forEach(label => {
            result[label] = this.dataset[label].map(sample => sample.slice());
        });
        return result;
    }

    fromJSON (dataset) {
        this.dataset = {};
        if (!dataset || typeof dataset !== 'object') return this;
        Object.keys(dataset).forEach(label => {
            if (Array.isArray(dataset[label])) dataset[label].forEach(sample => this.addExample(sample, label));
        });
        return this;
    }

    static fromJSON (dataset) { return new LandmarkClassifier().fromJSON(dataset); }
}
