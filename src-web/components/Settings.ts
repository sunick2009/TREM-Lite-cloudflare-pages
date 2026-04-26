import { events } from '@web/services/eventBus.ts';
import { getConfig, patchConfig, resetConfig, exportConfig, importConfig } from '@web/services/configStore.ts';
import { requestPermission, getPermission, isSupported as notifSupported } from '@web/services/notificationService.ts';
import { AudioManager } from '@web/services/audioService.ts';
import { APP_VERSION } from '@web/utils/constants.ts';

const PANEL_ID = 'settings-panel';

export function initSettings(): void {
  document.getElementById('current-version')!.textContent = APP_VERSION;

  injectSettingsPanel();

  events.on('OpenSettings', () => openSettings());
}

function injectSettingsPanel(): void {
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'settings-panel hidden';
  panel.innerHTML = `
    <div class="settings-overlay"></div>
    <div class="settings-content">
      <div class="settings-header">
        <h2>設定</h2>
        <button class="settings-close-btn" aria-label="關閉">✕</button>
      </div>
      <div class="settings-body">
        <section class="settings-section">
          <h3>API 設定</h3>
          <label>API 代理域名
            <input type="text" id="s-api-domain" placeholder="api.lb.exptech.dev">
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="s-use-proxy">
            <span>啟用 API Proxy (CORS 問題時使用)</span>
          </label>
        </section>

        <section class="settings-section">
          <h3>通知與音效</h3>
          <div class="notif-permission-row">
            <span id="s-notif-status">通知: 未授權</span>
            <button id="s-notif-request" class="btn-small">申請通知權限</button>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" id="s-sound">
            <span>啟用音效</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="s-speech">
            <span>啟用語音播報</span>
          </label>
          <button id="s-audio-unlock" class="btn-small">啟用音效 (點此解鎖)</button>
        </section>

        <section class="settings-section">
          <h3>音效細項</h3>
          <label class="checkbox-row"><input type="checkbox" id="s-sfx-eew"><span>地震速報 (預警)</span></label>
          <label class="checkbox-row"><input type="checkbox" id="s-sfx-eew2"><span>緊急地震速報 (警報)</span></label>
          <label class="checkbox-row"><input type="checkbox" id="s-sfx-update"><span>速報更新</span></label>
          <label class="checkbox-row"><input type="checkbox" id="s-sfx-report"><span>地震報告</span></label>
          <label class="checkbox-row"><input type="checkbox" id="s-sfx-palert"><span>震度速報 / 長週期地震動</span></label>
          <label class="checkbox-row"><input type="checkbox" id="s-sfx-pga1"><span>RTS PGA 一級</span></label>
          <label class="checkbox-row"><input type="checkbox" id="s-sfx-pga2"><span>RTS PGA 二級</span></label>
          <label class="checkbox-row"><input type="checkbox" id="s-sfx-shindo0"><span>RTS 震度 弱反應</span></label>
          <label class="checkbox-row"><input type="checkbox" id="s-sfx-shindo1"><span>RTS 震度 震動檢測</span></label>
          <label class="checkbox-row"><input type="checkbox" id="s-sfx-shindo2"><span>RTS 震度 強震檢測</span></label>
        </section>

        <section class="settings-section">
          <h3>所在地</h3>
          <label>位置代碼 (location-code)
            <input type="number" id="s-location-code" min="0" max="999">
          </label>
          <label>即時站 ID
            <input type="text" id="s-station-id">
          </label>
        </section>

        <section class="settings-section">
          <h3>顯示</h3>
          <label class="checkbox-row">
            <input type="checkbox" id="s-show-trem-eew">
            <span>顯示 TREM 自動測定 EEW</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="s-show-fault">
            <span>顯示斷層線</span>
          </label>
        </section>

        <section class="settings-section">
          <h3>設定檔</h3>
          <div class="settings-row">
            <button id="s-export" class="btn-small">匯出設定</button>
            <label class="btn-small" for="s-import-file">匯入設定</label>
            <input type="file" id="s-import-file" accept=".json" style="display:none">
          </div>
          <button id="s-reset" class="btn-small btn-danger">重置設定</button>
        </section>

        <div class="settings-version">TREM-Lite Web ${APP_VERSION}</div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  panel.querySelector('.settings-overlay')!.addEventListener('click', closeSettings);
  panel.querySelector('.settings-close-btn')!.addEventListener('click', closeSettings);

  panel.querySelector('#s-notif-request')!.addEventListener('click', async () => {
    await requestPermission();
    updateNotifStatus();
  });

  panel.querySelector('#s-audio-unlock')!.addEventListener('click', () => {
    AudioManager.getInstance().unlock();
    (panel.querySelector('#s-audio-unlock') as HTMLButtonElement).textContent = '音效已解鎖 ✓';
  });

  panel.querySelector('#s-export')!.addEventListener('click', () => exportConfig());

  panel.querySelector('#s-import-file')!.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await importConfig(file);
      loadSettingsValues();
      alert('設定匯入成功');
    } catch (err) {
      alert(`設定匯入失敗: ${err}`);
    }
  });

  panel.querySelector('#s-reset')!.addEventListener('click', async () => {
    if (confirm('確定要重置設定嗎？')) {
      await resetConfig();
      loadSettingsValues();
    }
  });

  // Auto-save on change
  for (const id of ['s-api-domain', 's-location-code', 's-station-id']) {
    panel.querySelector(`#${id}`)?.addEventListener('change', saveSettings);
  }
  for (const id of [
    's-use-proxy', 's-sound', 's-speech', 's-show-trem-eew', 's-show-fault',
    's-sfx-eew', 's-sfx-eew2', 's-sfx-update', 's-sfx-report', 's-sfx-palert',
    's-sfx-pga1', 's-sfx-pga2', 's-sfx-shindo0', 's-sfx-shindo1', 's-sfx-shindo2',
  ]) {
    panel.querySelector(`#${id}`)?.addEventListener('change', saveSettings);
  }
}

