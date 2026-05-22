// Entry point for the AI gesture trainer page.
// Loaded via app.js when window.scratchJrPage === 'aitrainer'.

import GestureTrainer, {MIN_SAMPLES, MAX_SAMPLES} from '../gesture/GestureTrainer';
import {GESTURE_DEFS, gestureShortLabel} from '../gesture/GestureDefs';

export function aiTrainerMain () {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('projectId') || 'default';

    const root = document.getElementById('aitrainer-root');
    root.innerHTML = `
      <header class="ait-header">
        <button id="ait-back">← 返回編輯器</button>
        <h1>AI 手勢訓練 <small>${projectId}</small></h1>
      </header>
      <div class="ait-body">
        <div class="ait-video-wrap">
          <video id="gesture-trainer-video" autoplay playsinline muted></video>
          <div class="ait-status" id="ait-status">準備中…</div>
        </div>
        <aside class="ait-controls">
          <div id="ait-grid" class="ait-grid"></div>
          <div class="ait-actions">
            <button id="ait-collect">▶ 開始收集</button>
            <button id="ait-stop">⏸ 停止</button>
            <button id="ait-test">🧪 測試</button>
            <button id="ait-save">💾 儲存模型</button>
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
        cell.innerHTML = `<div class="ait-cell-label">${def.label}</div><div class="ait-cell-count">0</div>`;
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
        if (!selectedId || !trainer) { progressEl.textContent = ''; return; }
        const n = trainer.getSampleCount(selectedId);
        progressEl.textContent = `${gestureShortLabel(selectedId)}: ${n} / ${MAX_SAMPLES}`;
    }

    document.getElementById('ait-back').onmousedown = () => {
        if (trainer) trainer.dispose();
        const back = projectId && projectId !== 'default'
            ? 'editor.html?pmd5=' + encodeURIComponent(projectId) + '&mode=edit'
            : 'editor.html';
        window.location.href = back;
    };

    document.getElementById('ait-collect').onmousedown = () => {
        if (!selectedId || !trainer) { alert('請先選擇要訓練的手勢'); return; }
        status.textContent = `收集中：${gestureShortLabel(selectedId)}`;
        trainer.startCollecting(selectedId, videoEl, (n, target, done) => {
            updateCellCount(selectedId, n);
            updateProgress();
            if (done) status.textContent = `完成 ${gestureShortLabel(selectedId)} 樣本收集`;
        });
    };
    document.getElementById('ait-stop').onmousedown = () => {
        if (trainer) trainer.stopCollecting();
        status.textContent = '已停止';
    };
    document.getElementById('ait-test').onmousedown = async () => {
        if (!trainer) return;
        const res = await trainer.testOnce(videoEl);
        if (!res) { resultEl.textContent = '尚無已訓練手勢'; return; }
        resultEl.textContent = `辨識：${gestureShortLabel(res.label)} (信心 ${(res.confidences[res.label] * 100).toFixed(0)}%)`;
    };
    document.getElementById('ait-save').onmousedown = async () => {
        if (!trainer) return;
        const saved = await trainer.saveModel();
        if (saved.length === 0) { alert('每個手勢至少需要 ' + MIN_SAMPLES + ' 個樣本'); return; }
        status.textContent = '已儲存 ' + saved.length + ' 個手勢';
        // Return to the editor with the project ID preserved so the editor
        // reopens the project the user was working on.
        const back = projectId && projectId !== 'default'
            ? 'editor.html?pmd5=' + encodeURIComponent(projectId) + '&mode=edit'
            : 'editor.html';
        setTimeout(() => { window.location.href = back; }, 1500);
    };

    (async () => {
        try {
            trainer = new GestureTrainer(projectId);
            await trainer.init();
            status.textContent = '請選擇手勢開始訓練';
            // Refresh sample counts from restored model.
            GESTURE_DEFS.forEach(def => updateCellCount(def.id, trainer.getSampleCount(def.id)));
        } catch (e) {
            console.error(e);
            status.textContent = '初始化失敗：' + e.message;
        }
    })();
}
