/* 판결 대기 연출(벼름) — 동전 의식을 끄면서 생긴 4~10초 공백을 무엇이 채우는가.
   실행: preview 기동 후 node e2e/brood-check.mjs

   배경: v129.2 로 동전을 끄자 대기 화면이 통째로 비었다. 실측 대기는 p50 4.4초 · p99 9.3초라
   **길이를 알 수 없으므로 고정 길이 연출을 쓸 수 없다** → 끝없는 루프 + 도착 시 해소로 짰다.
   설계 의도는 온보딩과 **반대 방향**이다: 온보딩은 '흩어진 것이 모여 밝아지며 태어남',
   대기는 '가라앉아 어두워지며 삼켰다가 솟구쳐 터짐'. 같은 응집을 써도 방향이 뜻을 가른다.

   ⚠ 여기서 제일 중요한 검사는 ②다 — 셰이더 좌표계 부호를 잘못 잡으면 '하강'이 조용히
     '상승'이 된다. 코드는 멀쩡히 돌고 화면도 그럴듯해서 눈으로는 못 잡는다. 픽셀로 잰다. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";
const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

const CALL1 = JSON.stringify({ category: "B", votes: [{ axis: "사주", v: "GO" }], tone: "단호", direction: "STOP", verdict: "보내지 마. 끝.", against: 4, total: 6 });
const CALL2 = JSON.stringify({ subline: "밤이 널 속이는 거야.", reasons: [{ axis: "사주", vote: "STOP", text: "화기." }], funLine: "욱하지 마.", disclaimer: "" });

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(9000);

// 콜1 을 일부러 6초 끌어 '대기 중' 상태를 붙잡는다(실측 p50 4.4초와 같은 구간)
await page.addInitScript(({ c1, c2 }) => {
  window.claude = { complete: async (p) => {
    const isDetail = p.includes("[이미 확정된 판결]");
    await new Promise((r) => setTimeout(r, isDetail ? 100 : 6000));
    return isDetail ? c2 : c1;
  } };
}, { c1: CALL1, c2: CALL2 });

const { onboard } = await import("./onboard.mjs");
await onboard(page, BASE);

/** 캔버스에서 밝은 픽셀의 세로 무게중심(0=위, 1=아래)과 총 밝기를 잰다 */
const measure = () => page.evaluate(() => {
  const cv = document.querySelector("canvas"); if (!cv) return null;
  const g = document.createElement("canvas"); g.width = cv.width; g.height = cv.height;
  g.getContext("2d").drawImage(cv, 0, 0);
  const d = g.getContext("2d").getImageData(0, 0, g.width, g.height).data;
  let sum = 0, wy = 0;
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    const i = (y * g.width + x) * 4;
    const l = d[i] + d[i + 1] + d[i + 2];
    if (l > 40) { sum += l; wy += l * y; }
  }
  return sum ? { cy: wy / sum / g.height, lum: sum / (g.width * g.height) } : null;
});

/* ⚠ 한 번만 재서 비교하면 안 된다 — 수호신은 평상시에도 호흡·부유로 무게중심이 흔들리고,
   실측 진폭이 0.030 이다. 단일 표본과 비교하면 그 흔들림을 연출로 착각한다(실제로 한 번 오판했다).
   그래서 **평상시 밴드**를 먼저 잰 뒤, 벼름이 그 밴드를 벗어나는지를 본다. */
await page.waitForTimeout(1200);
const band = [];
for (let i = 0; i < 8; i++) { const m = await measure(); if (m) band.push(m); await page.waitForTimeout(600); }
const cyMin = Math.min(...band.map((m) => m.cy)), cyMax = Math.max(...band.map((m) => m.cy));
const lumAvg = band.reduce((t, m) => t + m.lum, 0) / band.length;
const idle = { cy: (cyMin + cyMax) / 2, lum: lumAvg };
ck("① 대기 전 수호신이 그려진다", band.length >= 6 && lumAvg > 0,
   `밝기 ${lumAvg.toFixed(1)} · 평상시 중심 ${cyMin.toFixed(3)}~${cyMax.toFixed(3)}(진폭 ${(cyMax - cyMin).toFixed(3)})`);

await page.locator("textarea.qbox").fill("이직할까?");
await page.getByRole("button", { name: "판결을 청한다" }).click();
await page.waitForTimeout(2200);                       // 벼름이 거의 다 잠긴 시점

