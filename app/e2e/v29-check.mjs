// v29 회귀 — ①회상 나레이션 선택 시작하면 숨김 ②자기소개 탄생 순간에만 ③정독 스로틀 하에도 판결 렌더 정상
// 실행: preview 기동 후 node e2e/v29-check.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";
const R = []; const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
const CALL1 = JSON.stringify({ category: "C", tone: "단호", direction: "GO", verdict: "가. 망설이지 마.", against: 2, total: 6 });
const CALL2 = JSON.stringify({ subline: "이미 답을 알잖아.", reasons: [{ axis: "사주", vote: "GO", text: "목기가 뻗어." }], funLine: "가자.", disclaimer: "" });

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(9000);
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.addInitScript(({ c1, c2 }) => { window.claude = { complete: async (p) => (p.includes("결론만") ? c1 : c2) }; }, { c1: CALL1, c2: CALL2 });

// ── 온보딩: MBTI 화면까지 ──
await page.goto(BASE); await page.waitForTimeout(900);
await page.getByRole("button", { name: "조각을 모으러 갈래" }).click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "이름 없이 갈래" }).click();
const ins = page.locator("input.in:not(.wide)");
await ins.nth(0).fill("1990"); await ins.nth(1).fill("2"); await ins.nth(2).fill("25");
await page.getByRole("button", { name: "이 하늘이야" }).click();
const tins = page.locator("input.in:not(.wide)");
await tins.nth(0).fill("14"); await tins.nth(1).fill("30");
await page.getByRole("button", { name: "기억났어" }).click();
await page.getByRole("button", { name: "하늘을 열기" }).click();

// ── ① v30 순차: 회상 나레이션 단계 → "응, 기억나" 탭 → 문항 단계(나레이션 숨김) ──
await page.waitForSelector("text=너였지", { timeout: 12000 });
const mentionOnRecall = await page.getByText("너였지", { exact: false }).isVisible().catch(() => false);
ck("① 회상 단계에서 나레이션 노출", mentionOnRecall);
ck("① 회상 단계에선 문항 미노출(순차)", (await page.getByText("요즘의 너는", { exact: false }).count()) === 0);
await page.getByRole("button", { name: "응, 기억나" }).click();
await page.waitForSelector("text=요즘의 너는", { timeout: 8000 });
const mentionAfter = await page.getByText("너였지", { exact: false }).isVisible().catch(() => false);
ck("① 문항 단계에선 나레이션 숨김", !mentionAfter);
await page.getByRole("button", { name: "혼자일 때 차오르는 쪽" }).click(); await page.waitForTimeout(300);
const q2Visible = await page.getByText("네 눈은 어디를", { exact: false }).isVisible().catch(() => false);
ck("① 선택은 계속 진행(2번째 문항 노출)", q2Visible);

// 나머지 MBTI + 가치 진행
for (const t of ["아직 오지 않은 것을 보는 쪽", "마음이 먼저 움직이는 쪽", "열어둔 길이 편한 쪽"]) await page.getByRole("button", { name: t }).click();
await page.getByRole("button", { name: "마음의 방으로" }).click(); await page.waitForTimeout(400);
for (const v of ["안정", "성장", "자유", "인정", "관계", "성취"]) await page.getByRole("button", { name: v, exact: true }).click();
await page.getByRole("button", { name: "여섯 개 골랐어" }).click(); await page.waitForTimeout(200);
for (const v of ["안정", "성장", "자유"]) await page.getByRole("button", { name: v, exact: true }).click();
await page.getByRole("button", { name: "셋을 남겼어" }).click(); await page.waitForTimeout(200);
await page.getByRole("button", { name: "안정", exact: true }).click();
await page.getByRole("button", { name: "수호신 깨우기" }).click();

// ── ② 자기소개: 탄생(3.2s) 직후 로비에서 노출(v52) ──
await page.waitForSelector("text=두 번 두드려", { timeout: 12000 });
await page.waitForTimeout(1200); // 탄생 페이드 + justBorn
const introVisible = await page.locator(".gsay").first().isVisible().catch(() => false);
const introText = (await page.locator(".gsay").allTextContents()).join(" ");
ck("② 탄생 직후 자기소개(로비) 노출", introVisible, introText.slice(0, 40));
await page.locator("canvas").first().dblclick(); // 두 번 두드려 깨움
await page.waitForSelector("textarea.qbox", { timeout: 12000 });
await page.waitForTimeout(300);

// ── ③ 정독 스로틀 하에서 판결 렌더 정상 ──
await page.locator("textarea.qbox").fill("이 길로 가도 될까?"); await page.waitForTimeout(300);
await page.getByRole("button", { name: "가볍게 물을래" }).click();
let verdictOk = false;
for (let i = 0; i < 40; i++) { if (((await page.locator(".vv").allTextContents())[0] || "").includes("망설이지 마")) { verdictOk = true; break; } await page.waitForTimeout(300); }
ck("③ 스로틀 중에도 판결 L1 렌더", verdictOk);
await page.waitForTimeout(2200); // 반응 소멸 + restRef 스로틀 구간
const canvasAlive = await page.evaluate(() => !!document.querySelector("canvas"));
ck("③ 스로틀 후 캔버스 생존", canvasAlive);
ck("③ 판결 후 restRef 스로틀 경로 무오류", errs.length === 0, errs.slice(0, 2).join(" | "));

console.log(`\n=== v29 체크: ${R.filter(Boolean).length}/${R.length} PASS ===`);
await b.close();
process.exit(R.every(Boolean) ? 0 : 1);
