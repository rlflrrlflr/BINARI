/* 리텐션 자산 계측 회귀 — 실행: preview 기동 후 node app/e2e/retention-check.mjs
 *
 * 왜 이 검사가 있는가:
 *   아침문안·판결록·스트릭은 **화면에 있는데 track() 이 0건**인 채로 오래 살아 있었다
 *   (방향점검 §1-6 · 작업배분 §6-1 2번). 그래서 D7 게이트가 "다시 왔는가"까지만 답하고
 *   **"왜 다시 왔는가"** 를 못 읽었다. 눈에 안 보이는 결손이라 아무도 안 울었다 —
 *   그래서 사람 기억이 아니라 검사로 못 박는다.
 *
 * 여기서 보는 것:
 *   ① days_since_first 가 모든 이벤트에 붙는가 (D7 게이트의 분모)
 *   ② 스트릭이 하루 1회만 찍히는가 (StrictMode 이중 발사 방지)
 *   ③ 아침문안 퍼널 셋이 순서대로 나가는가 (offered 가 분모다)
 *   ④ 판결록 펼침·행 열람이 남는가
 *   ⑤ 질문 원문이 이 이벤트들에 섞이지 않는가
 *
 * PostHog 네트워크 없이 본다 — ?trackdebug 로 전송 직전 속성을 window.__binariEvents 에서 읽는다.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
import { onboard } from "./onboard.mjs";

const BASE = process.env.BASE || "http://localhost:4173";
const R = []; const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
const evs = (page) => page.evaluate(() => window.__binariEvents || []);
const pick = async (page, ev) => (await evs(page)).filter((e) => e.ev === ev);

const b = await chromium.launch((process.env.CHROME_PATH || process.env.PW_CHROMIUM)
  ? { executablePath: process.env.CHROME_PATH || process.env.PW_CHROMIUM } : {});

/* ── ①·② 첫 방문 — days_since_first 와 스트릭 ─────────────────────────── */
{
  const page = await b.newPage({ viewport: { width: 430, height: 932 } });
  page.setDefaultTimeout(12000);
  await onboard(page, BASE, "?trackdebug&i=0");

  const all = await evs(page);
  ck("이벤트가 실제로 쌓였다(검사가 안 낡았다)", all.length > 0, `${all.length}건`);
  ck("days_since_first 가 모든 이벤트에 붙는다",
     all.every((e) => "days_since_first" in e.props),
     `누락 ${all.filter((e) => !("days_since_first" in e.props)).length}건`);
  ck("첫 방문이면 days_since_first = 0",
     all.every((e) => e.props.days_since_first === 0),
     `값=${[...new Set(all.map((e) => e.props.days_since_first))].join(",")}`);

  const sd = await pick(page, "streak_day");
  ck("첫 방문에 streak_day 가 남는다", sd.length >= 1, `${sd.length}건`);
  ck("streak_day 는 하루 1회만(StrictMode 이중 발사 없음)", sd.length === 1, `${sd.length}건`);
  ck("첫 날 스트릭은 1", sd[0] && sd[0].props.streak === 1, sd[0] ? `streak=${sd[0].props.streak}` : "");
  ck("첫 방문은 returning=false", sd[0] && sd[0].props.returning === false);
  ck("끊김은 첫날에 안 찍힌다", (await pick(page, "streak_broken")).length === 0);

  /* 판결록은 판결이 있어야 열린다. 판결 없이도 버튼이 없다는 것 자체는 확인해 둔다 —
     "안 눌렀다"와 "버튼이 없었다"를 나중에 데이터에서 가르기 위한 기준선이다. */
  ck("판결 0건이면 판결록 버튼이 없다",
     (await page.getByRole("button", { name: /판결록 —/ }).count()) === 0);
  await page.close();
}

