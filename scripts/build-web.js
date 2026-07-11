#!/usr/bin/env node
// Build script that runs webpack and then copies static assets into ./docs/
// for GitHub Pages deployment.

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs');
const FREE_SRC = path.join(ROOT, 'editions', 'free', 'src');
const BUNDLE = path.join(ROOT, 'src', 'build', 'bundles', 'app.bundle.js');
function isPreservedDoc (p) {
    const resolved = path.resolve(p);
    return resolved === path.resolve(path.join(OUT, 'adr')) ||
        resolved === path.resolve(path.join(OUT, 'ui-audit')) ||
        (path.dirname(resolved) === path.resolve(OUT) && path.extname(resolved).toLowerCase() === '.md');
}

function rimraf (p) {
    if (!fs.existsSync(p)) return;
    for (const f of fs.readdirSync(p)) {
        const fp = path.join(p, f);
        if (isPreservedDoc(fp)) continue;
        if (fs.statSync(fp).isDirectory()) { rimraf(fp); fs.rmdirSync(fp); }
        else fs.unlinkSync(fp);
    }
}
function copyDir (src, dst) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, {recursive: true});
    for (const f of fs.readdirSync(src)) {
        const sp = path.join(src, f);
        const dp = path.join(dst, f);
        const st = fs.statSync(sp);
        if (st.isDirectory()) copyDir(sp, dp);
        else fs.copyFileSync(sp, dp);
    }
}

console.log('==> webpack production build');
execSync('npx webpack --mode=production', {
    cwd: ROOT,
    stdio: 'inherit',
    env: Object.assign({}, process.env, {NODE_OPTIONS: '--openssl-legacy-provider'})
});

console.log('==> sync bundle and generate precache manifest');
if (fs.existsSync(BUNDLE)) {
    fs.copyFileSync(BUNDLE, path.join(FREE_SRC, 'app.bundle.js'));
}
execSync('node scripts/generate-precache.js', {cwd: ROOT, stdio: 'inherit'});

console.log('==> reset', OUT);
rimraf(OUT);
fs.mkdirSync(OUT, {recursive: true});

console.log('==> copy editions/free/src -> docs/');
copyDir(FREE_SRC, OUT);

console.log('==> copy bundle -> docs/app.bundle.js');
if (fs.existsSync(BUNDLE)) {
    fs.copyFileSync(BUNDLE, path.join(OUT, 'app.bundle.js'));
    const mapPath = BUNDLE + '.map';
    if (fs.existsSync(mapPath)) fs.copyFileSync(mapPath, path.join(OUT, 'app.bundle.js.map'));
}

// GitHub Pages friendliness: disable Jekyll which strips _underscored paths.
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log('==> done. Deploy ./docs/ via GitHub Pages (Settings -> Pages -> Branch: main /docs).');
