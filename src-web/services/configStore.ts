import type { WebConfig } from '@web/types/index.ts';

const DB_NAME = 'trem-web';
const STORE_NAME = 'config';
const CONFIG_KEY = 'main';
const CURRENT_VERSION = 1;

const DEFAULT_CONFIG: WebConfig = {
  version: CURRENT_VERSION,
  apiProxyDomain: 'api.lb.exptech.dev',
  useProxy: false,
  map: {
    theme: 'default',
    showStations: true,
    showFault: false,
    autoZoom: false,
  },
  notification: {
    enabled: false,
    minRtsIntensity: 0,
    minEewIntensity: 0,
    sound: true,
    speech: true,
    soundEffects: {
      EEW: true,
      EEW2: true,
      PAlert: true,
      PGA1: true,
      PGA2: true,
      Report: true,
      Shindo0: true,
      Shindo1: true,
      Shindo2: true,
      Update: true,
      dong: true,
    },
  },
  location: {
    code: 711,
    stationId: '6732340',
  },
  display: {
    showEew: true,
    showReport: true,
    showDetect: true,
    showRtsIntensity: true,
    showTremEew: false,
  },
};

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getDB(): Promise<IDBDatabase> {
  if (!db) db = await openDB();
  return db;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function migrateConfig(old: Partial<WebConfig>): WebConfig {
  const merged = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as WebConfig;
  // Shallow merge top-level fields
  for (const key of Object.keys(old) as Array<keyof WebConfig>) {
    if (key === 'version') continue;
    const val = old[key];
    if (val !== null && val !== undefined) {
      if (typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(merged[key] as object, val);
      } else {
        (merged[key] as unknown) = val;
      }
    }
  }
  merged.version = CURRENT_VERSION;
  return merged;
}

let _config: WebConfig | null = null;
let _listeners: Array<(cfg: WebConfig) => void> = [];

export async function loadConfig(): Promise<WebConfig> {
  const stored = await idbGet<WebConfig>(CONFIG_KEY);
  if (!stored) {
    _config = { ...DEFAULT_CONFIG };
    await idbSet(CONFIG_KEY, _config);
  } else {
    _config = stored.version < CURRENT_VERSION ? migrateConfig(stored) : stored;
    if (_config !== stored) await idbSet(CONFIG_KEY, _config);
  }
  return _config;
}

export function getConfig(): WebConfig {
  return _config ?? DEFAULT_CONFIG;
}

export async function saveConfig(patch: Partial<WebConfig>): Promise<void> {
  const current = getConfig();
  _config = { ...current, ...patch, version: CURRENT_VERSION };
  await idbSet(CONFIG_KEY, _config);
  _listeners.forEach((fn) => fn(_config!));
}

export async function patchConfig(
  section: keyof WebConfig,
  patch: Partial<WebConfig[typeof section]>,
): Promise<void> {
  const current = getConfig();
  _config = {
    ...current,
    [section]: { ...(current[section] as object), ...(patch as object) },
    version: CURRENT_VERSION,
  };
  await idbSet(CONFIG_KEY, _config);
  _listeners.forEach((fn) => fn(_config!));
}

export async function resetConfig(): Promise<void> {
  _config = { ...DEFAULT_CONFIG };
  await idbSet(CONFIG_KEY, _config);
  _listeners.forEach((fn) => fn(_config!));
}

export function onConfigChange(fn: (cfg: WebConfig) => void): () => void {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((l) => l !== fn); };
}

export async function exportConfig(): Promise<void> {
  const cfg = getConfig();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trem-web-config.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importConfig(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const raw = JSON.parse(e.target!.result as string) as Partial<WebConfig>;
        if (typeof raw !== 'object' || Array.isArray(raw)) {
          throw new Error('Invalid config format');
        }
        const migrated = migrateConfig(raw);
        _config = migrated;
        await idbSet(CONFIG_KEY, _config);
        _listeners.forEach((fn) => fn(_config!));
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
