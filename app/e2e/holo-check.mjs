/* 홀로 스킨이 **온보딩 전 과정에** 걸려 있는가. 실행: preview 기동 후 node e2e/holo-check.mjs
 *
 * 왜 있나 — v150 에서 "여섯 건 다 반영했다"고 보고했는데 창업자가 실기에서 다시 잡았다.
 *   판결·곁·이름 화면만 눈으로 보고, **온보딩 중반(회상·기억이 돌아오는 중)은 안 봤다.**
 *   거기엔 홀로 분기가 아예 없어 어두운 판용 먼지 오브와 노랑·보라 글자가
 *   미색 바탕에 그대로 떠 있었다. 화면 수가 아홉인데 셋만 본 게 원인이고,
 *   그건 **사람 주의로 막을 종류가 아니다.**
 *
 * 검사하는 것 — 아홉 화면을 전부 지나가며
 *   ① 심볼이 홀로 색장(canvas.gcv)인가 — 입자·먼지 오브가 남아 있으면 걸린다
 *   ② 미색 바탕(#d9d5ca, L213)에서 **안 읽히는 밝은 글자**가 없는가(L>170)
 *   ③ 예시(placeholder)가 입력값보다 확실히 옅은가 — 진하면 이미 입력된 걸로 오인된다
 *
 * ⚠ 생년월일은 가상 값이다(CLAUDE.md §운영 규칙).
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const BASE = process.env.BASE || "http://localhost:4173";

const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

const b = await pw.chromium.launch(process.env.CHROME_PATH
  ? { executablePath: process.env.CHROME_PATH, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] }
  : { args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await b.newPage({ viewport: { width: 393, height: 852 } });
page.setDefaultTimeout(15000);

const probe = () => page.evaluate(() => {
  const L = (c) => { const m = c.match(/\d+/g); return m ? 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2] : 0; };
  const bright = [];
  for (const el of document.querySelectorAll("p,b,span,i,li,h1,h2,strong")) {
    if (!el.textContent.trim() || el.offsetParent === null || el.children.length) continue;
    const c = getComputedStyle(el).color;
    if (L(c) > 170) bright.push(`${el.className || el.tagName} "${el.textContent.trim().slice(0, 14)}" ${c}`);
  }
  const cvs = [...document.querySelectorAll("canvas")].map((c) => c.className || "(무명)");
  const ph = [...document.querySelectorAll("input")].filter((i) => i.placeholder && !i.value)
    .map((i) => ({ p: i.placeholder, c: L(getComputedStyle(i, "::placeholder").color) }));
  return { bright: [...new Set(bright)], cvs, ph };
});

const step = async (tag) => {
  const d = await probe();
  ck(`${tag} — 심볼이 홀로 색장`, d.cvs.length > 0 && d.cvs.every((c) => c === "gcv"),
     d.cvs.join(",") || "캔버스 없음");
  ck(`${tag} — 안 읽히는 밝은 글자 없음`, d.bright.length === 0, d.bright[0] || "깨끗");
  if (d.ph.length) ck(`${tag} — 예시가 값보다 옅다`, d.ph.every((x) => x.c > 150),
     d.ph.map((x) => `${x.p}:L${Math.round(x.c)}`).join(" "));
};
const click = async (re) => { await page.getByRole("button", { name: re }).click(); await page.waitForTimeout(700); };

await page.goto(BASE + "/?skin=holo"); await page.waitForTimeout(1600);
await step("① 인트로");
await click("조각을 모으러 갈래");   await step("② 이름");
await click("이름 없이 갈래");
const i1 = page.locator("input.in:not(.wide)");
await i1.nth(0).fill("1990"); await i1.nth(1).fill("2"); await i1.nth(2).fill("25");
await step("③ 생년월일");
await click("이 하늘이야");
const i2 = page.locator("input.in:not(.wide)");
await i2.nth(0).fill("14"); await i2.nth(1).fill("30");
await step("④ 시간");
await click("기억났어");            await step("⑤ 도시");
await click("다음");                await step("⑥ 확인");
await click("하늘을 열기"); await page.waitForTimeout(1200);
await step("⑦ 회상");
await page.waitForTimeout(4500);    await step("⑧ 기억 완료");
await click("응, 기억나"); await page.waitForTimeout(2200);
await step("⑨ 탄생");
await b.close();

const pass = R.filter(Boolean).length;
console.log(`\n=== 홀로 스킨 전 과정: ${pass}/${R.length} ${pass === R.length ? "PASS" : "FAIL"} ===`);
process.exit(pass === R.length ? 0 : 1);
