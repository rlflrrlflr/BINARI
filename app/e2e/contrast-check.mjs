/* 홀로 스킨 대비 검사 — 실행: node e2e/contrast-check.mjs (미리보기 서버 필요)
 *
 * 왜 있나: `holo-check.mjs` 의 글자 검출기는 ⓐ `button·a·input` 을 안 보고
 *   ⓑ **배경을 안 재서** 어두운 섬을 원리적으로 못 잡고 ⓒ 문턱이 절대 밝기라
 *   `#9d8fb5`(대비 2.04) 를 통과시킨다. 가독성 감사(03_비주얼프로토타입/…홀로가독성감사_v01.md)가
 *   지목한 그대로다. 여기서는 **조상을 타고 올라가 실제 합성 배경을 구한 뒤 WCAG 대비**로 잰다.
 *   그래야 어두운 문서는 자동으로 통과시키면서 밝은 판의 실패만 잡는다.
 *
 * ⚠ 대비만 재고 「고쳐라」는 안 한다. 예외는 `SKIP` 에 사유와 함께 적는다. */
import { chromium } from "playwright";
import { onboard } from "./onboard.mjs";

const BASE = process.env.BASE || "http://localhost:4173";
const AA = 4.5, AA_BIG = 3.0;
/* SKIN=base 로 돌리면 **기존(홀로 아님) 화면**을 잰다 — 실패가 홀로 탓인지
   원래 그런지 가르는 데 쓴다. 원래 그런 것은 이 작업의 범위가 아니다(본선 화면을 바꾸는 일이다). */
const QS = process.env.SKIN === "base" ? "/" : "/?skin=holo";

/* 명시적으로 봐주는 것 — 사유 없이 추가하지 마라 */
const SKIP = new Set([
  /* 생년월일 칸 예시. 진하면 「이미 입력된 값」으로 오인한다(창업자 실기 2026-08-28).
     예시는 값보다 확실히 옅어야 한다 — 색으로 풀 문제가 아니다. */
  "::placeholder",
]);

const PROBE = `() => {
  const hex = (c) => {
    const m = c.match(/[\\d.]+/g); if (!m) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] };
  };
  const over = (f, b) => ({ r: f.r*f.a + b.r*(1-f.a), g: f.g*f.a + b.g*(1-f.a), b: f.b*f.a + b.b*(1-f.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1,l2), lo = Math.min(l1,l2);
    return (hi + 0.05) / (lo + 0.05); };
  /* 그라데이션은 색 정지점들의 평균으로 근사한다 — 이 검사가 잡는 실패는 1~3 대라
     근사가 판정을 뒤집지 않는다. 경계선(4.3~4.7)만 참고값으로 본다. */
  const fromImage = (img) => {
    const ms = img.match(/rgba?\\([^)]+\\)/g); if (!ms || !ms.length) return null;
    const cs = ms.map(hex).filter((c) => c && c.a > 0.02); if (!cs.length) return null;
    return cs.reduce((a, c) => ({ r: a.r + c.r/cs.length, g: a.g + c.g/cs.length, b: a.b + c.b/cs.length, a: 1 }),
      { r: 0, g: 0, b: 0, a: 1 });
  };
  /* 조상을 타고 올라가며 **불투명한 판을 만날 때까지** 반투명 층을 쌓는다 */
  const bgOf = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      let c = hex(s.backgroundColor);
      const gi = s.backgroundImage && s.backgroundImage !== "none" ? fromImage(s.backgroundImage) : null;
      if (gi) c = c && c.a > 0.02 ? over(gi, c) : gi;
      if (c && c.a > 0.02) { stack.push(c); if (c.a >= 0.99) break; }
    }
    let out = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
    return out;
  };
  const sel = (el) => {
    const c = (el.className && el.className.toString ? el.className.toString() : "").trim().split(/\\s+/).filter(Boolean);
    return el.tagName.toLowerCase() + (c.length ? "." + c.join(".") : "");
  };
  const out = [];
  const nodes = document.querySelectorAll("p,b,span,i,li,h1,h2,h3,strong,em,small,label,button,a,input,textarea,td,th,div");
  nodes.forEach((el) => {
    /* 자기 글자를 직접 가진 것만 — 컨테이너까지 세면 같은 글자를 여러 번 센다 */
    let own = "";
    el.childNodes.forEach((n) => { if (n.nodeType === 3) own += n.textContent; });
    const ph = el.placeholder || "";
    if (!own.trim() && !ph.trim()) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || +s.opacity < 0.06) return;
    const fg0 = hex(s.color); if (!fg0) return;
    const bg = bgOf(el);
    const fg = over(fg0, bg);
    const px = parseFloat(s.fontSize) || 16;
    const bold = +(s.fontWeight) >= 600 || s.fontWeight === "bold";
    const big = px >= 24 || (px >= 18.66 && bold);
    out.push({ sel: sel(el), text: (own.trim() || ph.trim()).slice(0, 24),
      color: s.color, bg: "rgb(" + [bg.r,bg.g,bg.b].map(Math.round).join(",") + ")",
      px: +px.toFixed(1), big, cr: +ratio(fg, bg).toFixed(2) });
  });
  return out;
}`;

