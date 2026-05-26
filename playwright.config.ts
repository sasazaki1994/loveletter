import { defineConfig, devices } from '@playwright/test';

const useE2EServer = Boolean(process.env.CI || process.env.PLAYWRIGHT_E2E);
const serverPort = useE2EServer ? 3100 : 3000;
const serverUrl = `http://localhost:${serverPort}`;

export default defineConfig({
  testDir: 'tests',
  timeout: 1000 * 60 * 2, // 2 min (fail-fast in CI)
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
  ],
  use: {
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    viewport: { width: 1400, height: 900 },
    baseURL: serverUrl,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: useE2EServer
      ? (process.env.CI ? 'pnpm start --port 3100' : 'pnpm dev --port 3100')
      : 'pnpm dev --port 3000',
    url: serverUrl,
    reuseExistingServer: !process.env.CI && !process.env.PLAYWRIGHT_E2E,
    timeout: 1000 * 60 * 2,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
