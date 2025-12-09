import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 1000 * 60 * 8, // 8 min
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
    baseURL: 'http://localhost:3100',
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
    command: process.env.CI ? 'pnpm start --port 3100' : 'pnpm dev --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 1000 * 60 * 2,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});


