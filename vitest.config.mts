import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "server-only": "/test/server-only.ts",
    },
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: false,
  },
});
