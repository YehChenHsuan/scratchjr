# PWA and Offline Specification

## Requirements

- The app provides a Web App Manifest, install icons, standalone mode, landscape orientation, and a service worker.
- The service worker precaches the app shell and uses cache-first requests for versioned static assets.
- HTML navigation falls back to the cached matching page while offline.
- TensorFlow.js, MobileNet, KNN Classifier, MediaPipe Hands, WASM, TFLite, and MobileNet weights are served from the same origin.
- Activation removes obsolete app caches only; it never opens or deletes IndexedDB.
- Camera features require HTTPS in production and remain available on localhost for development.

## Acceptance

- After one completed online install, airplane-mode launch supports editing, saving, gesture training, and gesture inference.
- Runtime network logs contain no CDN, TFHub, Kaggle, or Google Storage requests.
- Updating the cache version preserves all user projects and gesture models.

