import { defineConfig } from '@playwright/test';

process.env.UI_BASE_URL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests',
  testMatch: [
    'map.spec.ts',
    'map-worker.spec.ts',
    'map-availability.spec.ts',
    'map-sovereignty-policy.spec.ts',
    'map-presentation.spec.ts',
    'theme-default.spec.ts',
    'admin-geodata.spec.ts',
    'sos-creation.spec.ts',
    'confirm-safe.spec.ts',
    'volunteer-flow.spec.ts',
    'sponsor-flow.spec.ts',
    'comment-moderation.spec.ts',
    'map-social-report.spec.ts',
    'chat-panel-*.spec.ts',
  ],
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    // Keep the mocked suite independent of production API and storage settings.
    env: {
      VITE_API_URL: 'http://127.0.0.1:5164/api',
      VITE_BASEMAP_TILE_URL: '',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
    command: 'pnpm --dir client build && pnpm --dir client preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
