/* 동전 의식 검사 (v140) — 재미 축과 마찰 축을 둘 다 지킨다.
   이 검사가 있는 이유: v129.2 에 의식을 끈 사유가 **검증 불가능한 추측**("허들같아보여서")이었다.
   같은 일이 반복되지 않게, 되살린 판의 성질을 값이 아니라 **구조**로 못 박는다. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
import { readFileSync } from "fs";
import { onboard } from "./onboard.mjs";

const BASE = process.env.BASE || "http://localhost:4173/";
const SRC = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ck = (c, m, d = "") => { c ? (pass++, console.log("PASS — " + m + (d ? " · " + d : ""))) : (fail++, console.log("FAIL — " + m + (d ? " · " + d : ""))); };

/* ── 소스 성질 ── */
ck(/const COIN_RITUAL = true;/.test(SRC), "의식이 켜져 있다");
/* ⚠ 문자열이 아니라 **함수**로 본다 — 「한 번에 던지기」는 위 주석에 "없앴다"고 적혀 있어서
   문자열로 잡으면 그 설명 자체가 검사를 깨뜨린다(v140 에서 실제로 깼다). */
ck(!/tossAll/.test(SRC), "건너뛰기 함수(tossAll)가 없다 — 그 버튼이 있으면 재미도 마찰도 무너진다");
ck(/track\("ritual_started"/.test(SRC) && /track\("ritual_tossed"/.test(SRC) && /track\("ritual_abandoned"/.test(SRC),
   "계측 셋이 다 있다 — 다음에 끌 땐 감이 아니라 이 셋을 읽는다");
ck(/const oneCoin = \(\) =>/.test(SRC), "oneCoin 이 인자를 안 받는다 — 쥔 시간이 결과에 못 섞인다");
ck(/onPointerDown=\{startCharge\}/.test(SRC) && /onClick=\{doThrow\}/.test(SRC),
   "쥐는 연출과 실제 던지기가 분리돼 있다 — 키보드로도 던져진다");
/* 수호신 렌더 결합 금지 — 디자인 세션이 도트→홀로그램으로 바꿔도 이 화면은 안 고쳐야 한다 */
const panel = SRC.slice(SRC.indexOf('{ritual && !res && ('), SRC.indexOf('{err && ('));
ck(panel.length > 200, "의식 블록을 찾았다", `${panel.length}자`);
for (const forbidden of ["texture(", "canvas", "GuardianSeal", "shader", "u_form"])
  ck(!panel.includes(forbidden), `의식 블록이 수호신 렌더에 안 묶여 있다 — ${forbidden} 없음`);

/* ── 실주행 ── */
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const p = await b.newPage({ viewport: { width: 430, height: 932 } });
try {
  await p.addInitScript(() => {
    window.claude = { complete: async () => { await new Promise((r) => setTimeout(r, 300)); return JSON.stringify({ category: "A", scope: "S1", votes: [{ axis: "사주", v: "GO" }, { axis: "주역", v: "GO" }], tone: "단호", direction: "GO", verdict: "망설이지 마." }); } };
  });
  await onboard(p, BASE, "?trackdebug&i=0");
  await p.locator("textarea.qbox").fill("이직할까?");
  await p.getByRole("button", { name: "판결을 청한다" }).click();
  await p.waitForTimeout(400);

  ck(await p.getByRole("button", { name: /^던진다 \(/ }).isVisible(), "의식 화면이 뜬다");
  ck((await p.getByRole("button", { name: /한 번에/ }).count()) === 0, "건너뛸 버튼이 화면에 없다");
  ck((await p.getByText("물음을 고칠래").count()) === 1, "빠져나갈 길은 있다 — 마찰이지 감금이 아니다");

  for (let i = 0; i < 6; i++) {
    ck((await p.locator(".hline").count()) === i, `${i + 1}번째 던지기 전 효가 ${i}개`);
    await p.getByRole("button", { name: /^던진다 \(/ }).click({ timeout: 15000 });
    await p.waitForTimeout(1150);
  }
  ck((await p.locator(".hline").count()) === 6, "여섯 번 던져야 괘가 맺힌다");

  const evs = await p.evaluate(() => window.__binariEvents || []);
  const tossed = evs.filter((e) => e.ev === "ritual_tossed");
  ck(evs.some((e) => e.ev === "ritual_started"), "의식 진입이 기록된다");
  ck(tossed.length === 6, `던지기가 회차별로 기록된다 (${tossed.length}/6)`);
  ck(tossed.every((e) => [6, 7, 8, 9].includes(e.props.v)), "각 던지기의 값이 6~9다");
  ck(tossed.every((e) => typeof e.props.held_ms === "number"), "쥔 시간이 실린다 — 손맛이 실제로 쓰이는지 나중에 본다");
  /* 주역 축 복귀 — 의식을 켠 실질 이유 중 하나다(v129.2 이후 실투표 0이었다) */
  await p.waitForTimeout(2500);
  const vs = evs.concat(await p.evaluate(() => window.__binariEvents || []));
  const shown = vs.filter((e) => e.ev === "verdict_shown").pop();
  ck(!!shown, "판결까지 간다");
  ck(!!shown && shown.props.ritual !== false, "판결이 의식 경로로 기록된다");
} catch (e) {
  fail++; console.log("FAIL — 실주행 예외 · " + String(e).slice(0, 220));
} finally { await b.close(); }

console.log(`\n=== 동전 의식: ${pass}/${pass + fail} PASS ===`);
process.exit(fail ? 1 : 0);
