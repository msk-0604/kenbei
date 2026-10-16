import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // apps/web の "@/..." を tsconfig と同じく src に向ける
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./apps/web/src/", import.meta.url)) }],
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/mobile/src/**/*.test.ts", "apps/web/src/**/*.test.ts"],
    environment: "node",
  },
});
