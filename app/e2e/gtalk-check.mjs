/* 수호신이 말하는 자리 — **손짓에 답하는가, 그리고 안 보이는 말을 안 만드는가.**
   실행: preview 기동 후 node e2e/gtalk-check.mjs

   창업자(2026-08-30): *"「다시 왔네 강석우, 기다렸어」 이 부분을 수호신이 말하는 공간으로 두자.
   처음엔 웰커밍 멘트, 인터랙션하는 거에 따라 대사가 바뀌는 걸로."*

   이 검사가 지키는 것 셋:
     ① **전부 반응이다** — 먼저 말을 걸지 않는다(설계 헌장 §모를 권리: 판결 국면에서 push 금지).
        그래서 **혼잣말 타이머가 없다**. 가만히 두면 환영 한 줄에서 안 움직여야 한다.
     ② **모델을 안 부른다** — 이 줄 하나로 판결 원가가 붙으면 안 된다. 표에서 고른다.
     ③ **써 놓고 화면에 못 나오는 대사가 없다** — 첫 판에 둘이나 그랬다(곁 탭엔 이 자리가 없고,
        깨어난 구간은 v55 가 「수호신이 물러난 자리」로 정해 둔 곳이었다). 죽은 대사는 죽은 검사와 같다. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";
const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

/* ── ① 표 — 목소리가 오행마다 다른가 ─────────────────────────────────────── */
const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const grab = (head) => {
  const i = src.indexOf(head); if (i < 0) throw new Error(`${head} 없음`);
  let d = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) {
    if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error("안 닫힘");
};
const { GSAY } = new Function(`${grab("const GSAY = {")}\nreturn { GSAY };`)();
const ELS = ["목", "화", "토", "금", "수"];
ck("① 오행 다섯이 다 있다", ELS.every((e) => GSAY[e]), Object.keys(GSAY).join(""));
/* ⚠ **열쇠 목록을 손으로 적지 않는다.** 처음엔 다섯을 박아 뒀는데, 그러면 **표에 대사가 하나 늘어도
   검사가 모른다**(음성 확인으로 잡았다 — 안 쓰이는 대사를 넣었는데 안 걸렸다).
   표에서 읽고, 오행끼리 열쇠 묶음이 같은지도 여기서 본다. */
const KEYS = [...new Set(ELS.flatMap((e) => Object.keys(GSAY[e] || {})))];
ck("① 상황이 오행마다 빠짐없이 있다",
   KEYS.length >= 4 && ELS.every((e) => KEYS.every((k) => typeof GSAY[e][k] === "string" && GSAY[e][k].length > 4)),
   `${KEYS.length}종 · ${KEYS.join(",")}`);
/* ⚠ **오행마다 달라야 한다.** 같으면 목소리가 그 사람 것이 아니라 앱 것이다 —
   수호신의 정체가 그 사람의 오행이라고 앱이 이미 말하고 있다(guardianIntro). */
for (const k of KEYS) {
  const v = ELS.map((e) => GSAY[e][k]);
  ck(`① 「${k}」가 오행마다 다르다`, new Set(v).size === 5, `${new Set(v).size}/5`);
}
/* ⚠ **처음엔 `say("…")` 리터럴만 훑다가 검사 쪽을 고쳤다.** touch1·2·N 은 삼항으로 넘어가서
   (`say(n === 1 ? "touch1" : …)`) 그 모양엔 안 잡히는데, 실제로는 화면에서 잘 돌고 있었다(③이 실측).
   그래서 **표 뒤쪽 코드 전체**에서 따옴표에 싸인 열쇠를 찾는다 — 주석은 걷고 본다. */
