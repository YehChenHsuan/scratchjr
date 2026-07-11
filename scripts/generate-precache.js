#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'editions', 'free', 'src');
const OUTPUT = path.join(SOURCE, 'precache-manifest.js');
const EXCLUDED = new Set(['precache-manifest.js', 'app.bundle.js.map']);

function collect (directory, base, result) {
    fs.readdirSync(directory).sort().forEach(name => {
        const fullPath = path.join(directory, name);
        const relative = path.relative(base, fullPath).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) collect(fullPath, base, result);
        else if (!EXCLUDED.has(relative) && !relative.endsWith('.map')) result.push(relative);
    });
}

const files = [];
collect(SOURCE, SOURCE, files);
const hash = crypto.createHash('sha256');
files.forEach(file => {
    hash.update(file);
    hash.update(fs.readFileSync(path.join(SOURCE, file)));
});
const version = hash.digest('hex').slice(0, 16);
const aiFiles = files.filter(file => file.indexOf('vendor/ai/') === 0);
const coreFiles = files.filter(file => file.indexOf('vendor/ai/') !== 0);
const coreUrls = coreFiles.map(file => './' + file);
const aiUrls = aiFiles.map(file => './' + file);
const output = `self.__SCRATCHJR_PRECACHE_VERSION=${JSON.stringify(version)};\n` +
    `self.__SCRATCHJR_CORE_URLS=${JSON.stringify(coreUrls, null, 2)};\n` +
    `self.__SCRATCHJR_AI_URLS=${JSON.stringify(aiUrls, null, 2)};\n`;
fs.writeFileSync(OUTPUT, output);
console.log(`Generated precache manifest ${version}: ${coreUrls.length} core, ${aiUrls.length} AI files`);
