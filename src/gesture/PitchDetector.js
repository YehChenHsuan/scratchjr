import {PITCH_DEFS} from './PitchDefs';

const C4 = 261.63;
const STABLE_MS = 150;
const COOLDOWN_MS = 1500;
const MIN_RMS = 0.01;
const MAX_CENTS_ERROR = 70;

export default class PitchDetector {
    constructor () {
        this.audioContext = null;
        this.analyser = null;
        this.stream = null;
        this.source = null;
        this.buffer = null;
        this.running = false;
        this.frameId = null;
        this.onDetect = null;
        this.streakPitch = null;
        this.streakStartedAt = 0;
        this.lastTrigger = 0;
    }

    onPitchDetected (cb) {
        this.onDetect = cb;
    }

    async start () {
        if (this.running) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Microphone input is not supported by this browser.');
        }
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            throw new Error('Web Audio is not supported by this browser.');
        }
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({audio: true});
            this.audioContext = new AudioContextClass();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);
            this.buffer = new Float32Array(this.analyser.fftSize);
            await this.audioContext.resume();
            this.running = true;
            this._listen();
        } catch (e) {
            this.stop();
            throw e;
        }
    }

    _listen () {
        if (!this.running) return;
        this.analyser.getFloatTimeDomainData(this.buffer);
        const frequency = PitchDetector.autocorrelate(this.buffer, this.audioContext.sampleRate);
        const pitch = this._frequencyToPitch(frequency);
        const now = Date.now();
        if (pitch) {
            if (pitch === this.streakPitch) {
                if (now - this.streakStartedAt >= STABLE_MS && now - this.lastTrigger >= COOLDOWN_MS) {
                    this.lastTrigger = now;
                    this.streakStartedAt = now;
                    if (this.onDetect) this.onDetect(pitch);
                }
            } else {
                this.streakPitch = pitch;
                this.streakStartedAt = now;
            }
        } else {
            this.streakPitch = null;
            this.streakStartedAt = 0;
        }
        this.frameId = window.requestAnimationFrame(() => this._listen());
    }

    _frequencyToPitch (frequency) {
        if (!frequency || !isFinite(frequency)) return null;
        let folded = frequency;
        while (folded < C4) folded *= 2;
        while (folded >= C4 * 2) folded /= 2;
        let closest = null;
        let error = Infinity;
        PITCH_DEFS.forEach(def => {
            const cents = Math.abs(1200 * Math.log(folded / def.frequency) / Math.LN2);
            if (cents < error) {
                closest = def.id;
                error = cents;
            }
        });
        return error <= MAX_CENTS_ERROR ? closest : null;
    }

    stop () {
        this.running = false;
        if (this.frameId !== null) window.cancelAnimationFrame(this.frameId);
        this.frameId = null;
        if (this.source) this.source.disconnect();
        if (this.stream) this.stream.getTracks().forEach(track => track.stop());
        if (this.audioContext) this.audioContext.close().catch(() => {});
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.stream = null;
        this.buffer = null;
        this.streakPitch = null;
    }

    static autocorrelate (buffer, sampleRate) {
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
        if (Math.sqrt(rms / buffer.length) < MIN_RMS) return null;
        let bestOffset = -1;
        let bestCorrelation = 0;
        const minOffset = Math.floor(sampleRate / 1000);
        const maxOffset = Math.floor(sampleRate / 80);
        for (let offset = minOffset; offset <= maxOffset; offset++) {
            let correlation = 0;
            for (let i = 0; i < buffer.length - offset; i++) correlation += buffer[i] * buffer[i + offset];
            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
            }
        }
        return bestOffset > 0 ? sampleRate / bestOffset : null;
    }
}
