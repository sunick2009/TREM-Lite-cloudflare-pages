# TREM-Lite Web Porting Analysis

## 1. 現有 Electron 相依清單

### Main Process (src/main.js)
| 模組 | 用途 | Web 替代 |
|------|------|----------|
| `electron` (BrowserWindow, app, ipcMain, Tray, Menu, shell, dialog, nativeImage) | 視窗管理、系統整合 | 刪除 |
| `electron-builder` | 打包 | 不需要 |
| `electron-updater` | 自動更新 | 刪除 |
| `@electron/remote/main` | 渲染進程存取 main API | 刪除 |
| `fs-extra` | 讀寫本機檔案 | IndexedDB / Cache Storage |
| `path` | 路徑操作 | 不需要 |
| `js-yaml` | YAML 解析 | 改用 JSON |
| `electron-store` | 視窗狀態持久化 | localStorage |

### Renderer Process (src/js/)
| 模組 | 用途 | Web 替代 |
|------|------|----------|
| `require('electron').ipcRenderer` | IPC 通訊 | 直接函式呼叫 / EventBus |
| `require('@electron/remote')` | 存取 app.getPath, BrowserWindow | 刪除，改用 IndexedDB |
| `require('fs-extra')` | 讀寫本機檔案 | 刪除 (replay 功能) |
| `require('path')` | 路徑操作 | 不需要 |
| `require('undici')` (Pool, dispatcher) | HTTP 請求 (Node.js) | 瀏覽器原生 `fetch()` |
| `require('ntp-time-sync')` | NTP 時間同步 (UDP) | HTTP Date header 估算 |
| `require('events')` (EventEmitter) | 事件系統 | 自製 EventBus 或 EventTarget |
| `require('maplibre-gl')` | 地圖 | **直接沿用** (Web 相容) |
| `require('speak-tts')` | TTS | **Web Speech API 直接使用** |
| `require('@exptech/http')` | 報告 API | 直接 HTTP fetch |
| `require('pino')` | 日誌 | `console.log` |
| `new Audio()` | 音效 | **直接沿用** (Web 相容) |
| `new Notification()` | 系統通知 | **直接沿用** (Web Notification API) |

## 2. API Endpoints 分析

### 使用的端點
| 端點 | 協定 | 頻率 | 說明 |
|------|------|------|------|
| `https://${apiProxyDomain}/api/v2/trem/rts` | HTTPS | ~1s | 即時測站資料 |
| `https://${apiProxyDomain}/api/v2/eq/eew` | HTTPS | ~1s | 地震速報 |
| `https://api-1.exptech.dev/api/v2/trem/intensity` | HTTPS | ~5s | 震度速報 |
| `https://api-1.exptech.dev/api/v2/trem/lpgm` | HTTPS | ~7s | 長週期地震動 |
| `https://api-1.exptech.dev/api/v1/trem/station` | HTTPS | ~10min | 測站資料 |
| `https://api-1.exptech.dev/api/v1/eq/report` | HTTPS | ~10s | 地震報告列表 |
| `https://api-1.exptech.dev/api/v1/map/tiles/tiles.json` | HTTPS | once | 地圖 tiles |
| `https://api-1.exptech.dev/api/v1/eq/report/{id}` | HTTPS | on demand | 特定報告 |

- 預設 apiProxyDomain: `api.lb.exptech.dev`
- 備用 API domain: `api-1.exptech.dev`, `api-2.exptech.dev`
- **不需要 token** (第一階段)

### CORS 狀態 (需實測)
以下是 ExpTech 公開 API 的 CORS 評估。由於這些是公開地震資訊 API，預期有適當的 CORS headers，但需要實測驗證：

**測試方法**:
```bash
curl -I -H "Origin: https://example.com" https://api-1.exptech.dev/api/v2/trem/rts
# 查看回應中是否有 Access-Control-Allow-Origin header
```

**預期結果**:
- 若回應含 `Access-Control-Allow-Origin: *` → 直接使用，不需要 proxy
- 若缺少此 header → 需要 `/functions/api/proxy.ts`

**目前狀態**: 需要實際部署後測試。已預先建立 proxy function 作為備案。

## 3. Web 可保留功能

| 功能 | 評估 | 說明 |
|------|------|------|
| 地圖 (MapLibre GL) | ✅ 直接沿用 | MapLibre GL 是 Web 函式庫 |
| RTS 即時站資料顯示 | ✅ 可移植 | 需重寫模組系統 |
| EEW 顯示與動畫 | ✅ 可移植 | 需重寫 IPC 呼叫 |
| 震度速報 | ✅ 可移植 | 同上 |
| LPGM | ✅ 可移植 | 同上 |
| 地震報告列表 | ✅ 可移植 | 改用直接 HTTP fetch |
| 音效通知 | ✅ 可移植 | 需處理 autoplay policy |
| Web Speech TTS | ✅ 可移植 | 改用 Web Speech API |
| 瀏覽器通知 | ✅ 可移植 | Web Notification API |
| 設定存取 | ✅ 可移植 | IndexedDB 替代 YAML |
| NTP 時間同步 | ⚠️ 降級 | 改用 HTTP Date header 估算 |
| PWA | ✅ 新增 | manifest + service worker |

