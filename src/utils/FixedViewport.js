export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

let rootElement;

function getPageRoot () {
    return document.getElementById('frame') ||
        document.getElementById('aitrainer-root') ||
        document.getElementById('tutorialmode');
}

function resizeFixedViewport () {
    if (!rootElement) return;
    const scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
    const left = Math.max(0, (window.innerWidth - DESIGN_WIDTH * scale) / 2);
    const top = Math.max(0, (window.innerHeight - DESIGN_HEIGHT * scale) / 2);

    rootElement.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
    document.documentElement.style.setProperty('--scratchjr-viewport-scale', scale);
}

export function initializeFixedViewport () {
    rootElement = getPageRoot();
    if (!rootElement) return;

    document.documentElement.classList.add('fixed-viewport');
    document.body.classList.add('fixed-viewport-body');
    rootElement.classList.add('fixed-viewport-canvas');
    rootElement.style.width = `${DESIGN_WIDTH}px`;
    rootElement.style.height = `${DESIGN_HEIGHT}px`;

    resizeFixedViewport();
    window.addEventListener('resize', resizeFixedViewport);
    window.addEventListener('orientationchange', resizeFixedViewport);
}

