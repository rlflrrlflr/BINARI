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
/* ⚠ 인사말은 **시각에 따라 갈린다**(밤이면 "밤이 깊었네…"). 한 문장으로 못 박아 두면
   낮에 돌리면 통과하고 밤에 돌리면 실패하는 검사가 된다 — 실제로 그렇게 한 번 붉게 떴다.
   여기서 지켜야 할 건 "판결 탭이 안 바뀌었다"이지 어느 인사말이냐가 아니므로, 둘 중 하나면 통과다. */
const NIGHT = "밤이 깊었네. 이 시간의 물음은 마음이 먼저 기울어 있기 마련이야.";
const DAY = "그래서, 요즘 뭘 망설이고 있어?";
ck("③ 판결 화면 문구 보존 — 로비 인사말(시각별 둘 중 하나)",
   (await page.getByText(DAY, { exact: false }).count()) + (await page.getByText(NIGHT, { exact: false }).count()) >= 1);
for (const t of ["판결을 청한다"]) {
  ck(`③ 판결 화면 문구 보존 — ${t}`, (await page.getByText(t, { exact: false }).count()) >= 1);
}

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

/* ── ⑥ 빈 옆자리에 탈출구가 있는가 (B-2) ────────────────────────────────────
   이 탭의 제일 큰 구멍은 없는 기능이 아니라 **막다른 길**이었다 —
   "누가 서게 되면 이 자리에…"라고만 써 두면 유저는 **어떻게 서게 하는지를 모른다.**
   그래서 여기서 보는 건 문구가 아니라 **문이 실제로 열리는가**다. */
{
  const p3 = await b.newPage({ viewport: { width: 430, height: 932 } });
  p3.setDefaultTimeout(15000);
  await onboard(p3, BASE, "?trackdebug");
  await p3.getByRole("button", { name: "곁", exact: true }).click();
  await p3.waitForTimeout(900);
  const cta = p3.getByRole("button", { name: /여기 서/ });
  ck("⑥ 곁이 비면 나갈 문이 있다", (await cta.count()) === 1);
  /* §5 금지 — 첫 화면이 결제벽이 되면 안 된다. 문 하나를 가리키는 것과 값을 파는 건 다르다. */
  const panel = await p3.locator(".gyeotpanel").innerText();
  ck("⑥ 그 문이 결제벽이 아니다(값·원 표기 없음)", !/원|₩|\d{3,}/.test(panel), panel.replace(/\n/g, " ").slice(0, 60));
  await cta.click();
  await p3.waitForTimeout(900);
  ck("⑥ 문이 실제로 궁합으로 이어진다", await p3.locator(".impask").isVisible().catch(() => false));
  const evs = await p3.evaluate(() => (window.__binariEvents || []).filter((e) => e.ev === "gyeot_empty_cta"));
  ck("⑥ 그 문을 누른 게 계측된다 — 빈 탭이 실제로 전환을 만드는지 봐야 한다", evs.length >= 1);

  /* 곁이 하나라도 서면 그 문은 사라진다 — 목록이 있는데 "비었다"는 안내가 남아 있으면 안 된다 */
  const ins = p3.locator(".impask input.impnum");
  await ins.nth(0).fill("1997"); await ins.nth(1).fill("4"); await ins.nth(2).fill("22");
  await p3.getByRole("button", { name: "둘을 맞대 볼게" }).click();
  await p3.waitForTimeout(1100);
  await p3.getByRole("button", { name: /닫을게/ }).last().click();
  await p3.waitForTimeout(700);
  await p3.getByRole("button", { name: "곁", exact: true }).click();
  await p3.waitForTimeout(1100);
  ck("⑥ 궁합을 보면 그 사람이 실제로 곁에 선다", (await p3.locator(".gyeotlist li").count()) === 1);
  ck("⑥ 곁이 서면 '비었다' 안내는 사라진다", (await p3.getByRole("button", { name: /여기 서/ }).count()) === 0);
  /* 창업자 결정 1(절충안) — 궁합만 본 사람은 정식 자리가 아니라 '답 대기'로 흐리게 선다 */
  ck("⑥ 궁합만 본 사람은 '답 대기' 자리다", (await p3.locator(".gyeotlist li.wait").count()) === 1);
  await p3.close();
}

await b.close();
const f = R.filter((x) => !x).length;
console.log(`\n=== 곁 탭: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
