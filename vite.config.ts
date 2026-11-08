import { defineConfig } from "vite";
import { sluTuning } from "@slu/web-shell/look/vite";

export default defineConfig({ plugins: [sluTuning()] });
