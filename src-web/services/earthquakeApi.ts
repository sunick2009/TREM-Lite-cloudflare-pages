import type { RtsData, EewData, IntensityData, LpgmData, StationData, ReportListItem, ReportDetail } from '@web/types/index.ts';
import { getConfig } from './configStore.ts';

let USE_PROXY = false;

const PROXY_BASE = '/api/proxy';

// On localhost (dev/preview), some ExpTech endpoints block CORS.
// Vite's proxy intercepts /local-api/* and forwards to api.core-tyo1.exptech.dev.
const IS_LOCALHOST =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

function apiUrl(domain: string, path: string): string {
  const full = `https://${domain}${path}`;
  if (USE_PROXY || getConfig().useProxy) {
    return `${PROXY_BASE}?url=${encodeURIComponent(full)}`;
  }
  return full;
}

async function fetchWithTimeout<T>(
  url: string,
  timeoutMs: number,
  fallbackUrls?: string[],
): Promise<T | null> {
  const urls = [url, ...(fallbackUrls ?? [])];
  for (const u of urls) {
    try {
      const res = await fetch(u, {
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res.json() as Promise<T>;
    } catch {
      // try next
    }
  }
  return null;
}

export interface EarthquakeApiData {
  rts: RtsData | null;
  eew: EewData[] | null;
  intensity: IntensityData[] | null;
  lpgm: LpgmData[] | null;
}

let counter = 0;

export async function fetchEarthquakeData(): Promise<EarthquakeApiData> {
  counter++;
  const cfg = getConfig();
  const proxyDomain = cfg.apiProxyDomain || 'api.lb.exptech.dev';
  const apiDomain = 'api-1.exptech.dev';
  const api2Domain = 'api-2.exptech.dev';

  const shouldFetchIntensity = counter % 5 === 0;
  const shouldFetchLpgm = counter % 7 === 0;

  const promises: Promise<unknown>[] = [
    fetchWithTimeout<RtsData>(apiUrl(proxyDomain, '/api/v2/trem/rts'), 1500),
    fetchWithTimeout<EewData[]>(apiUrl(proxyDomain, '/api/v2/eq/eew'), 1500),
  ];

  if (shouldFetchIntensity) {
    promises.push(
      fetchWithTimeout<IntensityData[]>(
        apiUrl(apiDomain, '/api/v2/trem/intensity'),
        1500,
        [apiUrl(api2Domain, '/api/v2/trem/intensity')],
      ),
    );
  }

  if (shouldFetchLpgm) {
    promises.push(
      fetchWithTimeout<LpgmData[]>(
        apiUrl(apiDomain, '/api/v2/trem/lpgm'),
        1500,
        [apiUrl(api2Domain, '/api/v2/trem/lpgm')],
      ),
    );
  }

  const results = await Promise.all(promises);

  return {
    rts: results[0] as RtsData | null,
    eew: results[1] as EewData[] | null,
    intensity: shouldFetchIntensity ? (results[2] as IntensityData[] | null) : null,
    lpgm: shouldFetchLpgm ? (results[shouldFetchIntensity ? 3 : 2] as LpgmData[] | null) : null,
  };
}

export async function fetchStationData(): Promise<StationData | null> {
  const apiDomain = 'api-1.exptech.dev';
  const api2Domain = 'api-2.exptech.dev';
  return fetchWithTimeout<StationData>(
    apiUrl(apiDomain, '/api/v1/trem/station'),
    3500,
    [apiUrl(api2Domain, '/api/v1/trem/station')],
  );
}

export async function fetchReportList(limit = 75): Promise<ReportListItem[] | null> {
  if (IS_LOCALHOST) {
    return fetchWithTimeout<ReportListItem[]>(`/local-api/api/v2/eq/report?limit=${limit}`, 5000);
  }
  return fetchWithTimeout<ReportListItem[]>(
    apiUrl('api.core.exptech.dev', `/api/v2/eq/report?limit=${limit}`),
    5000,
    [apiUrl('api.core-tyo1.exptech.dev', `/api/v2/eq/report?limit=${limit}`)],
  );
}

export async function fetchReportDetail(id: string): Promise<ReportDetail | null> {
  if (IS_LOCALHOST) {
    return fetchWithTimeout<ReportDetail>(`/local-api/api/v2/eq/report/${id}`, 5000);
  }
  return fetchWithTimeout<ReportDetail>(
    apiUrl('api.core.exptech.dev', `/api/v2/eq/report/${id}`),
    5000,
    [apiUrl('api.core-tyo1.exptech.dev', `/api/v2/eq/report/${id}`)],
  );
}

export function enableProxy(): void {
  USE_PROXY = true;
}

export function disableProxy(): void {
  USE_PROXY = false;
}
