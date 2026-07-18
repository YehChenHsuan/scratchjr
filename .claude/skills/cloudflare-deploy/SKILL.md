---
name: cloudflare-deploy
description: 本專案（ScratchJr Web）改用 Cloudflare Workers 部署後的維護指引。GitHub Pages 已停用。當使用者提到部署、上線、Cloudflare、workers.dev 網址、或要求發布變更時使用。
---

# Cloudflare Workers 部署維護

## 現況（2026-07-18 建立）

- 正式網址：`https://scratchjr.atax1022.workers.dev`
- 部署方式：**Cloudflare Dashboard 的 Git 整合**（Workers & Pages → 此專案 → Settings → Build），**不是**本地 `wrangler` CLI 部署。
- 綁定的 repo/分支：`YehChenHsuan/scratchjr` 的 `chromebook-optimize` 分支。
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- GitHub Pages 已於 2026-07-18 停用（workflow disabled + Pages 功能關閉），**不要再往 docs/ 部署邏輯排查**，該路徑已棄用。

## 觸發部署

Push 到 `chromebook-optimize` 分支即可觸發 Cloudflare 自動建置部署（跟 GitHub Actions 無關，是 Cloudflare 端自己 watch repo）。無法用 `gh run list` 追蹤，要用 Cloudflare Dashboard 或 `wrangler deployments list`（若本地有裝且有登入）查看部署狀態。

## 已知落差 / 待確認事項

`npm run build` 這個 script 只跑 `webpack --mode=production`，只會產生 `src/build/bundles/app.bundle.js`，**不會**產生完整靜態站台（`docs/`、`dist/pwa/` 是另外由 `npm run build:web` + `npm run package:pwa` 產生的）。但線上網址目前是可正常運作的（`curl -I` 回 200），代表：
- Cloudflare 那邊的 wrangler 設定（`wrangler.toml` 或 Dashboard 內建設定）**不在本地 repo 裡**，可能是透過 Dashboard 直接設定 assets 目錄，或有其他建置步驟未同步到本地認知。
- **下次維護前務必先去 Cloudflare Dashboard 確認實際的 wrangler 設定內容**（Settings → Build，或若有連結到 wrangler.toml 就直接讀那份），不要假設現有 npm scripts 就是完整建置流程。
- 如果之後要把 wrangler 設定納入版本控制（建議這樣做，才能被此 repo 追蹤變更），需要：
  1. 在 Cloudflare Dashboard 確認目前用的 assets 目錄與 compatibility date
  2. 建立 `wrangler.toml`（含 `[assets] directory = "..."`，指向實際部署的靜態輸出目錄）
  3. 視情況調整 `npm run build` 改成能產生該目錄內容的完整指令（例如改用 `build:web`/`package:pwa` 的邏輯）

## 更新網站的標準流程

1. 修改程式碼（`src/`、`editions/free/src/`）
2. 本地驗證：`npm run build:web` + `npm run package:pwa`，確認 `dist/pwa`/`docs` 邏輯正常（即使 Cloudflare 不讀這兩個目錄，這仍是驗證 webpack/資產打包沒壞掉的方式）
3. Commit + push 到 `chromebook-optimize`
4. 到 Cloudflare Dashboard 確認新的 build 是否成功（或詢問使用者截圖建置紀錄）
5. `curl -I https://scratchjr.atax1022.workers.dev/` 確認網站有回應，必要時请使用者實測功能（尤其是這個專案常見的錄音/離線 PWA 相關 bug）

## 相關 codebase memory

參考 `codebase-memory-mcp` 的 project `C-Users-LENOVO-Downloads-scratchjr-web`，有 PWA 離線機制、錄音修復、docs 部署清理等 ADR 記錄——這些多數是基於 GitHub Pages 時代寫的，適用邏輯（IndexedDB、PWA precache、資源相對路徑）仍然有效，只是「部署目標」要改成 Cloudflare 的認知。
