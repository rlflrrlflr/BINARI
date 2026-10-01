import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { sliceConst } from "./tools/lib/extract.mjs";

/* 3D 시험판이 앱의 색장 셰이더·팔레트를 **빌드 때** 뽑아 가는 가상 모듈.
   ⚠ 브라우저에서 new Function 으로 뽑았더니 배포판에서 화면이 통째로 죽었다(2026-10-01 창업자 실기:
   "아무것도 안나오고 곁도 안눌러져") — 배포 CSP 가 eval 을 막는다(script-src 'self', unsafe-eval 없음).
   그래서 평가는 여기 Node 쪽에서 끝내고 브라우저엔 값만 보낸다. 셰이더는 여전히 App.jsx 한 벌이다. */
function appField() {
  const ID = "virtual:app-field", RID = "\0" + ID, SRC = resolve(__dirname, "src/App.jsx");
  return {
    name: "app-field",
    resolveId: (id) => (id === ID ? RID : null),
    load(id) {
      if (id !== RID) return null;
      this.addWatchFile(SRC);
      const src = readFileSync(SRC, "utf8");
      const EL_COLOR = new Function("return " + src.match(/const EL_COLOR = (\{[\s\S]*?\});/)[1])();
      const holoPal = new Function("EL_COLOR",
        src.slice(src.indexOf("const HOLO_FIX"), src.indexOf("const HOLO_BG")) + "\nreturn holoPal;")(EL_COLOR);
      const PAL = Object.fromEntries(Object.keys(EL_COLOR).map((k) => [k, holoPal(k)]));
      const out = { FIELD_FRAG: sliceConst(src, "FIELD_FRAG"), FIELD_VERT: sliceConst(src, "FIELD_VERT"), EL_COLOR, PAL };
      return Object.entries(out).map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};`).join("\n");
    },
  };
}

export default defineConfig({
  plugins: [react(), appField()],
  /* three-proto.html — three.js 수호신 시험판(2026-10-01). 앱 번들과 따로 묶인다:
     앱 첫 화면은 three 를 한 바이트도 안 받는다. */
  build: { rollupOptions: { input: {
    main: resolve(__dirname, "index.html"),
    proto: resolve(__dirname, "three-proto.html"),
  } } },
});
