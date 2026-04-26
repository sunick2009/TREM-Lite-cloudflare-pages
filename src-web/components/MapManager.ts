import maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import { events } from '@web/services/eventBus.ts';
import { state } from '@web/services/appState.ts';
import { COLOR, MAP_CONFIG } from '@web/utils/constants.ts';
import { createIntensityIcon, createIntensityIconSquare, generateMapStyle, getRegionSync, distance } from '@web/utils/utils.ts';
import { getStation } from '@web/services/stationResource.ts';
import { getLastPosition } from '@web/services/geoLocation.ts';
import type { LpgmData, TremEventPayload } from '@web/types/index.ts';

let initError = false;

function buildMapStyle(): object {
  return {
    version: 8,
    name: 'ExpTech Studio',
    sources: {
      map: {
        type: 'vector',
        // Use tiles array directly to avoid fetching tiles.json (which lacks CORS headers).
        // The actual tile CDN lb.exptech.dev returns Access-Control-Allow-Origin: *
        tiles: ['https://lb.exptech.dev/api/v1/map/tiles/{z}/{x}/{y}.pbf'],
        minzoom: 0,
        maxzoom: 12,
        tileSize: 512,
        buffer: 64,
      },
    },
    sprite: '',
    glyphs: 'https://glyphs.geolonia.com/{fontstack}/{range}.pbf',
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': COLOR.MAP.BACKGROUND } },
      { id: 'county', type: 'fill', source: 'map', 'source-layer': 'city', paint: { 'fill-color': COLOR.MAP.TW_COUNTY_FILL, 'fill-opacity': 1 } },
      { id: 'town', type: 'fill', source: 'map', 'source-layer': 'town', paint: { 'fill-color': COLOR.MAP.TW_TOWN_FILL, 'fill-opacity': 1 } },
      { id: 'county-outline', source: 'map', 'source-layer': 'city', type: 'line', paint: { 'line-color': COLOR.MAP.TW_COUNTY_OUTLINE } },
      { id: 'global', type: 'fill', source: 'map', 'source-layer': 'global', paint: { 'fill-color': COLOR.MAP.GLOBAL_FILL, 'fill-opacity': 1 } },
      { id: 'tsunami', type: 'line', source: 'map', 'source-layer': 'tsunami', paint: { 'line-opacity': 0, 'line-width': 3 } },
    ],
  };
}

async function loadIcons(map: maplibregl.Map): Promise<void> {
  const intensityLabels = ['0', '1', '2', '3', '4', '5⁻', '5⁺', '6⁻', '6⁺', '7'];

  for (let i = 0; i < intensityLabels.length; i++) {
    const label = intensityLabels[i];
    const bg = COLOR.INTENSITY[i];
    const text = COLOR.INTENSITY_TEXT[i];
    const circle = createIntensityIcon(label, bg, text, text);
    const square = createIntensityIconSquare(label, bg, text, text);
    await loadImageToMap(map, `intensity-${i}`, circle);
    await loadImageToMap(map, `intensity-square-${i}`, square);
  }

  const lpgmLabels = ['1', '2', '3', '4'];
  for (const label of lpgmLabels) {
    const idx = parseInt(label) as 1 | 2 | 3 | 4;
    const sq = createIntensityIconSquare(label, COLOR.LPGM[idx], COLOR.LPGM_TEXT[idx], COLOR.LPGM_TEXT[idx]);
    await loadImageToMap(map, `lpgm-${label}`, sq);
  }

  // Load static images
  const images: Array<[string, string]> = [
    ['gps', '/image/gps.png'],
    ['cross', '/image/cross.png'],
    ['cross1', '/image/cross1.png'],
    ['cross2', '/image/cross2.png'],
    ['cross3', '/image/cross3.png'],
    ['cross4', '/image/cross4.png'],
  ];
  for (const [id, src] of images) {
    try {
      const loaded = await map.loadImage(src);
      map.addImage(id, loaded.data);
    } catch {
      console.warn(`[Map] Failed to load image: ${src}`);
    }
  }
}

