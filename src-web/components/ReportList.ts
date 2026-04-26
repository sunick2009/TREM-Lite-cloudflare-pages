import maplibregl from 'maplibre-gl';
import { events } from '@web/services/eventBus.ts';
import { state } from '@web/services/appState.ts';
import { fetchReportList, fetchReportDetail } from '@web/services/earthquakeApi.ts';
import { extractLocation, search_loc_name } from '@web/utils/utils.ts';
import { generateMapStyle, convertIntensityToAreaFormat } from '@web/utils/utils.ts';
import { REPORT_LIMIT, SHOW_REPORT } from '@web/utils/constants.ts';
import type { ReportListItem, ReportDetail, TremEventPayload } from '@web/types/index.ts';

const SURVEY_INTENSITY_TIMEOUT = 120_000;

// Persists the last-seen report ID across page reloads (e.g. SW updates).
// Prevents replaying audio/notification for reports the user already saw.
const LAST_SEEN_REPORT_KEY = 'trem_last_report_id';

export function initReportList(): void {
  const closeButton = document.getElementById('close-btn')!;
  const reportWrapper = document.querySelector<HTMLElement>('.report-wrapper')!;
  const reportBoxItems = document.getElementById('report-box-items')!;
  const customScrollbar = document.querySelector<HTMLElement>('.custom-scrollbar')!;

  let isClose = false;
  let isDragging = false;
  let startY = 0;
  let initialScrollTop = 0;

  closeButton.addEventListener('click', () => {
    closeButton.classList.toggle('off');
    reportWrapper.classList.toggle('hidden');
    isClose = !isClose;
  });

  reportBoxItems.addEventListener('scroll', () => updateScrollbar(reportBoxItems, customScrollbar));
  reportBoxItems.addEventListener('wheel', (e) => {
    reportBoxItems.scrollTop += e.deltaY;
    updateScrollbar(reportBoxItems, customScrollbar);
  });
  customScrollbar.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    initialScrollTop = reportBoxItems.scrollTop;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    const ratio = deltaY / (reportBoxItems.clientHeight - customScrollbar.clientHeight);
    reportBoxItems.scrollTop = initialScrollTop + ratio * (reportBoxItems.scrollHeight - reportBoxItems.clientHeight);
  });
  document.addEventListener('mouseup', () => { isDragging = false; document.body.style.userSelect = ''; });
  window.addEventListener('resize', () => updateScrollbar(reportBoxItems, customScrollbar));

  reportBoxItems.addEventListener('click', (e) => handleClick(e));

  events.on('MapLoad', (ans) => {
    const map = (ans as TremEventPayload<maplibregl.Map>).data;
    initMapLayers(map);
    refresh(map, reportBoxItems, customScrollbar);
    setInterval(() => refresh(map, reportBoxItems, customScrollbar), 10_000);
  });

  events.on<ReportListItem>('ReportRelease', () => {
    const map = state.map as maplibregl.Map | null;
    if (map) refresh(map, reportBoxItems, customScrollbar);
  });
}

