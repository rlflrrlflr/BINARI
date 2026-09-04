/* 줄 세우기 · 뽑기 (2026-09-01 창업자 결정 — "순위를 만들어보자. 기분이 나쁜지, 그냥
   콘텐츠로 받아들여지는지 테스트해봐야 할 거 같아")

   이 검사가 무는 것은 셋이다:
     ① 순위가 **답 안에서만** 산다 — 명부(gyeotOrder)로는 안 넘어간다
     ② **보통 물음의 순위 금지는 그대로다** — 열린 건 칩을 눌렀을 때뿐
     ③ **재는 장치가 붙어 있다** — 실험인데 계측이 없으면 켜고 끌 근거가 안 남는다 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const RAW = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
/* ⚠ **주석을 걷고 본다.** 「샜는가」류 검사는 코드가 실제로 하는 일을 봐야 하는데, 주석에
   `gyeotOrder` 와 `"rank"` 를 나란히 적기만 해도 걸린다 — 실제로 이 파일이 그렇게 한 번 깨졌다.
   같은 사고를 이 리포가 네 번 겪었고(`same ? 1 : 1`, \bidx\b, 검진 5-g, invite-check),
   gyeot-roster-check 는 이미 같은 방식으로 걷어 낸다. 문구 검사는 원문(RAW)으로 본다. */
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const BASE = process.env.BASE || "http://localhost:4173";
let pass = 0, fail = 0;
const ck = (n, ok, note = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

/* ── ① 명부는 안 건드렸다 ─────────────────────────────────────── */
const ord = (SRC.match(/function gyeotOrder\([\s\S]*?\n\}/) || [""])[0];
ck("① 명부 정렬은 여전히 최근순 하나뿐", /return list\.slice\(\)\.sort\(\(a, b\) => \(b\.at \|\| 0\) - \(a\.at \|\| 0\)\);/.test(ord), ord.split("\n")[1]);
ck("① 순위가 명부 정렬로 안 샜다", !/gyeotOrder[\s\S]{0,300}(gqKind|rank)/.test(SRC));
ck("① 순위를 저장하지 않는다(명부에 되쓰지 않는다)", !/writeGyeot[\s\S]{0,200}(gqRes|gqKind)/.test(SRC) && !/gqRes[\s\S]{0,120}writeGyeot/.test(SRC));

/* ── ② 보통 물음의 금지는 살아 있다 ───────────────────────────── */
ck("② 보통 물음엔 순위 금지가 그대로 붙는다", /순위를 매기지 마라\(1등·2등·점수 금지\)/.test(SRC));
ck("② 그 금지가 '보통'에만 걸린다(줄세우기·뽑기가 아닐 때)",
   /gqKind === "rank"[\s\S]{0,900}gqKind === "pick"[\s\S]{0,600}순위를 매기지 마라/.test(SRC));
/* 상대는 동의한 적이 없다 — 순위를 열어도 이 사실은 안 변한다 */
const bans = (SRC.match(/성격을 단정하지 마라/g) || []).length;
ck("② 줄세우기·뽑기 둘 다 성격 단정을 막는다", bans >= 2, `${bans}곳`);
ck("② 둘 다 '동의한 적 없다'를 다시 못박는다",
   (SRC.match(/동의한 적도 없다/g) || []).length >= 3);
ck("② 이름 대신 자리표를 쓰라는 지시가 살아 있다", /이름을 쓰지 마라/.test(SRC));

/* ── ③ 재는 장치 ─────────────────────────────────────────────── */
ck("③ 반응을 잰다(재밌다/좀 그렇다)", /gyeot_rank_react/.test(SRC) && /v: "fun"/.test(SRC) && /v: "bad"/.test(SRC));
ck("③ 물음에 종류가 실린다", /kind: gqKind \|\| "plain"/.test(SRC));
ck("③ 순위 본 뒤 곁을 지웠는지 잰다", /gyeot_dropped[\s\S]{0,120}afterRank/.test(SRC));
/* ⚠ 계측에 사람이 안 실린다 — 이름도, 곁 열쇠도 */
const tracks = SRC.match(/track\("gyeot_(rank_react|dropped|asked|ask_chip)"[^;]*\)/g) || [];
ck("③ 계측에 이름·열쇠가 안 실린다", tracks.length >= 4 && !tracks.some((t) => /\bname\b|\bkey\b|\.nm\b/.test(t)), `${tracks.length}건`);

/* ── 화면 ────────────────────────────────────────────────────── */
const b = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
const { onboard } = await import("./onboard.mjs");
await onboard(page, BASE);
const seed = (n) => page.evaluate((k) => localStorage.setItem("binari.gyeot.v1", JSON.stringify(
  [{ key:"a", el:"화", dg:2, name:"민수", tier:"standing", at:3000 },
   { key:"b", el:"수", dg:8, name:"팀장님", tier:"standing", at:2000 },
   { key:"c", el:"목", dg:0, name:"엄마", tier:"standing", at:1000 }].slice(0, k))), n);
const openGyeot = async () => {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5200);
  await page.getByRole("button", { name: "곁", exact: true }).click();
  await page.waitForTimeout(900);
  await page.locator("canvas").first().dblclick();
  await page.waitForTimeout(900);
};
await seed(3); await openGyeot();

