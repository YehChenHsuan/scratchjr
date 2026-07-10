#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'editions', 'free', 'src', 'assets', 'pwa');
const SOURCE = path.join(DIR, 'app-icon-master.svg');
const TARGETS = [
    ['app-icon-192.png', 192],
    ['app-icon-512.png', 512],
    ['app-icon-maskable-512.png', 512],
    ['apple-touch-icon.png', 180],
    ['favicon.png', 48]
];

if (!fs.existsSync(SOURCE)) throw new Error('Missing assets/pwa/app-icon-master.svg');

Promise.all(TARGETS.map(([name, size]) => sharp(SOURCE)
    .resize(size, size)
    .png()
    .toFile(path.join(DIR, name))))
    .then(() => console.log(`Generated ${TARGETS.length} PWA icons`))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });

