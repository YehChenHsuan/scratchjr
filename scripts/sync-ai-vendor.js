#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'editions', 'free', 'src', 'vendor', 'ai');
const FILES = [
    ['@mediapipe/hands/hands.js', 'mediapipe/hands.js'],
    ['@mediapipe/hands/hands.binarypb', 'mediapipe/hands.binarypb'],
    ['@mediapipe/hands/hand_landmark_full.tflite', 'mediapipe/hand_landmark_full.tflite'],
    ['@mediapipe/hands/hand_landmark_lite.tflite', 'mediapipe/hand_landmark_lite.tflite'],
    ['@mediapipe/hands/hands_solution_packed_assets.data', 'mediapipe/hands_solution_packed_assets.data'],
    ['@mediapipe/hands/hands_solution_packed_assets_loader.js', 'mediapipe/hands_solution_packed_assets_loader.js'],
    ['@mediapipe/hands/hands_solution_simd_wasm_bin.js', 'mediapipe/hands_solution_simd_wasm_bin.js'],
    ['@mediapipe/hands/hands_solution_simd_wasm_bin.wasm', 'mediapipe/hands_solution_simd_wasm_bin.wasm'],
    ['@mediapipe/hands/hands_solution_wasm_bin.js', 'mediapipe/hands_solution_wasm_bin.js'],
    ['@mediapipe/hands/hands_solution_wasm_bin.wasm', 'mediapipe/hands_solution_wasm_bin.wasm']
];

FILES.forEach(([modulePath, destination]) => {
    const source = require.resolve(modulePath);
    const target = path.join(OUT, destination);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.copyFileSync(source, target);
});

console.log(`Synced ${FILES.length} AI runtime files to ${OUT}`);
