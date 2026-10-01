/* 3D 시험판(/three-proto.html)이 **배포판의 보안 규칙 아래에서** 살아 있는가.
   ⚠ 왜 생겼나(2026-10-01): 시험판이 브라우저에서 new Function 으로 앱 셰이더를 뽑았다.
   로컬 미리보기엔 CSP 가 없어 멀쩡했고, 배포판에선 CSP(unsafe-eval 없음)가 막아 화면이 통째로 죽었다
   — 창업자 실기 "아무것도 안나오고 곁도 안눌러져". 그래서 vercel.json 의 헤더를 **그대로** 씌워 연다.
   실행: npx vite build && npx vite preview --port 4173 & → node e2e/proto-check.mjs */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const V = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const H = Object.fromEntries(V.headers[0].headers.map((h) => [h.key.toLowerCase(), h.value]));
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 390, height: 780 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && !/404/.test(m.text()) && errs.push(m.text()));
await p.route("**/*", async (r) => { const res = await r.fetch(); r.fulfill({ response: res, headers: { ...res.headers(), ...H } }); });
await p.goto(`http://localhost:${process.env.PORT || 4173}/three-proto.html`); await p.waitForTimeout(2500);
let pass = 0, n = 0; const ck = (t, ok, d = "") => { n++; if (ok) pass++; console.log((ok ? "PASS" : "FAIL") + " — " + t + (d ? " · " + d : "")); };
ck("① 배포판 CSP 아래에서 오류 없음", errs.length === 0, errs[0] || "");
ck("② 시험판이 살아 있다", await p.evaluate(() => !!window.__PROTO));
await p.click("#tGy"); await p.waitForTimeout(800);
ck("③ 곁 탭이 눌린다", (await p.evaluate(() => window.__PROTO && window.__PROTO.st.tab)) === "gy");
ck("④ 친구가 생긴다", (await p.evaluate(() => window.__PROTO && window.__PROTO.friends.length)) > 0);
console.log(`=== 3D 시험판: ${pass}/${n} PASS ===`);
await b.close(); process.exit(pass === n ? 0 : 1);
