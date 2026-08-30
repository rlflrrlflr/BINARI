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

/* ── ⑩ 곁은 **둥글어야** 한다 ────────────────────────────────────────────
   ⚠ 처음엔 바운딩박스 가로/세로 비로 쟀다가 **0.98 이 나와 통과시켰는데 실기에선
      둥근 삼각형이었다.** 삼각형도 가로세로 비는 1 에 가깝다 — 지표가 형태를 안 쟀다.
   그래서 **무게중심에서 각도별 반경**을 재고 그 편차를 본다. 삼각형이면 3주기로 크게 흔들린다.
   원인은 매번 달랐다(각도 굴곡 sin(ang*3) · 층 어긋남 · 뭉게 변조 lobes=3) —
   전부 "각도에 3이 곱해진 항"이었고, 화면에는 똑같이 삼각형으로 나온다. */
/* ⚠ **2026-08-30 지표 교체.** 예전 판은 광선마다 **알파가 처음 90 아래로 떨어지는 점**을
   반경으로 삼았다. 그런데 셰이더는 화면 전체에 그레인(픽셀 단위 난수)을 뿌린다 —
   가장자리는 기울기가 완만해서 **난수 한 픽셀이 광선을 일찍 끊는다.** 그래서 이 값이
   같은 코드에서도 0.14~0.17 로 흔들렸고(오늘 확인: 오늘 작업 이전 커밋도 0.163),
   통과·실패가 운에 좌우됐다. **형태가 아니라 노이즈를 재고 있었다.**
   셋을 고친다 — ①광선 위 3픽셀 평균으로 문턱을 넘겨 그레인을 눌러 없앤다
   ②마지막으로 문턱을 넘은 지점을 반경으로 쓴다(첫 교차가 아니라)
   ③여러 프레임을 평균낸다. 그리고 **지표 자체를 먼저 검증한다**(아래 ⑩-0). */
const HARM = `(A, W, H) => {
  let sx = 0, sy = 0, sw = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = A(x, y); if (v > 60) { sx += x * v; sy += y * v; sw += v; } }
  const cx = sx / sw, cy = sy / sw, rs = [];
  for (let i = 0; i < 72; i++) {
    const th = i / 72 * Math.PI * 2, dx = Math.cos(th), dy = Math.sin(th);
    let r = 0;
    for (let t = 1; t < W; t++) {
      const x = Math.round(cx + dx * t), y = Math.round(cy + dy * t);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) break;
      const m = (A(x, y) + A(x - 1, y) + A(x + 1, y) + A(x, y - 1) + A(x, y + 1)) / 5;
      if (m >= 90) r = t; else if (t > r + 6) break;
    }
    rs.push(r);
  }
  let re = 0, im = 0;
  for (let i = 0; i < 72; i++) { const th = i / 72 * Math.PI * 2 * 3; re += rs[i] * Math.cos(th); im += rs[i] * Math.sin(th); }
  const mean = rs.reduce((s, v) => s + v, 0) / rs.length;
  return mean > 0 ? 2 * Math.hypot(re, im) / 72 / mean : 0;
}`;
/* ⑩-0 **지표를 먼저 믿을 수 있는지 본다.** 합성 도형으로 눈금을 맞춘다 —
   원은 낮게, 둥근 삼각형은 높게 나와야 이 문턱(0.06)이 뜻을 갖는다.
   이걸 안 하면 "낮게 나왔다"가 둥글다는 뜻인지 지표가 죽었다는 뜻인지 모른다. */
const cal = await page.evaluate((src) => {
  const harm = eval(src), N = 220;
  const mk = (tri) => { const c = document.createElement("canvas"); c.width = c.height = N;
    const g = c.getContext("2d"); g.fillStyle = "#fff";
    g.beginPath();
    if (!tri) g.arc(N / 2, N / 2, N * 0.32, 0, 7);
    else { for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 - Math.PI / 2;
      const x = N / 2 + Math.cos(a) * N * 0.36, y = N / 2 + Math.sin(a) * N * 0.36;
      i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); }
    g.fill();
    const d = g.getImageData(0, 0, N, N).data;
    return harm((x, y) => d[4 * (y * N + x) + 3], N, N); };
  return { circle: +mk(false).toFixed(3), tri: +mk(true).toFixed(3) };
}, HARM);
ck("⑩-0 지표가 원과 삼각형을 가른다", cal.circle < 0.03 && cal.tri > 0.10,
   `원 ${cal.circle} / 삼각 ${cal.tri}`);
const rad = async () => {
  const v = [];
  for (let i = 0; i < 5; i++) {
    v.push(await page.evaluate((src) => {
      const harm = eval(src);
      const c = document.querySelector("canvas"), g = c.getContext("webgl");
      const W = c.width, H = c.height, a = new Uint8Array(4 * W * H);
      g.readPixels(0, 0, W, H, g.RGBA, g.UNSIGNED_BYTE, a);
      return harm((x, y) => a[4 * (y * W + x) + 3], W, H);
    }, HARM));
    await page.waitForTimeout(130);
  }
  return +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(3);
};
/* ⚠ 판결과 **비교**하지 않는다 — 판결 오라는 캔버스를 거의 채워서 등고선이 경계에 걸리고
      3주기 성분이 0 으로 나온다(측정이 안 되는 것이지 둥근 게 아니다). 곁의 절대값만 본다. */
await page.getByRole("button", { name: "곁" }).click(); await page.waitForTimeout(2400);
const gyeot3 = await rad();
ck("⑩ 곁이 둥글다 — 삼각(3주기) 성분", gyeot3 < 0.06, `${gyeot3} (0.06 미만이어야)`);

