// Browser NTP alternative using HTTP Date header
// Accuracy: ~50-200ms (acceptable for earthquake display purposes)

let offset = 0; // ms offset from Date.now() to server time
let lastSync = 0;
const SYNC_INTERVAL = 60_000;

export async function syncTime(apiDomain: string): Promise<void> {
  try {
    const t1 = Date.now();
    const res = await fetch(`https://${apiDomain}/api/v2/trem/rts`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });
    const t2 = Date.now();
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      const rtt = t2 - t1;
      offset = serverTime + rtt / 2 - t2;
      lastSync = t2;
      console.log(`[NTP] Synced offset: ${offset.toFixed(1)} ms (RTT: ${rtt}ms)`);
    }
  } catch (e) {
    console.warn('[NTP] Sync failed, using local time', e);
  }
}

export function now(): number {
  return Date.now() + offset;
}

export function startNtpSync(apiDomain: string): void {
  syncTime(apiDomain);
  setInterval(() => {
    if (Date.now() - lastSync >= SYNC_INTERVAL) {
      syncTime(apiDomain);
    }
  }, SYNC_INTERVAL);
}
