// 전 여정 풀페이지 캡처 — 매 단계를 사람 눈으로 검수하기 위한 스크린샷 세트
// 실행: preview 기동 후 SHOTS_DIR=... BIRTH=1993-7-15 node e2e/journey.mjs
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;

const BASE = process.env.BASE || "http://localhost:4173";
const SHOTS = process.env.SHOTS_DIR || "/tmp/binari-journey";
const [BY, BM, BD] = (process.env.BIRTH || "1993-7-15").split("-");
mkdirSync(SHOTS, { recursive: true });

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.setDefaultTimeout(9000);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });

await page.goto(BASE); await page.waitForTimeout(1400);
await shot("j01_오프닝");
await page.getByRole("button", { name: "조각을 모으러 갈래" }).click(); await page.waitForTimeout(500);
await shot("j02_생년월일");
const ins = page.locator("input.in");
await ins.nth(0).fill(BY); await ins.nth(1).fill(BM); await ins.nth(2).fill(BD);
await ins.nth(3).fill("14"); await ins.nth(4).fill("30");
await page.getByRole("button", { name: "하늘을 열기" }).click();
await page.waitForTimeout(1600); await shot("j03_리빌_중간");
await page.waitForSelector("text=요즘의 너는", { timeout: 15000 });
await page.waitForTimeout(400); await shot("j04_리빌완료_성격질문");
// MBTI 선택 (그리드 또는 픽션형 어느 쪽이든 대응)
const grid = await page.getByRole("button", { name: "INFP", exact: true }).count();
if (grid) { await page.getByRole("button", { name: "INFP", exact: true }).click(); }
else { for (const t of ["혼자", "오지 않은", "마음이", "열어둔"]) await page.getByRole("button", { name: new RegExp(t) }).first().click(); }
await page.getByRole("button", { name: "B형", exact: true }).click();
await page.waitForTimeout(300); await shot("j05_성격선택후");
await page.getByRole("button", { name: "마음의 방으로" }).click(); await page.waitForTimeout(600);
await shot("j06_가치_마음의방");
for (const v of ["안정", "성장", "자유", "인정", "관계", "성취"]) await page.getByRole("button", { name: v, exact: true }).click();
await page.getByRole("button", { name: "여섯 개 골랐어" }).click(); await page.waitForTimeout(500);
await shot("j07_가치_포기의방");
for (const v of ["안정", "성장", "자유"]) await page.getByRole("button", { name: v, exact: true }).click();
await page.getByRole("button", { name: "셋을 남겼어" }).click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "안정", exact: true }).click();
await page.waitForTimeout(300); await shot("j08_가치_단하나");
await page.getByRole("button", { name: "수호신 깨우기" }).click();
await page.waitForTimeout(1600); await shot("j09_수호신_형성중");
await page.waitForSelector("textarea.qbox", { timeout: 12000 });
await page.waitForTimeout(2600); await shot("j10_수호신_질문화면");
await page.locator("textarea.qbox").fill("지금 잘까, 더 할까");
await page.waitForTimeout(300);
await page.getByRole("button", { name: "판결을 청한다" }).click();
await page.waitForTimeout(500); await shot("j11_의식_시작");
await page.getByRole("button", { name: /동전/ }).first().click();
await page.waitForTimeout(400); await shot("j12_의식_동전공중");
await page.waitForTimeout(700); await shot("j13_의식_첫효");
await page.getByRole("button", { name: "한 번에 던지기" }).click();
await page.waitForTimeout(1300); await shot("j14_의식_괘완성");
console.log("journey shots →", SHOTS);
await b.close();