let seen = new Map();
let broken = [];

const collect = async (page, where) => {
  let rows = [];
  try { rows = await page.evaluate(eval("(" + PROBE + ")")); }
  catch (e) { broken.push(where + " 측정 실패: " + String(e).slice(0, 70)); return; }
  let add = 0;
  for (const r of rows) {
    const key = where + "|" + r.sel + "|" + r.text;
    if (!seen.has(key)) { seen.set(key, { ...r, where, key }); add++; }
  }
  if (process.env.V) console.log(`  ${where}: 요소 ${rows.length} · 새로 ${add}`);
};

/* ⚠ 걸음이 조용히 실패하면 **그 화면을 안 재고도 통과**한다 — 검사가 공허해지는 그 길이다. */
const step = async (page, label, fn) => {
  try { await fn(); await page.waitForTimeout(500); await collect(page, label); }
  catch (e) { broken.push(label + ": " + String(e).split("\n")[0].slice(0, 80)); }
};

async function run(page, qs) {
  await page.goto(BASE + qs); await page.waitForTimeout(900);
  await collect(page, "인트로");
  /* ⚠ `onboard()` 는 화면을 **지나쳐 간다**. 온보딩이 실패의 절반이라(칩·검증오류·처리방침 링크)
     여기서는 한 걸음씩 직접 걸으며 화면마다 잰다. 문구가 바뀌면 여기도 같이 고쳐야 한다. */
  const S = (l, f) => step(page, l, f);
  await S("시작", () => page.getByRole("button", { name: "조각을 모으러 갈래" }).click());
  await S("이름", () => page.getByRole("button", { name: "이름 없이 갈래" }).click());
  await S("생일", async () => {
    const ins = page.locator("input.in:not(.wide)");
    await ins.nth(0).fill("1990"); await ins.nth(1).fill("2"); await ins.nth(2).fill("25");
  });
  await S("생시", () => page.getByRole("button", { name: "이 하늘이야" }).click());
  await S("회상", async () => {
    const t = page.locator("input.in:not(.wide)");
    await t.nth(0).fill("14"); await t.nth(1).fill("30");
    await page.getByRole("button", { name: "기억났어" }).click();
    await page.getByRole("button", { name: "다음" }).click();
  });
  await S("탄생", async () => {
    await page.getByRole("button", { name: "하늘을 열기" }).click();
    await page.waitForTimeout(4500);
    await page.getByRole("button", { name: "응, 기억나" }).click({ timeout: 12000 });
    await page.waitForSelector("text=두드려봐", { timeout: 12000 });
  });
  await S("로비", async () => {
    await page.locator("canvas").first().dblclick();
    await page.waitForSelector("textarea.qbox", { timeout: 12000 });
    await page.waitForTimeout(800);
  });
  /* ⚠ **문서까지 걸어야 한다.** 감사가 찾은 가장 큰 실패(각인 문서 제목 1.16)가 여기 있었고,
     원인은 홀로 규칙이 후손 선택자라 **어두운 문서 안까지 내려간 것**이다.
     로비만 걷는 검사는 이 종류를 원리적으로 못 잡는다. */
  await S("각인 문서", async () => {
    await page.getByRole("button", { name: /각인 —/ }).click();
    await page.waitForSelector(".readwrap", { timeout: 15000 });
    await page.waitForTimeout(1200);
  });
  await S("각인 닫기", async () => {
    await page.getByRole("button", { name: /닫을게/ }).last().click();
    await page.waitForTimeout(800);
  });
  for (const tab of ["곁", "판결"]) {
    await S(tab + " 탭", async () => {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await page.waitForTimeout(1400);
    });
  }
}

