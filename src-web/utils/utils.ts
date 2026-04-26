import type { RegionData } from '@web/types/index.ts';
import { COLOR, INTENSITY_LIST } from './constants.ts';

// Region data is loaded lazily
let _region: RegionData | null = null;

export async function loadRegionData(): Promise<RegionData> {
  if (_region) return _region;
  const res = await fetch('/data/region.json');
  _region = await res.json() as RegionData;
  return _region;
}

export function getRegionSync(): RegionData | null {
  return _region;
}

export function distance(latA: number, lngA: number) {
  return function (latB: number, lngB: number) {
    const a = latA * Math.PI / 180;
    const b = lngA * Math.PI / 180;
    const c = latB * Math.PI / 180;
    const d = lngB * Math.PI / 180;
    const sinA = Math.sin(Math.atan(Math.tan(a)));
    const sinC = Math.sin(Math.atan(Math.tan(c)));
    const cosA = Math.cos(Math.atan(Math.tan(a)));
    const cosC = Math.cos(Math.atan(Math.tan(c)));
    return Math.acos(sinA * sinC + cosA * cosC * Math.cos(b - d)) * 6371.008;
  };
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function formatTimestamp(ts: number, offsetMs = 0): string {
  const date = new Date(ts + offsetMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function search_loc_name(code: number): { city: string; town: string } | null {
  if (!_region) return null;
  for (const city of Object.keys(_region)) {
    for (const town of Object.keys(_region[city])) {
      if (_region[city][town].code === code) {
        return { city, town };
      }
    }
  }
  return null;
}

export function search_loc_code(str: string): number | null {
  if (!_region) return null;
  for (const city of Object.keys(_region)) {
    for (const town of Object.keys(_region[city])) {
      if (`${city}${town}` === str) {
        return _region[city][town].code;
      }
    }
  }
  return null;
}

export function intensity_float_to_int(float: number): number {
  return float < 0 ? 0
    : float < 4.5 ? Math.round(float)
    : float < 5 ? 5
    : float < 5.5 ? 6
    : float < 6 ? 7
    : float < 6.5 ? 8 : 9;
}

export function int_to_string(max: number): string {
  return max === 5 ? '5弱'
    : max === 6 ? '5強'
    : max === 7 ? '6弱'
    : max === 8 ? '6強'
    : max === 9 ? '7級'
    : `${max}級`;
}

export function formatToChineseTime(dateTimeString: string | number): string {
  const dateTime = new Date(dateTimeString);
  const hours = dateTime.getHours();
  const minutes = dateTime.getMinutes();
  const period = hours < 12 ? '早上' : '晚上';
  const formattedHours = hours <= 12 ? hours : hours - 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  return `${period} ${formattedHours}點${formattedMinutes}分 左右`;
}

export function extractLocation(loc: string): string {
  const match = loc.match(/位於(.+?)(?=\))/);
  let extracted = match ? match[1] : loc;
  const spaceIndex = extracted.indexOf(' ');
  if (spaceIndex !== -1) extracted = extracted.substring(0, spaceIndex);
  return extracted;
}

export function createIntensityIconSquare(
  intensity: string,
  backgroundColor: string,
  textColor: string,
  strokeColor: string,
): HTMLImageElement {
  const svg = `<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="56" height="56" rx="10" ry="10" fill="${backgroundColor}" stroke="${strokeColor}" stroke-width="3"/>
    <text x="30" y="35" font-size="36" font-weight="bold" fill="${textColor}" text-anchor="middle" dominant-baseline="middle" font-family="Noto Sans TC, Manrope, sans-serif">${intensity}</text>
  </svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return img;
}

export function createIntensityIcon(
  intensity: string,
  backgroundColor: string,
  textColor: string,
  strokeColor: string,
): HTMLImageElement {
  const svg = `<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="28" fill="${backgroundColor}" stroke="${strokeColor}" stroke-width="3"/>
    <text x="30" y="35" font-size="36" font-weight="bold" fill="${textColor}" text-anchor="middle" dominant-baseline="middle" font-family="Noto Sans TC, Manrope, sans-serif">${intensity}</text>
  </svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return img;
}

export function generateMapStyle(
  eewArea: Record<string, number>,
  end = false,
  lpgm = false,
): string | unknown[] {
  if (end) return COLOR.MAP.TW_COUNTY_FILL;

  const matchExpression: unknown[] = ['match', ['get', 'CODE']];
  if (Object.keys(eewArea).length > 0) {
    Object.entries(eewArea).forEach(([code, intensity]) => {
      matchExpression.push(parseInt(code));
      matchExpression.push(
        intensity
          ? (lpgm ? COLOR.LPGM[intensity] : COLOR.INTENSITY[intensity])
          : COLOR.MAP.TW_COUNTY_FILL,
      );
    });
  }
  matchExpression.push(COLOR.MAP.TW_TOWN_FILL);
  return matchExpression;
}

export function convertIntensityToAreaFormat(
  intensityData: Record<string, number[]>,
): Record<string, number> {
  const result: Record<string, number> = {};
  Object.entries(intensityData).forEach(([intensity, codes]) => {
    codes.forEach((code) => {
      result[code] = parseInt(intensity);
    });
  });
  return result;
}

export function findMaxIntensityCity(
  eqArea: Record<string, number[]>,
): { intensity: number; cities: string[] } | null {
  if (!eqArea || Object.keys(eqArea).length === 0) return null;
  const maxIntensity = Math.max(...Object.keys(eqArea).map(Number));
  const maxCodes = eqArea[maxIntensity] || [];
  const cities = maxCodes
    .map((code) => search_loc_name(typeof code === 'number' ? code : parseInt(String(code))))
    .filter((loc) => loc !== null)
    .map((loc) => loc!.city);
  return { intensity: maxIntensity, cities: [...new Set(cities)] };
}

export { INTENSITY_LIST as intensity_list };