const play = page.locator(".gsugchip.gplay");
ck("④ 줄 세우기 칩이 뜬다", (await play.count()) === 2, (await play.allTextContents()).join(" / "));

/* ⑤ **한 명뿐이면 안 뜬다** — 한 사람을 줄 세우는 건 그 사람 한 명에 대한 판정이 된다 */
const names = page.locator(".gpick:not(.grel) .gpchip");
const n = await names.count();
for (let i = 2; i < n; i++) await names.nth(i).click();
await page.waitForTimeout(400);
ck("⑤ 한 명만 골랐을 땐 줄 세우기가 안 뜬다", (await page.locator(".gsugchip.gplay").count()) === 0);
await page.locator(".gpick:not(.grel) .gpchip").first().click();   // 전체로 되돌린다
await page.waitForTimeout(400);
ck("⑤ 여럿으로 되돌리면 다시 뜬다", (await page.locator(".gsugchip.gplay").count()) === 2);

/* ⑥ 관계를 바꾸면 놀이 물음도 바뀐다 */
const before = await page.locator(".gsugchip.gplay").first().innerText();
await page.locator(".grel .gpchip", { hasText: "가족" }).click();
await page.waitForTimeout(400);
const after = await page.locator(".gsugchip.gplay").first().innerText();
ck("⑥ 관계마다 놀이 물음이 다르다", before !== after, `${before} → ${after}`);

/* ⑦ 칩을 누르면 칸에 들어가고, **손으로 고치면 놀이가 꺼진다** */
await page.locator(".gsugchip.gplay").first().click();
await page.waitForTimeout(300);
ck("⑦ 놀이 칩이 질문 칸에 들어간다", (await page.locator("textarea.gqbox").inputValue()) === after);

/* ── ⑧ 답이 실제로 그려지는가 + **순번이 읽히는가** ─────────────────────────
   판결 API 를 가로채 가짜 답을 준다(실키 안 씀). 순위 기능인데 순번이 안 보이면 기능이 아니다.
   ⚠ **대비는 계산이 아니라 찍힌 픽셀로 잰다.** 이 화면의 바닥은 CSS 가 아니라 캔버스라
     (body 는 어두운데 눈에는 밝다) getComputedStyle 로 거슬러 올라가면 **엉뚱한 바닥**을 잡는다.
     실제로 그 방식이 같은 배지를 1.05·2.87 로 읽었고 둘 다 틀렸다. 진짜 값은 6.3 이었다. */
const stub = async (pg) => pg.route(/\/api\/judge|api\.anthropic\.com/, (route) => route.fulfill({
  status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify({
    rows: [{ who: "곁2", line: "오늘 기운이 제일 위로 뻗어 있어." },
           { who: "곁1", line: "받쳐 주느라 티가 안 나." },
           { who: "곁3", line: "오늘은 한 발 물러서 있어." }],
    close: "오늘 기준이야. 내일 순서는 또 바뀌어." }) }] }) }));
