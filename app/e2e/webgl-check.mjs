// v31 WebGL 수호신 검증 — ①WebGL 경로 활성 ②실제 픽셀 그려짐 ③강제 폴백(Canvas2D) ④판결 반응 무오류
// 실행: preview 기동 후 node e2e/webgl-check.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";
const R = []; const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
const CALL1 = JSON.stringify({ category: "C", direction: "GO", verdict: "가. 망설이지 마.", against: 2, total: 6 });
const CALL2 = JSON.stringify({ subline: "이미 답을 알잖아.", reasons: [{ axis: "사주", vote: "GO", text: "목기가 뻗어." }], funLine: "가자.", disclaimer: "" });

async function onboard(page) {
  await page.goto(BASE); await page.waitForTimeout(800);
  await page.getByRole("button", { name: "조각을 모으러 갈래" }).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "이름 없이 갈래" }).click();
  const ins = page.locator("input.in:not(.wide)");
  await ins.nth(0).fill("1990"); await ins.nth(1).fill("2"); await ins.nth(2).fill("25");
  await page.getByRole("button", { name: "이 하늘이야" }).click();
  const tins = page.locator("input.in:not(.wide)");
  await tins.nth(0).fill("14"); await tins.nth(1).fill("30");
  await page.getByRole("button", { name: "기억났어" }).click();
  await page.getByRole("button", { name: "하늘을 열기" }).click();
  await page.getByRole("button", { name: "응, 기억나" }).click({ timeout: 15000 });
  await page.waitForSelector("text=요즘의 너는", { timeout: 10000 });
  for (const t of ["혼자일 때 차오르는 쪽", "아직 오지 않은 것을 보는 쪽", "마음이 먼저 움직이는 쪽", "열어둔 길이 편한 쪽"]) await page.getByRole("button", { name: t }).click();
  await page.getByRole("button", { name: "마음의 방으로" }).click(); await page.waitForTimeout(400);
  for (const v of ["안정", "성장", "자유", "인정", "관계", "성취"]) await page.getByRole("button", { name: v, exact: true }).click();
  await page.getByRole("button", { name: "여섯 개 골랐어" }).click(); await page.waitForTimeout(200);
  for (const v of ["안정", "성장", "자유"]) await page.getByRole("button", { name: v, exact: true }).click();
  await page.getByRole("button", { name: "셋을 남겼어" }).click(); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "안정", exact: true }).click();
  await page.getByRole("button", { name: "수호신 깨우기" }).click();
  await page.waitForSelector("text=두 번 두드리면", { timeout: 12000 });        // v52: 로비
  await page.locator("canvas").first().dblclick();                              // 두 번 두드려 깨움
  await page.waitForSelector("textarea.qbox", { timeout: 12000 });
}
const brightness = (page) => page.evaluate(() => {
  const c = document.querySelector("canvas[data-renderer]"); if (!c) return -1;
  const d = document.createElement("canvas"); d.width = c.width; d.height = c.height;
  const x = d.getContext("2d"); x.drawImage(c, 0, 0);
  const im = x.getImageData(0, 0, d.width, d.height).data;
  let s = 0; for (let i = 0; i < im.length; i += 4) s += im[i] + im[i + 1] + im[i + 2];
  return s / (im.length / 4);
});

const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

// ── ① WebGL 경로 + 픽셀 + 판결 반응 ──
{
  const page = await b.newPage({ viewport: { width: 430, height: 932 } });
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(({ c1, c2 }) => { window.claude = { complete: async (p) => (p.includes("결론만") ? c1 : c2) }; }, { c1: CALL1, c2: CALL2 });
  await onboard(page);
  await page.waitForTimeout(2200); // 어셈블 진행
  const renderer = await page.evaluate(() => document.querySelector("canvas[data-renderer]")?.getAttribute("data-renderer"));
  ck("① 렌더러 = webgl", renderer === "webgl", "renderer=" + renderer);
  const lum1 = await brightness(page);
  ck("① 입자 실제 렌더(평균 밝기 > 1)", lum1 > 1, "avg=" + lum1.toFixed(2));
  await page.locator("textarea.qbox").fill("이 길로 가도 될까?"); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "가볍게 물을래" }).click();
  let ok = false;
  for (let i = 0; i < 40; i++) { if (((await page.locator(".vv").allTextContents())[0] || "").includes("망설이지 마")) { ok = true; break; } await page.waitForTimeout(300); }
  ck("① WebGL 하에서 판결 L1 렌더", ok);
  await page.waitForTimeout(2000);
  ck("① 카드 정독(rest) 경로 무오류", errs.length === 0, errs.slice(0, 2).join(" | "));
  await page.close();
}

// ── ② 강제 폴백: WebGL 봉쇄 → Canvas2D로 자동 전환 ──
{
  const page = await b.newPage({ viewport: { width: 430, height: 932 } });
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...a) {
      if (t === "webgl" || t === "webgl2" || t === "experimental-webgl") return null;
      return orig.call(this, t, ...a);
    };
  });
  await onboard(page);
  await page.waitForTimeout(1500);
  const renderer = await page.evaluate(() => document.querySelector("canvas[data-renderer]")?.getAttribute("data-renderer"));
  ck("② WebGL 봉쇄 시 renderer = 2d(폴백)", renderer === "2d", "renderer=" + renderer);
  const lum2 = await brightness(page);
  ck("② 폴백 캔버스도 렌더", lum2 > 0.5, "avg=" + lum2.toFixed(2));
  ck("② 폴백 경로 무오류", errs.length === 0, errs.slice(0, 2).join(" | "));
  await page.close();
}

console.log(`\n=== WebGL 체크: ${R.filter(Boolean).length}/${R.length} PASS ===`);
await b.close();
process.exit(R.every(Boolean) ? 0 : 1);
