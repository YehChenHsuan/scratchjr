# PWA Expansion Verification

Date: 2026-07-11
Baseline: `b35cc40`

## Passed

- `npm.cmd run build:web`: production bundle completed successfully.
- Precache manifest: 411 same-origin files generated; all 411 returned HTTP success from `localhost:8080`.
- First-launch UI: browser displayed Traditional Chinese `我的專案` and `匯入作品`.
- AI trainer: MediaPipe Hands and WASM load from `/vendor/ai/`; landmark classification is bundled pure JavaScript with no CDN runtime dependency.
- Browser console: home page had no errors; AI page only reported a development-server WASM MIME fallback warning and completed ArrayBuffer loading.
- `git diff --check`: no whitespace errors.
- codebase-memory-mcp: moderate index refreshed and ADR 0001 recorded.
- PWA manifest is valid UTF-8 Traditional Chinese JSON.
- PWA cache is split into 394 core files and 18 AI files; all 412 URLs returned HTTP success.
- AI background caching is limited to three concurrent requests and records progress locally.
- `npm run verify:pwa` confirms critical offline files and exact `src` to `docs` deployment consistency.
- `npm run verify:ui` validates fixed-canvas scale expectations and five nonblank regression screenshots.
- Persistent-storage usage/quota and the latest project-backup metadata are recorded locally.
- Paint editor dynamic frames now join the fixed 1280 x 720 viewport scaler.
- Paint SVG pointer conversion uses the browser screen matrix once, avoiding double scaling.
- Paint bucket refreshes its hit-test mask and uses native SVG geometry fallback; the first unfilled rectangle was verified to fill from an interior click.
- Camera preview/crop uses paint-canvas-local coordinates and clamps the video source rectangle.
- Camera photos and geometry masks share one SVG group; a synthetic ellipse capture and subsequent `(+100, +50)` drag verified identical image/border movement.
- Returning from the paint editor rendered nonblank character thumbnail and stage canvases after the grouped camera-photo edit.
- Camera capture now matches the mirrored `object-fit: cover` preview; an off-center four-color source preserved preview quadrant order, returned fully opaque corner/center samples, and fills the SVG mask without letterboxing.
- Physical-camera acceptance confirmed that the photographed subject retains its preview position after capture when target coordinates are passed directly in paint-workspace units.
- `npm run release:pwa` produces `dist/pwa/` with optimized SVG files and excludes unused runtime artifacts.

## Pending External Acceptance

- Replace assets listed in `ASSET_REQUIREMENTS.md` after the user supplies final artwork.
- Install and test on physical Android tablet and iPad in landscape and portrait.
- Verify camera permission, AI training, recognition and persistence after device restart.
- Verify offline cold start after installation on each target browser.
- Verify update retention and complete `.sjr` export-delete-import recovery with a representative child project.