function updateNotifStatus(): void {
  const el = document.getElementById('s-notif-status');
  if (!el) return;
  if (!notifSupported()) {
    el.textContent = '通知: 不支援';
  } else {
    const perm = getPermission();
    el.textContent = `通知: ${perm === 'granted' ? '已授權 ✓' : perm === 'denied' ? '已拒絕 ✗' : '未授權'}`;
  }
}

function loadSettingsValues(): void {
  const cfg = getConfig();
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

  const apiDomain = el<HTMLInputElement>('s-api-domain');
  if (apiDomain) apiDomain.value = cfg.apiProxyDomain;

  const useProxy = el<HTMLInputElement>('s-use-proxy');
  if (useProxy) useProxy.checked = cfg.useProxy;

  const sound = el<HTMLInputElement>('s-sound');
  if (sound) sound.checked = cfg.notification.sound;

  const speechEl = el<HTMLInputElement>('s-speech');
  if (speechEl) speechEl.checked = cfg.notification.speech;

  const locationCode = el<HTMLInputElement>('s-location-code');
  if (locationCode) locationCode.value = String(cfg.location.code);

  const stationId = el<HTMLInputElement>('s-station-id');
  if (stationId) stationId.value = cfg.location.stationId;

  const showTremEew = el<HTMLInputElement>('s-show-trem-eew');
  if (showTremEew) showTremEew.checked = cfg.display.showTremEew;

  const showFault = el<HTMLInputElement>('s-show-fault');
  if (showFault) showFault.checked = cfg.map.showFault;

  const sfx = cfg.notification.soundEffects;
  const sfxMap: Array<[string, keyof typeof sfx]> = [
    ['s-sfx-eew', 'EEW'], ['s-sfx-eew2', 'EEW2'], ['s-sfx-update', 'Update'],
    ['s-sfx-report', 'Report'], ['s-sfx-palert', 'PAlert'],
    ['s-sfx-pga1', 'PGA1'], ['s-sfx-pga2', 'PGA2'],
    ['s-sfx-shindo0', 'Shindo0'], ['s-sfx-shindo1', 'Shindo1'], ['s-sfx-shindo2', 'Shindo2'],
  ];
  for (const [id, key] of sfxMap) {
    const cb = el<HTMLInputElement>(id);
    if (cb) cb.checked = sfx[key];
  }

  updateNotifStatus();

  const unlockBtn = document.getElementById('s-audio-unlock') as HTMLButtonElement | null;
  if (unlockBtn && AudioManager.getInstance().isUnlocked()) {
    unlockBtn.textContent = '音效已解鎖 ✓';
  }
}

async function saveSettings(): Promise<void> {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const cfg = getConfig();

  const apiDomain = (el<HTMLInputElement>('s-api-domain')?.value ?? cfg.apiProxyDomain).trim() || cfg.apiProxyDomain;
  const useProxy = el<HTMLInputElement>('s-use-proxy')?.checked ?? cfg.useProxy;
  const sound = el<HTMLInputElement>('s-sound')?.checked ?? cfg.notification.sound;
  const speechEnabled = el<HTMLInputElement>('s-speech')?.checked ?? cfg.notification.speech;
  const locationCode = parseInt(el<HTMLInputElement>('s-location-code')?.value ?? String(cfg.location.code)) || cfg.location.code;
  const stationId = el<HTMLInputElement>('s-station-id')?.value.trim() || cfg.location.stationId;
  const showTremEew = el<HTMLInputElement>('s-show-trem-eew')?.checked ?? cfg.display.showTremEew;
  const showFault = el<HTMLInputElement>('s-show-fault')?.checked ?? cfg.map.showFault;

  const sfx = cfg.notification.soundEffects;
  const sfxMap: Array<[string, keyof typeof sfx]> = [
    ['s-sfx-eew', 'EEW'], ['s-sfx-eew2', 'EEW2'], ['s-sfx-update', 'Update'],
    ['s-sfx-report', 'Report'], ['s-sfx-palert', 'PAlert'],
    ['s-sfx-pga1', 'PGA1'], ['s-sfx-pga2', 'PGA2'],
    ['s-sfx-shindo0', 'Shindo0'], ['s-sfx-shindo1', 'Shindo1'], ['s-sfx-shindo2', 'Shindo2'],
  ];
  const soundEffectsPatch: Partial<typeof sfx> = {};
  for (const [id, key] of sfxMap) {
    const cb = el<HTMLInputElement>(id);
    if (cb) soundEffectsPatch[key] = cb.checked;
  }

  await patchConfig('notification', { sound, speech: speechEnabled, soundEffects: { ...sfx, ...soundEffectsPatch } as typeof sfx });
  await patchConfig('location', { code: locationCode, stationId });
  await patchConfig('display', { showTremEew });
  await patchConfig('map', { showFault });

  if (apiDomain !== cfg.apiProxyDomain || useProxy !== cfg.useProxy) {
    const { saveConfig } = await import('@web/services/configStore.ts');
    await saveConfig({ apiProxyDomain: apiDomain, useProxy });
  }
}

export function openSettings(): void {
  const panel = document.getElementById(PANEL_ID)!;
  loadSettingsValues();
  panel.classList.remove('hidden');
}

function closeSettings(): void {
  document.getElementById(PANEL_ID)?.classList.add('hidden');
}
