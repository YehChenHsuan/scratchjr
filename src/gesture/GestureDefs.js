// 20 gestures = 5 finger counts x 4 directions.
// IDs are stable strings stored inside `ongesture` block argValues.

export const GESTURE_DEFS = (() => {
    const out = [];
    const dirs = ['up', 'down', 'left', 'right'];
    const dirGlyph = {up: '↑', down: '↓', left: '←', right: '→'};
    for (let n = 1; n <= 5; n++) {
        for (const d of dirs) {
            out.push({
                id: `gesture_${n}_${d}`,
                fingers: n,
                direction: d,
                label: `${n}指${dirGlyph[d]}`
            });
        }
    }
    return out;
})();

export function gestureShortLabel (id) {
    const def = GESTURE_DEFS.find(g => g.id === id);
    return def ? def.label : id;
}
