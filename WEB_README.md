# ScratchJr Web Edition (with AI Gesture Training)

衍伸自 [LLK/scratchjr](https://github.com/LLK/scratchjr)，將原本的 iOS/Android
版改造成可直接部署到 GitHub Pages 等靜態託管平台的純前端應用，並新增
**AI 手勢辨識訓練**功能。

---

## 主要修改概覽

| 區塊 | 原版 | Web 版 |
|------|------|--------|
| 持久化 | iOS/Android Native + SQLite | **IndexedDB**（瀏覽器內建） |
| Bridge 層 | `iOS.js` / `Android.js` | `src/tablet/Web.js`（新增） |
| 鏡頭 | Native | **`getUserMedia`** |
| 錄音 | Native | **`MediaRecorder` + Web Audio** |
| 部署 | App Store / Google Play | **GitHub Pages / Vercel / Netlify** |
| AI 功能 | — | **MobileNet + KNN（TF.js）** 在地訓練手勢觸發積木 |

---

## 新增檔案

```
src/tablet/Web.js                    # IndexedDB / WebRTC / WebAudio 後端
src/gesture/GestureDefs.js           # 20 種手勢定義
src/gesture/GestureStorage.js        # 模型持久化（透過 Web.js 寫入 IndexedDB）
src/gesture/GestureEngine.js         # 即時推理 (MobileNet + KNN)
src/gesture/GestureTrainer.js        # 訓練 UX 控制器
src/entry/aitrainer.js               # 訓練頁入口
editions/free/src/aitrainer.html     # 訓練頁 HTML
editions/free/src/css/aitrainer.css  # 訓練頁樣式
editions/free/src/assets/blockicons/Gesture.svg
editions/free/src/assets/categories/GestureOn.svg
editions/free/src/assets/categories/GestureOff.svg
scripts/build-web.js                 # 產生 ./docs/ 供 GitHub Pages 部署
scripts/serve.js                     # 本地零依賴測試伺服器
```

## 修改檔案

```
src/tablet/OS.js                     # 加入 isWeb 偵測 → 走 Web.js bridge
src/entry/app.js                     # 註冊 'aitrainer' 頁面
src/editor/blocks/BlockSpecs.js      # 第 7 分類「AI 手勢」+ ongesture 積木
src/editor/engine/Prims.js           # ongesture = Ignore（觸發類）
editions/free/src/settings.json      # categoryGestureColor: #00BCD4
package.json                         # build:web / serve scripts
```

---

## 本地開發

```bash
npm install
npm run dev          # webpack 編譯 bundle（也可用 npm run watch 自動重編）
npm run serve        # 啟動 http://localhost:8080
```

> ⚠️ 鏡頭 (`getUserMedia`) 要求 HTTPS 或 localhost。本機 `localhost` 即可，GitHub Pages 預設 HTTPS。

---

## 部署到 GitHub Pages

```bash
npm run build:web
git add docs
git commit -m "build: web bundle"
git push
```

接著在 GitHub repo → **Settings → Pages → Source: Deploy from a branch → main /docs**。
網址會是 `https://<user>.github.io/<repo>/index.html`。

`build:web` 會：
1. 執行 webpack production build
2. 清空 `docs/`
3. 複製 `editions/free/src/*` 與 `app.bundle.js` 進 `docs/`
4. 寫入 `.nojekyll`，避免 GitHub Pages 隱藏底線開頭路徑

---

## AI 手勢辨識訓練功能

### 流程

1. 在編輯器分類列拉到第 7 個分類（青色手勢圖示）
2. 拖出 `ongesture` 積木並選擇對應手勢
3. 點選分類面板中的「前往 AI 訓練」按鈕（或直接打開 `aitrainer.html?projectId=<id>`）
4. 在訓練頁面選一個手勢（1-5 指 × 上/下/左/右，共 20 種）
5. 對著鏡頭擺出手勢，按「開始收集」蒐集 ≥ 20 張樣本
6. 點「測試」即時驗證；不滿意可繼續加樣本
7. 點「儲存模型」→ IndexedDB（`scratchjr` DB / `gestures` store）
8. 返回編輯器執行綠旗，做出手勢即觸發 ongesture 積木

### 技術選型理由

- **MobileNet（特徵提取）**：通用視覺特徵，無需重新訓練主幹網路
- **KNN Classifier**：加樣本即訓練完成（< 5 秒），對 20 類手勢已足夠
- **CDN 載入 TF.js**：避免膨脹主 bundle；首次用 trainer 才下載 ~20MB

### 參數（`src/gesture/GestureEngine.js`）

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `CONFIDENCE_THRESHOLD` | 0.75 | KNN 預測信心門檻 |
| `STABLE_FRAMES` | 3 | 連續幾幀同一手勢才觸發 |
| `COOLDOWN_MS` | 1000 | 觸發後冷卻時間，避免連發 |
| `MIN_SAMPLES` | 20 | 每個手勢最少訓練樣本 |
| `MAX_SAMPLES` | 50 | 自動停止收集的樣本上限 |

---

## 已完成 vs 待延伸

### ✅ 已完成
- IndexedDB 後端（projects/media/files/gestures）
- 鏡頭、錄音、播放、SQL→IDB 對應
- AI 手勢訓練引擎與訓練頁面
- ongesture 積木、第 7 分類整合
- GitHub Pages 構建腳本

### ⏳ 後續可延伸（如需要）
1. **Palette 可捲動**：原版固定 6 分類寬度，第 7 分類在某些解析度下可能被裁切。
   可在 `src/editor/ui/Palette.js` 中將 `categoryselector` 改為 `overflow-x: auto`
   並讓內層寬度 = `15 + n*54` 像素（n = 分類數）。
2. **BlockArg argType 'g'**：目前 `ongesture` argValue 是字串。要在積木上顯示手勢
   下拉選單，需在 `src/editor/blocks/BlockArg.js` 處理 `case 'g'`：
   讀 `IndexedDB.gestures` 取得已訓練手勢清單，作為菜單項。
3. **編輯器內鏡頭浮窗**：在 `UI.js` 加 `createGestureCameraOverlay()`，於綠旗執行時
   顯示右下角即時鏡頭預覽。
4. **ScratchJr 主流程綁定**：在 `ScratchJr.runStrips()` 啟動 `GestureEngine`，
   `onGestureDetected` callback 透過 `Runtime.startScript()` 觸發對應的 ongesture 積木。
5. **PWA 化**：加 `manifest.json` 與 service worker，支援離線使用。
6. **`.sjr` zip 分享**：目前 share 退化為 JSON 下載，可加入 JSZip 還原原版功能。

---

## 授權

繼承上游 `BSD-3-Clause`（見 [LICENSE](LICENSE)）。"ScratchJr" 名稱與商標屬於
MIT Media Lab，新增的 AI 功能屬於本衍伸版本獨立貢獻。
