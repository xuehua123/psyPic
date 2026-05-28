import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PSYPIC_E2E_PORT ?? 3200);
const baseURL = `http://127.0.0.1:${port}`;
const browserChannel = process.env.PSYPIC_E2E_BROWSER_CHANNEL?.trim();
const channelConfig = browserChannel ? { channel: browserChannel } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  globalSetup: "./tests/e2e/global-setup.ts",
  outputDir: "./output/playwright/test-results",
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 180_000,
  workers: 1,
  expect: {
    timeout: 60_000
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: `node ./node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p ${port}`,
    env: {
      ASSET_STORAGE_DRIVER: "local",
      KEY_ENCRYPTION_SECRET: "psypic-e2e-key-encryption-secret",
      PSYPIC_E2E_TOKEN: "e2e",
      SESSION_SECRET: "psypic-e2e-session-secret",
      SUB2API_TIMEOUT_MS: "30000",
      WATCHPACK_POLLING: "true"
    },
    reuseExistingServer: false,
    timeout: 300_000,
    url: `${baseURL}/api/health`
  },
  projects: [
    {
      name: "desktop-chromium",
      testMatch: /.*(\.desktop|workbench-.*)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...channelConfig,
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "mobile-chromium",
      testMatch: /.*(\.mobile|workbench-.*)\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        ...channelConfig
      }
    }
  ]
});
