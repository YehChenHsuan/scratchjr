export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

let rootElements = [];
let viewportScale = 1;
let viewportLeft = 0;
let viewportTop = 0;

function getPageRoots () {
    return ['frame', 'paintframe', 'libframe', 'aitrainer-root', 'tutorialmode']
        .map(id => document.getElementById(id))
        .filter(element => element);
}

function prepareRoot (element) {
    if (rootElements.indexOf(element) > -1) return;
    rootElements.push(element);
    element.classList.add('fixed-viewport-canvas');
    element.style.setProperty('transform-origin', '0 0', 'important');
    element.style.width = `${DESIGN_WIDTH}px`;
    element.style.height = `${DESIGN_HEIGHT}px`;
}

function resizeFixedViewport () {
    getPageRoots().forEach(prepareRoot);
    if (!rootElements.length) return;
    viewportScale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
    viewportLeft = Math.max(0, (window.innerWidth - DESIGN_WIDTH * viewportScale) / 2);
    viewportTop = Math.max(0, (window.innerHeight - DESIGN_HEIGHT * viewportScale) / 2);

    rootElements.forEach(element => {
        element.style.transform = `translate(${viewportLeft}px, ${viewportTop}px) scale(${viewportScale})`;
    });
    document.documentElement.style.setProperty('--scratchjr-viewport-scale', viewportScale);
}

export function getViewportScale () {
    return viewportScale;
}

export function getViewportOffset () {
    return {x: viewportLeft, y: viewportTop};
}

export function initializeFixedViewport () {
    document.documentElement.classList.add('fixed-viewport');
    document.body.classList.add('fixed-viewport-body');

    resizeFixedViewport();
    window.addEventListener('resize', resizeFixedViewport);
    window.addEventListener('orientationchange', resizeFixedViewport);
    new MutationObserver(resizeFixedViewport).observe(document.body, {childList: true});
}
