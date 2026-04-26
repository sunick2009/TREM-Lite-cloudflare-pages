/**
 * E2E Tests — Station Hover Tooltip
 *
 * Verifies that hovering over a station dot on the map shows a popup
 * with station name, intensity, and PGA data.
 *
 * Strategy: inject a known test feature into the rts-layer GeoJSON source,
 * project its coordinates to screen pixels via window.__map, then hover
 * the mouse at that pixel position and assert the popup DOM.
 */

import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Wait for the MapLibre map to initialise and be accessible via window.__map */
async function waitForMap(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as unknown as Record<string, unknown>)['__map'],
    { timeout: 15_000 },
  );
}

/** Coordinates of a test station in central Taipei */
const TEST_STATION = {
  lon: 121.5654,
  lat: 25.033,
  name: '台北市中正區',
  pga: 12.34,
  iFloat: 3.2,
  i: 3,
};

/**
 * Inject a single feature into the rts-layer source and return the
 * screen pixel coordinates of that feature (relative to the page).
 */
async function injectStationAndGetPixel(
  page: Page,
  station: typeof TEST_STATION,
): Promise<{ x: number; y: number }> {
  return page.evaluate((s) => {
    const map = (window as unknown as Record<string, unknown>)['__map'] as {
      getSource: (id: string) => { setData: (data: unknown) => void };
      project: (lngLat: [number, number]) => { x: number; y: number };
    };
    map.getSource('rts').setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
          properties: { i: s.i, name: s.name, pga: s.pga, iFloat: s.iFloat },
        },
      ],
    });
    const pt = map.project([s.lon, s.lat]);
    return { x: Math.round(pt.x), y: Math.round(pt.y) };
  }, station);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Station Tooltip', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForMap(page);
    // Allow one RTS poll cycle to complete so layers exist
    await page.waitForTimeout(2_000);
  });

  test('popup appears when hovering over a station dot', async ({ page }) => {
    const coords = await injectStationAndGetPixel(page, TEST_STATION);
    // Wait a frame for the map to render the injected feature
    await page.waitForTimeout(300);

    await page.mouse.move(coords.x, coords.y);

    const popup = page.locator('.station-popup-wrap');
    await expect(popup).toBeVisible({ timeout: 3_000 });
  });

  test('popup shows station name', async ({ page }) => {
    const coords = await injectStationAndGetPixel(page, TEST_STATION);
    await page.waitForTimeout(300);
    await page.mouse.move(coords.x, coords.y);

    await expect(page.locator('.sp-name')).toHaveText(TEST_STATION.name, { timeout: 3_000 });
  });

  test('popup shows PGA in gal', async ({ page }) => {
    const coords = await injectStationAndGetPixel(page, TEST_STATION);
    await page.waitForTimeout(300);
    await page.mouse.move(coords.x, coords.y);

    const pgaEl = page.locator('.sp-pga');
    await expect(pgaEl).toBeVisible({ timeout: 3_000 });
    await expect(pgaEl).toContainText('gal');
    await expect(pgaEl).toContainText('12.34');
  });

  test('popup shows intensity value and correct CSS class', async ({ page }) => {
    const coords = await injectStationAndGetPixel(page, TEST_STATION);
    await page.waitForTimeout(300);
    await page.mouse.move(coords.x, coords.y);

    const intensityEl = page.locator('.sp-intensity');
    await expect(intensityEl).toBeVisible({ timeout: 3_000 });
    // iFloat 3.2 → intensity_float_to_int → 3 → intensity-3 class
    await expect(intensityEl).toHaveClass(/intensity-3/);
    await expect(intensityEl).toContainText('3.2');
  });

  test('popup disappears when mouse moves away', async ({ page }) => {
    const coords = await injectStationAndGetPixel(page, TEST_STATION);
    await page.waitForTimeout(300);
    await page.mouse.move(coords.x, coords.y);

    const popup = page.locator('.station-popup-wrap');
    await expect(popup).toBeVisible({ timeout: 3_000 });

    // Move mouse to top-left corner (away from any station)
    await page.mouse.move(10, 10);
    await expect(popup).not.toBeVisible({ timeout: 3_000 });
  });

  test('cursor changes to pointer on station hover', async ({ page }) => {
    const coords = await injectStationAndGetPixel(page, TEST_STATION);
    await page.waitForTimeout(300);
    await page.mouse.move(coords.x, coords.y);

    // Wait for popup to confirm hover is active
    await expect(page.locator('.station-popup-wrap')).toBeVisible({ timeout: 3_000 });

    const cursor = await page.evaluate(
      () => document.querySelector('#map canvas')?.style.cursor ?? '',
    );
    expect(cursor).toBe('pointer');
  });

  test('popup content updates when hovering a different station', async ({ page }) => {
    const station1 = { ...TEST_STATION, name: '台北市中正區', pga: 12.34, iFloat: 3.2, i: 3 };
    const station2 = { lon: 121.0, lat: 24.1, name: '台中市中區', pga: 55.0, iFloat: 5.5, i: 5 };

    // Inject two stations
    await page.evaluate(
      ([s1, s2]) => {
        const map = (window as unknown as Record<string, unknown>)['__map'] as {
          getSource: (id: string) => { setData: (data: unknown) => void };
        };
        map.getSource('rts').setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [s1.lon, s1.lat] },
              properties: { i: s1.i, name: s1.name, pga: s1.pga, iFloat: s1.iFloat },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [s2.lon, s2.lat] },
              properties: { i: s2.i, name: s2.name, pga: s2.pga, iFloat: s2.iFloat },
            },
          ],
        });
      },
      [station1, station2] as const,
    );
    await page.waitForTimeout(300);

    // Hover station 1
    const pt1 = await page.evaluate((s) => {
      const map = (window as unknown as Record<string, unknown>)['__map'] as {
        project: (lngLat: [number, number]) => { x: number; y: number };
      };
      const p = map.project([s.lon, s.lat]);
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }, station1);
    await page.mouse.move(pt1.x, pt1.y);
    await expect(page.locator('.sp-name')).toHaveText(station1.name, { timeout: 3_000 });

    // Hover station 2
    const pt2 = await page.evaluate((s) => {
      const map = (window as unknown as Record<string, unknown>)['__map'] as {
        project: (lngLat: [number, number]) => { x: number; y: number };
      };
      const p = map.project([s.lon, s.lat]);
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }, station2);
    await page.mouse.move(pt2.x, pt2.y);
    await expect(page.locator('.sp-name')).toHaveText(station2.name, { timeout: 3_000 });
  });
});
