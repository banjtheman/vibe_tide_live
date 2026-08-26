import { cloudflare } from "@cloudflare/vite-plugin";
import { sites } from "@openai/sites-vite-plugin";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    sites(),
    ...(mode === "test"
      ? []
      : cloudflare({
          viteEnvironment: { name: "server" },
          config: {
            name: "vibetide-live",
            main: "server/index.js",
            compatibility_date: "2026-08-26",
            assets: {
              binding: "ASSETS",
              not_found_handling: "single-page-application",
            },
          },
        })),
  ],
  server: {
    host: "0.0.0.0",
    port: 4173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
}));