function initMapLayers(map: maplibregl.Map): void {
  map.addSource('report-markers-geojson', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  map.addLayer({
    id: 'report-markers', type: 'symbol', source: 'report-markers-geojson',
    filter: ['!=', ['get', 'i'], 0],
    layout: {
      'symbol-sort-key': ['get', 'i'],
      'symbol-z-order': 'source',
      'icon-image': ['match', ['get', 'i'], 1, 'intensity-1', 2, 'intensity-2', 3, 'intensity-3', 4, 'intensity-4', 5, 'intensity-5', 6, 'intensity-6', 7, 'intensity-7', 8, 'intensity-8', 9, 'intensity-9', 'cross'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 10, 0.6],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  map.addLayer({
    id: 'report-markers-cross', type: 'symbol', source: 'report-markers-geojson',
    filter: ['==', ['get', 'i'], 0],
    layout: {
      'icon-image': 'cross',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.01, 10, 0.09],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
}

async function refresh(map: maplibregl.Map, container: HTMLElement, scrollbar: HTMLElement): Promise<void> {
  const list = await fetchReportList(REPORT_LIMIT);
  if (!list) return;

  if (!state.data.report.length && list.length) {
    const detail = await fetchReportDetail(list[0].id);
    if (detail) {
      showReportOnMap(map, detail);
      state.cache.last_report = list[0];
    }
    state.data.report = list;
    // Only alert if this report wasn't already seen before the page reload.
    // Guards against SW-update reloads replaying audio for old reports.
    // Secondary guard: suppress alerts on page load for reports older than 1 minute,
    // so stale data never triggers audio/notification on refresh.
    const lastSeenId = localStorage.getItem(LAST_SEEN_REPORT_KEY);
    if (list[0].id !== lastSeenId) {
      localStorage.setItem(LAST_SEEN_REPORT_KEY, list[0].id);
      const isRecent = Date.now() - list[0].time < 60_000;
      if (isRecent) {
        events.emit('ReportRelease', { info: { type: 0 }, data: list[0] });
      }
    }
  } else if (list.length && list[0].id !== state.data.report[0]?.id) {
    const detail = await fetchReportDetail(list[0].id);
    if (detail) {
      showReportOnMap(map, detail);
      state.cache.last_report = list[0];
    }
    state.data.report = list;
    events.emit('ReportRelease', { info: { type: 0 }, data: list[0] });
    localStorage.setItem(LAST_SEEN_REPORT_KEY, list[0].id);
  } else {
    state.data.report = list;
  }

  renderReportItems(list, container, scrollbar);
}

function showReportOnMap(map: maplibregl.Map, detail: ReportDetail): void {
  const features: GeoJSON.Feature[] = [];
  for (const [county, countyData] of Object.entries(detail.list)) {
    for (const [town, townData] of Object.entries(countyData.town)) {
      const code = findCode(`${county}${town}`);
      if (code !== null) {
        const loc = search_loc_name(code);
        if (loc) {
          const region = (window as Window & { _regionData?: unknown })._regionData;
          // Simplified: just use intensity markers
        }
      }
    }
  }

  // Show intensity area colors
  if (detail.list) {
    const area: Record<string, number> = {};
    for (const [, countyData] of Object.entries(detail.list)) {
      for (const [, townData] of Object.entries(countyData.town)) {
        // We'd need region data here - simplified for now
      }
    }
  }
}

function findCode(name: string): number | null {
  // Use search_loc_code which reads from loaded region
  return null; // simplified
}

export function showReportPoint(report: ReportListItem | null): void {
  // Will be called from RTS logic when not in alert mode
  if (!report || !SHOW_REPORT) return;
  const map = state.map as maplibregl.Map | null;
  if (!map) return;
  // Implementation simplified
}

function renderReportItems(list: ReportListItem[], container: HTMLElement, scrollbar: HTMLElement): void {
  container.innerHTML = '';
  list.forEach((item) => {
    container.appendChild(createReportItem(item));
  });
  updateScrollbar(container, scrollbar);
}

function createIntensityBox(intensity: number): HTMLElement {
  const box = document.createElement('div');
  box.className = 'report-intensity-box';
  const val = document.createElement('div');
  val.className = `report-intensity-val intensity-${intensity}`;
  const text = document.createElement('div');
  text.className = 'report-intensity-text';
  box.append(val, text);
  return box;
}

function createInfoBox(item: ReportListItem): HTMLElement {
  const box = document.createElement('div');
  box.className = 'report-info-box';
  const infoItem = document.createElement('div');
  infoItem.className = 'report-info-item';

  const loc = document.createElement('div');
  loc.className = 'report-loc';
  if (item.loc) loc.textContent = extractLocation(item.loc);

  const time = document.createElement('div');
  time.className = 'report-time';
  const d = new Date(item.time);
  time.textContent = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  infoItem.append(loc, time);

  const magDep = document.createElement('div');
  magDep.className = 'report-mag-dep';

  const mag = document.createElement('div');
  mag.className = 'report-mag';
  const magText = document.createElement('div');
  magText.className = 'report-mag-text';
  const magVal = document.createElement('div');
  magVal.className = `report-mag-val ${!item.id.split('-')[0].includes('000') ? 'isNum' : ''}`;
  magVal.textContent = item.mag ? item.mag.toFixed(1) : '';
  mag.append(magText, magVal);

  const depth = document.createElement('div');
  depth.className = 'report-depth';
  const depthText = document.createElement('div');
  depthText.className = 'report-depth-text';
  const depthVal = document.createElement('div');
  depthVal.className = 'report-depth-val';
  depthVal.textContent = String(item.depth || '');
  depth.append(depthText, depthVal);

  magDep.append(mag, depth);
  box.append(infoItem, magDep);
  return box;
}

function createReportItem(item: ReportListItem): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'report-box-item-wrapper';
  wrapper.setAttribute('data-id', item.id);
  wrapper.setAttribute('data-time', String(item.time));
  if (item.trem) wrapper.setAttribute('trem-url', `https://api.exptech.dev/file/trem_info.html?id=${item.trem}`);

  const contain = document.createElement('div');
  contain.className = 'report-box-item-contain';
  contain.append(createIntensityBox(item.int), createInfoBox(item));

  const buttons = document.createElement('div');
  buttons.className = 'report-buttons';
  const webButton = document.createElement('div');
  webButton.className = `report-web ${item.trem ? 'web-detection' : 'web-report'}`;
  buttons.appendChild(webButton);

  wrapper.append(contain, buttons);
  return wrapper;
}

function handleClick(e: MouseEvent): void {
  const webBtn = (e.target as Element).closest('.report-web');
  if (webBtn) {
    const wrapper = (e.target as Element).closest('.report-box-item-wrapper');
    if (wrapper) {
      const id = wrapper.getAttribute('data-id') ?? '';
      const trem = wrapper.getAttribute('trem-url');
      const reportId = id.replace(`-${id.split('-')[1]}`, '');
      const url = trem ? trem : `https://www.cwa.gov.tw/V8/C/E/EQ/EQ${reportId}.html`;
      window.open(url, '_blank', 'noopener');
    }
  }
}

function updateScrollbar(container: HTMLElement, scrollbar: HTMLElement): void {
  const { scrollHeight, clientHeight, scrollTop } = container;
  const maxTop = clientHeight - scrollbar.clientHeight - 8;
  scrollbar.style.height = `${Math.max((clientHeight / scrollHeight) * clientHeight, 30)}px`;
  if (scrollHeight > clientHeight) {
    scrollbar.style.top = `${(scrollTop / (scrollHeight - clientHeight)) * maxTop}px`;
  }
}
