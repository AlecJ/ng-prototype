import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "",
  plugins: [react()],
  worker: {
    format: "es",
  },
  esbuild: {
    target: "es2022",
  },
  build: {
    target: "es2022",
  },
});