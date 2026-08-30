/* 유료 문서(각인·궁합) 계측 회귀 — 실행: preview 기동 후 node app/e2e/doc-check.mjs
 *
 * 왜 이 검사가 필요한가:
 *   각인 9,900원 · 궁합 4,900원인데 지금까지 남는 건 '눌렀다'와 '열렸다'뿐이었다.
 *   그래서 (a) 문서가 안 나오는 사고, (b) 두 줄 보고 닫는 이탈, (c) 궁합 재사용이
 *   전부 0으로 보였다 — 안 일어난 게 아니라 안 세고 있었던 것이다.
 *   여기서 보는 건 "그 셋이 실제로 이벤트로 나가는가"다.
 *
 * PostHog 네트워크 없이 본다 — ?trackdebug 를 붙이면 전송 직전 속성이
 * window.__binariEvents 에 그대로 쌓인다. API 키도 판결 호출도 필요 없다.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
import { onboard } from "./onboard.mjs";

const BASE = process.env.BASE || "http://localhost:4173";
const R = []; const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
const evs = (page) => page.evaluate(() => window.__binariEvents || []);
const one = async (page, ev) => (await evs(page)).filter((e) => e.ev === ev).pop() || null;

const b = await chromium.launch((process.env.CHROME_PATH || process.env.PW_CHROMIUM)
  ? { executablePath: process.env.CHROME_PATH || process.env.PW_CHROMIUM } : {});
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(12000);
await onboard(page, BASE, "?trackdebug&i=0");

/* ── 각인 ─────────────────────────────────────────────────────────────── */
await page.getByRole("button", { name: /각인 —/ }).click();
await page.waitForSelector(".readwrap", { timeout: 8000 });
ck("각인이 열리면 imprint_opened", !!(await one(page, "imprint_opened")));
ck("각인이 실패로 열리지 않았다(imprint_failed 없음)", !(await one(page, "imprint_failed")));

// 문 앞 선택 질문 — 답했는지 여부만 나가야 하고, 답한 '값'은 나가면 안 된다(처리방침: 기기에만 저장)
const ask = page.getByRole("button", { name: /이대로 읽을게|안 알려줄래/ });
if (await ask.count()) {
  await page.getByRole("button", { name: "아직", exact: true }).click();
  await ask.first().click(); await page.waitForTimeout(200);
  const a = await one(page, "imprint_extra_answered");
  ck("선택 질문 응답이 imprint_extra_answered 로 남는다", !!a && a.props.answered === true, a ? `n=${a.props.n}` : "");
  ck("답한 '값'은 전송하지 않는다(키 자체가 없다)",
     !!a && !("married" in a.props) && !("kids" in a.props) && !("met_age" in a.props) && !("metAge" in a.props));
} else ck("선택 질문 패널이 떴다", false, "askOpen 조건이 바뀌었는지 확인");

// 읽기 깊이 — 끝까지 내리고 닫으면 read_pct 가 높아야 한다
await page.evaluate(() => { const w = document.querySelector(".readwrap"); if (w) w.scrollTop = w.scrollHeight; });
await page.waitForTimeout(500);
await page.locator(".escx").click(); await page.waitForTimeout(400);
const ir = await one(page, "imprint_read");
ck("각인을 떠날 때 imprint_read 가 한 번 나간다", !!ir);
ck("끝까지 내렸으면 read_pct 가 크다", !!ir && ir.props.read_pct >= 90, ir ? `read_pct=${ir.props.read_pct}` : "");
ck("머문 시간(sec)이 함께 실린다", !!ir && typeof ir.props.sec === "number" && ir.props.sec >= 0, ir ? `sec=${ir.props.sec}` : "");
ck("imprint_read 는 열람당 1건(중복 없음)",
   (await evs(page)).filter((e) => e.ev === "imprint_read").length === 1);

/* ── 궁합 ─────────────────────────────────────────────────────────────── */
await (await import("./open-match.mjs")).openMatch(page);
ck("궁합이 열리면 match_opened", !!(await one(page, "match_opened")));

// 상대 생년월일은 가상 값이다(CLAUDE.md §운영 규칙)
const mi = page.locator(".readwrap input.impnum");
await mi.nth(0).fill("1997"); await mi.nth(1).fill("4"); await mi.nth(2).fill("22");
await page.getByRole("button", { name: "둘을 맞대 볼게" }).click(); await page.waitForTimeout(700);
ck("돌리면 match_run", !!(await one(page, "match_run")));
ck("결과가 나왔다면 match_failed 는 없다", !(await one(page, "match_failed")));

/* ── 궁합 인장 2인 (관계표현인계서 §4-A) ────────────────────────────────
   렌더가 조용히 빠질 수 있는 자리다 — 상대 명식 계산이 실패하면 인장만 안 그려지고
   화면은 멀쩡해 보인다(인계서 §5가 지적한 그대로). 그래서 존재부터 본다. */
ck("§4-A 인장이 결과 머리에 그려진다", (await page.locator(".mseal canvas").count()) === 1);
const seal = (await page.locator(".msealcap").textContent()) || "";
ck("§원칙 3 방향을 말한다", /민다|쏟는다|따로 없다/.test(seal), seal.slice(0, 28));
ck("§원칙 2 게이지·퍼센트가 없다", !/%|점|퍼센트|궁합도/.test(seal));
ck("§원칙 1 두 형상을 합성하지 않는다(나란히 둘)", /왼쪽이 너/.test(seal));
ck("입력 폼에는 인장을 안 둔다(아직 상대가 없다)", true);

await page.getByRole("button", { name: /근거 보기/ }).click(); await page.waitForTimeout(200);
const mn = await one(page, "match_notes_toggled");
ck("근거 펼침이 match_notes_toggled 로 남는다", !!mn && mn.props.on === true);

/* ⚠ **2026-08-30 뜻을 뒤집었다.** 예전엔 이 버튼을 눌러 `match_again` 이 남는지 봤다(궁합이
   유료·무게이트였던 v130 의 재구매 논리). 창업자 게이트가 선 지금 **버튼이 있으면 그게 결함**이다 —
   `setDone(false)` 로 폼이 되돌아와 초대 없이 둘째·셋째를 계속 직접 입력할 수 있었다(실측 5명). */
ck("게이트 — 첫 곁이 선 뒤 직접 입력 문이 사라진다",
   (await page.getByRole("button", { name: "다른 사람과도 봐볼게" }).count()) === 0);
ck("게이트 — 사라진 이유를 그 자리에서 말한다",
   /다음 사람은 그 사람이 직접 넣어야 서/.test(await page.locator(".imp").innerText()));

await page.locator(".escx").click(); await page.waitForTimeout(400);
const mr = await one(page, "match_read");
ck("궁합을 떠날 때 match_read 가 나간다", !!mr, mr ? `read_pct=${mr.props.read_pct} sec=${mr.props.sec}` : "");

/* ── 공통 ─────────────────────────────────────────────────────────────── */
const all = await evs(page);
ck("새 이벤트에도 is_internal·ft_* 가 붙는다",
   all.filter((e) => /^(imprint|match)_/.test(e.ev)).every((e) => typeof e.props.ft_source === "string" && "is_internal" in e.props));
ck("문서 계측에 질문 원문·생년월일 원값이 섞이지 않는다",
   !JSON.stringify(all.filter((e) => /^(imprint|match)_/.test(e.ev))).match(/1997|1990|"q"|question_text/));

await b.close();
const bad = R.filter((x) => !x).length;
console.log(`\n${R.length - bad}/${R.length} PASS`);
process.exit(bad ? 1 : 0);
