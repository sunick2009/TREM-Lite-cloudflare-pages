import { events } from '@web/services/eventBus.ts';
import { state } from '@web/services/appState.ts';
import { now } from '@web/services/ntpService.ts';
import { formatTime } from '@web/utils/utils.ts';
import { LAST_DATA_TIMEOUT_ERROR, RECONNECT_GRACE_MS } from '@web/utils/constants.ts';
import { getVisibleAt } from '@web/services/dataManager.ts';
import { startGeolocation, getLastPosition } from '@web/services/geoLocation.ts';

const timeEl = document.getElementById('time')!;
const warningBoxInternet = document.getElementById('warning-box-internet')!;

export function initNavBar(): void {
  // Clock display
  setInterval(() => {
    const stale = state.cache.last_data_time !== 0
      && (Date.now() - state.cache.last_data_time) > LAST_DATA_TIMEOUT_ERROR;
    // After returning from background, give the first fetch time to complete
    // before showing the "no network" warning.
    const inGrace = (Date.now() - getVisibleAt()) < RECONNECT_GRACE_MS;

    if (stale && !inGrace) {
      timeEl.className = 'time-error';
      warningBoxInternet.classList.remove('hide');
    } else if (state.cache.last_data_time === 0) {
      timeEl.className = 'time-error';
    } else {
      timeEl.className = 'time-normal';
      timeEl.textContent = formatTime(now());
      warningBoxInternet.classList.add('hide');
    }
  }, 1000);

  // Settings button
  const settingBtn = document.getElementById('setting');
  if (settingBtn) {
    settingBtn.style.display = 'flex';
    settingBtn.addEventListener('click', () => {
      events.emit('OpenSettings', { info: { type: 0 }, data: null });
    });
  }

  // Focus button — triggers geolocation permission on first click (user gesture required
  // by some browsers), then flies to position once available.
  const focusBtn = document.getElementById('focus');
  if (focusBtn) {
    focusBtn.addEventListener('click', () => {
      startGeolocation();
      if (getLastPosition()) {
        events.emit('FocusLocation', { info: { type: 0 }, data: null });
      } else {
        // Position not yet available; MapManager will fly on next GeoLocation event
        events.emit('FocusOnNextLocation', { info: { type: 0 }, data: null });
      }
    });
  }
}
