/* 공유 카드 실물 뽑기 — 실행: preview 기동 후 node e2e/card-shot.mjs [출력폴더]
   카드는 **그림**이라 검사만으로는 "재미없다"를 못 잡는다. 실제로 떠서 눈으로 본다.
   ⚠ 검사가 아니다(통과/실패 없음). 창업자 검수용 산출물이다. */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";
const OUT = process.argv[2] || ".";

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
await page.goto(BASE); await page.waitForTimeout(800);

/* 앱을 온보딩까지 태우지 않고 **빌더만** 부른다 — 카드 문구·배치를 보는 게 목적이다.
   빌더는 모듈 스코프에 있어 window 로 노출돼 있지 않으므로, 번들에서 직접 끌어오지 않고
   앱이 실제로 그리는 경로(버튼)를 쓰는 대신 여기서는 lib 로 문구만 뽑고 캔버스는 앱 코드로 그린다. */
const shots = await page.evaluate(async () => {
  const { readMatch } = await import("/src/lib/match.js").catch(() => ({}));
  return { hasLib: !!readMatch };
}).catch(() => ({ hasLib: false }));

/* 번들에서 빌더를 못 부르므로 실제 유저 경로로 간다 */
async function onboard() {
  await page.getByRole("button", { name: "조각을 모으러 갈래" }).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "이름 없이 갈래" }).click();
  const ins = page.locator("input.in:not(.wide)");
  await ins.nth(0).fill("1990"); await ins.nth(1).fill("2"); await ins.nth(2).fill("25");
  await page.getByRole("button", { name: "이 하늘이야" }).click();
  const tins = page.locator("input.in:not(.wide)");
  await tins.nth(0).fill("14"); await tins.nth(1).fill("30");
  await page.getByRole("button", { name: "기억났어" }).click();
  await page.getByRole("button", { name: "남", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "하늘을 열기" }).click();
  await page.getByRole("button", { name: "응, 기억나" }).click({ timeout: 12000 });
  await page.waitForSelector("text=두드려봐", { timeout: 12000 });
  await page.locator("canvas").first().dblclick();
  await page.waitForSelector("textarea.qbox", { timeout: 12000 }); await page.waitForTimeout(600);
}
await onboard();

/* 저장 경로를 가로채 dataURL 만 받는다 — 파일로 떨어뜨리는 건 우리가 한다 */
const grab = async (btnRe) => await page.evaluate(async (re) => await new Promise((res) => {
  let url = null;
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) url = this.href; else realClick.call(this); };
  const btn = [...document.querySelectorAll("button")].find((b) => new RegExp(re).test(b.textContent));
  if (!btn) return res(null);
  btn.click();
  setTimeout(() => { HTMLAnchorElement.prototype.click = realClick; res(url); }, 1200);
}), btnRe);

const save = (name, dataUrl) => {
  if (!dataUrl) { console.log(`✗ ${name} — 못 뽑음`); return; }
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`✓ ${OUT}/${name}.png`);
};

console.log("로비 수호신:", await page.evaluate(() => [...document.querySelectorAll("canvas[data-renderer]")].map((c) => `${c.width}x${c.height} ${c.dataset.renderer}`)));
await page.getByRole("button", { name: /각인 — 네가 어떻게/ }).click(); await page.waitForTimeout(1000);
console.log("각인 연 뒤 수호신:", await page.evaluate(() => [...document.querySelectorAll("canvas[data-renderer]")].map((c) => `${c.width}x${c.height}`)));
save("card-imprint", await grab("이미지로 간직하기 — 겉과 속"));
await page.getByRole("button", { name: "닫을게" }).click(); await page.waitForTimeout(500);

await page.getByRole("button", { name: /궁합 — 그 사람과 너/ }).click(); await page.waitForTimeout(400);
const ins = page.locator(".imp .impnum");
await ins.nth(0).fill("1997"); await ins.nth(1).fill("4"); await ins.nth(2).fill("22");
await page.getByRole("button", { name: /둘을 맞대 볼게/ }).click(); await page.waitForTimeout(600);
save("card-match", await grab("이미지로 간직하기 — 한 장"));

await b.close();
