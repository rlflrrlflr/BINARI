/* 곁 탭 — 곁탭IA v01 §6 단계 1(껍데기 + 1층)이 지켜지는가.
   실행: preview 기동 후 node e2e/gyeot-check.mjs

   이 검사가 지키는 건 **금지 목록(§5)** 이다. 기능은 눈에 보이니 사라지면 알지만,
   "하지 말 것"은 어기는 순간에도 화면이 멀쩡해 보인다 — 빈 슬롯 하나, 배지 숫자 하나가
   조용히 들어와서 곁 탭을 '아직 못 채운 것'으로 만든다. 그때부터 그 탭은 안 여는 게 낫다.

   §5 금지: 판결 탭 변경 · 결제벽 · 개수 표기 · 하트/커플/핑크 · 신규 캐릭터 · 상대 이름 받기 */
import { createRequire } from "node:module";
import { throwCoins } from "./ritual.mjs";   // v140: 의식이 켜져 있으면 여섯 번 던져 통과
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
  const cta = p3.getByRole("button", { name: /부르게 돼|곁에 서/ });
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
  /* v136 — 명부는 **두 번 두드려야 열린다**(판결 탭 awake 와 같은 문법). 닫힌 채로는 목록이 없다.
     이름이 적힌 화면이라 한 번의 의도적인 동작 뒤에 두는 게 맞다. */
  ck("⑥ 명부는 두드리기 전엔 안 열린다", (await p3.locator(".gyeotlist li").count()) === 0);
  await p3.locator("canvas").first().dblclick();
  await p3.waitForTimeout(900);
  ck("⑥ 궁합을 보면 그 사람이 실제로 곁에 선다", (await p3.locator(".gyeotlist li").count()) === 1);
  ck("⑥ 곁이 서면 '비었다' 안내는 사라진다", (await p3.getByRole("button", { name: /부르게 돼|곁에 서/ }).count()) === 0);
  /* 창업자 결정 1(절충안) — 궁합만 본 사람은 정식 자리가 아니라 '답 대기'로 흐리게 선다 */
  /* 창업자 결정 1(절충안)의 층 구분은 그대로다. 다만 화면 말은 「부른 곁」이고,
     **라벨을 글자로 안 붙이기로** 했으므로(곁탭IA 어휘확장) 흐리기로만 갈린다 — 그걸 본다. */
  ck("⑥ 궁합만 본 사람은 '부른 곁'으로 흐리게 선다", (await p3.locator(".gyeotlist li.called").count()) === 1);
  const panel2 = await p3.locator(".gyeotpanel").innerText();
  ck("⑥ 기각된 「답 대기」·「대기」가 화면에 없다", !/대기/.test(panel2), panel2.replace(/\n/g, " ").slice(0, 50));
  await p3.close();
}

