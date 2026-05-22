// AI gesture commands are limited to one index finger or two joined fingers,
// each pointing in one of four directions.

const DIRECTIONS = [
    {key: 'up', text: 'Up', glyph: '^'},
    {key: 'down', text: 'Down', glyph: 'v'},
    {key: 'left', text: 'Left', glyph: '<'},
    {key: 'right', text: 'Right', glyph: '>'}
];

const FINGER_GROUPS = [
    {count: 1, text: 'Index'},
    {count: 2, text: 'IndexMiddle'}
];

export const GESTURE_DEFS = (() => {
    const out = [];
    for (const group of FINGER_GROUPS) {
        for (const direction of DIRECTIONS) {
            out.push({
                id: `gesture_${group.count}_${direction.key}`,
                fingers: group.count,
                direction: direction.key,
                label: `${group.count}F ${direction.text}`,
                glyph: `${group.count}${direction.glyph}`,
                icon: `Gesture${group.count}${direction.text}`
            });
        }
    }
    return out;
})();

export function getGestureDef (id) {
    return GESTURE_DEFS.find(g => g.id === id);
}

export function gestureShortLabel (id) {
    const def = getGestureDef(id);
    return def ? def.label : id;
}

export function gestureIconName (id) {
    const def = getGestureDef(id);
    return def ? def.icon : 'Gesture';
}