/* ── ⑪ xyz 로 **눈에 보이게** 떠다니는가 ─────────────────────────────────
   ⚠ 창업자가 "xyz 축으로 움직이고 있는 건 맞아?" 라고 물었다. 실제로 움직이고는
      있었는데 12초에 x 20px·y 21px·면적 18% 라 **정지로 보였다**(주기 23초).
      "구현했다"와 "보인다"는 다른 말이고, 지표가 없으면 그 차이를 놓친다. */
await page.getByRole("button", { name: "판결" }).click(); await page.waitForTimeout(1500);
const snap = () => page.evaluate(() => {
  const c = document.querySelector("canvas"), g = c.getContext("webgl");
  const W = c.width, H = c.height, a = new Uint8Array(4 * W * H);
  g.readPixels(0, 0, W, H, g.RGBA, g.UNSIGNED_BYTE, a);
  let sx = 0, sy = 0, sw = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = a[4 * (y * W + x) + 3];
    if (v > 60) { sx += x * v; sy += y * v; sw += v; n++; } }
  return { x: sx / sw / W, y: sy / sw / H, area: n / (W * H) };
});
const rec = [];
for (let i = 0; i < 18; i++) { rec.push(await snap()); await page.waitForTimeout(500); }
const span = (k) => { const v = rec.map((r) => r[k]); return Math.max(...v) - Math.min(...v); };
const dx = Math.round(span("x") * 393), dy = Math.round(span("y") * 393);
const dz = Math.round(span("area") / Math.min(...rec.map((r) => r.area)) * 100);
ck("⑪ x·y 로 떠다닌다(9초 안에)", dx + dy > 45, `x ${dx}px + y ${dy}px`);
ck("⑪ z(앞뒤)로 커졌다 작아진다", dz > 25, `면적 변화 ${dz}%`);

/* ── ⑫ 폰에서 **드래그를 브라우저에 뺏기지 않는가** ──────────────────────
   창업자 실기 제보: "폰에서 왜 잡아서 드래그하려면 스크롤이 되지?"
   원인은 캔버스에 `touch-action:none` 이 없어 브라우저가 그 제스처를 스크롤로 가져간 것.
   ⚠ **스크롤 위치로는 검증이 안 된다** — 로비는 스크롤이 없어서 늘 0 이다.
   ⚠ **2026-08-29 재작성.** 예전엔 「위습이 손끝을 끝까지 따라왔는가」로 쟀는데,
      인터랙션이 바뀌어(안쪽=눌림 / 바깥=튕겨나감) **손끝을 따라오지 않는다**.
      옛 검사는 고쳐진 버그가 아니라 **그때의 동작**을 못 박고 있었다 — 그래서 오검출이 났다.
      원인을 직접 문다: ①캔버스의 touch-action 이 none 인가(이게 그 버그의 정체다)
      ②드래그가 실제로 장을 움직이는가(방향은 인터랙션 설계에 맡기고 크기만 본다). */
const tctx = await b.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
const tp = await tctx.newPage();
await tp.goto(BASE + "/?skin=holo"); await tp.waitForTimeout(1000);
/* 온보딩을 통과한 상태를 그대로 쓰려면 저장소를 옮겨 심는다 */
const store = await page.evaluate(() => JSON.stringify(localStorage));
await tp.evaluate((j) => { const o = JSON.parse(j); for (const k in o) localStorage.setItem(k, o[k]); }, store);
await tp.goto(BASE + "/?skin=holo"); await tp.waitForTimeout(2600);
const ta = await tp.evaluate(() => getComputedStyle(document.querySelector("canvas")).touchAction);
ck("⑫-a 캔버스가 제스처를 브라우저에 안 넘긴다", ta === "none", `touch-action: ${ta}`);
const tbox = await tp.evaluate(() => { const r = document.querySelector("canvas").getBoundingClientRect();
  return { l: r.left, t: r.top, w: r.width, h: r.height }; });
const wy = () => tp.evaluate(() => {
  const c = document.querySelector("canvas"), g = c.getContext("webgl");
  const W = c.width, H = c.height, a = new Uint8Array(4 * W * H);
  g.readPixels(0, 0, W, H, g.RGBA, g.UNSIGNED_BYTE, a);
  let sy = 0, sw = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = a[4 * (y * W + x) + 3];
    if (v > 170) { sy += y * v; sw += v; } }
  return sw ? sy / sw / H : null;
});
const cdp = await tctx.newCDPSession(tp);
const before = await wy();
const cx = tbox.l + tbox.w * 0.5, y0 = tbox.t + tbox.h * 0.30, y1 = tbox.t + tbox.h * 0.78;
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: y0 }] });
let peak = 0;
for (let i = 1; i <= 8; i++) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx, y: y0 + (y1 - y0) * i / 8 }] });
  await tp.waitForTimeout(50);
  const v = await wy(); if (v !== null && before !== null) peak = Math.max(peak, Math.abs(v - before));
}
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await tctx.close();
/* 드리프트만으로 이 짧은 사이에 움직이는 폭은 0.02 미만이다(무입력 실측). 그 두 배를 문턱으로. */
ck("⑫-b 드래그가 장을 실제로 움직인다", peak > 0.04, `이동 ${peak.toFixed(3)} (0.04 초과여야)`);
await b.close();

const pass = R.filter(Boolean).length;
console.log(`\n=== 홀로 스킨 전 과정: ${pass}/${R.length} ${pass === R.length ? "PASS" : "FAIL"} ===`);
process.exit(pass === R.length ? 0 : 1);