const b = await chromium.launch({ executablePath: process.env.CHROME_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });

/* ⚠ **두 판을 다 걷는다.** 홀로만 재면 「원래부터 낮은 것」까지 홀로 탓으로 잡힌다 —
   실측으로 기존 화면에 13건이 있었고 홀로에 남은 2건이 **그 안에 들어 있었다.**
   이 검사가 물어야 하는 건 「대비가 낮은 곳」이 아니라 **「홀로가 나쁘게 만든 곳」** 이다.
   원래부터 낮은 것은 본선 화면을 바꾸는 일이라 별건이고, 아래에 참고로만 적는다. */
const walk = async (qs) => {
  seen = new Map(); broken = [];
  const page = await b.newPage({ viewport: { width: 393, height: 852 } });
  await run(page, qs);
  await page.close();
  return { rows: [...seen.values()], broken: [...broken] };
};

const base = await walk("/");
const holo = await walk("/?skin=holo");
await b.close();

const skip = (r) => r.text.startsWith("::") || [...SKIP].some((k) => r.sel.includes(k));
const bad = (r) => r.cr < (r.big ? AA_BIG : AA);
const baseMap = new Map(base.rows.map((r) => [r.key, r]));

const holoBad = holo.rows.filter((r) => !skip(r) && bad(r));
const 홀로탓 = holoBad.filter((r) => { const b0 = baseMap.get(r.key); return !b0 || !bad(b0); });
const 원래 = holoBad.filter((r) => { const b0 = baseMap.get(r.key); return b0 && bad(b0); });
/* 기준은 넘겼지만 **홀로가 원본보다 나쁘게 만든 것** — 다음번 실패 후보다 */
/* ⚠ 「기존보다 낮아짐」만으로 세면 **개선까지 후보로 잡힌다** — 어두운 판의 12:1 이
   밝은 판의 7.5:1 이 된 건 나빠진 게 아니라 판이 바뀐 것이다. 여유가 실제로 얇은 것만 본다. */
const 나빠짐 = holo.rows.filter((r) => { const b0 = baseMap.get(r.key);
  return b0 && !bad(r) && r.cr < 5.5 && r.cr < b0.cr * 0.6; });

const line = (r) => `${String(r.cr).padStart(5)}  ${r.where.padEnd(7)} ${r.sel.slice(0, 40).padEnd(41)} ${r.color.padEnd(21)} on ${r.bg.padEnd(17)} ${r.px}px  "${r.text}"`;
console.log(`측정 홀로 ${holo.rows.length}건 / 기존 ${base.rows.length}건 · 기준 본문 ${AA} · 큰글자 ${AA_BIG}\n`);
console.log(`■ 홀로가 만든 실패 ${홀로탓.length}건`);
홀로탓.sort((a, c) => a.cr - c.cr).forEach((r) => console.log("  " + line(r)));
console.log(`\n□ 원래부터 낮은 곳 ${원래.length}건 — 본선 화면 문제라 이 작업 범위 밖이다(참고)`);
원래.sort((a, c) => a.cr - c.cr).slice(0, 12).forEach((r) => console.log("  " + line(r)));
if (나빠짐.length) {
  console.log(`\n△ 기준은 넘겼지만 홀로가 크게 낮춘 곳 ${나빠짐.length}건 — 다음 실패 후보`);
  나빠짐.sort((a, c) => a.cr - c.cr).slice(0, 10).forEach((r) => console.log("  " + line(r)));
}
const allBroken = [...base.broken, ...holo.broken];
if (allBroken.length) {
  console.log("\n⚠ 못 걸은 화면 " + allBroken.length + "개 — 재지 못한 곳이 있다는 뜻이다:");
  allBroken.forEach((x) => console.log("   " + x));
}
const ok = 홀로탓.length === 0 && allBroken.length === 0;
console.log(`\n=== 홀로 대비: 홀로가 만든 실패 ${홀로탓.length}건 · 못 걸은 화면 ${allBroken.length}개 ${ok ? "PASS" : "FAIL"} ===`);
process.exit(ok ? 0 : 1);
