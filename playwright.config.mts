import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "test-results/browser",
  timeout: 300_000,
  expect: {
    timeout: 12_000
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report", open: "never" }]
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    headless: true,
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      args: [
        "--use-angle=swiftshader",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--disable-dev-shm-usage"
      ]
    }
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI
  }
});
