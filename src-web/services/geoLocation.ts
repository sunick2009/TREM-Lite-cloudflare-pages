import { events } from './eventBus.ts';
import { getRegionSync, distance } from '@web/utils/utils.ts';
import { patchConfig, getConfig } from './configStore.ts';

let _lastPos: GeolocationCoordinates | null = null;
let _watchId: number | null = null;

export function getLastPosition(): GeolocationCoordinates | null {
  return _lastPos;
}

export function isGeolocationActive(): boolean {
  return _watchId !== null;
}

function findNearestCode(lat: number, lon: number): number | null {
  const region = getRegionSync();
  if (!region) return null;
  let minDist = Infinity;
  let code: number | null = null;
  const distFn = distance(lat, lon);
  for (const city of Object.values(region)) {
    for (const town of Object.values(city)) {
      const d = distFn(town.lat, town.lon);
      if (d < minDist) { minDist = d; code = town.code; }
    }
  }
  return code;
}

export function startGeolocation(): void {
  if (!navigator.geolocation || _watchId !== null) return;
  _watchId = navigator.geolocation.watchPosition(
    (pos) => {
      _lastPos = pos.coords;
      events.emit('GeoLocation', { info: { type: 0 }, data: pos.coords });

      const code = findNearestCode(pos.coords.latitude, pos.coords.longitude);
      if (code !== null) {
        const cfg = getConfig();
        if (cfg.location.code !== code) {
          patchConfig('location', { code }).catch(() => {});
        }
      }
    },
    (err) => {
      console.warn('[GeoLocation] error:', err.message);
      // Reset so user can retry (e.g. by clicking the focus button again)
      _watchId = null;
    },
    { enableHighAccuracy: false, timeout: 10_000 },
  );
}
