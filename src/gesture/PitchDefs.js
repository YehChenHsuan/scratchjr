export const PITCH_DEFS = [
    {id: 'do', label: 'Do', icon: 'Pitch_do', frequency: 261.63},
    {id: 're', label: 'Re', icon: 'Pitch_re', frequency: 293.66},
    {id: 'mi', label: 'Mi', icon: 'Pitch_mi', frequency: 329.63},
    {id: 'fa', label: 'Fa', icon: 'Pitch_fa', frequency: 349.23},
    {id: 'sol', label: 'Sol', icon: 'Pitch_sol', frequency: 392.00},
    {id: 'la', label: 'La', icon: 'Pitch_la', frequency: 440.00},
    {id: 'si', label: 'Si', icon: 'Pitch_si', frequency: 493.88}
];

export const PITCH_ICONS = PITCH_DEFS.map(def => def.icon);

export function getPitchDef (id) {
    return PITCH_DEFS.find(def => def.id === id);
}

export function pitchShortLabel (id) {
    const def = getPitchDef(id);
    return def ? def.label : id;
}