/* ── ③·④ 재방문 — 아침문안·판결록 ────────────────────────────────────────
   재방문 상태를 실제로 만들려면 하루를 기다려야 하므로, 저장된 기억을 손으로 심는다.
   ⚠ 앱이 읽는 키·형태 그대로 심어야 한다 — 형태가 어긋나면 앱이 조용히 새 유저로 떨어지고
     이 검사는 "문안이 안 떴다"를 앱 결함으로 오인한다. */
{
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  await onboard(page, BASE, "?trackdebug&i=0");

  // 판결록·문안이 뜨는 상태를 만든다: 기억을 어제 날짜로 되돌리고 판결 기록 하나를 심는다
  await page.evaluate(() => {
    const key = "binari.v1";                       // App.jsx STORE_KEY 와 같은 값이어야 한다
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const m = JSON.parse(raw);
    const y = new Date(); y.setDate(y.getDate() - 1);
    const ys = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    m.streak = { last: ys, count: 3 };                       // 어제까지 3일 연속
    m.records = [{ at: Date.now() - 3 * 86400000, q: "가상 질문", direction: "HOLD",
                   verdict: "가상 판결", cat: "B", actionable: false, followUp: null, note: "", rating: 0 }];
    localStorage.setItem(key, JSON.stringify(m));
    Object.keys(localStorage).filter((k) => k.indexOf("binari.once.") === 0).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("binari.lastvisit.v1");
    localStorage.removeItem("binari.daily.v1");    // App.jsx DAILY_KEY — 오늘 문안 미수령 상태로
  });
  /* 재방문은 온보딩을 건너뛰지만 **수호신을 다시 깨우는 단계는 남아 있다**(로비 = '두드려봐').
     그걸 안 밟으면 textarea.qbox 가 안 뜨고, 검사는 "문안이 안 떴다"를 앱 결함으로 오인한다. */
  await page.reload();
  await page.waitForTimeout(1200);
  if (await page.locator("canvas").first().count()) {
    await page.locator("canvas").first().dblclick().catch(() => {});
  }
  await page.waitForSelector("textarea.qbox", { timeout: 15000 });
  await page.waitForTimeout(800);

  const sd = await pick(page, "streak_day");
  ck("이어진 방문은 streak_day 가 4로 오른다",
     sd.some((e) => e.props.streak === 4 && e.props.returning === true),
     sd.map((e) => e.props.streak).join(",") || "0건");

  const off = await pick(page, "daily_offered");
  ck("문안이 떴으면 daily_offered 가 남는다(열림의 분모)", off.length >= 1, `${off.length}건`);
  ck("daily_offered 는 방문당 1회", off.length <= 1, `${off.length}건`);
  /* 2026-08-26 우선순위 교체 — 문안(당김형)이 먼저, 되물음(push)이 미뤄진다.
     속성도 방향이 바뀌었다: blocked_by_askback(문안이 밀림) → askback_deferred(되물음이 밀림). */
  ck("미뤄진 되물음을 구분한다(문안 우선)", off[0] && "askback_deferred" in off[0].props);
  ck("옛 속성(blocked_by_askback)은 더 안 나간다", off[0] && !("blocked_by_askback" in off[0].props));

  const knock = page.getByRole("button", { name: /오늘의 하늘을 봐뒀어/ });
  if (await knock.count()) {
    await knock.click(); await page.waitForTimeout(250);
    const op = await pick(page, "daily_opened");
    ck("문안을 열면 daily_opened", op.length === 1, `${op.length}건`);
    ck("daily_opened 에 스트릭이 실린다", op[0] && op[0].props.streak === 4, op[0] ? `streak=${op[0].props.streak}` : "");
    await page.getByRole("button", { name: "받았어" }).click(); await page.waitForTimeout(250);
    ck("받으면 daily_received", (await pick(page, "daily_received")).length === 1);
  } else ck("문안 노크가 화면에 떴다", false, "dailyData 조건이 바뀌었는지 확인");

  const logBtn = page.getByRole("button", { name: /판결록 —/ });
  ck("판결 기록이 있으면 판결록 버튼이 뜬다", (await logBtn.count()) === 1);
  if (await logBtn.count()) {
    await logBtn.click(); await page.waitForTimeout(250);
    const lo = await pick(page, "log_opened");
    ck("판결록을 열면 log_opened", lo.length === 1, `${lo.length}건`);
    ck("미보고 건수가 함께 실린다", lo[0] && lo[0].props.unreported === 1, lo[0] ? `unreported=${lo[0].props.unreported}` : "");
    ck("접을 때는 다시 안 찍힌다(펼침만 센다)", true);
    await page.locator(".vlogrow").first().click(); await page.waitForTimeout(250);
    const lr = await pick(page, "log_row_opened");
    ck("행을 펼치면 log_row_opened", lr.length === 1, `${lr.length}건`);
    ck("며칠 지난 판결인지 남는다", lr[0] && lr[0].props.age_days === 3, lr[0] ? `age_days=${lr[0].props.age_days}` : "");
    // 펼친 뒤에는 버튼 문구가 "판결록 접기" 로 바뀐다 — 같은 로케이터로 잡히지 않는다
    await page.getByRole("button", { name: "판결록 접기" }).click(); await page.waitForTimeout(200);
    ck("판결록 접기는 log_opened 를 늘리지 않는다", (await pick(page, "log_opened")).length === 1);
  }

  /* ⑤ 질문 원문이 리텐션 이벤트에 섞이면 안 된다 — 이 자리는 anon() 을 안 거친다 */
  const ret = (await evs(page)).filter((e) => /^(streak_|daily_|log_)/.test(e.ev));
  ck("리텐션 이벤트에 질문 원문이 안 섞인다",
     !JSON.stringify(ret).includes("가상 질문") && !JSON.stringify(ret).includes("가상 판결"));
  ck("리텐션 이벤트에도 is_internal·ft_* 가 붙는다",
     ret.length > 0 && ret.every((e) => typeof e.props.ft_source === "string" && "is_internal" in e.props));
  await page.close(); await ctx.close();
}

await b.close();
const bad = R.filter((x) => !x).length;
console.log(`\n${R.length - bad}/${R.length} PASS`);
process.exit(bad ? 1 : 0);
