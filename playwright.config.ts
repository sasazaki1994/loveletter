import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 1000 * 60 * 8, // 8 min
  retries: 0,
  reporter: [['list']],
  use: {
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    viewport: { width: 1400, height: 900 },
    baseURL: 'http://localhost:3100',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 1000 * 60 * 2,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});


