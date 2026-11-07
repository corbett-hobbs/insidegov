import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // `@/` as in tsconfig, so a test can load a module that imports with it (the news tests read the pages' real chart ids).
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "pipeline/**/*.test.ts"],
  },
});
