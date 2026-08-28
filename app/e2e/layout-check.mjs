/* 기기별 레이아웃 — 탭이 본문을 가리지 않는가, 두 탭의 본문이 같은 자리에 있는가.
   실행: preview 기동 후 node e2e/layout-check.mjs

   왜 있나: v132.3 을 실기(iPhone·사파리)에서 보고 창업자가 두 가지를 지적했다.
     ① 판결 탭 "두드려봐" 가 **탭 스크림에 먹혔다** — `.lobbypanel` 이 `bottom:14vh` 였는데
        작은 기기일수록 14vh 가 짧아져 스크림 안으로 들어간다. vh 로 잡은 게 원인이다.
     ② 곁 탭 문구가 판결과 **다른 높이**에 있었다 — 판결만 absolute, 곁은 문서 흐름이었다.
   둘 다 "내 기기에선 괜찮아 보이는" 종류라, 눈으로 보는 대신 **기기 크기를 바꿔 가며 좌표를 잰다.**

   ⚠ 생년월일은 onboard.mjs 의 가상 값을 쓴다(CLAUDE.md §운영 규칙). */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";
const { onboard } = await import("./onboard.mjs");

/* 작은 기기(SE)가 제일 잘 깨진다 — 반드시 남겨 둘 것 */
const DEVICES = [
  ["iPhone SE", 375, 667],
  ["iPhone 15", 393, 852],
  ["Pixel 8", 412, 915],
  ["Desktop", 1280, 800],
];

const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
for (const [name, w, h] of DEVICES) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  page.setDefaultTimeout(9000);
  await onboard(page, BASE);
  await page.reload(); await page.waitForTimeout(1600);

  /* 본문 맨 아랫줄이 "탭이 차지하는 높이"(알약 + 그 위 페이드) 위에 있어야 한다 */
  const probe = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s), tb = document.querySelector("nav.tabbar");
    if (!el || !tb) return null;
    const scrim = parseFloat(getComputedStyle(document.querySelector(".stage")).getPropertyValue("--tabscrim")) || 72;
    return { bottom: Math.round(el.getBoundingClientRect().bottom),
             limit: Math.round(tb.getBoundingClientRect().top - scrim) };
  }, sel);

  const j = await probe(".lobbypanel");
  await page.getByRole("button", { name: "곁" }).click(); await page.waitForTimeout(700);
  /* ⚠ 재는 대상을 **패널 전체**로 바꿨다(v144). 처음엔 두 탭의 마지막 줄(`.wakehint` ↔ `.fine`)을
     맞댔는데, 그 뒤 곁 탭에 안내 문구와 버튼이 붙어 `.fine` 이 더는 마지막 줄이 아니게 됐다 —
     검사는 FAIL 인데 화면은 멀쩡했다. **두 탭이 같은 자리에서 끝나는가**를 보려면 패널을 재야 한다. */
  const g = await probe(".gyeotpanel");
  await page.close();

  ck(`${name} — 판결 문구가 탭에 안 가림`, !!j && j.bottom <= j.limit, j && `끝 ${j.bottom} ≤ 한계 ${j.limit}`);
  ck(`${name} — 곁 문구가 탭에 안 가림`, !!g && g.bottom <= g.limit, g && `끝 ${g.bottom} ≤ 한계 ${g.limit}`);
  ck(`${name} — 두 탭 본문이 같은 높이`, !!j && !!g && Math.abs(j.bottom - g.bottom) <= 20,
     j && g && `차 ${Math.abs(j.bottom - g.bottom)}px ≤ 20`);
}
await b.close();

const pass = R.filter(Boolean).length;
console.log(`\n=== 기기별 레이아웃: ${pass}/${R.length} ${pass === R.length ? "PASS" : "FAIL"} ===`);
process.exit(pass === R.length ? 0 : 1);
