import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  /* three-proto.html — three.js 수호신 시험판(2026-10-01). 앱 번들과 따로 묶인다:
     앱 첫 화면은 three 를 한 바이트도 안 받는다. */
  build: { rollupOptions: { input: {
    main: resolve(__dirname, "index.html"),
    proto: resolve(__dirname, "three-proto.html"),
  } } },
});
