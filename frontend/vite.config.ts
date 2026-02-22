import fbteePreset from "@nkzw/babel-preset-fbtee";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        presets: [fbteePreset],
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  preview: {
    port: 4173,
  },
});
