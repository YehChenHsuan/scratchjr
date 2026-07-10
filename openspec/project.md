# ScratchJr AI PWA Project Specification

## Baseline

- Stable baseline: `b35cc40` (`Backup stable AI gesture ScratchJr version`).
- Code graph project: `C-Users-LENOVO-Downloads-scratchjr-web`.
- Primary runtime: static Web application built from `editions/free/src` and `src/entry/app.js`.
- Primary target: landscape desktop, Android tablet, and iPad installed as a PWA.

## Product invariants

- Preserve ScratchJr's image-first, child-friendly interaction model.
- First launch uses Traditional Chinese (`zh-tw`); an explicit later language choice wins.
- Projects, user media, and gesture models remain local to the device unless exported.
- App updates may replace cached application files but must never delete IndexedDB stores.
- AI gesture training and inference must work without a network after PWA installation.
- New built-in media must remain compatible with existing `media.json` entries.

## Specification workflow

1. Read this file and the relevant document under `openspec/specs/`.
2. Follow `openspec/changes/pwa-expansion/tasks.md` in order.
3. Record architectural deviations in `docs/adr/` before implementation.
4. Run the acceptance checks described by each specification.
5. Refresh codebase-memory-mcp after a completed phase.

