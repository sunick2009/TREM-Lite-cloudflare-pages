# TREM-Lite Web Plugin Strategy

## 1. 為何第一階段不相容原 Electron Plugin

### 技術原因
- Electron plugin 使用 `require()` 載入，依賴 Node.js 模組系統
- Plugin 可直接存取 `require('fs')`, `require('path')`, `require('@electron/remote')` 等 Node API
- Plugin 以 `.trem` 格式打包 (ADM-ZIP)，需要本機檔案系統才能解壓
- Plugin 使用 `ipcRenderer`/`ipcMain` 進行進程間通訊

### 安全原因
- Web 環境下執行第三方 JS 風險極高
- 同 origin 下的 plugin 可讀取 IndexedDB 中的設定與任何資料
- CSP (Content Security Policy) 無法有效限制 eval/dynamic import 的安全邊界
- Plugin 可能操控 DOM，注入惡意內容

### 相容性說明文件
現有 Electron plugin 必須針對 Web 環境重寫，因為：
1. 移除了 Node.js 環境
2. 移除了 Electron IPC
3. 改用 ES module 系統
4. 本機檔案存取改為 IndexedDB / File System Access API

## 2. Web Plugin 未來方向

### 短期：官方內建模組化
將常用 plugin 功能改寫為內建 feature module，受統一的 TypeScript 型別和安全邊界控管。

### 中期：Web Worker Plugin 沙盒
```
主執行緒
  ↕ postMessage (allowlist 訊息格式)
Web Worker (plugin sandbox)
  - 不能存取 DOM
  - 不能存取 indexedDB 直接
  - 透過 API 訊息讀取允許的資料
  - 有嚴格的訊息 schema 限制
```

### 長期：iframe sandbox Plugin
```html
<iframe sandbox="allow-scripts" src="https://plugin-cdn/plugin/index.html">
```
- `sandbox` 屬性限制 plugin 能力
- plugin 透過 `postMessage` 與主 app 通訊
- 主 app 實作 plugin API handler，檢查每個請求是否合法
- Plugin manifest 宣告所需權限

### Plugin Manifest 格式（未來）
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "Author",
  "permissions": [
    "read:eew",
    "read:rts",
    "read:config",
    "notification"
  ],
  "entry": "index.js",
  "sandbox": "worker"
}
```

### postMessage API（未來）
Plugin 透過 `postMessage` 與主 app 通訊：
```javascript
// Plugin 請求資料
self.postMessage({ type: 'REQUEST', resource: 'eew' });

// 主 app 回應
self.postMessage({ type: 'RESPONSE', resource: 'eew', data: [...] });
```

### 權限模型（未來）
| 權限 | 說明 |
|------|------|
| `read:eew` | 讀取 EEW 資料 |
| `read:rts` | 讀取 RTS 資料 |
| `read:config` | 讀取設定 |
| `write:config` | 修改設定（需使用者確認） |
| `notification` | 發送通知 |
| `audio` | 播放音效 |
| `speech` | 語音播報 |

## 3. 第一階段替代方案

### 將常用 plugin 功能改成內建 feature
| Electron Plugin 功能 | Web 版替代 |
|---------------------|-----------|
| 自訂音效 | Settings 中的音效設定 |
| 自訂 UI 主題 | CSS 變數 + Settings |
| 額外資料來源 | 第一階段不做，第二階段可用 configurable endpoint |
| WebSocket 資料 | 第一階段不做，第二階段可考慮 |
| 地圖疊加層 | 內建 layer 設定 |

### WebSocket Plugin 暫不做
原因：
- WebSocket plugin 需要 ExpTech 帳號登入
- token 不得寫入前端 bundle
- 需要後端儲存 token 的機制（Worker KV 或 D1）
- 第一階段以無登入的 HTTP polling 為主

若未來實作 WebSocket，設計方向：
1. 使用 Cloudflare Worker 作為 WebSocket proxy
2. 使用者在 Settings 中輸入 token
3. Token 存入 IndexedDB（加密儲存）
4. Worker 中繼 WebSocket 訊息到瀏覽器

## 4. 對現有使用者的溝通

Web 版不支援原有 Electron plugin，原因已說明如上。
有興趣開發 Web 版 plugin 的開發者，請參考未來的 Web Plugin SDK 文件（待發布）。
