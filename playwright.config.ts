import { defineConfig, devices } from '@playwright/test';

const useWrangler = process.env['BASE_URL']?.includes('8788');
const baseURL = process.env['BASE_URL'] ?? 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    headless: true,
    ignoreHTTPSErrors: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: useWrangler
    ? {
        // wrangler pages dev — runs Cloudflare Functions + serves dist/
        command: 'npm run pages:dev',
        port: 8788,
        reuseExistingServer: true,
        timeout: 20_000,
      }
    : {
        // vite preview — fast, no Cloudflare Functions
        command: 'npm run preview:web',
        port: 4173,
        reuseExistingServer: true,
        timeout: 15_000,
      },
});
