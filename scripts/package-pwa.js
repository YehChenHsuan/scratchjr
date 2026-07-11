#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {optimize} = require('svgo');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'editions', 'free', 'src');
const OUTPUT = path.join(ROOT, 'dist', 'pwa');
const UNUSED_RUNTIME_FILES = new Set([
    'assets/aitrainer/gesture-trainer-scene.png',
    'assets/aitrainer/gesture-trainer-scene-v2.png'
]);
let removedUnusedBytes = 0;
const excluded = (name, relative) => name.endsWith('.map') || name === 'Thumbs.db' ||
    name === '.DS_Store' || UNUSED_RUNTIME_FILES.has(relative);

function copyRuntime (source, output, files) {
    fs.mkdirSync(output, {recursive: true});
    fs.readdirSync(source).sort().forEach(name => {
        const sourcePath = path.join(source, name);
        const outputPath = path.join(output, name);
        const relative = path.relative(SOURCE, sourcePath).replace(/\\/g, '/');
        if (excluded(name, relative) || name === 'precache-manifest.js') {
            if (UNUSED_RUNTIME_FILES.has(relative)) removedUnusedBytes += fs.statSync(sourcePath).size;
            return;
        }
        if (fs.statSync(sourcePath).isDirectory()) {
            copyRuntime(sourcePath, outputPath, files);
            return;
        }
        let data = fs.readFileSync(sourcePath);
        if (path.extname(name).toLowerCase() === '.svg') {
            const result = optimize(data.toString('utf8'), {
                path: sourcePath,
                multipass: true,
                plugins: [{
                    name: 'preset-default',
                    params: {overrides: {removeViewBox: false}}
                }]
            });
            data = Buffer.from(result.data);
        }
        fs.writeFileSync(outputPath, data);
        files.push(path.relative(OUTPUT, outputPath).replace(/\\/g, '/'));
    });
}

fs.rmSync(OUTPUT, {recursive: true, force: true});
const files = [];
copyRuntime(SOURCE, OUTPUT, files);

const aiFiles = files.filter(file => file.indexOf('vendor/ai/') === 0);
const coreFiles = files.filter(file => file.indexOf('vendor/ai/') !== 0);
const hash = crypto.createHash('sha256');
files.forEach(file => {
    hash.update(file);
    hash.update(fs.readFileSync(path.join(OUTPUT, file)));
});
const version = hash.digest('hex').slice(0, 16);
const manifest = `self.__SCRATCHJR_PRECACHE_VERSION=${JSON.stringify(version)};\n` +
    `self.__SCRATCHJR_CORE_URLS=${JSON.stringify(coreFiles.map(file => './' + file), null, 2)};\n` +
    `self.__SCRATCHJR_AI_URLS=${JSON.stringify(aiFiles.map(file => './' + file), null, 2)};\n`;
fs.writeFileSync(path.join(OUTPUT, 'precache-manifest.js'), manifest);

const sourceBytes = files.reduce((sum, file) => sum + fs.statSync(path.join(SOURCE, file)).size, 0) + removedUnusedBytes;
const outputFiles = files.concat('precache-manifest.js');
const outputBytes = outputFiles.reduce((sum, file) => sum + fs.statSync(path.join(OUTPUT, file)).size, 0);
const report = {
    generatedAt: new Date().toISOString(),
    version,
    files: outputFiles.length,
    coreFiles: coreFiles.length,
    aiFiles: aiFiles.length,
    sourceBytes,
    outputBytes,
    savedBytes: sourceBytes - outputBytes,
    removedUnusedBytes
};
fs.writeFileSync(path.join(OUTPUT, 'deployment-report.json'), JSON.stringify(report, null, 2));
console.log(`PWA deployment package: ${OUTPUT}`);
console.log(JSON.stringify(report, null, 2));
