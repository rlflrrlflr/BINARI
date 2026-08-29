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
/* ⚠ **이 줄이 2026-08-28 에 뒤집혔다.** v142 는 「한 번에 던지기」를 **없는 것**으로 못 박았고
   사유도 창업자 지시였다(*"무료로 바꾼 이상 일정 허들은 남겨야겠어"*).
   이번 지시가 그 결정을 뒤집는다(*"일괄 던지기 버튼도 추가해 … 없애기 직전으로 롤백"*).
   **없앤 이유를 지우지 않는다** — 코드 주석에 남겼고, 검사는 「없다」에서 **「있되 같은 규칙으로 돈다」**로
   자리를 옮긴다. 지우기만 하면 다음 판에 아무 규칙 없이 도는 버튼이 된다. */
ck(/const tossAll = /.test(SRC), "한 번에 던지기가 있다(2026-08-28 되살림)");
/* 압축이지 다른 규칙이 아니다 — 같은 oneCoin()·같은 finalize() 를 탄다 */
ck(/const tossAll = [\s\S]{0,700}?oneCoin\(\)/.test(SRC) && /const tossAll = [\s\S]{0,900}?finalize\(nt\)/.test(SRC),
   "한 번에 던져도 같은 동전·같은 마무리를 쓴다");
/* ⚠ 쥔 시간이 결과에 안 섞이는 규칙은 그대로다 — oneCoin 은 여전히 인자를 안 받는다 */
ck(/const oneCoin = \(\) =>/.test(SRC), "동전은 여전히 인자를 안 받는다(손맛이 결과에 안 섞인다)");
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
  ck((await p.getByRole("button", { name: /한 번에/ }).count()) === 1, "한 번에 던지기가 화면에 있다");
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

/* ── ⑧ 한 번에 던지기 (2026-08-28 창업자 지시로 되살림) ─────────────────────
     ⚠ **이 파일의 ck() 는 `ck(조건, 설명)` 순서다.** 처음에 설명을 앞에 써서 **항상 통과하는 빈 검사**
     여섯을 넣을 뻔했다(문자열이 조건 자리에 들어가면 늘 참이다). 순서를 확인하고 쓴다.
   ⚠ **v142 에서 일부러 지웠던 버튼이다**(그때도 창업자 지시: "무료로 바꾼 이상 허들은 남겨야겠어").
       이번 지시가 그 결정을 뒤집는다. **지운 이유를 지우지 않는다** — 코드 주석에 남겼고,
       여기서는 되살린 버튼이 **같은 규칙으로 도는지**를 문다. 압축은 하되 결과는 안 바뀐다. */
  {
    const p8 = await b.newPage({ viewport: { width: 430, height: 932 } });
    await onboard(p8, BASE, "?trackdebug");
    await p8.locator("textarea.qbox").fill("한 번에 던져도 같은 규칙인가");
    await p8.getByRole("button", { name: /판결을 청한다/ }).click();
    await p8.waitForTimeout(700);
    const bulk = p8.getByRole("button", { name: "한 번에 던지기" });
    ck(await bulk.isVisible().catch(() => false), "⑧ 한 번에 던지기 버튼이 있다");
    /* 손으로 던지는 게 기본이고 이건 우회로다 — 같은 무게(gold)로 두면 아무도 여섯 번 안 던진다 */
    ck(!((await bulk.getAttribute("class")) || "").includes("gold"),
       "⑧ 손으로 던지기보다 아래 위계다(gold 아님)", (await bulk.getAttribute("class")) || "");
    await bulk.click();
    await p8.waitForTimeout(1600);
    /* 여섯 획이 한 번에 맺힌다 — 압축이지 다른 규칙이 아니다 */
    ck((await p8.locator(".hexlines .hline").count()) === 6, "⑧ 여섯 획이 한 번에 맺힌다",
       `${await p8.locator(".hexlines .hline").count()}획`);
    const evs8 = await p8.evaluate(() => window.__binariEvents || []);
    const tossed = evs8.filter((e) => e.ev === "ritual_tossed");
    /* ⚠ **한 건으로 뭉치지 않는다.** 뭉치면 「몇 번째에서 이탈하나」를 못 읽는다 —
       v142 가 그 계측을 만든 이유가 정확히 그것이다. */
    ck(tossed.length === 6, "⑧ 계측은 던진 횟수만큼 남는다", `${tossed.length}건`);
    ck(tossed.every((e) => e.props.bulk === true), "⑧ 한 번에 던진 것이 표시된다");
    ck(tossed.every((e) => [6, 7, 8, 9].includes(e.props.v)),
       "⑧ 값이 6~9 범위를 안 벗어난다(손으로 던진 것과 같은 동전)",
       [...new Set(tossed.map((e) => e.props.v))].join(","));
    await p8.close();
  }
} catch (e) {
  fail++; console.log("FAIL — 실주행 예외 · " + String(e).slice(0, 220));
} finally { await b.close(); }

console.log(`\n=== 동전 의식: ${pass}/${pass + fail} PASS ===`);
process.exit(fail ? 1 : 0);
