import maplibregl from 'maplibre-gl';
import { events } from '@web/services/eventBus.ts';
import { state } from '@web/services/appState.ts';
import { now } from '@web/services/ntpService.ts';
import { EEWCalculator } from '@web/utils/eewCalculator.ts';
import { formatTime } from '@web/utils/utils.ts';
import { COLOR, SHOW_TREM_EEW, EEW_CACHE_TTL } from '@web/utils/constants.ts';
import type { EewData, TremEventPayload } from '@web/types/index.ts';

let timeTableData: object = {};
try {
  // Will be loaded async
} catch { /* */ }

let calculator: EEWCalculator;

const eew_cache: Record<string, EewData & { cacheTime: number }> = {};
let flash = false;
let eew_rotation = 0;
let drawLock = false;

const infoWrapper = document.getElementById('info-wrapper')!;
const infoUnit = document.getElementById('info-unit')!;
const infoNumber = document.getElementById('info-number')!;
const infoLoc = document.getElementById('info-loc')!;
const infoMag = document.getElementById('info-mag')!;
const infoDepth = document.getElementById('info-depth')!;
const infoIntensity = document.getElementById('info-intensity')!;
const infoFooter = document.getElementById('info-footer')!;
const infoTime = document.getElementById('info-time')!;
const triggerBox = document.getElementById('trigger-box')!;

export async function initEewBox(): Promise<void> {
  try {
    const res = await fetch('/data/time.json');
    if (res.ok) timeTableData = await res.json() as object;
  } catch { /* use empty timetable */ }
  calculator = new EEWCalculator(timeTableData as ConstructorParameters<typeof EEWCalculator>[0]);

  setInterval(() => { flash = !flash; }, 500);
  setInterval(showEew, 5000);
  setInterval(drawWavesLoop, 100);
  setInterval(cleanupExpiredCache, 60_000);

  events.on<EewData>('EewRelease', (ans) => {
    eew_cache[ans.data.id] = { ...ans.data, cacheTime: Date.now() };
    showEew(false);
    createEewLayer(ans.data);
  });

  events.on<EewData>('EewAlert', (ans) => {
    updateEewLayerAlert(ans.data);
  });

  events.on<EewData>('EewUpdate', (ans) => {
    eew_cache[ans.data.id] = { ...ans.data, cacheTime: Date.now() };
    createEewLayer(ans.data);
    showEew(false);
    if (ans.data.status === 3) removeEewLayersAndSources(ans.data.id);
  });

  events.on<EewData>('EewEnd', (ans) => {
    removeEewLayersAndSources(ans.data.id);
    delete eew_cache[ans.data.id];
    showEew(true);
  });
}

function getMap(): maplibregl.Map | null {
  return state.map as maplibregl.Map | null;
}

