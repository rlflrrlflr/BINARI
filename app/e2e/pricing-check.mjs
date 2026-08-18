/* 결정 8 검사 — 무료 발행 코호트 표식이 실제로 남는가 (2026-08-17)
   지금 서신·각인·궁합은 값을 표시하고도 실물을 무료로 준다. 결제가 붙는 날
   이 사람들을 갈라내지 못하면 "처음 사는 사람의 지불 의사"를 영영 못 잰다.
   ⚠ 소급이 안 되는 표식이라, 조용히 빠지면 손실이 회복 불가다. 그래서 검사를 붙인다.

   값을 못 박지 않고 **성질**을 검사한다 — 상수 이름이 바뀌어도 살아 있게. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
import { onboard } from "./onboard.mjs";
import { readFileSync } from "fs";

const BASE = process.env.BASE || "http://localhost:4173/";
const SRC = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("PASS — " + m)) : (fail++, console.log("FAIL — " + m)); };

/* ── 소스 성질 검사 (브라우저 없이) ── */
ok(/const PRICING_MODE\s*=\s*"[a-z_]+"/.test(SRC), "체제 표시 상수가 있다");
ok(/_superProps\s*=\s*\{[^}]*pricing_mode:\s*PRICING_MODE/.test(SRC),
   "체제 표시가 고정 속성이다 — 이벤트마다 손으로 안 붙인다");
ok(/\$set:\s*\{\s*free_issued:\s*true\s*\}/.test(SRC),
   "free_issued 가 person 속성이다 — 기기를 바꿔도 안 끊긴다");
ok(/\$set_once:/.test(SRC), "첫 수령 시점·종류는 \$set_once 라 덮이지 않는다");
/* 세 상품 전부 걸려 있어야 한다 — 서신만 걸면 각인·궁합 수령자가 새 나간다 */
for (const k of ["letter", "imprint", "match"])
  ok(new RegExp(`markFreeIssue\\("${k}"\\)`).test(SRC), `${k} 발행 지점에 표식이 걸려 있다`);
ok((SRC.match(/function markFreeIssue/g) || []).length === 1,
   "표식 함수가 하나다 — 문이 갈리면 한쪽만 고쳐진다");
ok(/if \(_superProps\.free_issued\) return;/.test(SRC), "사람당 한 번만 발사한다");

/* ── 실주행: 정말로 붙어서 나가는가 ── */
const br = await chromium.launch();
const page = await br.newPage({ viewport: { width: 390, height: 844 } });
try {
  await onboard(page, BASE, "?trackdebug&i=0");
  const evs = await page.evaluate(() => window.__binariEvents || []);
  ok(evs.length > 0, `이벤트가 실제로 잡힌다 (${evs.length}건)`);
  ok(evs.every((e) => typeof e.props.pricing_mode === "string"),
     "모든 이벤트에 체제 표시가 붙는다");
  ok(!evs.some((e) => e.ev === "free_issue"),
     "아직 아무것도 안 받았으면 표식이 안 나간다(오탐 방지)");
} catch (e) {
  fail++; console.log("FAIL — 실주행 예외 · " + String(e).slice(0, 200));
} finally { await br.close(); }

console.log(`\n=== 결정 8 무료 발행 표식: ${pass}/${pass + fail} PASS ===`);
process.exit(fail ? 1 : 0);
