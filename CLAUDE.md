# CLAUDE.md — TREM-Lite Cloudflare Pages

Quick context for Claude Code sessions on this repo.

---

## What this repo is

**TREM-Lite** 是 ExpTechTW 的台灣即時地震監測桌面 App（Electron）。
這個 fork 在同一個 repo 裡新增了 **Web/PWA 版本**，部署至 Cloudflare Pages，不動原有 Electron 程式碼。

- Electron 原始碼：`src/`（不要改動）
- Web 版原始碼：`src-web/`（本 session 的工作區）

---

## 架構速覽

```
src-web/
  main.ts                   # 入口，初始化所有元件
  components/
    MapManager.ts           # MapLibre GL 地圖；vector tiles from lb.exptech.dev
    RtsList.ts              # 即時地震站資料 + 地圖圖層 + station hover tooltip
    EewBox.ts               # 地震速報顯示
    ReportList.ts           # 地震報告列表（含 detail fetch）
    Settings.ts             # 設定面板
    NavBar.ts               # 導覽列
    AudioController.ts      # 音效控制
  services/
    dataManager.ts          # 每 1s poll RTS/EEW；觸發 events
    earthquakeApi.ts        # API fetch；IS_LOCALHOST 路由 report 走 Vite proxy
    configStore.ts          # 設定 localStorage
    stationResource.ts      # 測站資料 (station.json)
    eventBus.ts             # 全域事件匯流排
    ntpService.ts           # NTP 時間同步
  styles/main.css           # 單一 CSS 檔（含 intensity-X 全域 class）

functions/api/proxy.ts      # Cloudflare Pages Function：CORS proxy
public/                     # PWA manifest, audio, icons, data/region.json
e2e/                        # Playwright 測試
```

---

## 重要設計決策與已知問題

### CORS 繞過策略（三層）

| 環境 | 路徑 | 說明 |
|------|------|------|
| localhost dev/preview | `/local-api/*` → Vite proxy | `vite.config.ts` 的 `server.proxy` + `preview.proxy` |
| 生產（官方域名） | 直接 call `api.core.exptech.dev` | ExpTech CORS 允許官方 origin |
| 生產（自訂域名）或手動 | `/api/proxy?url=...` | Cloudflare Function，需開啟 `useProxy` 設定 |

### Map Tiles
- **不能用** `url: 'https://api-1.exptech.dev/.../tiles.json'`：tiles.json 沒有 CORS header
- **必須用** `tiles: ['https://lb.exptech.dev/api/v1/map/tiles/{z}/{x}/{y}.pbf']`：CDN 有 `*` CORS
- MapLibre `map.on('error')` 加了 tile-error 跳過判斷，防止單一 tile 失敗觸發整個地圖重新初始化的無限 loop

### intensity-X CSS 全域 ::after
- 全域 `.intensity-N::after` 會注入文字（例如 "3"、"不明"）
- 凡是用 `intensity-N` class 但自行設定文字內容的元素，必須加 `::after { content: none !important; }`
- 例子：`.sp-intensity::after { content: none !important; }` in station tooltip

### Station Hover Tooltip
- `window.__map` 在地圖載入後被曝露（MapManager.ts），供 debug 和 e2e 測試使用
- GeoJSON feature properties 包含 `{ i, name, pga, iFloat }` 給 popup 使用
- Popup 掛在 `rts-layer`、`markers`、`markers-0` 三個 layer 的 mousemove/mouseleave

---

## 開發指令

```bash
npm run dev:web          # Vite dev server (localhost:5173)
npm run build:web        # TypeScript check + Vite build → dist/
npm run preview:web      # 預覽 production build (localhost:4173，含 Vite proxy)
npm run pages:dev        # wrangler pages dev (localhost:8788，含 Cloudflare Functions)

npm run test:e2e         # Playwright 測試（針對 vite preview）
npm run test:e2e:proxy   # Playwright proxy 測試（針對 wrangler，BASE_URL=http://localhost:8788）
```

**build 前必過：** `npm run build:web` 包含 `tsc --noEmit`，TypeScript 有錯就失敗。

