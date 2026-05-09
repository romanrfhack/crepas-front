import { defineConfig, devices } from '@playwright/test';

const nodeExecutable = JSON.stringify(process.execPath);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4300',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `${nodeExecutable} ./node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 --port 4300`,
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
