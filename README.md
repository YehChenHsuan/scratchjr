# ScratchJr Web Edition

[繁體中文](README.md) | [简体中文](README.zh-CN.md) | [English](README.en.md)

這是以 [LLK/scratchjr](https://github.com/LLK/scratchjr) 為基礎的 ScratchJr 網頁版衍生專案。原始專案主要為 iOS 與 Android App；本專案將其轉為可部署在 GitHub Pages、Netlify 等靜態網站服務的純前端 Web App。

目前公開版本：<https://yehchenhsuan.github.io/scratchjr/>

## 專案特色

- **為網頁而生的本機體驗：** 專案與媒體資料儲存在 IndexedDB。`src/tablet/Web.js` 以網頁 API 取代原本 iOS／Android bridge：相機使用 `getUserMedia`，錄音使用 `MediaRecorder` 與 Web Audio API。
- **AI 手勢辨識：** 新增青綠色第七類積木與 `ongesture` 事件積木。使用者可訓練自己的手勢，讓手勢觸發程式；分類器使用手部關鍵點（landmark）的 KNN，而非已移除的 MobileNet／TensorFlow.js，藉此降低 PWA 離線快取體積。
- **可完整離線使用的 PWA：** 首次連線時會下載離線資源包，底部會顯示進度列，完成後顯示通知。Service Worker 提供可續傳的 `GET_CACHE_STATUS` 狀態機制，安裝完成後可離線啟動與使用。
- **更豐富的創作素材：** 相較 Desktop 版，角色庫新增 119 個角色與 28 個背景。
- **WAP 分享與下載：** 專案可下載到本機，也可在支援的裝置上透過 Web Share API 開啟系統分享面板，提供類似 AirDrop 的分享流程。

## 快速開始

需要 Node.js 與 npm。先安裝相依套件：

```bash
npm install
```

開發時，先建立開發用 bundle，再啟動靜態伺服器並開啟 <http://localhost:8080/index.html>：

```bash
npm run dev
npm run serve
```

持續監看程式變更可改用：

```bash
npm run watch
```

相機功能需要安全環境；瀏覽器中的 `localhost` 可用於本機測試，部署時請使用 HTTPS。

## 建置與部署

GitHub Pages 的發布目錄是 `docs/`。以下指令會同步 AI 資源、產生 PWA 圖示、建立 production bundle，並重建 `docs/`：

```bash
npm run build:web
```

在 GitHub 儲存庫設定中，將 Pages 設為從分支的 `/docs` 目錄發布。將更新後的 `docs/` 提交並推送，即可更新 GitHub Pages。

若要建立另一份可部署的最佳化 PWA 發布樹，執行：

```bash
npm run package:pwa
```

它會輸出至 `dist/pwa/`；此目錄可作為 Netlify 等靜態主機的部署來源。完整檢查與打包流程可使用 `npm run release:pwa`。

## 授權與商標

本專案延續上游的 [BSD-3-Clause 授權](LICENSE)。ScratchJr 的名稱與商標屬於 MIT Media Lab。本衍生專案所加入的網頁化 bridge、AI 手勢辨識、離線 PWA、WAP 分享等功能，為本專案的衍生貢獻，不代表 MIT Media Lab 的官方產品或背書。