function createEewLayer(eew: EewData): void {
  const map = getMap();
  if (!map) return;

  const id = eew.id;
  if (!map.getSource(`${id}-s-wave`)) {
    map.addSource(`${id}-s-wave`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }
  if (!map.getSource(`${id}-p-wave`)) {
    map.addSource(`${id}-p-wave`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }
  if (!map.getSource(`${id}-s-wave-bg`)) {
    map.addSource(`${id}-s-wave-bg`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }

  const isTrem = !SHOW_TREM_EEW && eew.author === 'trem';
  const color = isTrem ? COLOR.TREM.S
    : eew.status === 1 ? COLOR.EEW.S.ALERT : COLOR.EEW.S.WARN;

  if (!map.getLayer(`${id}-p-wave-outline`)) {
    map.addLayer({ id: `${id}-p-wave-outline`, type: 'line', source: `${id}-p-wave`, paint: { 'line-color': COLOR.EEW.P, 'line-width': isTrem ? 0.2 : 1 } });
  }
  if (!map.getLayer(`${id}-s-wave-outline`)) {
    map.addLayer({ id: `${id}-s-wave-outline`, type: 'line', source: `${id}-s-wave`, paint: { 'line-color': color, 'line-width': isTrem ? 0.6 : 2 } });
  }
  if (!map.getLayer(`${id}-s-wave-background`)) {
    map.addLayer({ id: `${id}-s-wave-background`, type: 'fill', source: `${id}-s-wave-bg`, paint: { 'fill-color': color, 'fill-opacity': isTrem ? 0 : 0.25 } }, 'county');
  }
}

function updateEewLayerAlert(eew: EewData): void {
  const map = getMap();
  if (!map) return;
  const id = eew.id;
  const isTrem = !SHOW_TREM_EEW && eew.author === 'trem';
  const color = isTrem ? COLOR.TREM.S : COLOR.EEW.S.ALERT;

  if (map.getLayer(`${id}-s-wave-outline`)) map.removeLayer(`${id}-s-wave-outline`);
  if (map.getLayer(`${id}-s-wave-background`)) map.removeLayer(`${id}-s-wave-background`);

  map.addLayer({ id: `${id}-s-wave-outline`, type: 'line', source: `${id}-s-wave`, paint: { 'line-color': color, 'line-width': isTrem ? 0.6 : 2 } });
  map.addLayer({ id: `${id}-s-wave-background`, type: 'fill', source: `${id}-s-wave-bg`, paint: { 'fill-color': color, 'fill-opacity': isTrem ? 0 : 0.25 } }, 'county');
}

function drawWavesLoop(): void {
  const map = getMap();
  if (!map || drawLock) return;
  drawLock = true;

  const alert = state.data.eew.some((e) => e.author !== 'trem');

  for (const eew of state.data.eew) {
    const isTrem = !SHOW_TREM_EEW && eew.author === 'trem';
    const sWave = map.getSource(`${eew.id}-s-wave`) as maplibregl.GeoJSONSource | undefined;
    const sWaveBg = map.getSource(`${eew.id}-s-wave-bg`) as maplibregl.GeoJSONSource | undefined;
    const pWave = map.getSource(`${eew.id}-p-wave`) as maplibregl.GeoJSONSource | undefined;

    if (!sWave || !sWaveBg || !pWave) continue;

    const center: [number, number] = [eew.eq.lon, eew.eq.lat];
    const dist = calculator.psWaveDist(eew.eq.depth, eew.eq.time, now());

    if (isTrem) {
      if (!alert && flash) {
        sWave.setData({ type: 'FeatureCollection', features: [circleFeature(center, dist.s_dist)] });
        sWaveBg.setData({ type: 'FeatureCollection', features: [circleFeature(center, dist.s_dist)] });
        pWave.setData({ type: 'FeatureCollection', features: [circleFeature(center, dist.p_dist)] });
      } else {
        sWave.setData({ type: 'FeatureCollection', features: [] });
        sWaveBg.setData({ type: 'FeatureCollection', features: [] });
        pWave.setData({ type: 'FeatureCollection', features: [] });
      }
      continue;
    }

    if (eew.eq.mag === 1) continue;
    sWave.setData({ type: 'FeatureCollection', features: [circleFeature(center, dist.s_dist)] });
    sWaveBg.setData({ type: 'FeatureCollection', features: [circleFeature(center, dist.s_dist)] });
    pWave.setData({ type: 'FeatureCollection', features: [circleFeature(center, dist.p_dist)] });
  }
  drawLock = false;
}

function circleFeature(center: [number, number], radiusKm: number, steps = 256): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const km = radiusKm;
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 360) / steps;
    const rad = (angle * Math.PI) / 180;
    const δ = km / 6371;
    const φ1 = (center[1] * Math.PI) / 180;
    const λ1 = (center[0] * Math.PI) / 180;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(rad));
    const λ2 = λ1 + Math.atan2(Math.sin(rad) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    coords.push([(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI]);
  }
  coords.push(coords[0]);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

function removeEewLayersAndSources(eewId: string): void {
  const map = getMap();
  if (!map) return;
  const layers = [`${eewId}-p-wave-outline`, `${eewId}-s-wave-outline`, `${eewId}-s-wave-background`];
  const sources = [`${eewId}-s-wave`, `${eewId}-s-wave-bg`, `${eewId}-p-wave`];
  layers.forEach((l) => { if (map.getLayer(l)) map.removeLayer(l); });
  sources.forEach((s) => { if (map.getSource(s)) map.removeSource(s); });
}

export function showEew(rotation = true): void {
  const eew_list = Object.keys(eew_cache);
  let count = state.data.eew.filter((e) => SHOW_TREM_EEW || e.author !== 'trem').length;

  triggerBox.innerHTML = '';

  if (count && eew_list.length) {
    state.cache.show_eew_box = true;
    const eew = eew_cache[eew_list[eew_rotation]];
    if (eew) {
      if (!SHOW_TREM_EEW && eew.author === 'trem') {
        eew_rotation = (eew_rotation + 1) % eew_list.length;
      } else {
        const statusClass = eew.status === 3 ? 'eew-cancel' : eew.status === 1 ? 'eew-alert' : eew.author === 'trem' && !eew.rts ? 'eew-rts' : 'eew-warn';
        infoWrapper.className = `info-wrapper ${statusClass}`;
        infoNumber.textContent = String(eew.serial);
        infoNumber.className = `info-number${eew.status === 3 ? ' info-cancel-last' : eew.final ? ' info-number-last' : ''}`;
        const unitText = `${eew.author.toUpperCase()}${count === 1 ? '' : ` ${eew_rotation + 1}/${count}`}`;
        infoUnit.textContent = unitText;
        infoLoc.textContent = eew.eq.loc;
        infoDepth.textContent = String(eew.eq.depth);
        infoMag.textContent = eew.eq.mag.toFixed(1);
        infoIntensity.className = `info-title-box intensity-${eew.eq.max}`;
        infoFooter.className = `info-footer${eew.eq.mag === 1 ? ' nsspe' : ''}`;
        infoTime.textContent = formatTime(eew.eq.time);
      }
    }

    if (rotation) {
      eew_rotation = (eew_rotation + 1) % eew_list.length;
    }
  } else {
    state.cache.show_eew_box = false;
    infoUnit.textContent = '';
    infoNumber.textContent = '';
    infoNumber.className = 'info-number';

    const locArr = state.cache.rts_trigger.loc;
    if (locArr.length) {
      const max = state.cache.rts_trigger.max;
      infoWrapper.className = `info-wrapper no-eew ${max > 3 ? 'rts-trigger-high' : max > 1 ? 'rts-trigger-middle' : 'rts-trigger-low'}`;
      for (let i = 0; i < 2; i++) {
        const triggerAreas = document.createElement('div');
        triggerAreas.className = 'trigger-areas';
        locArr.slice(i * 4, i * 4 + 4).forEach((loc) => {
          const areaName = document.createElement('div');
          areaName.className = 'area-name';
          areaName.textContent = loc.name;
          triggerAreas.appendChild(areaName);
        });
        triggerBox.appendChild(triggerAreas);
      }
    } else {
      infoWrapper.className = 'info-wrapper no-eew';
    }
  }
}

function cleanupExpiredCache(): void {
  const n = Date.now();
  for (const id of Object.keys(eew_cache)) {
    if (n - eew_cache[id].cacheTime > EEW_CACHE_TTL) {
      removeEewLayersAndSources(id);
      delete eew_cache[id];
    }
  }
}
