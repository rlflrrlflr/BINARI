/* 3D 판(`/?r=3d`, 짧은 주소 /3d) 검사 — **배포판 보안 규칙(vercel.json 헤더)을 씌워서** 연다.
 * ⚠ 왜 헤더를 씌우나(2026-10-01): 첫 시험판이 로컬에선 멀쩡했는데 배포판에선 CSP 가 eval 을 막아
 *    화면이 통째로 죽었다(창업자 실기 "아무것도 안나오고 곁도 안눌러져"). 로컬 미리보기엔 CSP 가 없다.
 * 무는 것: ①오류 없음 ②경악 두 박자(뜨악 → 어이없음) ③무거운 말엔 안 놀람 ④곁 공간 층이 실제로 돈다
 *          ⑤**기본 주소는 반응이 아예 없다**(앱 주소 구분 — 창업자 지시) ⑥기본 번들엔 three 가 없다
 * 실행: npx vite build && npx vite preview --port 4173 & → node e2e/r3d-check.mjs */
import { chromium } from "playwright";
import { readFileSync, readdirSync } from "node:fs";
import { onboard } from "./onboard.mjs";
const BASE = `http://localhost:${process.env.PORT || 4173}/`;
const V = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const H = Object.fromEntries(V.headers[0].headers.map((h) => [h.key.toLowerCase(), h.value]));
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
let pass = 0, n = 0; const ck = (t, ok, d = "") => { n++; if (ok) pass++; console.log((ok ? "PASS" : "FAIL") + " — " + t + (d ? " · " + d : "")); };
const open = async (qs) => {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && /unsafe-eval|script-src|\[3D\]/.test(m.text())) errs.push(m.text()); });
  await p.route("**/*", async (r) => { const res = await r.fetch(); r.fulfill({ response: res, headers: { ...res.headers(), ...H } }); });
  await onboard(p, BASE, qs);
  return { p, errs };
};
const fx = (p) => p.evaluate(() => window.__BINARI_FX || null);

{ const { p, errs } = await open("?r=3d");
  const q = p.locator("textarea.qbox");
  await q.click(); await q.pressSequentially("외계인이 나를", { delay: 40 }); await p.waitForTimeout(250);
  const a = await fx(p);
  ck("② 엉뚱한 말 → 뜨악(큰 눈)", a && a.kind === "shock" && a.eye === "wide", JSON.stringify(a));
  await p.waitForTimeout(1800);
  const b2 = await fx(p);
  ck("② 1초 뒤 → 어이없음(콩알 눈)", b2 && b2.kind === "shock" && b2.eye === "dot", JSON.stringify(b2));
  await q.fill(""); await q.pressSequentially("요즘 너무 힘들어", { delay: 40 }); await p.waitForTimeout(600);
  const c = await fx(p);
  ck("③ 무거운 말 → 놀라지 않는다", c && c.kind === "heavy" && c.eye !== "wide", JSON.stringify(c));
  await p.getByRole("button", { name: "곁", exact: true }).click(); await p.waitForTimeout(2500);
  ck("④ 곁에서 3D 공간 층이 돈다", await p.evaluate(() => typeof window.__BINARI_G3 === "number"));
  ck("④ 곁 층 캔버스 둘(몸 뒤·앞)이 붙어 있다", (await p.locator("section.gyeot canvas").count()) >= 4);
  ck("① 배포판 보안 규칙 아래 오류 없음", errs.length === 0, errs[0] || "");
  await p.close(); }

{ const { p } = await open("");
  const q = p.locator("textarea.qbox");
  await q.click(); await q.pressSequentially("외계인이 나를", { delay: 40 }); await p.waitForTimeout(400);
  ck("⑤ 기본 주소는 타이핑 반응이 없다(앱 그대로)", (await fx(p)) === null);
  await p.close(); }

const assets = readdirSync(new URL("../dist/assets/", import.meta.url));
const idx = assets.filter((f) => /^index-.*\.js$/.test(f));
ck("⑥ 기본 번들에 three 가 없다", idx.length > 0 && idx.every((f) => !readFileSync(new URL("../dist/assets/" + f, import.meta.url), "utf8").includes("WebGLRenderer")), idx.join(","));
console.log(`=== 3D 판: ${pass}/${n} PASS ===`);
await b.close(); process.exit(pass === n ? 0 : 1);
