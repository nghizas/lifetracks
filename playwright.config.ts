import { defineConfig, devices } from "@playwright/test";

// Phase 1 acceptance test runs at a 390px-wide touch viewport (iPhone 14-ish).
// We start the Vite dev server automatically.

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 2 : 0,
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      // Chromium with a 390px touch viewport. This is the fastest CI-friendly
      // setup; for true Mobile Safari fidelity, install webkit and switch this
      // to devices["iPhone 14"]:
      //   npx playwright install webkit
      name: "mobile-chromium-390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
