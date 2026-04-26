import { events } from '@web/services/eventBus.ts';
import { state } from '@web/services/appState.ts';
import { now } from '@web/services/ntpService.ts';
import { formatTime } from '@web/utils/utils.ts';
import { LAST_DATA_TIMEOUT_ERROR } from '@web/utils/constants.ts';

const timeEl = document.getElementById('time')!;
const warningBoxInternet = document.getElementById('warning-box-internet')!;

export function initNavBar(): void {
  // Clock display
  setInterval(() => {
    if ((Date.now() - state.cache.last_data_time) > LAST_DATA_TIMEOUT_ERROR && state.cache.last_data_time !== 0) {
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

  // Focus button
  const focusBtn = document.getElementById('focus');
  if (focusBtn) {
    focusBtn.addEventListener('click', () => {
      events.emit('FocusLocation', { info: { type: 0 }, data: null });
    });
  }
}
