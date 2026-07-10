#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'editions', 'free', 'src', 'vendor', 'ai', 'mobilenet', 'model');
const BASE = 'https://tfhub.dev/google/imagenet/mobilenet_v1_100_224/classification/1/';
const FILES = ['model.json', 'group1-shard1of5.bin', 'group1-shard2of5.bin',
    'group1-shard3of5.bin', 'group1-shard4of5.bin', 'group1-shard5of5.bin'];

async function download (name) {
    const response = await fetch(BASE + name + '?tfjs-format=file', {redirect: 'follow'});
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, name), data);
    console.log(`Downloaded ${name} (${data.length} bytes)`);
}

Promise.all(FILES.map(download)).catch(error => {
    console.error(error);
    process.exitCode = 1;
});

