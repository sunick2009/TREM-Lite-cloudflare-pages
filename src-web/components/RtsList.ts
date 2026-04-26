import maplibregl from 'maplibre-gl';
import { events } from '@web/services/eventBus.ts';
import { state } from '@web/services/appState.ts';
import { getConfig } from '@web/services/configStore.ts';
import { getStation } from '@web/services/stationResource.ts';
import { EEWCalculator } from '@web/utils/eewCalculator.ts';
import { intensity_float_to_int, search_loc_name } from '@web/utils/utils.ts';
import { showEew } from './EewBox.ts';
import { COLOR, SHOW_TREM_EEW } from '@web/utils/constants.ts';
import type { RtsData, TremEventPayload } from '@web/types/index.ts';

const calculator = new EEWCalculator();

const rtsIntensityList = document.getElementById('rts-intensity-list')!;
const maxPga = document.getElementById('max-pga')!;
const maxIntensity = document.getElementById('max-intensity')!;
const currentStationLoc = document.getElementById('current-station-loc')!;
const currentStationPga = document.getElementById('current-station-pga')!;
const currentStationIntensity = document.getElementById('current-station-intensity')!;
const currentStationIntensityText = document.getElementById('current-station-intensity-text')!;
const rtsInfoTrigger = document.getElementById('rts-info-trigger')!;
const rtsInfoLevel = document.getElementById('rts-info-level')!;
const warningBoxUnstable = document.getElementById('warning-box-unstable')!;

const levelList: Record<string, number> = {};

export function initRtsList(): void {
  events.on('MapLoad', (ans) => {
    const map = (ans as TremEventPayload<maplibregl.Map>).data;

    map.addSource('markers-geojson', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('markers-geojson-0', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('rts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    map.addLayer({
      id: 'rts-layer', type: 'circle', source: 'rts',
      paint: {
        'circle-color': ['interpolate', ['linear'], ['get', 'i'],
          -3, COLOR.RTS.intensity_3, -2, COLOR.RTS.intensity_2, -1, COLOR.RTS.intensity_1,
          0, COLOR.RTS.intensity0, 1, COLOR.RTS.intensity1, 2, COLOR.RTS.intensity2,
          3, COLOR.RTS.intensity3, 4, COLOR.RTS.intensity4, 5, COLOR.RTS.intensity5,
          6, COLOR.RTS.intensity6, 7, COLOR.RTS.intensity7,
        ],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 12, 8],
      },
    });

    map.addLayer({
      id: 'markers-0', type: 'circle', source: 'markers-geojson-0',
      paint: { 'circle-color': COLOR.INTENSITY[0], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 12, 8] },
    });

    map.addLayer({
      id: 'markers', type: 'symbol', source: 'markers-geojson',
      layout: {
        'symbol-sort-key': ['get', 'i'],
        'symbol-z-order': 'source',
        'icon-image': ['match', ['get', 'i'], 1, 'intensity-1', 2, 'intensity-2', 3, 'intensity-3', 4, 'intensity-4', 5, 'intensity-5', 6, 'intensity-6', 7, 'intensity-7', 8, 'intensity-8', 9, 'intensity-9', 'intensity-0'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 10, 0.6],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });

    setupStationHover(map);
  });

  events.on<RtsData>('DataRts', (ans) => handleRts(ans.data));
}

