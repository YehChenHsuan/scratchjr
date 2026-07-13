// Entry point for the AI gesture trainer page.
// Loaded via app.js when window.scratchJrPage === 'aitrainer'.

import GestureTrainer, {MIN_SAMPLES, MAX_SAMPLES} from '../gesture/GestureTrainer';
import {GESTURE_DEFS, gestureShortLabel} from '../gesture/GestureDefs';
import Localization from '../utils/Localization';

export function aiTrainerMain () {
    const params = new window.URLSearchParams(window.location.search);
    const projectId = params.get('projectId') || 'default';

    const root = document.getElementById('aitrainer-root');
    root.innerHTML = `
      <div class="ait-body">
        <div class="ait-stage">
          <button id="ait-back" class="ait-hotspot ait-back-hit" aria-label="Back"></button>
          <button id="ait-camera" class="ait-hotspot ait-camera-hit" aria-label="Restart camera"></button>
          <button id="ait-next" class="ait-hotspot ait-next-hit" aria-label="Next gesture"></button>
          <button id="ait-reset" class="ait-hotspot ait-reset-hit" aria-label="Reset gesture"></button>
          <video id="gesture-trainer-video" autoplay playsinline muted></video>
          <canvas id="gesture-trainer-overlay" aria-hidden="true"></canvas>
          <div class="ait-status state-camera" id="ait-status" aria-label="Preparing camera"></div>
          <div id="ait-grid" class="ait-grid"></div>
          <div class="ait-actions">
            <button id="ait-collect" class="ait-hotspot action-collect" aria-label="Collect"></button>
            <button id="ait-stop" class="ait-hotspot action-stop" aria-label="Stop"></button>
            <button id="ait-test" class="ait-hotspot action-test" aria-label="Test"></button>
            <button id="ait-save" class="ait-hotspot action-save" aria-label="Save model"></button>
          </div>
          <div id="ait-progress" class="ait-progress"></div>
          <div id="ait-result" class="ait-result"></div>
        </div>
      </div>
    `;

    const status = document.getElementById('ait-status');
    const stageEl = root.querySelector('.ait-stage');
    const grid = document.getElementById('ait-grid');
    const progressEl = document.getElementById('ait-progress');
    const resultEl = document.getElementById('ait-result');

    let selectedId = null;
    let trainer = null;
    let initRequest = 0;

    function bindPress (element, handler) {
        let lastPress = 0;
        const press = (event) => {
            event.preventDefault();
            event.stopPropagation();
            const now = Date.now();
            if (now - lastPress < 600) {
                return;
            }
            lastPress = now;
            handler();
        };
        element.onmousedown = press;
        element.ontouchstart = press;
    }

    function selectGesture (id) {
        selectedId = id;
        Array.from(grid.children).forEach(cell => {
            cell.classList.toggle('selected', cell.dataset.id === id);
        });
        updateProgress();
    }

    GESTURE_DEFS.forEach(def => {
        const cell = document.createElement('div');
        cell.className = 'ait-cell';
        cell.dataset.id = def.id;
        cell.setAttribute('aria-label', def.label);
        cell.innerHTML = `<div class="ait-cell-icon gesture-${def.fingers}-${def.direction}">` +
            '<span class="hand-palm"></span><span class="finger finger-a"></span>' +
            '<span class="finger finger-b"></span><span class="hand-thumb"></span></div>' +
            '<div class="ait-cell-meter"><span></span></div>';
        bindPress(cell, () => selectGesture(def.id));
        grid.appendChild(cell);
    });

    function updateCellCount (id, n) {
        const cell = grid.querySelector(`[data-id="${id}"]`);
        if (cell) {
            const meter = cell.querySelector('.ait-cell-meter span');
            if (meter) {
                meter.style.width = Math.min(100, Math.round((n / MAX_SAMPLES) * 100)) + '%';
            }
            cell.classList.toggle('trained', n >= MIN_SAMPLES);
        }
    }

    function updateProgress () {
        if (!selectedId || !trainer) {
            progressEl.style.display = 'none';
            return;
        }
        const n = trainer.getSampleCount(selectedId);
        progressEl.style.display = 'block';
        progressEl.style.setProperty('--progress', Math.min(100, Math.round((n / MAX_SAMPLES) * 100)) + '%');
        progressEl.setAttribute('aria-label', `${gestureShortLabel(selectedId)}: ${n} / ${MAX_SAMPLES}`);
    }

    function setStatus (state, label) {
        status.className = 'ait-status state-' + state;
        status.setAttribute('aria-label', label);
        stageEl.dataset.state = state;
    }

    function setResult (state, label) {
        resultEl.style.display = 'block';
        resultEl.className = 'ait-result result-' + state;
        resultEl.setAttribute('aria-label', label);
    }

    bindPress(document.getElementById('ait-back'), () => {
        initRequest++;
        if (trainer) {
            trainer.dispose();
        }
        const back = projectId && projectId !== 'default'
            ? 'editor.html?pmd5=' + encodeURIComponent(projectId) + '&mode=edit'
            : 'editor.html';
        window.location.href = back;
    });

    bindPress(document.getElementById('ait-camera'), () => initializeTrainer());

    bindPress(document.getElementById('ait-next'), () => {
        const current = GESTURE_DEFS.findIndex(def => def.id === selectedId);
        for (let offset = 1; offset <= GESTURE_DEFS.length; offset++) {
            const def = GESTURE_DEFS[(current + offset + GESTURE_DEFS.length) % GESTURE_DEFS.length];
            if (!trainer || trainer.getSampleCount(def.id) < MIN_SAMPLES) {
                selectGesture(def.id);
                return;
            }
        }
        selectGesture(GESTURE_DEFS[(current + 1 + GESTURE_DEFS.length) % GESTURE_DEFS.length].id);
    });

    bindPress(document.getElementById('ait-reset'), () => {
        if (!trainer || !selectedId) {
            setStatus('error', 'Select a gesture first.');
            return;
        }
        trainer.resetGesture(selectedId);
        updateCellCount(selectedId, 0);
        updateProgress();
        setStatus('ready', 'Gesture reset.');
    });

    bindPress(document.getElementById('ait-collect'), () => {
        if (!selectedId || !trainer) {
            setStatus('error', 'Select a gesture first.');
            return;
        }
        setStatus('collect', `Collecting ${gestureShortLabel(selectedId)}`);
        trainer.startCollecting(selectedId, (n, target, done) => {
            updateCellCount(selectedId, n);
            updateProgress();
            if (done) {
                setStatus('done', `Finished collecting ${gestureShortLabel(selectedId)}`);
            }
        });
    });

    bindPress(document.getElementById('ait-stop'), () => {
        if (trainer) {
            trainer.stopCollecting();
        }
        setStatus('stop', 'Stopped');
    });

    bindPress(document.getElementById('ait-test'), async () => {
        if (!trainer) {
            return;
        }
        const res = await trainer.testOnce();
        if (!res) {
            setResult('empty', 'No trained gestures yet.');
            return;
        }
        setResult('hit', `Detected ${gestureShortLabel(res.label)} ` +
            `(${(res.confidences[res.label] * 100).toFixed(0)}%)`);
    });

    bindPress(document.getElementById('ait-save'), async () => {
        if (!trainer) {
            return;
        }
        const saved = await trainer.saveModel();
        if (saved.length === 0) {
            setResult('empty', 'Each gesture needs at least ' + MIN_SAMPLES + ' samples.');
            return;
        }
        setStatus('save', 'Saved ' + saved.length + ' gestures.');
        const back = projectId && projectId !== 'default'
            ? 'editor.html?pmd5=' + encodeURIComponent(projectId) + '&mode=edit'
            : 'editor.html';
        setTimeout(() => {
            window.location.href = back;
        }, 1500);
    });

    async function initializeTrainer () {
        const request = ++initRequest;
        let nextTrainer = null;
        if (trainer) {
            trainer.dispose();
            trainer = null;
        }
        setStatus('camera', 'Preparing camera.');
        try {
            nextTrainer = new GestureTrainer(projectId);
            await nextTrainer.init();
            if (request !== initRequest) {
                nextTrainer.dispose();
                return;
            }
            trainer = nextTrainer;
            setStatus('ready', trainer.legacy
                ? Localization.localize('GESTURE_LEGACY_RETRAIN')
                : 'Select a gesture to start training.');
            GESTURE_DEFS.forEach(def => updateCellCount(def.id, trainer.getSampleCount(def.id)));
            if (!selectedId) {
                selectGesture(GESTURE_DEFS[0].id);
            }
        } catch (e) {
            if (nextTrainer) {
                nextTrainer.dispose();
            }
            window.console.error(e);
            setStatus('error', 'Init failed: ' + e.message);
        }
    }

    initializeTrainer();
}
