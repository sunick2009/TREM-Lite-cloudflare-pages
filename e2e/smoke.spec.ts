/**
 * E2E Smoke Tests — TREM-Lite Web
 *
 * Verifies that the Cloudflare Pages build loads correctly and that
 * key UI elements and data flows are functional.
 *
 * Tests are designed to be run against `npm run preview:web` (vite preview
 * of the production dist/) rather than a live deployment.
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err: Error) => errors.push(err.message));
  return errors;
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

test.describe('Build & Load', () => {
  test('page returns HTTP 200', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
  });

  test('page has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TREM/i);
  });

  test('no JavaScript errors on load', async ({ page }) => {
    const errors = await collectErrors(page);
    await page.goto('/');
    // Wait for main.ts to initialize
    await page.waitForTimeout(3000);
    const fatalErrors = errors.filter(
      (e) =>
        // Ignore non-fatal warnings
        !e.includes('workbox') &&
        !e.includes('sw.js') &&
        !e.includes('CJS build of Vite') &&
        // Map tiles CORS is blocked on localhost:4173 (works in production)
        !e.includes('api-1.exptech.dev/api/v1/map/') &&
        !e.includes('api-2.exptech.dev/api/v1/map/') &&
        !e.includes('tiles.json') &&
        !e.includes('[Map] loading error') &&
        // Some API paths may 404 from localhost due to CORS origin restrictions
        !e.includes('blocked by CORS') &&
        !e.includes('ERR_FAILED')
    );
    expect(fatalErrors, `JS errors: ${fatalErrors.join('\n')}`).toHaveLength(0);
  });
});

test.describe('PWA & Manifest', () => {
  test('manifest.webmanifest is accessible', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toMatch(/TREM/i);
    expect(body.display).toBe('standalone');
    expect(body.icons.length).toBeGreaterThan(0);
  });

  test('service worker (sw.js) is accessible', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
  });

  test('PWA icon 192 exists', async ({ request }) => {
    const res = await request.get('/icons/icon-192.png');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image');
  });

  test('PWA icon 512 exists', async ({ request }) => {
    const res = await request.get('/icons/icon-512.png');
    expect(res.status()).toBe(200);
  });
});

test.describe('Static Assets', () => {
  test('region.json is accessible', async ({ request }) => {
    const res = await request.get('/data/region.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Should contain Taiwan counties
    expect(body).toHaveProperty('臺北市');
    expect(body).toHaveProperty('花蓮縣');
  });

  test('time.json is accessible', async ({ request }) => {
    const res = await request.get('/data/time.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Should be a non-empty object with numeric depth keys
    const keys = Object.keys(body);
    expect(keys.length).toBeGreaterThan(0);
  });

  test('EEW audio file exists', async ({ request }) => {
    const res = await request.get('/audio/EEW.mp3');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('audio');
  });

  test('all 12 audio files exist', async ({ request }) => {
    const files = [
      'ALERT', 'CANCEL', 'EEW', 'INTENSITY',
      'PGA1', 'PGA2', 'REPORT', 'SHINDO0',
      'SHINDO1', 'SHINDO2', 'TSUNAMI', 'UPDATE',
    ];
    for (const name of files) {
      const res = await request.get(`/audio/${name}.mp3`);
      expect(res.status(), `Missing audio: ${name}.mp3`).toBe(200);
    }
  });

  test('map images exist', async ({ request }) => {
    for (const name of ['gps.png', 'cross.png']) {
      const res = await request.get(`/image/${name}`);
      expect(res.status(), `Missing image: ${name}`).toBe(200);
    }
  });
});

test.describe('DOM Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Allow time for module initialization
    await page.waitForTimeout(2000);
  });

  test('EEW info-wrapper is present', async ({ page }) => {
    await expect(page.locator('#info-wrapper')).toBeAttached();
  });

  test('report-wrapper is present', async ({ page }) => {
    await expect(page.locator('.report-wrapper')).toBeAttached();
  });

  test('max-intensity-pga-wrapper is present', async ({ page }) => {
    await expect(page.locator('.max-intensity-pga-wrapper')).toBeAttached();
  });

  test('nav-bar-wrapper is present', async ({ page }) => {
    await expect(page.locator('.nav-bar-wrapper')).toBeAttached();
  });

  test('map canvas renders', async ({ page }) => {
    // MapLibre creates a canvas element inside #map
    await page.waitForSelector('#map canvas', { timeout: 10_000 });
    const canvas = page.locator('#map canvas');
    await expect(canvas).toBeVisible();
  });

  test('intensity color list is rendered', async ({ page }) => {
    await expect(page.locator('.intensity-color-list-wrapper')).toBeAttached();
  });
});

test.describe('Settings Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('settings button opens settings panel', async ({ page }) => {
    const settingsBtn = page.locator('.nav-bar-setting');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();
    await expect(page.locator('.settings-panel')).not.toHaveClass(/hidden/);
  });

  test('settings panel can be closed', async ({ page }) => {
    await page.locator('.nav-bar-setting').click();
    const panel = page.locator('.settings-panel');
    await expect(panel).not.toHaveClass(/hidden/);

    await page.locator('.settings-close-btn').click();
    await expect(panel).toHaveClass(/hidden/);
  });

  test('settings overlay click closes panel', async ({ page }) => {
    await page.locator('.nav-bar-setting').click();
    // Click the overlay at the top-left corner, away from the centered content
    await page.locator('.settings-overlay').click({ position: { x: 10, y: 10 }, force: true });
    await expect(page.locator('.settings-panel')).toHaveClass(/hidden/);
  });
});

test.describe('Report Panel Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('report list button toggles panel', async ({ page }) => {
    const wrapper = page.locator('.report-wrapper');
    const btn = page.locator('.report-list-btn');
    // Panel is visible by default
    await expect(wrapper).not.toHaveClass(/hidden/);
    await btn.click();
    await expect(wrapper).toHaveClass(/hidden/);
    await btn.click();
    await expect(wrapper).not.toHaveClass(/hidden/);
  });
});

test.describe('Live API (CORS)', () => {
  test('ExpTech RTS endpoint returns data', async ({ request }) => {
    const res = await request.get('https://api-1.exptech.dev/api/v1/trem/rts');
    expect(res.status()).toBe(200);
    const body = await res.json();
    // RTS data should have a time field
    expect(body).toHaveProperty('time');
    expect(body).toHaveProperty('station');
  });

  test('ExpTech EEW endpoint returns array', async ({ request }) => {
    const res = await request.get('https://api.lb.exptech.dev/api/v1/eq/eew');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('ExpTech report list returns array', async ({ request }) => {
    // Reports are served from core-api cluster (not lb/numbered APIs)
    const res = await request.get(
      'https://api.core.exptech.dev/api/v2/eq/report?limit=5'
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('id');
    }
  });

  test('ExpTech station endpoint returns station map', async ({ request }) => {
    const res = await request.get('https://api-1.exptech.dev/api/v1/trem/station');
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Station data is a record of station IDs
    expect(typeof body).toBe('object');
    const keys = Object.keys(body);
    expect(keys.length).toBeGreaterThan(0);
  });
});

// Proxy Function tests require Cloudflare Pages Functions runtime.
// Run with: npx wrangler pages dev dist --port 8788
// then: BASE_URL=http://localhost:8788 npx playwright test --grep "Proxy"
test.describe('Proxy Function', () => {
  test.skip(
    !process.env['BASE_URL']?.includes('8788'),
    'Proxy tests require wrangler pages dev (set BASE_URL=http://localhost:8788)'
  );

  test('proxy rejects missing url param', async ({ request }) => {
    const res = await request.get('/api/proxy');
    expect(res.status()).toBe(400);
  });

  test('proxy rejects non-allowlisted host', async ({ request }) => {
    const res = await request.get(
      '/api/proxy?url=https://example.com/api/v1/eq/report'
    );
    expect(res.status()).toBe(403);
  });

  test('proxy rejects HTTP (non-HTTPS) url', async ({ request }) => {
    const res = await request.get(
      '/api/proxy?url=http://api-1.exptech.dev/api/v1/trem/rts'
    );
    expect(res.status()).toBe(403);
  });
});
