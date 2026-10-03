import { rmSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Every run starts from an empty database. Workers load this file again, so the
// folder is chosen once (in the main process) and handed down through the environment.
if (!process.env.E2E_DATA_DIR) {
  rmSync('.e2e-data', { recursive: true, force: true });
  process.env.E2E_DATA_DIR = `.e2e-data/${Date.now()}`;
}
const dataDir = process.env.E2E_DATA_DIR;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }, grepInvert: /@telemovel/ },
    { name: 'telemovel', use: { ...devices['Pixel 7'] }, grep: /@telemovel/ },
  ],
  // The production build (with its Content-Security-Policy) behind vite preview, which proxies /api to the API.
  webServer: [
    {
      command: 'npx tsx server/src/index.ts',
      url: 'http://127.0.0.1:3001/api/health',
      env: { PGLITE_DIR: dataDir, PORT: '3001', APP_URL: 'http://localhost:4173', ALLOWED_ORIGINS: 'http://localhost:4173' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
