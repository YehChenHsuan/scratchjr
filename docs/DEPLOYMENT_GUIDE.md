# ScratchJr AI PWA Deployment

## Build The Deployment Folder

Run:

```powershell
npm.cmd run release:pwa
```

Deploy only the generated `dist/pwa/` folder to an HTTPS static host. Do not deploy the repository root.

## Included

- Application HTML, CSS and production JavaScript bundle
- PWA manifest, service worker and versioned precache manifest
- Traditional Chinese and all selectable language files
- Runtime character, background, block, sound and tutorial media
- Local TensorFlow.js, MobileNet, KNN and MediaPipe Hands runtime/model files

## Excluded

- Source maps and development source code
- Markdown specifications and UI audit screenshots
- Operating-system metadata such as `Thumbs.db`
- Two unreferenced legacy AI trainer PNG scenes

SVG files are optimized only in the generated deployment copy. Source artwork remains unchanged, `viewBox` is preserved and the release verifier runs before packaging.

## Hosting Requirements

- HTTPS is required for camera access and service workers, except on localhost.
- Serve `.wasm` as `application/wasm`, `.webmanifest` as `application/manifest+json` and `.svg` as `image/svg+xml`.
- Do not rewrite model `.bin`, `.tflite`, `.data` or `.wasm` requests to `index.html`.
- Configure long-lived caching for hashed/versioned assets but revalidate HTML, `service-worker.js` and `precache-manifest.js`.

## Data Safety

Projects, user media and gesture models remain in browser IndexedDB and are not part of the deployment folder. Updating the PWA must not clear site data. Users should still export `.sjr` backups before device replacement or clearing browser storage.