/* ── ⑦ 이름은 기기 밖으로 안 나간다 (2026-08-17 결정의 **조건**) ────────────────
   결정은 "이름을 받는다"였지 "이름을 내보낸다"가 아니다. 그리고 그 약속을 **화면에 적어 놨다**
   ("서버로도, 통계로도 안 나가"). 이 리포엔 약속을 먼저 쓰고 코드가 안 따라간 사고가 있었다(v127.7,
   PostHog 로 질문 원문이 22건 샜다). 그래서 소스 검사가 아니라 **실제로 돌려서** 확인한다:
   모델에 간 프롬프트와 계측에 나간 값을 직접 열어 본다. */
{
  const C1 = JSON.stringify({ category: "A", scope: "S1", votes: [{ axis: "사주", v: "GO" }, { axis: "달", v: "GO" }, { axis: "별자리", v: "STOP" }], tone: "단호", direction: "GO", verdict: "곁1한테 먼저 말해." });
  const C2 = JSON.stringify({ subline: "곁1이 뒤를 받쳐 줄 거야.", reasons: [{ axis: "사주", vote: "GO", text: "편재 — 곁1과 붙으면 커져." }], funLine: "가 봐.", disclaimer: "" });
  const NAME = "홍길동테스트";
  const p4 = await b.newPage({ viewport: { width: 430, height: 932 } });
  p4.setDefaultTimeout(15000);
  await p4.addInitScript(({ c1, c2 }) => {
    window.__prompts = [];
    window.claude = { complete: async (p) => { window.__prompts.push(p); return p.includes("[이미 확정된 판결]") ? c2 : c1; } };
  }, { c1: C1, c2: C2 });
  await onboard(p4, BASE, "?trackdebug");
  await (await import("./open-match.mjs")).openMatch(p4);
  await p4.waitForTimeout(600);
  await p4.locator(".impname").fill(NAME);
  const ins = p4.locator(".impask input.impnum");
  await ins.nth(0).fill("1997"); await ins.nth(1).fill("4"); await ins.nth(2).fill("22");
  await p4.getByRole("button", { name: "둘을 맞대 볼게" }).click(); await p4.waitForTimeout(900);
  await p4.getByRole("button", { name: /닫을게/ }).last().click(); await p4.waitForTimeout(1200);
  /* ⚠ v144 — 궁합을 닫으면 **곁 탭으로 간다**(위성이 붙는 걸 보여주는 단계). 판결로 돌아와야 한다.
     이 줄이 없으면 여기서 textarea 를 기다리다 타임아웃 난다 — 실제로 그렇게 걸렸다. */
  await p4.getByRole("button", { name: "판결", exact: true }).click(); await p4.waitForTimeout(500);
  await p4.locator("canvas").first().dblclick();
  await p4.waitForSelector("textarea.qbox", { timeout: 12000 });
  await p4.locator("textarea.qbox").fill("내 사업에 도움이 될 사람이 있을까?");
  await p4.getByRole("button", { name: "판결을 청한다" }).click();
  await throwCoins(p4);
  await p4.waitForTimeout(3000);
  await p4.getByRole("button", { name: "왜 이렇게 봤어?" }).click().catch(() => {});
  await p4.waitForTimeout(2000);

  const prompts = await p4.evaluate(() => (window.__prompts || []).join("\n"));
  ck("⑦ 모델에 간 프롬프트에 이름이 없다", !prompts.includes(NAME));
  ck("⑦ 프롬프트엔 자리표와 역할이 간다", /\[곁\][^\n]*곁1=/.test(prompts), (prompts.match(/\[곁\][^\n]{0,60}/) || [""])[0]);
  const evs = await p4.evaluate(() => JSON.stringify(window.__binariEvents || []));
  ck("⑦ 계측 어디에도 이름이 없다", !evs.includes(NAME));
  ck("⑦ 계측엔 자리표가 그대로 남는다(치환 전 값)", /곁\s*1/.test(evs));
  /* 그런데 **화면에는 이름이 보여야** 한다 — 안 보이면 기능이 없는 것과 같다 */
  ck("⑦ 화면 판결문엔 이름이 보인다", ((await p4.locator(".vv").innerText().catch(() => "")) || "").includes(NAME));
  ck("⑦ 화면 근거에도 이름이 보인다",
     (await p4.locator(".vr li p").allTextContents()).join(" ").includes(NAME));
  /* 밖으로 나가는 면(공유 문안)엔 이름 대신 가림말 — 상대는 미동의 제3자다 */
  const shareTxt = await p4.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find((b) => /공유|보내/.test(b.textContent || ""));
    return el ? "있음" : "없음";
  });
  ck("⑦ 공유 경로가 화면에 존재한다(가림말 검사의 전제)", shareTxt === "있음", shareTxt);
  await p4.close();
}

