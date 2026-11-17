import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'node scripts/serve.mjs',
    port: 5173,
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:5173/' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], hasTouch: true } },
  ],
});