---

## API 域名對照

| 用途 | 域名 | CORS |
|------|------|------|
| RTS / EEW polling | `api.lb.exptech.dev` | ✅ `*` |
| Intensity / LPGM | `api-1.exptech.dev`, `api-2.exptech.dev` | ✅ `*` |
| 報告列表 | `api.core.exptech.dev` | ✅（限官方 origin） |
| 報告詳情 | `api.core.exptech.dev` | ⚠️ localhost 需走 Vite proxy |
| Map tiles | `lb.exptech.dev` | ✅ `*` |
| Map metadata | `api-1.exptech.dev/tiles.json` | ❌ 無 CORS（不使用） |

---

## Cloudflare 部署

- `wrangler.toml`：`pages_build_output_dir = "dist"`
- `functions/api/proxy.ts` → 路由 `/api/proxy`（自動識別）
- `public/_headers`：Cloudflare cache/security headers
- `public/_redirects`：SPA fallback `/* /index.html 200`

---

## 測試

```
e2e/smoke.spec.ts           # 29 項 smoke tests（build、PWA、DOM、API CORS、proxy）
e2e/station-tooltip.spec.ts # 6 項 tooltip 測試（注入假 station、hover、驗證 popup）
```

Tooltip 測試策略：透過 `window.__map` 取得地圖，用 `getSource('rts').setData()` 注入已知座標的測站，再用 `map.project()` 轉換成螢幕座標後 hover。

---

## 尚未實作（Phase 2）

- [ ] 音效設定 UI（已有 AudioController，無設定介面）
- [ ] EEW P/S wave 動畫（CSS 已備，邏輯待補）
- [ ] LPGM 圖層（資料有 fetch，layer 未加）
- [ ] 離線支援最佳化（Service Worker precache 已設定）
- [ ] 響應式行動版調整
- [ ] 瀏覽器定位 API 整合（Geolocation）

### 瀏覽器定位 API（待實作）

透過 `navigator.geolocation` 取得使用者座標，在地圖上顯示當前位置，並自動比對所在行政區。

**預計功能：**
- 地圖上顯示定位點（藍色脈衝標記，類似 Google Maps）
- 自動比對 `data/region.json` 找出最近的行政區代碼，設定為使用者所在地
- 所在地用於 EEW 警報的震度預估（顯示「您的位置預估震度 X 級」）
- NavBar 加入定位按鈕（`🎯` 或類似圖示），點擊後觸發定位或移動視角至定位點
- 定位失敗（拒絕授權、逾時）需有 graceful fallback，不影響主功能

**實作建議：**
- 新增 `src-web/services/geoLocation.ts`，封裝 `watchPosition` + 誤差過濾邏輯
- 定位點 layer 加在 `MapManager.ts`（source: `user-location`，type: `circle`）
- 行政區比對用 `search_loc_name` / 現有 region 資料，避免額外 API 呼叫
- HTTPS 限制：Cloudflare Pages 已是 HTTPS，localhost dev 也符合（瀏覽器允許 localhost geolocation）

### WebSocket 即時連線（重要，待實作）

**問題**：Web 版目前用 HTTP polling（`setInterval` 1s），瀏覽器對背景 tab 的 timer 節流政策
（Chrome 88+）會導致 tab 閒置超過 5 分鐘後 fetch 幾乎停止，警報功能失效。

**解法**：改用 WebSocket 持久連線。OS 層 socket 不受 timer 節流影響，Teams/Slack 等均採此方案。

**ExpTech 現況**：
- Electron 版 `constant.js` 已有 `// 0 realtime (http) | 1 realtime (websocket)` 模式設計
- WebSocket API endpoint 格式尚未完成設計，**待 ExpTech 團隊確認後實作**
- 實作時建議在 `dataManager.ts` 新增 WebSocket 連線層，保留 HTTP polling 作為 fallback

**暫行緩解**（已實作）：`visibilitychange` 事件偵測，使用者切回 tab 時立即重連 + 5 秒緩衝期。
