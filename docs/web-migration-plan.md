# TREM-Lite → Cloudflare Pages Web/PWA Migration Plan

## Status: Complete (Phase 1 MVP)

---

## What Was Built

A full browser-based port of TREM-Lite that runs on Cloudflare Pages with no Electron dependency, deployed from the same repository alongside the original Electron build.

### New Files

| Path | Purpose |
|------|---------|
| `index.html` | Web entry point (mirrors `src/view/index.html`) |
| `vite.config.ts` | Vite build config with PWA plugin |
| `tsconfig.web.json` | TypeScript config targeting ES2022/DOM |
| `src-web/main.ts` | Bootstrap: init all services + components |
| `src-web/types/index.ts` | Full TypeScript interfaces for all data types |
| `src-web/utils/constants.ts` | COLOR, URL, AUDIO, MAP constants (no Node deps) |
| `src-web/utils/utils.ts` | Search/format helpers, loadRegionData() via fetch |
| `src-web/utils/eewCalculator.ts` | P/S wave distance + PGA→intensity math |
| `src-web/services/eventBus.ts` | Browser EventEmitter replacement |
| `src-web/services/ntpService.ts` | HTTP Date header NTP sync |
| `src-web/services/configStore.ts` | IndexedDB config (replaces YAML + electron-store) |
| `src-web/services/earthquakeApi.ts` | Browser fetch polling (replaces undici) |
| `src-web/services/audioService.ts` | HTML5 Audio + queue, autoplay unlock |
| `src-web/services/notificationService.ts` | Web Notification API wrapper |
| `src-web/services/speechService.ts` | window.speechSynthesis wrapper |
| `src-web/services/stationResource.ts` | Station data with localStorage cache |
| `src-web/services/appState.ts` | Global state singleton (replaces TREM.variable) |
| `src-web/services/dataManager.ts` | EEW/RTS/Intensity/LPGM data loop |
| `src-web/components/MapManager.ts` | MapLibre GL init + icon loading |
| `src-web/components/EewBox.ts` | EEW panel + P/S wave animation |
| `src-web/components/RtsList.ts` | Station dots + intensity list |
| `src-web/components/ReportList.ts` | Report list panel |
| `src-web/components/NavBar.ts` | Clock display + nav buttons |
| `src-web/components/AudioController.ts` | Event→audio/TTS/notification wiring |
| `src-web/components/Settings.ts` | Settings panel (IndexedDB backed) |
| `src-web/styles/main.css` | Consolidated CSS (all original CSS merged) |
| `public/manifest.webmanifest` | PWA manifest |
| `public/audio/*.mp3` | Audio assets (copied from src/audio/) |
| `public/image/*.png` | Map marker images |
| `public/icons/icon-192.png` | PWA icon 192×192 |
| `public/icons/icon-512.png` | PWA icon 512×512 |
| `public/data/time.json` | EEW travel-time table (served statically) |
| `public/data/region.json` | Taiwan region/code lookup (served statically) |
| `public/_headers` | Cloudflare cache + security headers |
| `public/_redirects` | SPA fallback `/* /index.html 200` |
| `functions/api/proxy.ts` | Cloudflare Pages Function CORS proxy (allowlist) |
| `docs/web-porting-analysis.md` | Electron dependency analysis |
| `docs/web-plugin-strategy.md` | Plugin system strategy |
| `docs/cloudflare-pages-deploy.md` | Deployment guide |

---

## Electron vs Web API Mapping

| Electron API | Web Replacement |
|---|---|
| `@electron/remote` / `BrowserWindow` | Removed (no PiP window in web) |
| `ipcRenderer.send('openUrl', url)` | `window.open(url, '_blank')` |
| `ipcRenderer.send('update-pip', ...)` | Removed |
| `electron-store` + YAML | IndexedDB via `configStore.ts` |
| `fs-extra` (replay directory) | Deferred (File System Access API, Phase 2) |
| `undici` Pool + dispatcher | `fetch()` + `AbortSignal.timeout()` |
| `ntp-time-sync` (UDP) | HTTP `Date` header offset |
| `EventEmitter` (Node.js) | Custom `EventBus` class |
| `speak-tts` npm package | `window.speechSynthesis` |
| `new Notification()` | Web Notification API (same interface) |
| `require('crypto')` | Unused in web version |
| Auto-updater | Service Worker update banner |
| Plugin loader | Deferred (Phase 2) |
| `@exptech/http` SDK | Direct `fetch()` to known endpoints |

---

## CORS Verification

All ExpTech API endpoints return `Access-Control-Allow-Origin: *`. The proxy at `/api/proxy` is a **fallback only** for custom proxy domains configured in settings. Direct browser fetch works from any origin.

Endpoints verified:
- `https://api-1.exptech.dev/api/v1/trem/rts` → ✅ CORS open
- `https://api-1.exptech.dev/api/v1/trem/station` → ✅ CORS open
- `https://api.lb.exptech.dev/api/v1/eq/eew` → ✅ CORS open

---

## Build Commands

```bash
# Development server (hot reload)
npm run dev:web

# Production build → dist/
npm run build:web

# Preview production build locally
npm run preview:web

# TypeScript check only
npm run typecheck:web
```

---

## Cloudflare Pages Settings

| Setting | Value |
|---|---|
| Build command | `npm run build:web` |
| Output directory | `dist` |
| Node version | `20` |
| Root directory | (repository root) |

---

## Phase 2 Backlog

- [ ] Replay mode (File System Access API for local replay files)
- [ ] Plugin sandbox (Web Worker + postMessage API)
- [ ] Background push notifications (Web Push + service worker)
- [ ] PiP window (Picture-in-Picture API or popup window)
- [ ] Auto-zoom map on EEW (already in Electron, port to web)
- [ ] LPGM display component
- [ ] Tsunami warning overlay
- [ ] Settings: more audio toggles, graphics options

---

## Known Limitations (Phase 1)

- **Audio autoplay**: browser requires a user gesture before audio can play. The Settings panel has an "Unlock Audio" button that triggers the AudioContext unlock.
- **NTP accuracy**: HTTP Date header gives ~50–200ms accuracy vs. UDP NTP's ~10ms. Sufficient for earthquake monitoring display.
- **PiP window**: removed. The Electron PiP countdown overlay is not replicated in Phase 1.
- **Plugin system**: not ported. All plugin hooks are no-ops.
- **Replay**: not ported. Replay mode requires the File System Access API.