function handleRts(data: RtsData | null): void {
  const map = state.map as maplibregl.Map | null;
  const station = getStation();
  const cfg = getConfig();

  if (!map || !station || !data) {
    if (map) {
      (map.getSource('rts') as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] });
      (map.getSource('markers-geojson') as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] });
      (map.getSource('markers-geojson-0') as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] });
    }
    return;
  }

  const eew_alert = (state.data.eew.length && SHOW_TREM_EEW) ? true : state.data.eew.some((e) => e.author !== 'trem');
  const alert = data.box ? Object.keys(data.box).length > 0 : false;

  if (!alert) {
    state.cache.rts_alert = false;
    state.cache.audio = { shindo: -1, pga: -1, status: { shindo: 0, pga: 0 }, count: { pga_1: 0, pga_2: 0, shindo_1: 0, shindo_2: 0 } };
  } else {
    state.cache.rts_alert = true;
    state.cache.last_rts_alert = data.time ?? 0;
  }

  let pga = 0, trigger = 0, level = 0;
  let rts_max_pga = -1, rts_max_shindo = -1;
  const data_list: GeoJSON.Feature[] = [];
  const data_alert_0_list: GeoJSON.Feature[] = [];
  const data_alert_list: GeoJSON.Feature[] = [];
  const coordinates: Array<{ lat: number; lon: number }> = [];

  for (const [id, stData] of Object.entries(data.station)) {
    const sInfo = station[id];
    if (!sInfo) continue;
    const sLoc = sInfo.info.at(-1);
    if (!sLoc) continue;

    if (stData.pga > pga) pga = stData.pga;

    const loc = search_loc_name(sLoc.code);
    const stationName = loc ? `${loc.city}${loc.town}` : id;

    if (id === cfg.location.stationId) {
      const I = (alert && stData.alert) ? stData.I : stData.i;
      if (loc) currentStationLoc.textContent = `${loc.city}${loc.town}`;
      currentStationPga.textContent = stData.pga.toFixed(2);
      const iInt = intensity_float_to_int(I);
      currentStationIntensity.className = `current-station-intensity intensity-${iInt}`;
      currentStationIntensityText.textContent = I.toFixed(1);
    }

    if (stData.alert) {
      trigger++;
      if (!levelList[id] || levelList[id] < stData.pga) levelList[id] = stData.pga;
    } else {
      delete levelList[id];
    }

    if (alert && stData.alert) {
      const I = intensity_float_to_int(stData.I);
      const baseProp = { name: stationName, pga: stData.pga, iFloat: stData.I };
      if (state.cache.show_intensity || state.cache.show_lpgm) {
        data_list.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [sLoc.lon, sLoc.lat] }, properties: { i: I, ...baseProp } });
      } else if (I > 0) {
        data_alert_list.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [sLoc.lon, sLoc.lat] }, properties: { i: I, ...baseProp } });
      } else if (eew_alert) {
        data_alert_0_list.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [sLoc.lon, sLoc.lat] }, properties: { i: 0, ...baseProp } });
      } else {
        data_list.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [sLoc.lon, sLoc.lat] }, properties: { i: I, ...baseProp } });
      }
      coordinates.push({ lon: sLoc.lon, lat: sLoc.lat });
      if (rts_max_pga < stData.pga) rts_max_pga = stData.pga;
      if (rts_max_shindo < I) rts_max_shindo = I;

      // Audio triggers
      if (pga > state.cache.audio.pga) {
        if (pga > 200 && state.cache.audio.status.pga !== 2) {
          events.emit('RtsPga2', { info: { type: 0 }, data });
          state.cache.audio.status.pga = 2;
        } else if (pga > 8 && !state.cache.audio.status.pga) {
          events.emit('RtsPga1', { info: { type: 0 }, data });
          state.cache.audio.status.pga = 1;
        }
        state.cache.audio.pga = pga;
      }
      if (I > state.cache.audio.shindo) {
        if (I > 3 && state.cache.audio.status.shindo !== 3) {
          events.emit('RtsShindo2', { info: { type: 0 }, data });
          state.cache.audio.status.shindo = 3;
        } else if (I > 1 && state.cache.audio.status.shindo < 2) {
          events.emit('RtsShindo1', { info: { type: 0 }, data });
          state.cache.audio.status.shindo = 2;
        } else if (!state.cache.audio.status.shindo) {
          events.emit('RtsShindo0', { info: { type: 0 }, data });
          state.cache.audio.status.shindo = 1;
        }
        state.cache.audio.shindo = I;
      }
    } else if (!eew_alert) {
      data_list.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [sLoc.lon, sLoc.lat] }, properties: { i: stData.i, name: stationName, pga: stData.pga, iFloat: stData.i } });
    }
  }

  (map.getSource('rts') as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: data_list });
  (map.getSource('markers-geojson') as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: data_alert_list });
  (map.getSource('markers-geojson-0') as maplibregl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: data_alert_0_list });

  // Intensity list
  const int_list = data.int ?? [];
  if (int_list.length) {
    state.cache.rts_trigger.loc = getTopIntensities(filterIntArray(int_list), 8);
    state.cache.rts_trigger.max = int_list[0].i;
    showEew(false);
  } else {
    state.cache.rts_trigger.loc = [];
  }

  const boxList = getTopIntensities(updateIntensityHistory(int_list, data.time ?? 0))
    .sort((a, b) => b.i - a.i)
    .map((loc) => intensityItem(loc.i, loc.name));
  rtsIntensityList.replaceChildren(...boxList);

  maxPga.textContent = `${pga.toFixed(2)} gal`;
  maxPga.className = `max-station-pga ${!alert ? 'intensity-0' : `intensity-${pga < 5 ? '0' : calculator.pgaToIntensity(pga)}`}`;
  maxIntensity.className = `max-station-intensity intensity-${int_list[0]?.i ?? 0}`;

  for (const id of Object.keys(levelList)) level += levelList[id];
  rtsInfoLevel.textContent = String(Math.round(level));
  rtsInfoTrigger.textContent = String(trigger);
  state.cache.bounds.rts = coordinates;

  if (state.cache.unstable && (data.time ?? 0) - state.cache.unstable < 300_000) {
    warningBoxUnstable.classList.remove('hide');
  } else {
    warningBoxUnstable.classList.add('hide');
  }
}

