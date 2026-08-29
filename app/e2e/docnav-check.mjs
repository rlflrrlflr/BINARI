/* 문서 목차 — **긴 문서에서 길을 놓아 주는가.**
   실행: preview 기동 후 node e2e/docnav-check.mjs

   왜 있나: 유저 제보 둘이 이 파일의 이유다(2026-08-28).
     ① *"내용이 너무 길고 … 보려던 내용을 다시 위로 올리니 어디였는지 찾기 어렵다.
        고정 목차나 내비게이션바를 배치하면 어떨까요?"*
     ② *"섹션별 타이틀이 잘 눈에 안 들어와서 … 타이틀을 위에 박으면 한눈에 들어오겠다."*
   §알 권리(2026-08-06)가 *"값을 치른 문서는 줄 수 있는 걸 다 주고 완결시킨다"* 로 정한 이상
   **문서는 앞으로도 길다** — 짧게 만드는 게 답이 아니라 길을 놓는 게 답이다. 그 길을 여기서 문다. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";
const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(12000);
const { onboard } = await import("./onboard.mjs");
await onboard(page, BASE);
await page.getByRole("button", { name: /각인 —/ }).click();
await page.waitForSelector(".imp", { timeout: 9000 });
await page.waitForTimeout(1600);

/* ── ① 목차가 있고, **그려진 섹션에서** 나온다 ────────────────────────────── */
const chips = page.locator(".docchip");
const nChip = await chips.count();
ck("① 목차가 뜬다", nChip >= 3, `${nChip}칩`);
/* ⚠ **손으로 적은 목록이면 없는 자리로 보낸다.** 각인은 조건부 섹션이 셋이라(짝·직장·삶의 자리)
   사람마다 개수가 다르다 — 칩 수가 실제 제목 수와 같아야 목록을 손으로 안 적었다는 뜻이다. */
const nHead = await page.locator(".imp .imph[data-tag]").count();
ck("① 칩 수 = 그려진 섹션 수 (목록을 손으로 안 적었다)", nChip === nHead, `칩 ${nChip} · 제목 ${nHead}`);

/* ── ② 눌러서 실제로 간다 ─────────────────────────────────────────────── */
const top0 = await page.evaluate(() => document.querySelector(".readwrap").scrollTop);
await chips.nth(Math.min(5, nChip - 1)).click();
await page.waitForTimeout(1300);
const top1 = await page.evaluate(() => document.querySelector(".readwrap").scrollTop);
ck("② 칩을 누르면 그 자리로 간다", top1 > top0 + 300, `${top0} → ${top1}`);
/* ⚠ 눌러서 건너뛰면 제목이 관찰 띠를 **지나쳐 버린다** — 처음에 띠를 5%로 잡았다가
   활성 칩이 안 따라왔다(「삶의 자리」로 갔는데 칩은 「너」). 도착지가 활성이어야 한다. */
const onTxt = await page.locator(".docchip.on").innerText().catch(() => "");
const wantTxt = await chips.nth(Math.min(5, nChip - 1)).innerText();
ck("② 도착한 자리가 활성 칩이 된다", onTxt.trim() === wantTxt.trim(), `${onTxt} / ${wantTxt}`);

/* ── ③ 띠가 화면을 안 가리고, 닫기와 안 겹친다 ───────────────────────────── */
ck("③ 목차가 위에 붙어 있다(스크롤해도 남는다)",
   await page.evaluate(() => { const n = document.querySelector(".docnav"); return !!n && n.getBoundingClientRect().top < 80; }));
/* ⚠ 실물 스샷으로 잡은 것 — 마지막 칩이 닫기(✕) 밑에 깔려 있었다 */
ck("③ 마지막 칩이 닫기 버튼 밑에 안 깔린다", await page.evaluate(() => {
  const cs = [...document.querySelectorAll(".docchip")]; if (!cs.length) return true;
  const c = cs[cs.length - 1].getBoundingClientRect(), x = document.querySelector(".escx").getBoundingClientRect();
  return c.right < x.left || c.left > x.right;
}));
/* 눌러서 간 제목이 띠 밑에 깔리면 "갔는데 안 보인다"가 된다 */
ck("③ 눌러서 간 제목이 띠 밑에 안 깔린다", await page.evaluate(() => {
  const on = document.querySelector(".docchip.on"); if (!on) return false;
  const h = [...document.querySelectorAll(".imph[data-tag]")].find((x) => x.dataset.tag === on.innerText.trim());
  if (!h) return false;
  const n = document.querySelector(".docnav").getBoundingClientRect();
  return h.getBoundingClientRect().top >= n.bottom - 2;
}));

/* ── ④ 제목이 제목처럼 보인다 (제보 ②) ──────────────────────────────────── */
const hStyle = await page.evaluate(() => {
  const h = document.querySelector(".imp .imph[data-tag]"); if (!h) return null;
  const cs = getComputedStyle(h);
  const body = getComputedStyle(document.querySelector(".imp .impp") || h);
  return { size: parseFloat(cs.fontSize), weight: +cs.fontWeight, bodySize: parseFloat(body.fontSize) };
});
/* ⚠ 전엔 10.5px 자간 .16em 이라 **제목이 아니라 라벨로** 읽혔다 — 본문보다 작았다.
   숫자를 못 박지 않고 **본문보다 큰가**로 문다(본문 크기가 바뀌어도 뜻이 산다). */
ck("④ 제목이 본문보다 크다", hStyle && hStyle.size > hStyle.bodySize, hStyle ? `제목 ${hStyle.size}px · 본문 ${hStyle.bodySize}px` : "못 읽음");
ck("④ 제목이 굵다", hStyle && hStyle.weight >= 600, hStyle ? String(hStyle.weight) : "");
/* 부제가 오른쪽에 떠 있으면 430px 에서 제목과 한 줄에 끼어 둘 다 안 읽힌다 */
ck("④ 부제가 제목 아랫줄에 있다(오른쪽 띄우기 아님)", await page.evaluate(() => {
  const i = document.querySelector(".imp .imph[data-tag] i");
  return !i || getComputedStyle(i).cssFloat === "none";
}));

/* ── ⑤ 궁합에도 같은 목차가 붙는다 (컴포넌트가 하나다) ────────────────────── */
await page.getByRole("button", { name: /닫을게/ }).last().click().catch(() => {});
await page.waitForTimeout(700);
{
  const { openMatch } = await import("./open-match.mjs");
  await openMatch(page);
  const ins = page.locator(".impask input.impnum");
  await ins.nth(0).fill("1997"); await ins.nth(1).fill("4"); await ins.nth(2).fill("22");
  await page.getByRole("button", { name: "둘을 맞대 볼게" }).click();
  await page.waitForTimeout(1500);
  ck("⑤ 궁합에도 같은 목차가 붙는다", (await page.locator(".docchip").count()) >= 3,
     `${await page.locator(".docchip").count()}칩`);
}

await b.close();
const pass = R.filter(Boolean).length;
console.log(`\n=== 문서 목차: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