function loadImageToMap(map: maplibregl.Map, id: string, img: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    if (img.complete) {
      try {
        map.addImage(id, img);
      } catch { /* ignore duplicate */ }
      resolve();
    } else {
      img.onload = () => {
        try { map.addImage(id, img); } catch { /* ignore */ }
        resolve();
      };
      img.onerror = () => resolve();
    }
  });
}

export async function initMap(delay = 3000): Promise<void> {
  return new Promise((resolve) => {
    function attempt() {
      const map = new maplibregl.Map({
        container: 'map',
        style: buildMapStyle() as maplibregl.StyleSpecification,
        center: MAP_CONFIG.CENTER,
        zoom: MAP_CONFIG.ZOOM,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
        maxZoom: 12,
        minZoom: 4,
      });

      map.on('load', async () => {
        map.on('resize', () => map.fitBounds(MAP_CONFIG.BOUNDS, MAP_CONFIG.OPTIONS));
        map.resize();
        map.fitBounds(MAP_CONFIG.BOUNDS, MAP_CONFIG.OPTIONS);

        await loadIcons(map);

        // LPGM markers layer
        map.addSource('lpgm-markers-geojson', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'lpgm-markers', type: 'symbol', source: 'lpgm-markers-geojson',
          layout: {
            'icon-image': ['match', ['get', 'i'], 1, 'lpgm-1', 2, 'lpgm-2', 3, 'lpgm-3', 4, 'lpgm-4', 'cross'],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 10, 0.7],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });

        // User location layer
        map.addSource('user-location', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'user-location-dot', type: 'circle', source: 'user-location',
          paint: { 'circle-radius': 8, 'circle-color': '#4285f4', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
        });
        map.addLayer({
          id: 'user-location-icon', type: 'symbol', source: 'user-location',
          layout: { 'icon-image': 'gps', 'icon-size': 0.5, 'icon-allow-overlap': true },
        });

        events.on<LpgmData>('LpgmRelease', (ans) => {
          const station = getStation();
          if (!station) return;
          const features: GeoJSON.Feature[] = [];
          const codeIntensity: Record<number, number> = {};
          for (const s of ans.data.list) {
            if (!s.lpgm) continue;
            const info = station[s.id]?.info.at(-1);
            if (!info) continue;
            if (!codeIntensity[info.code] || s.lpgm > codeIntensity[info.code]) {
              codeIntensity[info.code] = s.lpgm;
            }
            features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [info.lon, info.lat] }, properties: { i: s.lpgm } });
          }
          map.setPaintProperty('town', 'fill-color', generateMapStyle(codeIntensity, false, true));
          map.setPaintProperty('rts-layer', 'circle-opacity', 0.2);
          (map.getSource('lpgm-markers-geojson') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
          setTimeout(() => {
            map.setPaintProperty('town', 'fill-color', generateMapStyle({}, false, false));
            map.setPaintProperty('rts-layer', 'circle-opacity', 1);
            (map.getSource('lpgm-markers-geojson') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
          }, 15_000);
        });

        const setUserLocation = (coords: GeolocationCoordinates) => {
          (map.getSource('user-location') as GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [coords.longitude, coords.latitude] }, properties: {} }],
          });
        };

        events.on('GeoLocation', (ans) => {
          setUserLocation((ans as TremEventPayload<GeolocationCoordinates>).data);
        });

        // Apply immediately if geolocation already fired before MapLoad
        const existingPos = getLastPosition();
        if (existingPos) setUserLocation(existingPos);

        events.on('FocusLocation', () => {
          const pos = getLastPosition();
          if (pos) map.flyTo({ center: [pos.longitude, pos.latitude], zoom: 10 });
        });

        state.map = map;
        // Expose for debugging and e2e tests
        (window as unknown as Record<string, unknown>)['__map'] = map;
        events.emit('MapLoad', { info: { type: 0 }, data: map });
        resolve();
      });

      map.on('error', (e) => {
        // Tile fetch failures are non-fatal; MapLibre renders gracefully without them.
        if ('tile' in e && e.tile) return;
        if (!initError) {
          initError = true;
          console.error('[Map] loading error, retrying...');
        }
        setTimeout(attempt, delay);
      });
    }
    attempt();
  });
}
