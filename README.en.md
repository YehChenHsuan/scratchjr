# ScratchJr Web Edition

[繁體中文](README.md) | [简体中文](README.zh-CN.md) | [English](README.en.md)

This is a ScratchJr web derivative based on [LLK/scratchjr](https://github.com/LLK/scratchjr). The upstream project began as an iOS and Android app; this project turns it into a pure front-end static web app that can be deployed to GitHub Pages, Netlify, and similar hosts.

Live version: <https://yehchenhsuan.github.io/scratchjr/>

## Highlights

- **Local-first browser experience:** Projects and media live in IndexedDB. `src/tablet/Web.js` replaces the iOS/Android bridge with browser APIs: `getUserMedia` for the camera, and `MediaRecorder` plus the Web Audio API for recording.
- **AI gesture recognition:** A cyan seventh block category and the `ongesture` event block let children train custom gestures that trigger scripts. Classification uses landmark-based KNN—not the removed MobileNet/TensorFlow.js stack—reducing the PWA offline precache footprint.
- **Full offline PWA support:** On the first connection, the app downloads its offline resource bundle with a bottom progress bar and completion toast. Its service worker uses a resumable `GET_CACHE_STATUS` flow, so the installed app can launch and run offline.
- **Expanded creative library:** Compared with the Desktop edition, the library adds 119 characters and 28 backgrounds.
- **WAP download and sharing:** Projects can be downloaded locally and, on supported devices, shared through the Web Share API using the system share sheet for an AirDrop-like flow.

## Quick start

Install Node.js and npm, then install dependencies:

```bash
npm install
```

For local development, generate the development bundle and start the static server. Then open <http://localhost:8080/index.html>:

```bash
npm run dev
npm run serve
```

To rebuild while files change, use:

```bash
npm run watch
```

Camera access requires a secure context. Browser `localhost` is suitable for local development; deploy over HTTPS.

## Build and deploy

GitHub Pages is served from `docs/`. The following command syncs AI assets, generates PWA icons, creates the production bundle, and rebuilds `docs/`:

```bash
npm run build:web
```

In the GitHub repository settings, configure Pages to deploy from the branch's `/docs` directory. Commit and push the updated `docs/` directory to publish the site.

To create a separate optimized PWA deployment tree, run:

```bash
npm run package:pwa
```

The result is written to `dist/pwa/`, which can be used as the deployment source for Netlify or another static host. Use `npm run release:pwa` for the full verification-and-packaging flow.

## License and trademark

This project follows the upstream [BSD-3-Clause license](LICENSE). The ScratchJr name and trademark belong to MIT Media Lab. This derivative project's web bridge, AI gesture recognition, offline PWA, WAP sharing, and related additions are its own contributions; they are not an official MIT Media Lab product or endorsement.
