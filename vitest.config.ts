import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The mobile app pins its own Vitest major; run it with `pnpm --filter @testownik/mobile test`.
    projects: ["apps/web", "packages/*"],
  },
});