const contrast = async (pg, sel) => {
  const shot = await pg.locator(sel).first().screenshot();
  return pg.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = "data:image/png;base64," + b64; });
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    const L = []; for (let i = 0; i < d.length; i += 4) L.push(.2126 * f(d[i]) + .7152 * f(d[i+1]) + .0722 * f(d[i+2]));
    L.sort((a, b) => a - b);
    /* ⚠ **양끝을 대칭으로 잡는다.** 밝은 판은 글씨가 어둡고(어두운 끝=글씨) 까만 판은 글씨가 밝다
       (밝은 끝=글씨). 한쪽을 .90 으로 잡으면 까만 판에서 **작은 밝은 글씨를 통째로 놓쳐**
       바닥끼리 비교하게 된다 — 실제로 그래서 6.25 짜리 배지가 2.79 로 읽혔다. */
    const lo = L[Math.floor(L.length * .02)], hi = L[Math.floor(L.length * .98)];
    return +((hi + .05) / (lo + .05)).toFixed(2);
  }, shot.toString("base64"));
};
const ask = async (pg, idx = 0) => {
  /* ⚠ 칸을 먼저 비운다 — 예상질문은 **빈 칸일 때만** 뜬다(쓰던 걸 안 덮으려고 그렇게 만들었다).
     앞 검사가 칸을 채워 놓은 채로 오면 칩이 없어 여기서 멈춘다. 실제로 그렇게 한 번 멈췄다. */
  await pg.locator("textarea.gqbox").fill("");
  await pg.waitForTimeout(250);
  await pg.locator(".gsugchip.gplay").nth(idx).click();
  await pg.waitForTimeout(250);
  await pg.locator(".btn.gold.sm", { hasText: /물어볼게/ }).click();
  await pg.waitForTimeout(2500);
};
await stub(page);
await ask(page);
ck("⑧ 순위 답이 줄줄이 그려진다", (await page.locator(".gqrow").count()) === 3);
ck("⑧ 순번이 붙는다", (await page.locator(".gqno").count()) === 3);
ck("⑧ 「이거 어땠어?」가 같이 뜬다(실험 장치)", (await page.locator(".graterow").count()) === 1);
const cHolo = await contrast(page, ".gqno");
ck("⑧ 홀로에서 순번이 읽힌다(4.5 이상)", cHolo >= 4.5, `${cHolo}`);

/* ⑨ 뽑기는 **한 명만**, 순번 없이 */
await page.route(/\/api\/judge|api\.anthropic\.com/, (route) => route.fulfill({
  status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify({
    rows: [{ who: "곁3", line: "오늘은 네 차례야." }], close: "내일은 또 몰라." }) }] }) }));
await ask(page, 1);
ck("⑨ 뽑기는 한 명만 나온다", (await page.locator(".gqrow").count()) === 1);
ck("⑨ 뽑기엔 순번을 안 붙인다(우열이 아니라 차례다)", (await page.locator(".gqno").count()) === 0);

/* ⑩ 까만 판에서도 순번이 읽힌다 — 홀로만 고치고 그쪽을 깨는 일이 이 리포에 있었다 */
const dark = await b.newPage({ viewport: { width: 430, height: 932 } });
await stub(dark);
await onboard(dark, BASE, "?skin=dark");
await dark.evaluate(() => localStorage.setItem("binari.gyeot.v1", JSON.stringify(
  [{ key:"a", el:"화", dg:2, name:"민수", tier:"standing", at:3000 },
   { key:"b", el:"수", dg:8, name:"팀장님", tier:"standing", at:2000 },
   { key:"c", el:"목", dg:0, name:"엄마", tier:"standing", at:1000 }])));
await dark.goto(BASE + "/?skin=dark", { waitUntil: "domcontentloaded" });
await dark.waitForTimeout(5200);
await dark.getByRole("button", { name: "곁", exact: true }).click();
await dark.waitForTimeout(900);
await dark.locator("canvas").first().dblclick().catch(() => {});
await dark.waitForTimeout(900);
if (await dark.locator(".gsugchip.gplay").count()) {
  await ask(dark);
  const cDark = await contrast(dark, ".gqno");
  ck("⑩ 까만 판에서도 순번이 읽힌다(4.5 이상)", cDark >= 4.5, `${cDark}`);
} else ck("⑩ 까만 판에서도 순번이 읽힌다(4.5 이상)", false, "놀이 칩을 못 찾음");

await b.close();
console.log(`\n=== 줄 세우기·뽑기: ${pass}/${pass + fail} PASS ===`);
process.exit(fail ? 1 : 0);
