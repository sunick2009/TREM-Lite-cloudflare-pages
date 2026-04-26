/**
 * E2E Tests — Phase 2 Features
 *
 * Covers:
 *  1. LPGM layer — inject LpgmRelease event, verify markers + town fill-color change
 *  2. Sound effects settings UI — checkboxes present, toggleable, persisted to config
 *  3. Geolocation — mock position, verify user-location source receives a feature
 */

import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function waitForMap(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as unknown as Record<string, unknown>)['__map'],
    { timeout: 15_000 },
  );
}

async function waitForEvents(page: Page): Promise<void> {
  // Wait for the eventBus to be ready (main.ts finishes init)
  await page.waitForFunction(
    () => !!(window as unknown as Record<string, unknown>)['__map'],
    { timeout: 15_000 },
  );
  await page.waitForTimeout(1_000);
}

// ─── LPGM Layer ───────────────────────────────────────────────────────────────

test.describe('LPGM Layer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMap(page);
    await page.waitForTimeout(1_500);
  });

  test('lpgm-markers-geojson source exists on map', async ({ page }) => {
    const hasSource = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>)['__map'] as {
        getSource: (id: string) => unknown;
      };
      return !!map.getSource('lpgm-markers-geojson');
    });
    expect(hasSource).toBe(true);
  });

  test('LpgmRelease event populates lpgm-markers features', async ({ page }) => {
    // Wait for station data to load (API resolves within a few seconds)
    await page.waitForFunction(
      () => typeof (window as Record<string, unknown>)['__getStation'] === 'function'
        && (window as Record<string, unknown>)['__getStation'] !== null
        && Object.keys(((window as Record<string, unknown>)['__getStation'] as () => Record<string, unknown> | null)() ?? {}).length > 0,
      { timeout: 10_000 },
    );

    // Inject a fake station entry into the live station object so the handler resolves coords
    await page.evaluate(() => {
      const getStation = (window as Record<string, unknown>)['__getStation'] as () => Record<string, unknown> | null;
      const station = getStation();
      if (station) {
        station['TEST_LPGM'] = { info: [{ code: 711, lon: 120.58, lat: 23.48 }] };
      }
      const emitEvents = (window as Record<string, unknown>)['__events'] as {
        emit: (name: string, payload: unknown) => void;
      };
      emitEvents.emit('LpgmRelease', {
        info: { type: 0 },
        data: { id: Date.now(), list: [{ id: 'TEST_LPGM', lpgm: 3 }] },
      });
    });

    await page.waitForTimeout(400);

    const featureCount = await page.evaluate(async () => {
      const map = (window as Record<string, unknown>)['__map'] as {
        getSource: (id: string) => { getData: () => Promise<{ features?: unknown[] }> };
      };
      const data = await map.getSource('lpgm-markers-geojson').getData();
      return (data.features ?? []).length;
    });
    expect(featureCount).toBeGreaterThan(0);
  });

  test('LpgmRelease changes town fill-color paint property', async ({ page }) => {
    await page.waitForFunction(
      () => typeof (window as Record<string, unknown>)['__getStation'] === 'function'
        && Object.keys(((window as Record<string, unknown>)['__getStation'] as () => Record<string, unknown> | null)() ?? {}).length > 0,
      { timeout: 10_000 },
    );

    const paintBefore = await page.evaluate(() => {
      const map = (window as Record<string, unknown>)['__map'] as {
        getPaintProperty: (layer: string, prop: string) => unknown;
      };
      return JSON.stringify(map.getPaintProperty('town', 'fill-color'));
    });

    await page.evaluate(() => {
      const getStation = (window as Record<string, unknown>)['__getStation'] as () => Record<string, unknown> | null;
      const station = getStation();
      if (station) {
        station['TEST_LPGM2'] = { info: [{ code: 711, lon: 120.58, lat: 23.48 }] };
      }
      const emitEvents = (window as Record<string, unknown>)['__events'] as {
        emit: (name: string, payload: unknown) => void;
      };
      emitEvents.emit('LpgmRelease', {
        info: { type: 0 },
        data: { id: Date.now(), list: [{ id: 'TEST_LPGM2', lpgm: 2 }] },
      });
    });

    await page.waitForTimeout(400);

    const paintAfter = await page.evaluate(() => {
      const map = (window as Record<string, unknown>)['__map'] as {
        getPaintProperty: (layer: string, prop: string) => unknown;
      };
      return JSON.stringify(map.getPaintProperty('town', 'fill-color'));
    });

    expect(paintAfter).not.toBe(paintBefore);
    expect(paintAfter).toContain('match');
  });
});

// ─── Sound Effects Settings UI ────────────────────────────────────────────────

