import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/main.css';

import { loadConfig } from './services/configStore.ts';
import { loadRegionData } from './utils/utils.ts';
import { loadStation, startStationRefresh } from './services/stationResource.ts';
import { startNtpSync } from './services/ntpService.ts';
import { init as initNotification } from './services/notificationService.ts';
import { init as initSpeech } from './services/speechService.ts';
import { startDataLoop } from './services/dataManager.ts';
import { initMap } from './components/MapManager.ts';
import { initEewBox } from './components/EewBox.ts';
import { initRtsList } from './components/RtsList.ts';
import { initReportList } from './components/ReportList.ts';
import { initNavBar } from './components/NavBar.ts';
import { initAudioController } from './components/AudioController.ts';
import { initSettings } from './components/Settings.ts';
import { startGeolocation } from './services/geoLocation.ts';

async function main(): Promise<void> {
  console.log('[TREM Web] Starting...');

  // Load config first
  const config = await loadConfig();
  console.log('[TREM Web] Config loaded');

  // Load region data (needed for loc lookups)
  await loadRegionData();
  console.log('[TREM Web] Region data loaded');

  // Init services
  initNotification();
  initSpeech();
  startNtpSync(config.apiProxyDomain);

  // Load station data (async, non-blocking for UI)
  loadStation().then(() => {
    startStationRefresh();
    console.log('[TREM Web] Station data loaded');
  });

  // Init UI components (before map so elements exist)
  initNavBar();
  startGeolocation();
  initSettings();
  initRtsList();
  initReportList();
  initAudioController();

  // Init EEW box (needs to load time.json)
  await initEewBox();

  // Start data polling loop
  startDataLoop();

  // Init map (emits 'MapLoad' when ready, which triggers data loop start)
  await initMap();

  console.log('[TREM Web] Ready.');
}

main().catch((e) => {
  console.error('[TREM Web] Fatal error:', e);
});

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[SW] Registered:', reg.scope);
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
    }).catch((e) => {
      console.warn('[SW] Registration failed:', e);
    });
  });
}

function showUpdateBanner(): void {
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.innerHTML = `<span>有新版本可用</span><button id="update-reload">重新載入</button>`;
  document.body.appendChild(banner);
  document.getElementById('update-reload')?.addEventListener('click', () => window.location.reload());
}