/* ── ⑧ 창업자 게이트 — 「첫 곁은 내가 직접 넣어 공짜, 그 다음부터는 그 사람이 직접 넣는다」 ──
   ⚠ **이 검사가 없어서 게이트가 넉 달 가까이 샜다.** 규칙은 코드 주석 두 곳·변경이력 세 줄에
   적혀 있었는데 **집행하는 코드가 문 앞 한 곳뿐**이었고, 문 안쪽 「다른 사람과도 봐볼게」가
   폼을 되돌려 초대 0건으로 다섯 명까지 직접 입력됐다(2026-08-30 실측).
   그래서 여기서 재는 건 버튼의 유무가 아니라 **성질**이다 — 「직접 입력 폼에 두 번 도달할 수
   있는가」. 어떤 새 버튼이 생기든 이 질문이 그대로 잡는다. */
{
  const p5 = await b.newPage({ viewport: { width: 430, height: 932 } });
  p5.setDefaultTimeout(9000);
  await onboard(p5, BASE);
  const roster = () => p5.evaluate(() => { try { return JSON.parse(localStorage.getItem("binari.gyeot.v1") || "[]").length; } catch { return -1; } });
  await p5.getByRole("button", { name: "곁", exact: true }).click();
  await p5.waitForTimeout(900);
  const cta = p5.getByRole("button", { name: /곁에 서|부르게 돼|둘 사이를 보면/ });
  ck("⑧ 곁이 비면 직접 입력 문이 하나 있다(첫 한 명은 공짜)", (await cta.count()) === 1);
  await cta.first().click();
  await p5.waitForSelector(".impask", { timeout: 15000 });
  const ins = p5.locator(".impask input.impnum");
  await ins.nth(0).fill("1997"); await ins.nth(1).fill("4"); await ins.nth(2).fill("22");
  await p5.locator(".impask input.impname").fill("가상갑");
  await p5.getByRole("button", { name: "둘을 맞대 볼게" }).click();
  await p5.waitForTimeout(1400);
  ck("⑧ 첫 사람이 곁에 선다", (await roster()) === 1, `곁 ${await roster()}`);
  /* 성질 검사 ①: 결과 화면 어디에도 폼으로 되돌아가는 문이 없다 */
  ck("⑧ 결과 화면에 직접 입력 폼이 다시 열리는 문이 없다", (await p5.locator(".impask").count()) === 0);
  const mt5 = await p5.locator(".imp").innerText();
  ck("⑧ 문이 닫힌 이유를 그 자리에서 말한다", /다음 사람은 그 사람이 직접 넣어야 서/.test(mt5));
  /* 성질 검사 ②: 문서를 닫고 곁으로 돌아와도 직접 입력 문이 없고, 남는 문은 초대뿐 */
  await p5.getByRole("button", { name: /닫을게/ }).last().click();
  await p5.waitForTimeout(1000);
  await p5.getByRole("button", { name: "곁", exact: true }).click().catch(() => {});
  await p5.waitForTimeout(900);
  await p5.locator("canvas").first().dblclick();
  await p5.waitForTimeout(1300);
  ck("⑧ 곁이 서면 직접 입력 문이 사라진다",
     (await p5.getByRole("button", { name: /곁에 서|부르게 돼|둘 사이를 보면/ }).count()) === 0);
  ck("⑧ 남는 문은 초대뿐이다", (await p5.getByRole("button", { name: "한 사람 더 부를래" }).count()) === 1);
  /* 성질 검사 ③: 왜 초대인지가 버튼 위에 적혀 있다 (창업자 지시 2026-08-30) */
  const gate = await p5.locator(".gyegate").innerText().catch(() => "");
  ck("⑧ 초대 버튼 위에 이유가 적혀 있다", /직접 넣어/.test(gate), gate.replace(/\s+/g, " ").slice(0, 60));
  ck("⑧ 안내에 개수·값이 안 섞인다(§5)", !/\d\s*(명|개)|원|₩/.test(gate));
  await p5.close();
}

await b.close();
const f = R.filter((x) => !x).length;
console.log(`\n=== 곁 탭: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