const body = src.slice(src.indexOf("const gsay = ")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const used = KEYS.filter((k) => new RegExp(`"${k}"`).test(body));
/* ⚠ **표에 있는데 아무도 안 부르는 대사**가 없어야 한다 — 첫 판에 `gyeot` 이 딱 그랬다
   (곁 탭엔 이 자리가 없어 영영 안 보였다). 죽은 대사는 죽은 검사와 같다. */
ck("① 표에 있는데 안 쓰는 대사가 없다", used.length === KEYS.length,
   KEYS.filter((k) => !used.includes(k)).join(",") || "0건");
/* 반대 방향 — 코드가 표에 없는 열쇠를 부르면 조용히 아무 말도 안 하게 된다 */
const called = [...body.matchAll(/say\(\s*(?:[^)]*\?\s*)?"([a-zA-Z0-9]+)"/g)].map((m) => m[1]);
ck("① 코드가 부르는 열쇠가 표에 다 있다", called.every((k) => KEYS.includes(k)),
   called.filter((k) => !KEYS.includes(k)).join(",") || "0건");
/* ② 모델을 안 부른다 — 이 기능이 원가를 만들면 안 된다 */
const fnArea = src.slice(src.indexOf("const GSAY = {"), src.indexOf("const GSAY = {") + 3000);
ck("② 모델을 안 부른다(표에서 고른다)", !/callClaude|fetch\(/.test(fnArea));

/* ── ③ 실제로 손짓에 답하는가 ────────────────────────────────────────────── */
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(12000);
const { onboard } = await import("./onboard.mjs");
await onboard(page, BASE, "?skin=holo");
await page.goto(BASE + "/?skin=holo", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5500);
const line = async () => (await page.locator(".gsay").first().innerText().catch(() => "")).replace(/\n/g, " ").trim();

const hello = await line();
ck("③ 열자마자 환영 한 줄", /다시 왔네/.test(hello), hello);
/* ⚠ **가만히 두면 안 바뀌어야 한다** — 혼잣말은 push 다(§모를 권리). */
await page.waitForTimeout(4000);
ck("③ 가만히 두면 먼저 말 걸지 않는다", (await line()) === hello, await line());

const tap = async () => { await page.locator("section.scene").click({ position: { x: 215, y: 300 } }); await page.waitForTimeout(650); };
await tap(); const t1 = await line();
ck("③ 한 번 두드리면 말이 바뀐다", t1 !== hello && t1.length > 4, t1);
await tap(); const t2 = await line();
ck("③ 두 번째는 또 다르다 — 같은 답을 반복하지 않는다", t2 !== t1, t2);
await tap(); const t3 = await line();
ck("③ 세 번째도 다르다", t3 !== t2 && t3 !== t1, t3);

/* 곁을 보고 오면 그 사실에 답한다 — 곁 탭에서가 아니라 **돌아왔을 때** */
await page.getByRole("button", { name: "곁", exact: true }).click(); await page.waitForTimeout(900);
await page.getByRole("button", { name: "판결", exact: true }).click(); await page.waitForTimeout(900);
const back = await line();
ck("③ 곁을 보고 오면 그 사실에 답한다", back !== t3 && /곁/.test(back), back);

/* 깨우면 한 마디 하고 **스스로 물러난다** — v55 「수호신이 물러난 순수 질문입력 구간」을 안 깬다 */
await page.locator("section.scene").dblclick({ position: { x: 215, y: 300 } });
await page.waitForTimeout(800);
ck("③ 깨우면 한 마디 한다", (await page.locator(".gtalk").count()) === 1 && (await line()) !== back, await line());
ck("③ 질문 칸이 같이 열린다", (await page.locator("textarea.qbox").count()) === 1);
await page.waitForTimeout(2600);
ck("③ 한 마디만 하고 물러난다(질문 칸만 남는다)", (await page.locator(".gtalk").count()) === 0);

/* ── ④ 기존 화면은 한 줄도 안 바뀐다 ─────────────────────────────────────── */
{
  const p2 = await b.newPage({ viewport: { width: 430, height: 932 } });
  await onboard(p2, BASE);
  await p2.goto(BASE, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(5000);
  const before = (await p2.locator(".gsay").first().innerText().catch(() => "")).replace(/\n/g, " ").trim();
  await p2.locator("section.scene").click({ position: { x: 215, y: 300 } });
  await p2.waitForTimeout(700);
  ck("④ 홀로가 아니면 말이 안 바뀐다(기존 화면 불변)",
     (await p2.locator(".gsay").first().innerText().catch(() => "")).replace(/\n/g, " ").trim() === before, before);
  await p2.close();
}

await b.close();
const pass = R.filter(Boolean).length;
console.log(`\n=== 수호신이 말하는 자리: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
