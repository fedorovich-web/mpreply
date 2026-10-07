import { defineConfig } from "@playwright/test";

import baseConfig from "./playwright.config";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  ...baseConfig,
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}",
  updateSnapshots: "none",
  webServer: {
    command: "npm run start",
    env: {
      HOSTNAME: "0.0.0.0",
      PORT: new URL(baseURL).port || "3000",
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
