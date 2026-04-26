// ============================
// API Data Types
// ============================

export interface RtsStation {
  pga: number;
  pgv?: number;
  i: number;    // float intensity
  I: number;    // alert intensity
  alert: boolean;
}

export interface RtsBox {
  [code: string]: number; // code -> intensity
}

export interface RtsIntensityItem {
  code: number;
  i: number;
}

export interface RtsData {
  time: number;
  station: Record<string, RtsStation>;
  box: RtsBox;
  int: RtsIntensityItem[];
}

export interface EewEq {
  time: number;
  lat: number;
  lon: number;
  depth: number;
  mag: number;
  loc: string;
  max: number;
}

export interface EewData {
  id: string;
  serial: number;
  author: string;   // 'cwa' | 'trem'
  status: number;   // 0=warn, 1=alert, 3=cancel
  final: boolean;
  eq: EewEq;
  rts?: boolean;
  // internal fields
  method?: string;
  EewEnd?: boolean;
  status3Time?: number;
  dist?: { p_dist: number; s_dist: number; s_t: number };
}

export interface IntensityArea {
  [intensity: string]: number[]; // intensity -> area codes
}

export interface IntensityData {
  id: number;
  serial: number;
  max: number;
  area: IntensityArea;
  IntensityEnd?: boolean;
}

export interface LpgmStation {
  id: string;
  lpgm: number;
}

export interface LpgmData {
  id: string;
  list: LpgmStation[];
  time?: number;
  LpgmEnd?: boolean;
}

export interface ReportListItem {
  id: string;
  time: number;
  mag: number;
  depth: number;
  loc: string;
  int: number;
  trem?: string;
}

export interface ReportDetail extends ReportListItem {
  list: Record<string, CountyIntensity>;
}

export interface CountyIntensity {
  int: number;
  town: Record<string, { int: number }>;
}

export interface StationInfo {
  lat: number;
  lon: number;
  code: number;
}

export interface StationRecord {
  info: StationInfo[];
}

export type StationData = Record<string, StationRecord>;

// ============================
// Config Types
// ============================

export interface WebConfig {
  version: number;
  apiProxyDomain: string;
  useProxy: boolean;
  map: {
    theme: string;
    showStations: boolean;
    showFault: boolean;
    autoZoom: boolean;
  };
  notification: {
    enabled: boolean;
    minRtsIntensity: number;
    minEewIntensity: number;
    sound: boolean;
    speech: boolean;
    soundEffects: Record<string, boolean>;
  };
  location: {
    code: number;
    stationId: string;
  };
  display: {
    showEew: boolean;
    showReport: boolean;
    showDetect: boolean;
    showRtsIntensity: boolean;
    showTremEew: boolean;
  };
}

// ============================
// Internal State Types
// ============================

export interface AppState {
  map: unknown | null;    // maplibre-gl Map instance
  station: StationData | null;
  data: {
    rts: RtsData | null;
    eew: EewData[];
    intensity: IntensityData[];
    report: ReportListItem[];
    lpgm: LpgmData[];
  };
  cache: {
    rts_alert: boolean;
    unstable: number;
    last_rts_alert: number;
    show_eew_box: boolean;
    rts_trigger: {
      max: number;
      loc: Array<{ name: string; i: number }>;
    };
    int_cache_list: Record<string, { values: number[]; lastUpdate: number }>;
    eew_last: Record<string, { last_time: number; serial: number }>;
    intensity_last: Record<string, { last_time: number; serial: number }>;
    last_report: ReportListItem | null;
    eewIntensityArea: Record<string, Record<string, number>>;
    show_intensity: boolean;
    show_lpgm: boolean;
    intensity: { time: number; max: number };
    last_data_time: number;
    audio: {
      shindo: number;
      pga: number;
      status: { shindo: number; pga: number };
      count: { pga_1: number; pga_2: number; shindo_1: number; shindo_2: number };
    };
    bounds: {
      rts: Array<{ lat: number; lon: number }>;
      intensity: unknown[];
      report: unknown[];
      lpgm: unknown[];
    };
  };
}

// ============================
// Event Types
// ============================

export type TremEvent =
  | 'MapLoad'
  | 'DataRts'
  | 'DataEew'
  | 'DataIntensity'
  | 'DataLpgm'
  | 'EewRelease'
  | 'EewAlert'
  | 'EewUpdate'
  | 'EewCancel'
  | 'EewEnd'
  | 'EewNewAreaAlert'
  | 'RtsPga2'
  | 'RtsPga1'
  | 'RtsShindo2'
  | 'RtsShindo1'
  | 'RtsShindo0'
  | 'ReportRelease'
  | 'IntensityRelease'
  | 'IntensityUpdate'
  | 'IntensityEnd'
  | 'LpgmRelease'
  | 'LpgmEnd'
  | 'TsunamiRelease';

export interface TremEventPayload<T = unknown> {
  info: { type: number };
  data: T;
}

// ============================
// Region Data Types
// ============================

export interface RegionTown {
  code: number;
  lat: number;
  lon: number;
  site?: number;
  area?: string;
}

export type RegionData = Record<string, Record<string, RegionTown>>;
