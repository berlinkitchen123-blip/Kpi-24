import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

// `--mode preview` builds a single self-contained HTML file running on demo data.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    mode === "preview"
      ? viteSingleFile()
      : VitePWA({
          registerType: "autoUpdate",
          manifest: {
            name: "City P&L Control Center",
            short_name: "City P&L",
            theme_color: "#0f172a",
            background_color: "#f8fafc",
            display: "standalone",
            start_url: "/",
            icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
          },
          workbox: { navigateFallback: "/index.html" },
        }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: { outDir: mode === "preview" ? "dist-preview" : "dist" },
}));
