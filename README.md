# TREM-Lite — Cloudflare Pages Web/PWA

> **Fork of [ExpTechTW/TREM-Lite](https://github.com/ExpTechTW/TREM-Lite)**
> This repository adapts the desktop Electron app into a browser-based PWA deployed on Cloudflare Pages.
> All changes from the upstream source are listed in the [Changes from upstream](#changes-from-upstream) section.

<div align="center">
<a href="https://github.com/ExpTechTW/TREM-Lite/tree/main"><img alt="upstream" src="https://img.shields.io/badge/upstream-ExpTechTW%2FTREM--Lite-blue"></a>
<img alt="GitHub License" src="https://img.shields.io/github/license/exptechtw/TREM-Lite">
<a href="https://exptech.dev/trem"><img alt="website" src="https://img.shields.io/badge/website-exptech.dev-purple.svg"></a>
</div>

## 簡介

TREM（Taiwan Real-time Earthquake Monitoring）是一款開源地震速報軟體，提供即時地震資訊。本 fork 將原本的 Electron 桌面應用程式改寫為可在瀏覽器執行的 PWA，並部署於 Cloudflare Pages。

### 功能

- **強震即時警報 (EEW)** — 地震發生時即時推播警報，含音效與通知
- **即時地震觀測 (RTS)** — 顯示 TREM-Net 各測站即時震度，滑鼠滑過可查看測站數據
- **地震報告列表** — 顯示最新地震報告，含震度、規模、深度、位置
- **地圖視覺化** — MapLibre GL 地圖，顯示震央、測站震度、警報範圍
- **PWA 支援** — 可安裝至桌面、離線快取靜態資源、Service Worker 自動更新

## 資料來源

所有資料皆來自於以下單位：

- [交通部中央氣象署](https://www.cwa.gov.tw/)
- [國家災害防救科技中心](https://www.ncdr.nat.gov.tw/)
- TREM-Net by [ExpTech Studio](https://exptech.dev/)

## 本地開發

```bash
# 安裝依賴
npm install

# 啟動 Vite dev server（純前端，直接呼叫 ExpTech API）
npm run dev:web

# TypeScript 型別檢查
npm run typecheck:web

# 建置生產版本
npm run build:web

# 啟動 Cloudflare Pages 本地模擬（含 Functions/Proxy）
npm run pages:dev
```

## E2E 測試

```bash
# 執行所有 E2E 測試（需先 build:web）
npm run test:e2e

# 透過 Cloudflare Pages 本地代理執行測試
npm run test:e2e:proxy
```

## 部署至 Cloudflare Pages

### 首次設定

```bash
# 登入 Cloudflare
npx wrangler login

# 建置並部署（會自動建立 Pages 專案）
npm run deploy:pages
```

### CI/CD

推送至 `feat/cloudflare-pages` 分支後，GitHub Actions 會自動執行：
1. TypeScript 型別檢查
2. 建置 Vite 生產版本
3. 透過 `wrangler pages deploy` 部署至 Cloudflare Pages

需在 GitHub Repository Settings → Secrets 設定：
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Branch 說明

| Branch | 說明 |
|--------|------|
| `main` | 追蹤上游 [ExpTechTW/TREM-Lite](https://github.com/ExpTechTW/TREM-Lite) |
| `feat/cloudflare-pages` | 本 fork 的所有工作，Web/PWA/Cloudflare 相關變更 |

## Changes from upstream

本 fork 在上游原始碼基礎上進行以下變更：

- **新增 `src-web/`** — 瀏覽器端 TypeScript 原始碼（取代 Electron 的 `src/`）
- **新增 `functions/`** — Cloudflare Pages Functions（API proxy 等）
- **新增 `public/`** — 靜態資源（PWA icons、地圖 sprites 等）
- **新增 `vite.config.ts`、`tsconfig.web.json`** — Web 建置設定
- **新增 `wrangler.toml`** — Cloudflare Pages 部署設定
- **新增 `.github/workflows/deploy-pages.yml`** — CI/CD（移除原始 Electron 相關 workflows）
- **移除 Electron 相關 workflows** — `ci.yml`、`release.yml` 等

原始 Electron 應用程式的功能與原始碼未受影響，上游更新可透過 `main` branch merge 取得。

## 開放原始碼授權

本專案依照上游授權，採用 **GNU Affero General Public License v3.0 (AGPL-3.0)**。

AGPL-3.0 的「網路使用條款」要求：若您透過網路提供本軟體的服務，必須公開對應的原始碼。本 fork 以此公開 GitHub repository 的方式履行此義務。

詳見 [LICENSE](LICENSE) 檔案。

原始專案：[ExpTechTW/TREM-Lite](https://github.com/ExpTechTW/TREM-Lite)，作者 [ExpTech Studio](https://exptech.dev/)。
