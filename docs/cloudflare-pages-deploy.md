# Cloudflare Pages 部署指南

## 建置設定

| 項目 | 值 |
|------|-----|
| Build command | `npm run build:web` |
| Build output directory | `dist` |
| Root directory | `/` (專案根目錄) |
| Node.js version | `20.x` (建議) |
| Package manager | npm 或 bun |

## 環境變數

目前第一階段不需要任何環境變數（無 token、無 private API key）。

若未來需要：
| 變數名稱 | 說明 | 是否必要 |
|---------|------|---------|
| `EXPTECH_API_TOKEN` | ExpTech API token（未來 WebSocket 功能） | 否 |
| `ALLOWED_ORIGINS` | 允許的 CORS origin（proxy function） | 否 |

## 本機開發

```bash
# 安裝依賴
npm install

# 啟動 Web 版開發伺服器
npm run dev:web
# → http://localhost:5173

# 本機模擬 Cloudflare Pages Functions（包含 proxy）
npm run preview:web
# → 需要先安裝 wrangler: npm install -D wrangler
# → npx wrangler pages dev dist --port 8788
```

## 建置與部署

```bash
# 建置 Web 版
npm run build:web
# → 輸出到 dist/

# 預覽建置結果
npx serve dist

# 部署到 Cloudflare Pages（手動）
npx wrangler pages deploy dist
```

## CORS 驗證

部署後，在瀏覽器 Console 中測試 API 可達性：

```javascript
// 測試 RTS API
fetch('https://api.lb.exptech.dev/api/v2/trem/rts')
  .then(r => console.log('RTS CORS OK:', r.status))
  .catch(e => console.error('RTS CORS FAIL:', e.message));

// 測試 EEW API
fetch('https://api.lb.exptech.dev/api/v2/eq/eew')
  .then(r => console.log('EEW CORS OK:', r.status))
  .catch(e => console.error('EEW CORS FAIL:', e.message));

// 測試 Station API
fetch('https://api-1.exptech.dev/api/v1/trem/station')
  .then(r => console.log('Station CORS OK:', r.status))
  .catch(e => console.error('Station CORS FAIL:', e.message));
```

**若 CORS 通過**：不需要 proxy，直接使用。

**若 CORS 失敗**：啟用 `/functions/api/proxy.ts`，在 `src-web/services/earthquakeApi.ts` 中將 API domain 改為 `/api/proxy?url=...`。

## Pages Functions

目前 `/functions/api/proxy.ts` 已預先建立，但**預設不啟用**。

啟用方式：在 `src-web/services/earthquakeApi.ts` 中修改 `USE_PROXY` 常數：
```typescript
const USE_PROXY = true; // 改為 true 啟用 proxy
```

## 快取設定 (_headers)

- `index.html` → no-cache（確保最新版本）
- `*.js`, `*.css` → immutable 長快取（Vite hash 命名）
- `manifest.webmanifest` → no-cache
- Service Worker → no-cache

## SPA Fallback (_redirects)

`_redirects` 設定：
```
/* /index.html 200
```

若使用 client-side routing，此設定確保直接訪問路由時能正確返回 index.html。

## Cloudflare Web Analytics

在 `index.html` 中加入（可選）：
```html
<script defer src='https://static.cloudflareinsights.com/beacon.min.js'
  data-cf-beacon='{"token": "YOUR_TOKEN"}'></script>
```

## 注意事項

1. **不要 commit** `.env` 或任何包含 private token 的檔案
2. **不要** 將 Electron build 的 `dist/` 與 Web build 的 `dist/` 混淆
3. **定期檢查** API endpoints 是否有 breaking change
4. **Service Worker** 更新後，使用者需要重整頁面才能取得新版本（已有提示機制）

## 常見問題

**Q: 地圖不顯示？**
A: 確認 `https://api-1.exptech.dev/api/v1/map/tiles/tiles.json` 可正常存取，且有允許 CORS。

**Q: 無法取得即時資料？**
A: 打開 Browser DevTools → Network，確認 API 請求是否有 CORS 錯誤。若有，啟用 proxy。

**Q: 音效無法播放？**
A: 點擊頁面上的「啟用音效」按鈕，或先與頁面互動（點擊任意位置）再等待音效觸發。

**Q: PWA 無法安裝？**
A: 確認部署在 HTTPS 域名，且 manifest.webmanifest 路徑正確。
