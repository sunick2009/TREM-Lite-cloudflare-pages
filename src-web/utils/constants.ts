export const COLOR = {
  MAP: {
    BACKGROUND: '#1f2025',
    TW_COUNTY_FILL: '#3F4045',
    TW_TOWN_FILL: '#3F4045',
    TW_COUNTY_OUTLINE: '#a9b4bc',
    GLOBAL_FILL: '#3F4045',
  },
  RTS: {
    intensity_3: '#0005d0',
    intensity_2: '#004bf8',
    intensity_1: '#009EF8',
    intensity0: '#79E5FD',
    intensity1: '#49E9AD',
    intensity2: '#44fa34',
    intensity3: '#beff0c',
    intensity4: '#fff000',
    intensity5: '#ff9300',
    intensity6: '#fc5235',
    intensity7: '#b720e9',
  },
  INTENSITY: {
    0: '#202020',
    1: '#003264',
    2: '#0064c8',
    3: '#1e9632',
    4: '#ffc800',
    5: '#ff9600',
    6: '#ff6400',
    7: '#ff0000',
    8: '#c00000',
    9: '#9600c8',
  } as Record<number, string>,
  INTENSITY_TEXT: {
    0: '#ffffff',
    1: '#ffffff',
    2: '#ffffff',
    3: '#ffffff',
    4: '#000000',
    5: '#000000',
    6: '#000000',
    7: '#ffffff',
    8: '#ffffff',
    9: '#ffffff',
  } as Record<number, string>,
  LPGM: {
    1: '#0040ff',
    2: '#ffe600',
    3: '#ff2800',
    4: '#a50021',
  } as Record<number, string>,
  LPGM_TEXT: {
    1: '#ffffff',
    2: '#000000',
    3: '#ffffff',
    4: '#ffffff',
  } as Record<number, string>,
  EEW: {
    S: {
      WARN: '#ffaa00',
      ALERT: '#ff0000',
      CANCEL: '#000',
      RTS: '#0005d0',
    },
    TRIGGER: {
      LOW: '#1e9632',
      MIDDLE: '#ffc800',
      HIGH: '#c00000',
    },
    P: '#00CACA',
  },
  TREM: {
    S: '#beff0c',
    P: '#beff0c',
  },
};

export const HTTP_TIMEOUT = {
  LOOP: 1000,
  RESOURCE: 3500,
  RTS: 1500,
  EEW: 1500,
  REPORT: 5000,
  INTENSITY: 1500,
  LPGM: 1500,
  NTP: 2000,
};

export const LAST_DATA_TIMEOUT_ERROR = 3000;

export const URL_CONFIG = {
  API: ['api-1.exptech.dev', 'api-2.exptech.dev'],
  LB: [
    'lb-1.exptech.dev',
    'lb-2.exptech.dev',
    'lb-3.exptech.dev',
    'lb-4.exptech.dev',
  ],
  DEFAULT_PROXY_DOMAIN: 'api.lb.exptech.dev',
};

export const MAP_CONFIG = {
  BOUNDS: [[118.0, 21.2], [124.0, 25.8]] as [[number, number], [number, number]],
  OPTIONS: { padding: 20, duration: 0 },
  CENTER: [121.6, 23.5] as [number, number],
  ZOOM: 6.8,
};

export const EEW_AUTHOR = ['trem', 'cwa'];

export const REPORT_LIMIT = 75;

export const SHOW_TREM_EEW = false;
export const SHOW_REPORT = true;

export const EEW_CACHE_TTL = 600000;

export const TIME_OFFSET = 3600 * 8 * 1000; // UTC+8

export const INTENSITY_LIST = ['0', '1', '2', '3', '4', '5⁻', '5⁺', '6⁻', '6⁺', '7'];

export const APP_VERSION = '3.2.1-web';
