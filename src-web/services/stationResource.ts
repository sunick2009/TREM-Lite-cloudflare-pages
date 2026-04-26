import type { StationData } from '@web/types/index.ts';
import { fetchStationData } from './earthquakeApi.ts';

const CACHE_KEY = 'cache.station';
const REFRESH_INTERVAL = 600_000; // 10 min

let _station: StationData | null = null;
let _retryCount = 0;
const MAX_RETRIES = 5;

export function getStation(): StationData | null {
  return _station;
}

export async function loadStation(): Promise<StationData | null> {
  // Try cache first
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      _station = JSON.parse(cached) as StationData;
    }
  } catch { /* ignore */ }

  await fetchStation();
  return _station;
}

async function fetchStation(): Promise<void> {
  const data = await fetchStationData();
  if (data) {
    _station = data;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    _retryCount = 0;
  } else if (_retryCount < MAX_RETRIES) {
    _retryCount++;
    setTimeout(fetchStation, 3000 * _retryCount);
  } else {
    _retryCount = 0;
  }
}

export function startStationRefresh(): void {
  setInterval(fetchStation, REFRESH_INTERVAL);
}
