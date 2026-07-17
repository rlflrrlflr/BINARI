// 판결 경로 회귀 — window.claude.complete(아티팩트 내장 API) mock으로 콜1·콜2 검증
// 실행: preview 기동 후 node e2e/verdict.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";

const R = []; const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(9000);

// 아티팩트 내장 API mock: 콜1=결론, 콜2=근거
await page.addInitScript(() => {
  window.claude = { complete: async (prompt) => {
    if (prompt.includes("결론만")) return JSON.stringify({ category: "B", tone: "단호", direction: "STOP", verdict: "보내지 마. 끝.", against: 4, total: 6 });
    return JSON.stringify({ subline: "밤이 널 속이는 거야.", reasons: [{ axis: "사주", vote: "STOP", text: "화기가 널 밀어." }, { axis: "달", vote: "STOP", text: "기우는 달은 비우라 해." }], funLine: "욱하지 마.", disclaimer: "" });
  } };
});
const vvText = async () => (await page.locator(".vv").allTextContents())[0] || "";
const waitVerdict = async () => { for (let i = 0; i < 40; i++) { if ((await vvText()).includes("보내지 마")) return true; await page.waitForTimeout(300); } return false; };

await page.goto(BASE);
await page.waitForTimeout(900);
ck("아티팩트 API(window.claude.complete) 감지", await page.evaluate(() => typeof window.claude?.complete === "function"));
// 온보딩
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

// 속결(콜1만)
await page.locator("textarea.qbox").fill("전남친에게 연락할까?"); await page.waitForTimeout(300);
await page.getByRole("button", { name: "가볍게 물을래" }).click();
ck("속결 판결(콜1) — verdict 렌더", await waitVerdict(), await vvText());

// 의식(콜1+콜2)
await page.getByRole("button", { name: "다른 걸 물어볼래" }).click(); await page.waitForTimeout(400);
await page.locator("textarea.qbox").fill("이직할까 크게 고민이야"); await page.waitForTimeout(300);
await page.getByRole("button", { name: "판결을 청한다" }).click();
await page.waitForSelector("text=동전 셋을 여섯 번", { timeout: 5000 });
await page.getByRole("button", { name: "한 번에 던지기" }).click();
ck("의식 판결(콜1) — verdict 렌더", await waitVerdict(), await vvText());
await page.getByRole("button", { name: "왜 이렇게 봤어?" }).click().catch(() => {});
let subOk = false;
for (let i = 0; i < 30; i++) { if (await page.getByText("밤이 널 속이는 거야.").isVisible().catch(() => false)) { subOk = true; break; } await page.waitForTimeout(300); }
ck("근거(콜2) — subline 렌더", subOk);

await b.close();
const f = R.filter(x => !x).length;
console.log(`\n=== 판결 경로: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
