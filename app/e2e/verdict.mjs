// 판결 경로 회귀 — ①window.claude.complete 정상 ②complete 고장 시 폭포수(→server 404→direct)
// 실행: preview 기동 후 node e2e/verdict.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";

const R = []; const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
const CALL1 = JSON.stringify({ category: "B", tone: "단호", direction: "STOP", verdict: "보내지 마. 끝.", against: 4, total: 6 });
const CALL2 = JSON.stringify({ subline: "밤이 널 속이는 거야.", reasons: [{ axis: "사주", vote: "STOP", text: "화기가 널 밀어." }], funLine: "욱하지 마.", disclaimer: "" });

async function onboard(page) {
  await page.goto(BASE); await page.waitForTimeout(900);
  await page.getByRole("button", { name: "조각을 모으러 갈래" }).click(); await page.waitForTimeout(400);
  const ins = page.locator("input.in");
  await ins.nth(0).fill("1990"); await ins.nth(1).fill("2"); await ins.nth(2).fill("25"); await ins.nth(3).fill("14"); await ins.nth(4).fill("30");
  await page.getByRole("button", { name: "하늘을 열기" }).click();
  await page.waitForSelector("text=요즘의 너는", { timeout: 10000 });
  await page.getByRole("button", { name: "INFP", exact: true }).click();
  await page.getByRole("button", { name: "B형", exact: true }).click();
  await page.getByRole("button", { name: "마음의 방으로" }).click(); await page.waitForTimeout(500);
  for (const v of ["안정", "성장", "자유", "인정", "관계", "성취", "즐거움", "의미"]) await page.getByRole("button", { name: v, exact: true }).click();
  await page.getByRole("button", { name: "여덟 개 골랐어" }).click(); await page.waitForTimeout(300);
  for (const v of ["안정", "성장", "자유", "인정"]) await page.getByRole("button", { name: v, exact: true }).click();
  await page.getByRole("button", { name: "넷을 남겼어" }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "안정", exact: true }).click();
  await page.getByRole("button", { name: "수호신 깨우기" }).click();
  await page.waitForSelector("textarea.qbox", { timeout: 12000 }); await page.waitForTimeout(600);
}
const vvText = async (page) => (await page.locator(".vv").allTextContents())[0] || "";
const waitVerdict = async (page) => { for (let i = 0; i < 40; i++) { if ((await vvText(page)).includes("보내지 마")) return true; await page.waitForTimeout(300); } return false; };

const b = await chromium.launch();

// ── 시나리오 1: complete 정상 (아티팩트 표준 환경) ──
{
  const page = await b.newPage({ viewport: { width: 430, height: 932 } });
  page.setDefaultTimeout(9000);
  await page.addInitScript(({ c1, c2 }) => {
    window.claude = { complete: async (p) => (p.includes("결론만") ? c1 : c2) };
  }, { c1: CALL1, c2: CALL2 });
  await onboard(page);
  ck("S1 complete 감지", await page.evaluate(() => typeof window.claude?.complete === "function"));
  await page.locator("textarea.qbox").fill("전남친에게 연락할까?"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "가볍게 물을래" }).click();
  ck("S1 속결 판결(콜1)", await waitVerdict(page), await vvText(page));
  await page.getByRole("button", { name: "다른 걸 물어볼래" }).click(); await page.waitForTimeout(400);
  await page.locator("textarea.qbox").fill("이직할까 크게 고민이야"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "판결을 청한다" }).click();
  await page.waitForSelector("text=동전 셋을 여섯 번", { timeout: 5000 });
  await page.getByRole("button", { name: "한 번에 던지기" }).click();
  ck("S1 의식 판결(콜1)", await waitVerdict(page));
  await page.getByRole("button", { name: "왜 이렇게 봤어?" }).click().catch(() => {});
  let subOk = false;
  for (let i = 0; i < 30; i++) { if (await page.getByText("밤이 널 속이는 거야.").isVisible().catch(() => false)) { subOk = true; break; } await page.waitForTimeout(300); }
  ck("S1 근거(콜2)", subOk);
  await page.close();
}

// ── 시나리오 2: complete가 존재하지만 고장(모바일 브리지 재현) → server 404 → direct 로 판결 성사 ──
{
  const page = await b.newPage({ viewport: { width: 430, height: 932 } });
  page.setDefaultTimeout(9000);
  await page.addInitScript(() => {
    window.claude = { complete: async () => { throw new Error("Invalid response format"); } };
  });
  await page.route("https://api.anthropic.com/**", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    const txt = (body.max_tokens || 0) <= 400 ? CALL1 : CALL2;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: txt }] }) });
  });
  await onboard(page);
  await page.locator("textarea.qbox").fill("전남친에게 연락할까?"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "가볍게 물을래" }).click();
  ck("S2 complete 고장 → 폭포수로 판결 성사", await waitVerdict(page), await vvText(page));
  ck("S2 화면에 에러 없음(사용자는 실패를 못 느낌)", (await page.locator(".err").count()) === 0);
  await page.close();
}

await b.close();
const f = R.filter((x) => !x).length;
console.log(`\n=== 판결 경로: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
