import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.MOBILE_E2E_BASE_URL ?? "http://localhost:8082",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "tablet",
      use: { viewport: { width: 1024, height: 900 }, colorScheme: "dark" },
    },
  ],
  reporter: "list",
});
