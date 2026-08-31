// v31 WebGL 수호신 검증 — ①WebGL 경로 활성 ②실제 픽셀 그려짐 ③강제 폴백(Canvas2D) ④판결 반응 무오류
// 실행: preview 기동 후 node e2e/webgl-check.mjs
import { createRequire } from "node:module";
import { throwCoins } from "./ritual.mjs";   // v140: 의식이 켜져 있으면 여섯 번 던져 통과
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";
const R = []; const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
const CALL1 = JSON.stringify({ category: "C", votes: [{ axis: "사주", v: "GO" }, { axis: "달", v: "GO" }, { axis: "별자리", v: "STOP" }], direction: "GO", verdict: "가. 망설이지 마.", against: 2, total: 6 });
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
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "하늘을 열기" }).click();
  await page.getByRole("button", { name: "응, 기억나" }).click({ timeout: 15000 });
  await page.waitForSelector("text=두드려봐", { timeout: 12000 });        // v52: 로비
  await page.locator("canvas").first().dblclick();                              // 두드려봐 깨움
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

/* ⚠ **이 검사만 브라우저를 못 찾아 죽고 있었다 (2026-08-31).**
   다른 검사들은 헤드리스 셸로 도는데, 여기는 소프트웨어 GPU 인자(swiftshader)를 쓰느라
   **완전한 크로미움**이 필요하다. 그게 없으면 「npx playwright install 하라」로 끝나는데,
   그 메시지가 **앱 사망과 구분이 안 된다** — 실제로 이 검사가 죽어 있는 동안
   첫 방문자가 빈 화면을 보는 결함이 통과됐다.
   그래서 후보를 차례로 시도하고, **전부 실패하면 조용히 통과하지 말고 그 사실을 말하고 죽는다.** */
const GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const b = await (async () => {
  const tries = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium", null];
  let last;
  for (const ep of tries) {
    if (ep === undefined) continue;
    try { return await chromium.launch({ ...(ep ? { executablePath: ep } : {}), args: GL_ARGS }); }
    catch (e) { last = e; }
  }
  console.log("FAIL — 브라우저를 못 찾아 이 검사가 아예 못 돌았다(통과가 아니다). CHROME_PATH 를 주거나 완전한 크로미움을 설치해라.");
  console.log(String(last && last.message).split("\n")[0]);
  process.exit(1);
})();

/* ── ⓪ **첫 방문자가 화면을 본다** (2026-08-31 신설) ────────────────────────────
   ⚠ 이 검사가 없어서 **앱이 통째로 안 뜨는 결함이 라이브로 나갔다.**
   홀로가 기본이 되면서 온보딩 0·1단계가 수호신을 **명식 없이** 세우는데, WebGL 이 없거나
   셰이더가 실패해 입자 렌더러로 떨어지면 그쪽이 `saju.main` 을 무방비로 읽어 터졌다.
   에러 경계가 0개라 React 가 트리를 통째로 언마운트했고, 배경이 `#0a0812` 단색이라
   **고장이 아니라 로딩 중처럼 보였다.** 실측: root 0자·버튼 0개.
   ⚠ **값이 아니라 성질을 묻는다** — 「첫 방문자가 누를 것을 보는가」. 렌더러가 무엇이든,
     앞으로 기본값을 또 뒤집든, 이 질문은 그대로 유효하다. */
{
  const BLOCK = `HTMLCanvasElement.prototype.getContext = (function(o){ return function(t, ...r){
    if (String(t).indexOf("webgl") === 0 || String(t) === "experimental-webgl") return null;
    return o.call(this, t, ...r); }; })(HTMLCanvasElement.prototype.getContext);`;
  for (const [tag, qs, block] of [
    ["기본", "/", false], ["기본 · WebGL 없음", "/", true], ["보관한 옛 판 · WebGL 없음", "/?skin=dark", true],
  ]) {
    const page = await b.newPage({ viewport: { width: 430, height: 932 } });
    const errs = []; page.on("pageerror", (e) => errs.push(e.message));
    if (block) await page.addInitScript(BLOCK);
    await page.goto(BASE + qs, { waitUntil: "load" });
    await page.waitForTimeout(3200);
    const root = await page.evaluate(() => (document.getElementById("root") || {}).innerHTML?.length || 0);
    const btns = await page.locator("button").count();
    ck(`⓪ ${tag} — 첫 방문자가 화면을 본다`, root > 1000 && btns >= 1, `root ${root}자 · 버튼 ${btns}개`);
    ck(`⓪ ${tag} — 오류 없이 뜬다`, errs.length === 0, errs.slice(0, 1).join(""));
    await page.close();
  }
}

// ── ① WebGL 경로 + 픽셀 + 판결 반응 ──
{
  const page = await b.newPage({ viewport: { width: 430, height: 932 } });
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(({ c1, c2 }) => { window.claude = { complete: async (p) => (p.includes("[이미 확정된 판결]") ? c2 : c1) }; }, { c1: CALL1, c2: CALL2 });
  await onboard(page);
  await page.waitForTimeout(2200); // 어셈블 진행
  const renderer = await page.evaluate(() => document.querySelector("canvas[data-renderer]")?.getAttribute("data-renderer"));
  /* ⚠ **전제가 낡았다 (2026-08-31).** 2026-08-31 에 기본 스킨이 홀로로 뒤집혔다 —
     인자 없이 열면 이제 색장(field)이 선다. 검출은 정확했고 틀린 건 검사의 전제였다.
     그래서 **둘로 가른다**: 기본은 field 여야 하고, 보관해 둔 옛 판(?skin=dark)은 입자여야 한다.
     ⚠ 「기본이 홀로인가」를 묻는 검사가 리포 전체에 0개였다 — 그걸 여기서 만든다. */
  ck("① 기본으로 열면 색장이 선다(홀로가 기본)", renderer === "field", "renderer=" + renderer);
  const lum1 = await brightness(page);
  ck("① 입자 실제 렌더(평균 밝기 > 1)", lum1 > 1, "avg=" + lum1.toFixed(2));
  await page.locator("textarea.qbox").fill("이 길로 가도 될까?"); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "판결을 청한다" }).click();
  await throwCoins(page);
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