ck("② 대기 문구가 뜬다(동전 끄면서 사라졌던 것)",
   await page.getByText("조각들이 합의하는 중…").isVisible().catch(() => false));
ck("② 대기 중엔 '판결을 청한다'가 사라진다(중복 요청 방지)",
   (await page.getByRole("button", { name: "판결을 청한다" }).count()) === 0);

const brooding = await measure();
if (idle && brooding) {
  // 하강 — 무게중심이 아래(값 증가)로 내려가야 한다. 부호를 뒤집으면 여기서 잡힌다.
  // 평상시 밴드의 **아래쪽 끝을 넘어서** 내려가야 한다 — 호흡 범위 안이면 연출이 아니라 우연이다
  ck("② 가라앉는다(평상시 흔들림 범위를 벗어나 내려감)", brooding.cy > cyMax + 0.012,
     `평상시 최저점 ${cyMax.toFixed(3)} → 벼름 ${brooding.cy.toFixed(3)}`);
  // 침잠 — 어두워져야 한다. 온보딩(어둠→밝아짐)과 반대 방향이라는 게 이 연출의 핵심이다.
  ck("② 어두워진다(온보딩과 반대 방향)", brooding.lum < idle.lum * 0.95,
     `${idle.lum.toFixed(1)} → ${brooding.lum.toFixed(1)}`);
}

// 도착 — 판결이 뜨고 벼름이 풀려야 한다(모인 채로 굳지 않는다)
await page.waitForSelector(".vv", { timeout: 15000 });
ck("③ 판결 도착", (await page.locator(".vv").allTextContents())[0].includes("보내지 마"));
ck("③ 도착하면 대기 문구가 사라진다", (await page.getByText("조각들이 합의하는 중…").count()) === 0);
await page.waitForTimeout(2500);                       // 발화(0.9초) + 풀림
const after = await measure();
if (idle && after) {
  // 평상시 밴드 안으로 복귀해야 한다(여유 0.015 — 측정 시점의 호흡 위상 차이)
  ck("③ 풀린 뒤 평상시 범위로 돌아온다(가라앉은 채 굳지 않는다)",
     after.cy > cyMin - 0.015 && after.cy < cyMax + 0.015,
     `평상시 ${cyMin.toFixed(3)}~${cyMax.toFixed(3)} · 복귀 ${after.cy.toFixed(3)}`);
}

/* ④ reduced-motion 이면 아예 켜지 않는다 — 가라앉음·솟구침이 그 설정이 피하려는 바로 그 움직임이다 */
{
  const p2 = await b.newPage({ viewport: { width: 430, height: 932 }, reducedMotion: "reduce" });
  await p2.addInitScript(({ c1, c2 }) => {
    window.claude = { complete: async (p) => {
      const d = p.includes("[이미 확정된 판결]");
      await new Promise((r) => setTimeout(r, d ? 100 : 4000));
      return d ? c2 : c1;
    } };
  }, { c1: CALL1, c2: CALL2 });
  await onboard(p2, BASE);
  const base = await (async () => { const m = measure; return null; })();
  await p2.locator("textarea.qbox").fill("이직할까?");
  await p2.getByRole("button", { name: "판결을 청한다" }).click();
  await p2.waitForTimeout(2000);
  const brood = await p2.evaluate(() => {
    const cv = document.querySelector("canvas"); if (!cv) return null;
    const g = document.createElement("canvas"); g.width = cv.width; g.height = cv.height;
    g.getContext("2d").drawImage(cv, 0, 0);
    const d = g.getContext("2d").getImageData(0, 0, g.width, g.height).data;
    let sum = 0, wy = 0;
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
      const i = (y * g.width + x) * 4; const l = d[i] + d[i + 1] + d[i + 2];
      if (l > 40) { sum += l; wy += l * y; }
    }
    return sum ? wy / sum / g.height : null;
  });
  ck("④ reduced-motion 이어도 대기 문구는 뜬다(정보는 남긴다)",
     await p2.getByText("조각들이 합의하는 중…").isVisible().catch(() => false));
  ck("④ reduced-motion 이면 가라앉지 않는다",
     brood === null || !idle || brood > cyMin - 0.02 && brood < cyMax + 0.02, `중심 ${brood == null ? "-" : brood.toFixed(3)}`);
  await p2.close();
}

await b.close();
const f = R.filter((x) => !x).length;
console.log(`\n=== 판결 대기 연출: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
