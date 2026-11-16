import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  // Inline so Vite never picks up a postcss.config from a parent folder
  css: {
    postcss: {},
  },
  server: {
    port: 3001,
  },
  build: {
    outDir: "build", // match CRA output directory
  },
});
