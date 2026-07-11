export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

let rootElement;
let viewportScale = 1;
let viewportLeft = 0;
let viewportTop = 0;

function getPageRoot () {
    return document.getElementById('frame') ||
        document.getElementById('aitrainer-root') ||
        document.getElementById('tutorialmode');
}

function resizeFixedViewport () {
    if (!rootElement) return;
    viewportScale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
    viewportLeft = Math.max(0, (window.innerWidth - DESIGN_WIDTH * viewportScale) / 2);
    viewportTop = Math.max(0, (window.innerHeight - DESIGN_HEIGHT * viewportScale) / 2);

    rootElement.style.transform = `translate(${viewportLeft}px, ${viewportTop}px) scale(${viewportScale})`;
    document.documentElement.style.setProperty('--scratchjr-viewport-scale', viewportScale);
}

export function getViewportScale () {
    return viewportScale;
}

export function getViewportOffset () {
    return {x: viewportLeft, y: viewportTop};
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
