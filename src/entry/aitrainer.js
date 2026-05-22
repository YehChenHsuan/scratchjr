// Entry point for the AI gesture trainer page.
// Loaded via app.js when window.scratchJrPage === 'aitrainer'.

import GestureTrainer, {MIN_SAMPLES, MAX_SAMPLES} from '../gesture/GestureTrainer';
import {GESTURE_DEFS, gestureShortLabel} from '../gesture/GestureDefs';

export function aiTrainerMain () {
    const params = new window.URLSearchParams(window.location.search);
    const projectId = params.get('projectId') || 'default';

    const root = document.getElementById('aitrainer-root');
    root.innerHTML = `
      <header class="ait-header">
        <button id="ait-back">Back</button>
        <div>
          <h1>AI Gesture Trainer</h1>
          <p>Train one-finger or two-finger direction commands for this project.</p>
        </div>
        <small>${projectId}</small>
      </header>
      <div class="ait-body">
        <div class="ait-video-wrap">
          <video id="gesture-trainer-video" autoplay playsinline muted></video>
          <div class="ait-status" id="ait-status">Preparing camera...</div>
          <div class="ait-camera-guide">
            <span>Keep hand centered</span>
            <span>Point clearly: up / down / left / right</span>
          </div>
        </div>
        <aside class="ait-controls">
          <div class="ait-panel-title">Available gestures</div>
          <div id="ait-grid" class="ait-grid"></div>
          <div class="ait-actions">
            <button id="ait-collect">Collect</button>
            <button id="ait-stop">Stop</button>
            <button id="ait-test">Test</button>
            <button id="ait-save">Save model</button>
          </div>
          <div id="ait-progress" class="ait-progress"></div>
          <div id="ait-result" class="ait-result"></div>
        </aside>
      </div>
    `;

    const status = document.getElementById('ait-status');
    const grid = document.getElementById('ait-grid');
    const progressEl = document.getElementById('ait-progress');
    const resultEl = document.getElementById('ait-result');
    const videoEl = document.getElementById('gesture-trainer-video');

    let selectedId = null;
    let trainer = null;

    GESTURE_DEFS.forEach(def => {
        const cell = document.createElement('div');
        cell.className = 'ait-cell';
        cell.dataset.id = def.id;
        cell.innerHTML = `<div class="ait-cell-glyph">${def.glyph}</div>` +
            `<div class="ait-cell-label">${def.label}</div><div class="ait-cell-count">0</div>`;
        cell.onmousedown = () => {
            selectedId = def.id;
            Array.from(grid.children).forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            updateProgress();
        };
        grid.appendChild(cell);
    });

    function updateCellCount (id, n) {
        const cell = grid.querySelector(`[data-id="${id}"]`);
        if (cell) {
            cell.querySelector('.ait-cell-count').textContent = String(n);
            if (n >= MIN_SAMPLES) cell.classList.add('trained');
        }
    }

    function updateProgress () {
        if (!selectedId || !trainer) {
            progressEl.textContent = '';
            return;
        }
        const n = trainer.getSampleCount(selectedId);
        progressEl.textContent = `${gestureShortLabel(selectedId)}: ${n} / ${MAX_SAMPLES}`;
    }

    document.getElementById('ait-back').onmousedown = () => {
        if (trainer) {
            trainer.dispose();
        }
        const back = projectId && projectId !== 'default'
            ? 'editor.html?pmd5=' + encodeURIComponent(projectId) + '&mode=edit'
            : 'editor.html';
        window.location.href = back;
    };

    document.getElementById('ait-collect').onmousedown = () => {
        if (!selectedId || !trainer) {
            alert('Please select a gesture first.');
            return;
        }
        status.textContent = `Collecting ${gestureShortLabel(selectedId)}`;
        trainer.startCollecting(selectedId, videoEl, (n, target, done) => {
            updateCellCount(selectedId, n);
            updateProgress();
            if (done) {
                status.textContent = `Finished collecting ${gestureShortLabel(selectedId)}`;
            }
        });
    };

    document.getElementById('ait-stop').onmousedown = () => {
        if (trainer) {
            trainer.stopCollecting();
        }
        status.textContent = 'Stopped';
    };

    document.getElementById('ait-test').onmousedown = async () => {
        if (!trainer) {
            return;
        }
        const res = await trainer.testOnce(videoEl);
        if (!res) {
            resultEl.textContent = 'No trained gestures yet.';
            return;
        }
        resultEl.textContent = `Detected ${gestureShortLabel(res.label)} ` +
            `(${(res.confidences[res.label] * 100).toFixed(0)}%)`;
    };

    document.getElementById('ait-save').onmousedown = async () => {
        if (!trainer) {
            return;
        }
        const saved = await trainer.saveModel();
        if (saved.length === 0) {
            alert('Each gesture needs at least ' + MIN_SAMPLES + ' samples.');
            return;
        }
        status.textContent = 'Saved ' + saved.length + ' gestures.';
        const back = projectId && projectId !== 'default'
            ? 'editor.html?pmd5=' + encodeURIComponent(projectId) + '&mode=edit'
            : 'editor.html';
        setTimeout(() => {
            window.location.href = back;
        }, 1500);
    };

    (async () => {
        try {
            trainer = new GestureTrainer(projectId);
            await trainer.init();
            status.textContent = 'Select a gesture to start training.';
            GESTURE_DEFS.forEach(def => updateCellCount(def.id, trainer.getSampleCount(def.id)));
        } catch (e) {
            window.console.error(e);
            status.textContent = 'Init failed: ' + e.message;
        }
    })();
}
