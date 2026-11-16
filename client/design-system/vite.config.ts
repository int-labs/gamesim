import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Used by Storybook and Vitest. Apps consume the package's sources with their own Vite config.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
