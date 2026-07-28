#!/usr/bin/env node
/* 보드를 PNG로 떠낸다(브라우저 없이 결과만 보고 싶을 때).
   실행: node app/tools/shoot-guardian-board.mjs [출력디렉터리]
   출력: 01_현재_오행x모드.png · 02_매트릭스_A|B|C.png · 03_2D계보.png

   매트릭스는 화면에 보이는 줄만 렌더하므로, 뷰포트를 통째로 키워 전 줄을 한 장에 담는다. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + join(ROOT, "app/public/guardian-board.html");
const OUT = process.argv[2] || join(ROOT, "app/public/board-shots");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });

/* ── 1절: 현재 버전 오행 × 모드 ── */
{
  const page = await browser.newPage({ viewport: { width: 1240, height: 1600 }, deviceScaleFactor: 2 });
  await page.goto(PAGE);
  await page.waitForTimeout(6000);                       // 어셈블(u_k) 완료 대기
  const box = await page.locator(".glwrap").first().boundingBox();
  await page.screenshot({ path: join(OUT, "01_현재_오행x모드.png"), clip: box });
  await page.close();
  console.log("01_현재_오행x모드.png");
}

/* ── 2절: 버전 매트릭스 — 모드별 3장 ── */
for (const mode of ["A", "B", "C"]) {
  const page = await browser.newPage({ viewport: { width: 1240, height: 7000 }, deviceScaleFactor: 1 });
  await page.goto(PAGE);
  await page.waitForTimeout(1500);
  await page.evaluate(m => document.querySelector(`#mmode button[data-mode="${m}"]`).click(), mode);
  await page.evaluate(() => document.querySelector(".matrix").scrollIntoView({ block: "start" }));
  await page.waitForTimeout(mode === "B" ? 16000 : 9000);  // sim 스프링 안정 + 터치 모임 완료(소프트웨어 렌더는 느리다)
  if (mode === "C") {                                     // GO(솟구쳐 펼침) 국면에서 찍는다
    await page.waitForFunction(() => {
      const t = (performance.now() - window.__T0) / 1000;
      const c = t % 12; return c > 2.4 && c < 3.2;
    }, null, { timeout: 20000 }).catch(() => {});
  }
  const box = await page.locator(".matrix").boundingBox();
  await page.screenshot({ path: join(OUT, `02_매트릭스_${mode}.png`), clip: box });
  await page.close();
  console.log(`02_매트릭스_${mode}.png`);
}

/* ── 3절: 2D 형태 계보 ── */
{
  const page = await browser.newPage({ viewport: { width: 1240, height: 1400 }, deviceScaleFactor: 2 });
  await page.goto(PAGE);
  await page.evaluate(() => document.getElementById("gen").scrollIntoView({ block: "center" }));
  await page.waitForTimeout(5000);
  const box = await page.locator("#gen").boundingBox();
  await page.screenshot({ path: join(OUT, "03_2D계보.png"), clip: box });
  await page.close();
  console.log("03_2D계보.png");
}

await browser.close();
console.log("→ " + OUT);