function filterIntArray(data: Array<{ i: number; code: number }>): Array<{ i: number; code: number }> {
  const max = data[0].i;
  if (max > 3) return data.filter((v) => v.i > 3);
  if (max > 1) return data.filter((v) => v.i > 1);
  return data;
}

function updateIntensityHistory(newData: Array<{ i: number; code: number }>, time: number): Array<{ code: number; i: number }> {
  for (const int of newData) {
    if (!state.cache.int_cache_list[int.code]) {
      state.cache.int_cache_list[int.code] = { values: [], lastUpdate: time };
    }
    state.cache.int_cache_list[int.code].values.push(int.i);
    state.cache.int_cache_list[int.code].lastUpdate = time;
    if (state.cache.int_cache_list[int.code].values.length > 45) {
      state.cache.int_cache_list[int.code].values.shift();
    }
  }

  const cutoff = time - 30_000;
  Object.keys(state.cache.int_cache_list).forEach((code) => {
    if (state.cache.int_cache_list[code].lastUpdate < cutoff) delete state.cache.int_cache_list[code];
  });

  return Object.entries(state.cache.int_cache_list).map(([code, d]) => ({
    code: Number(code),
    i: Math.max(...d.values),
  }));
}

function getTopIntensities(intensities: Array<{ i: number; code: number }>, maxCount = 6): Array<{ i: number; name: string }> {
  const withNames = intensities.map((loc) => {
    const name = search_loc_name(loc.code);
    return name ? { i: loc.i, city: name.city, town: name.town } : null;
  }).filter(Boolean) as Array<{ i: number; city: string; town: string }>;

  if (withNames.length <= maxCount) {
    return withNames.map((l) => ({ i: l.i, name: `${l.city}${l.town}` }));
  }

  const cityMap = new Map<string, { i: number; name: string }>();
  withNames.forEach((l) => {
    const curr = cityMap.get(l.city);
    if (!curr || l.i > curr.i) cityMap.set(l.city, { i: l.i, name: l.city });
  });
  return Array.from(cityMap.values()).sort((a, b) => b.i - a.i).slice(0, maxCount);
}

function intensityItem(i: number, loc: string): HTMLElement {
  const box = document.createElement('div');
  box.className = 'rts-intensity-item';
  const intensity = document.createElement('div');
  intensity.className = `rts-intensity intensity-${i}`;
  const location = document.createElement('div');
  location.className = 'rts-loc';
  location.textContent = loc;
  box.append(intensity, location);
  return box;
}

function setupStationHover(map: maplibregl.Map): void {
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'station-popup-wrap',
    maxWidth: 'none',
  });

  type StationProps = { name?: string; pga?: number; iFloat?: number; i?: number };

  const show = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
    if (!e.features?.length) return;
    map.getCanvas().style.cursor = 'pointer';
    const props = e.features[0].properties as StationProps;
    const name = props.name ?? '';
    const pga = Number(props.pga ?? 0);
    const intensity = Number(props.iFloat ?? props.i ?? 0);
    const iInt = intensity_float_to_int(intensity);
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="station-popup">` +
        `<div class="sp-name">${name}</div>` +
        `<div class="sp-data">` +
        `<span class="sp-intensity intensity-${iInt}">${intensity.toFixed(1)}</span>` +
        `<span class="sp-pga">${pga.toFixed(2)} gal</span>` +
        `</div></div>`,
      )
      .addTo(map);
  };

  const hide = () => {
    map.getCanvas().style.cursor = '';
    popup.remove();
  };

  for (const layer of ['rts-layer', 'markers', 'markers-0'] as const) {
    map.on('mousemove', layer, show);
    map.on('mouseleave', layer, hide);
  }
}
