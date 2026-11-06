import { defineConfig } from "vitest/config";

// merged coverage over the whole workspace (vitest.workspace.ts); per project reports come from each project's config
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
      exclude: [
        "**/*.{test,stories}.{ts,tsx}",
        "apps/frontend/src/test/**",
        "apps/frontend/src/main.tsx",
        "apps/backend/src/database/**",
        "**/index.ts",
        "**/*.d.ts",
      ],
      reporter: ["text-summary", "html", "lcov", "json-summary"],
      // written even when a test fails; the run still exits with an error
      reportOnFailure: true,
    },
  },
});
