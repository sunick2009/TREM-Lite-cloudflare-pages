import type { RtsData, EewData, IntensityData, LpgmData } from '@web/types/index.ts';
import { events } from './eventBus.ts';
import { fetchEarthquakeData } from './earthquakeApi.ts';
import { now } from './ntpService.ts';
import { EEW_AUTHOR, HTTP_TIMEOUT } from '@web/utils/constants.ts';
import { state } from './appState.ts';

let fetchInterval: ReturnType<typeof setInterval> | null = null;
let lastFetchTime = 0;
let mapReady = false;

export function startDataLoop(): void {
  events.on('MapLoad', () => {
    if (mapReady) return;
    mapReady = true;
    if (fetchInterval) clearInterval(fetchInterval);
    fetchInterval = setInterval(async () => {
      await fetchData();
    }, 100);
  });
}

async function fetchData(): Promise<void> {
  const localNow = Date.now();
  if (localNow - lastFetchTime < HTTP_TIMEOUT.LOOP) return;
  lastFetchTime = localNow;

  const data = await fetchEarthquakeData();

  if (!data.rts && !data.eew) {
    // both failed — network issue
  }

  if (data.rts) {
    if (!state.data.rts || state.data.rts.time < data.rts.time) {
      state.data.rts = data.rts;
      state.cache.last_data_time = localNow;
      events.emit('DataRts', { info: { type: 0 }, data: data.rts });
    }
  }

  if (data.eew !== null) {
    processEEWData(data.eew ?? []);
  } else {
    processEEWData([]);
  }

  if (data.intensity) processIntensityData(data.intensity);
  if (data.lpgm) processLpgmData(data.lpgm);

  if (data.rts) state.cache.last_data_time = localNow;
}

export function processEEWData(newData: EewData[] = []): void {
  const currentTime = now();
  const EXPIRY_TIME = 240_000;
  const STATUS_3_TIMEOUT = 60_000;

  // Expire old
  state.data.eew
    .filter((item) =>
      item.eq?.time && (
        currentTime - item.eq.time > EXPIRY_TIME
        || item.EewEnd
        || (item.status === 3 && item.status3Time && currentTime - item.status3Time > STATUS_3_TIMEOUT)
      ),
    )
    .forEach((data) => {
      events.emit('EewEnd', { info: { type: 0 }, data: { ...data, EewEnd: true } });
    });

  state.data.eew = state.data.eew.filter((item) =>
    item.eq?.time
    && currentTime - item.eq.time <= EXPIRY_TIME
    && !item.EewEnd
    && !(item.status === 3 && item.status3Time && currentTime - item.status3Time > STATUS_3_TIMEOUT),
  );

  newData.forEach((data) => {
    if (!data.eq?.time || currentTime - data.eq.time > EXPIRY_TIME || data.EewEnd) return;

    const existingIndex = state.data.eew.findIndex((item) => item.id === data.id);
    const eventData = { info: { type: 0 }, data };

    if (existingIndex === -1) {
      if (!state.cache.eew_last[data.id]) {
        if (EEW_AUTHOR.includes(data.author)) {
          state.cache.eew_last[data.id] = { last_time: currentTime, serial: 1 };
          const method = data.author === 'trem' ? 'nsspe' : 'eew';
          state.data.eew.push({ ...data, method });
          events.emit('EewRelease', eventData);
        }
      }
      return;
    }

    if (state.cache.eew_last[data.id] && state.cache.eew_last[data.id].serial < data.serial) {
      state.cache.eew_last[data.id].serial = data.serial;
      if (data.status === 3) data.status3Time = currentTime;

      events.emit('EewUpdate', eventData);
      if (data.eq.mag && data.eq.mag !== 1) data.method = 'eew';
      if (data.status === 3 && state.data.eew[existingIndex].status !== data.status) {
        events.emit('EewCancel', eventData);
      }
      if (state.data.eew[existingIndex].status !== 1 && data.status === 1) {
        events.emit('EewAlert', eventData);
      }
      state.data.eew[existingIndex] = data;
    }
  });

  cleanupCache('eew_last');
  events.emit('DataEew', { info: { type: 0 }, data: state.data.eew });
}

export function processIntensityData(newData: IntensityData[] = []): void {
  const currentTime = now();
  const EXPIRY_TIME = 600_000;

  state.data.intensity
    .filter((item) => item.id && (currentTime - item.id > EXPIRY_TIME || item.IntensityEnd))
    .forEach((data) => events.emit('IntensityEnd', { info: { type: 0 }, data: { ...data, IntensityEnd: true } }));

  state.data.intensity = state.data.intensity.filter((item) =>
    item.id && currentTime - item.id <= EXPIRY_TIME && !item.IntensityEnd,
  );

  newData.forEach((data) => {
    if (!data.id || currentTime - data.id > EXPIRY_TIME || data.IntensityEnd) return;
    const existingIndex = state.data.intensity.findIndex((item) => item.id === data.id);
    const eventData = { info: { type: 0 }, data };

    if (existingIndex === -1) {
      if (!state.cache.intensity_last[data.id]) {
        state.cache.intensity_last[data.id] = { last_time: currentTime, serial: 1 };
        state.data.intensity.push(data);
        events.emit('IntensityRelease', eventData);
        return;
      }
    }

    if (state.cache.intensity_last[data.id] && state.cache.intensity_last[data.id].serial < data.serial) {
      state.cache.intensity_last[data.id].serial = data.serial;
      events.emit('IntensityUpdate', eventData);
      state.data.intensity[existingIndex] = data;
    }
  });

  cleanupCache('intensity_last');
  events.emit('DataIntensity', { info: { type: 0 }, data: state.data.intensity });
}

export function processLpgmData(newData: LpgmData[] = []): void {
  const currentTime = now();
  const EXPIRY_TIME = 600_000;

  state.data.lpgm
    .filter((item) => item.time && (currentTime - item.time > EXPIRY_TIME || item.LpgmEnd))
    .forEach((data) => events.emit('LpgmEnd', { info: { type: 0 }, data: { ...data, LpgmEnd: true } }));

  state.data.lpgm = state.data.lpgm.filter((item) =>
    item.time && currentTime - item.time <= EXPIRY_TIME && !item.LpgmEnd,
  );

  newData.forEach((data) => {
    if (!data.id || data.LpgmEnd) return;
    const existingIndex = state.data.lpgm.findIndex((item) => item.id === data.id);
    const eventData = { info: { type: 0 }, data };
    if (existingIndex === -1) {
      data.time = now();
      state.data.lpgm.push(data);
      events.emit('LpgmRelease', eventData);
    }
  });

  events.emit('DataLpgm', { info: { type: 0 }, data: state.data.lpgm });
}

function cleanupCache(cacheKey: 'eew_last' | 'intensity_last'): void {
  const currentTime = now();
  Object.keys(state.cache[cacheKey]).forEach((id) => {
    const item = state.cache[cacheKey][id];
    if (currentTime - item.last_time > 600_000) {
      delete state.cache[cacheKey][id];
    }
  });
}
