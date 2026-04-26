import type { AppState } from '@web/types/index.ts';

export const state: AppState = {
  map: null,
  station: null,
  data: {
    rts: null,
    eew: [],
    intensity: [],
    report: [],
    lpgm: [],
  },
  cache: {
    rts_alert: false,
    unstable: 0,
    last_rts_alert: 0,
    show_eew_box: false,
    rts_trigger: { max: 0, loc: [] },
    int_cache_list: {},
    eew_last: {},
    intensity_last: {},
    last_report: null,
    eewIntensityArea: {},
    show_intensity: false,
    show_lpgm: false,
    intensity: { time: 0, max: 0 },
    last_data_time: 0,
    audio: {
      shindo: -1,
      pga: -1,
      status: { shindo: 0, pga: 0 },
      count: { pga_1: 0, pga_2: 0, shindo_1: 0, shindo_2: 0 },
    },
    bounds: { rts: [], intensity: [], report: [], lpgm: [] },
  },
};
