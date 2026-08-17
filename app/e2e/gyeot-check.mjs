/* 곁 탭 — 곁탭IA v01 §6 단계 1(껍데기 + 1층)이 지켜지는가.
   실행: preview 기동 후 node e2e/gyeot-check.mjs

   이 검사가 지키는 건 **금지 목록(§5)** 이다. 기능은 눈에 보이니 사라지면 알지만,
   "하지 말 것"은 어기는 순간에도 화면이 멀쩡해 보인다 — 빈 슬롯 하나, 배지 숫자 하나가
   조용히 들어와서 곁 탭을 '아직 못 채운 것'으로 만든다. 그때부터 그 탭은 안 여는 게 낫다.

   §5 금지: 판결 탭 변경 · 결제벽 · 개수 표기 · 하트/커플/핑크 · 신규 캐릭터 · 상대 이름 받기 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
import { readFileSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173";
const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(9000);
const { onboard } = await import("./onboard.mjs");
await onboard(page, BASE);

/* ── ① 탭이 있고, 판결이 기본이다 ─────────────────────────────────────── */
const tabbar = page.locator("nav.tabbar");
ck("① 하단 탭이 로비에 있다", await tabbar.isVisible().catch(() => false));
ck("① 탭은 둘뿐이다(판결·곁)", (await page.locator(".tabbtn").count()) === 2,
   (await page.locator(".tabbtn").allTextContents()).join("·"));
ck("① 기본은 판결 탭", ((await page.locator(".tabbtn.on").allTextContents())[0] || "").includes("판결"));
ck("① 판결 탭에선 질문 입력이 그대로", await page.locator("textarea.qbox").isVisible().catch(() => false));

/* ── ② 곁 탭 — 1층이 화면을 완결시킨다 ────────────────────────────────── */
await page.getByRole("button", { name: "곁", exact: true }).click();
await page.waitForTimeout(900);
const gy = page.locator("section.gyeot");
ck("② 곁 탭이 열린다", await gy.isVisible().catch(() => false));
ck("② 곁 탭에도 수호신이 그려진다", (await gy.locator("canvas").count()) >= 1);
ck("② 판결 화면은 곁 탭에 안 딸려온다", (await page.locator("textarea.qbox").count()) === 0);

const gtxt = await gy.innerText();
/* §5 — 개수 표기 금지. "0명"·"곁 3"·"1/5" 류가 들어오면 이 탭은 카운터가 된다. */
ck("② 개수 표기가 없다", !/\d\s*(명|개|\/)|곁\s*\d|0명/.test(gtxt), gtxt.replace(/\n/g, " ").slice(0, 70));
/* §5 — 빈 슬롯·진행바 금지 */
ck("② 빈 슬롯·진행바가 없다",
   (await gy.locator(".slot,.empty,progress,[role=progressbar]").count()) === 0);
/* §5 — 결제벽 금지. 무료 유저가 열었을 때 살 것부터 보이면 실패다. */
ck("② 결제벽이 없다(값·구매 버튼 없음)", !/원|결제|구매|시험 발행/.test(gtxt), gtxt.replace(/\n/g, " ").slice(0, 70));
/* §5 — 하트·커플·핑크 금지(연애 기능이 아니다) */
ck("② 연애 기호가 없다", !/[♥♡❤]|커플|연인/.test(gtxt));
/* 곁이 0이어도 화면이 완결돼야 한다 — 안내 문구가 실제로 있다 */
ck("② 곁이 없어도 화면이 말이 된다", gtxt.trim().length > 10 && gtxt.includes("곁"));

/* ── ③ 판결 탭은 한 글자도 안 바뀐다(§5 첫 줄) ────────────────────────── */
await page.getByRole("button", { name: "판결", exact: true }).click();
await page.waitForTimeout(700);
ck("③ 판결 탭으로 돌아온다", await page.locator("textarea.qbox").isVisible().catch(() => false));
/* ⚠ 첫 줄은 **시각에 따라 갈린다**(v132.2 심야 분기: 23~04시엔 "밤이 깊었네…").
   전엔 낮 문구만 못 박아 두어서 **밤에 돌리면 무조건 FAIL** 이었다 — 실제로 KST 새벽에 걸렸다.
   탭이 판결 화면을 안 건드렸는지가 검사의 목적이므로, 둘 중 하나만 있으면 통과다. */
const INTRO = ["그래서, 요즘 뭘 망설이고 있어?", "밤이 깊었네"];
let introHit = 0;
for (const t of INTRO) introHit += await page.getByText(t, { exact: false }).count();
ck("③ 판결 화면 인사말 보존(낮/심야 둘 중 하나)", introHit >= 1);
ck("③ 판결 화면 문구 보존 — 판결을 청한다",
   (await page.getByText("판결을 청한다", { exact: false }).count()) >= 1);

/* ── ④ 집중 국면에선 탭을 숨긴다 ──────────────────────────────────────── */
{
  const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const cond = (src.match(/\{step === 3 && phase >= 1 && !res[^&]*(?:&&[^&]*)*?&& \(\s*\n\s*<nav className="tabbar"/) || [""])[0];
  for (const g of ["!res", "!imprintOpen", "!matchOpen", "!letterOpen", "!bujeok"]) {
    ck(`④ 탭 숨김 조건에 ${g}`, cond.includes(g));
  }
}

/* ── ⑤ 계측 — 탭 전환이 기록된다(어느 탭이 열리는지 모르면 판단할 수 없다) ── */
{
  const p2 = await b.newPage({ viewport: { width: 430, height: 932 } });
  await onboard(p2, BASE, "?trackdebug");
  await p2.getByRole("button", { name: "곁", exact: true }).click();
  await p2.waitForTimeout(600);
  const evs = await p2.evaluate(() => (window.__binariEvents || []).filter((e) => e.ev === "tab_switched"));
  ck("⑤ 탭 전환이 계측된다", evs.length >= 1 && evs[evs.length - 1].props.to === "gyeot",
     JSON.stringify(evs.map((e) => e.props.to)));
  await p2.close();
}

await b.close();
const f = R.filter((x) => !x).length;
console.log(`\n=== 곁 탭: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
