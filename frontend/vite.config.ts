import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (mode === "production" && env.VITE_USE_FIXTURES === "true")
    throw new Error("Production fixture mode is forbidden");
  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("/maplibre-gl/")) return "map-engine";
            if (id.includes("@js-temporal") || id.includes("jsbi"))
              return "temporal";
            if (id.includes("/zod/")) return "validation";
            if (id.includes("node_modules")) return "vendor";
          },
        },
      },
    },
    plugins: [react()],
    server: {
      proxy: {
        "/api": { target: "http://127.0.0.1:8000", changeOrigin: false },
      },
    },
    test: {
      environment: "jsdom",
      testTimeout: 10000,
      setupFiles: ["src/test/setup.ts"],
      restoreMocks: true,
    },
  };
});