## 4. Web 應捨棄功能

| 功能 | 原因 |
|------|------|
| Tray icon | Electron 專屬，Web 無此概念 |
| 開機自動啟動 | OS level，Web 無此能力 |
| trem-lite:// protocol | Electron 深連結，不適用 Web |
| autoUpdater | Electron 功能，Web 版由 Service Worker 管理更新 |
| BrowserWindow 多視窗 | 改用 modal/overlay |
| PiP 視窗 | 改用 CSS overlay 或 Picture-in-Picture Web API |
| Plugin 系統 | 第一階段不支援，見 web-plugin-strategy.md |
| Replay 從本機檔案載入 | 需要 File System Access API，第一階段不做 |
| YAML 編輯器視窗 | 不需要，改用 JSON 編輯 |
| 任意讀寫本機資料夾 | Web 安全限制 |
| 背景常駐警報 | 需要 Web Push，第一階段不做 |

## 5. 需要重構的模組

| 原模組 | 重構方式 |
|--------|----------|
| `src/js/core/config.js` | → `src-web/services/configStore.ts` (IndexedDB) |
| `src/js/core/utils/fetch.js` | → 瀏覽器原生 `fetch()` + AbortController |
| `src/js/core/utils/logger.js` | → `console.log/error` |
| `src/js/index/event.js` | → `src-web/services/eventBus.ts` |
| `src/js/index/data/http.js` | → `src-web/services/earthquakeApi.ts` |
| `src/js/index/data/data.js` | → `src-web/services/dataManager.ts` |
| `src/js/index/core/resource.js` | → `src-web/services/stationResource.ts` |
| `src/js/index/core/audio.js` | → `src-web/services/audioService.ts` |
| `src/js/index/core/tts.js` | → `src-web/services/speechService.ts` |
| `src/js/index/core/eew.js` | → `src-web/components/EewBox.ts` |
| `src/js/index/core/rts.js` | → `src-web/components/RtsList.ts` |
| `src/js/index/core/report.js` | → `src-web/components/ReportList.ts` |
| `src/js/index/map.js` | → `src-web/components/MapManager.ts` |
| `src/js/index/core/loop.js` | → `src-web/components/NavBar.ts` + main loop |
| `src/js/index/utils/eewCalculator.js` | → `src-web/utils/eewCalculator.ts` |
| `src/js/index/utils/utils.js` | → `src-web/utils/utils.ts` |
| `src/js/index/utils/ntp.js` | → `src-web/services/ntpService.ts` |

## 6. 第一階段 MVP 範圍

### 必須
- [x] 地圖顯示 (MapLibre GL)
- [x] RTS 即時測站顯示
- [x] EEW 速報顯示 (info box + 波圈動畫)
- [x] 震度速報顯示
- [x] LPGM 顯示
- [x] 地震報告列表
- [x] 連線狀態顯示
- [x] 音效通知
- [x] Web Speech TTS
- [x] 瀏覽器通知 (Notification API)
- [x] 基本設定 (configStore with IndexedDB)
- [x] PWA manifest + service worker
- [x] Cloudflare Pages 部署

### 不做
- [ ] Replay 功能
- [ ] Plugin 系統
- [ ] 背景常駐通知 (Web Push)
- [ ] YAML 編輯器
- [ ] PiP 視窗 (可升級為 Picture-in-Picture Web API)

## 7. 風險與未決事項

1. **CORS**: ExpTech API 是否允許來自瀏覽器的跨域請求，需部署後實測。已預備 proxy。
2. **NTP 精度**: 瀏覽器無法用 UDP NTP。改用 HTTP Date header 估算，精度較低 (~100ms)。
3. **音效 Autoplay**: 瀏覽器要求使用者先互動才能播放音效。已處理，需要使用者確認。
4. **通知權限**: Notification API 需要使用者授權。
5. **地圖 tiles CORS**: MapLibre GL 需要地圖 tiles 允許 CORS，需確認 ExpTech 伺服器設定。
6. **speak-tts vs Web Speech API**: 原版用 `speak-tts` npm 套件，Web 版改用 `window.speechSynthesis` 直接呼叫。
7. **`@exptech/http` SDK**: 不引入此套件，改用直接 fetch 呼叫已知 API endpoint。