test.describe('Sound Effects Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForEvents(page);
    // Open settings panel
    await page.locator('.nav-bar-setting').click();
    await expect(page.locator('.settings-panel')).not.toHaveClass(/hidden/);
  });

  const SFX_IDS = [
    's-sfx-eew', 's-sfx-eew2', 's-sfx-update', 's-sfx-report',
    's-sfx-palert', 's-sfx-pga1', 's-sfx-pga2',
    's-sfx-shindo0', 's-sfx-shindo1', 's-sfx-shindo2',
  ];

  test('all 10 sound-effect checkboxes are present', async ({ page }) => {
    for (const id of SFX_IDS) {
      await expect(page.locator(`#${id}`), `missing checkbox: ${id}`).toBeAttached();
    }
  });

  test('sound-effect checkboxes are checked by default', async ({ page }) => {
    for (const id of SFX_IDS) {
      await expect(page.locator(`#${id}`), `unchecked by default: ${id}`).toBeChecked();
    }
  });

  test('unchecking Report sfx persists to config', async ({ page }) => {
    const checkbox = page.locator('#s-sfx-report');
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();

    // Close and reopen panel to verify persistence
    await page.locator('.settings-close-btn').click();
    await page.locator('.nav-bar-setting').click();

    await expect(page.locator('#s-sfx-report')).not.toBeChecked();
  });

  test('re-checking Report sfx persists to config', async ({ page }) => {
    // First uncheck
    await page.locator('#s-sfx-report').uncheck();
    await page.locator('.settings-close-btn').click();

    // Reopen and re-check
    await page.locator('.nav-bar-setting').click();
    await page.locator('#s-sfx-report').check();
    await page.locator('.settings-close-btn').click();

    // Reopen and verify restored
    await page.locator('.nav-bar-setting').click();
    await expect(page.locator('#s-sfx-report')).toBeChecked();
  });
});

// ─── Geolocation ─────────────────────────────────────────────────────────────

test.describe('Geolocation', () => {
  // Grant geolocation permission and set a mock position (central Taipei)
  test.use({
    geolocation: { latitude: 25.0330, longitude: 121.5654 },
    permissions: ['geolocation'],
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMap(page);
    await page.waitForTimeout(2_000);
  });

  test('user-location source exists on map', async ({ page }) => {
    const hasSource = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>)['__map'] as {
        getSource: (id: string) => unknown;
      };
      return !!map.getSource('user-location');
    });
    expect(hasSource).toBe(true);
  });

  test('user-location receives a feature after geolocation fires', async ({ page }) => {
    // Wait for watchPosition to have fired (exposed via __getLastPosition)
    await page.waitForFunction(
      () => (window as Record<string, unknown>)['__getLastPosition'] !== undefined
        && ((window as Record<string, unknown>)['__getLastPosition'] as () => unknown | null)() !== null,
      { timeout: 8_000 },
    );

    const featureCount = await page.evaluate(async () => {
      const map = (window as Record<string, unknown>)['__map'] as {
        getSource: (id: string) => { getData: () => Promise<{ features?: unknown[] }> };
      };
      const data = await map.getSource('user-location').getData();
      return (data.features ?? []).length;
    });
    expect(featureCount).toBe(1);
  });

  test('user-location feature has correct coordinates', async ({ page }) => {
    await page.waitForFunction(
      () => (window as Record<string, unknown>)['__getLastPosition'] !== undefined
        && ((window as Record<string, unknown>)['__getLastPosition'] as () => unknown | null)() !== null,
      { timeout: 8_000 },
    );

    const coords = await page.evaluate(async () => {
      const map = (window as Record<string, unknown>)['__map'] as {
        getSource: (id: string) => {
          getData: () => Promise<{ features?: Array<{ geometry: { coordinates: number[] } }> }>;
        };
      };
      const data = await map.getSource('user-location').getData();
      return data.features?.[0]?.geometry.coordinates;
    });
    expect(coords).toBeDefined();
    expect(coords![0]).toBeCloseTo(121.5654, 2);
    expect(coords![1]).toBeCloseTo(25.0330, 2);
  });

  test('focus button flies map to user location', async ({ page }) => {
    const focusBtn = page.locator('#focus');
    await expect(focusBtn).toBeVisible();

    const centerBefore = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>)['__map'] as {
        getCenter: () => { lng: number; lat: number };
      };
      return map.getCenter();
    });

    await focusBtn.click();
    // Allow flyTo animation to start
    await page.waitForTimeout(1_000);

    const centerAfter = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>)['__map'] as {
        getCenter: () => { lng: number; lat: number };
      };
      return map.getCenter();
    });

    // Map center should have moved toward Taipei
    expect(centerAfter.lat).toBeCloseTo(25.0330, 0);
    expect(centerAfter.lng).toBeCloseTo(121.5654, 0);
  });
});
