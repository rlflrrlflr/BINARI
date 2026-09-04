/* 마지막 그물 회귀 — 실행: preview 기동 후 node app/e2e/crash-net-check.mjs
 *
 * 왜 이 검사가 있는가:
 *   2026-08-31 라이브 사고에서 **첫 방문자가 빈 화면을 봤다.** 렌더가 던졌는데
 *   에러 경계가 0개라 React 가 트리를 통째로 언마운트했고, 배경이 단색이라
 *   고장이 아니라 로딩 중으로 보였다. 그날 원인 셋은 고쳤지만 **구조는 그대로였다.**
 *
 *   그리고 그 빈 화면은 **계측에 안 보인다.** posthog.init 이 App 안의 useEffect 에서
 *   돌기 때문에 마운트가 실패하면 이벤트가 0건이다 — 「아무도 안 왔다」와
 *   「전부 죽었다」가 데이터에서 같은 그림이다.
 *
 * 여기서 묻는 것은 원인이 아니라 **성질**이다:
 *   ① 멀쩡할 땐 그물이 안 보인다 (평소 화면을 안 가린다)
 *   ② 렌더가 던져도 유저에게 **누를 것**이 남는다 (빈 화면이 아니다)
 *   ③ 그 버튼이 실제로 앱을 되살린다
 *   ④ 죽었다는 사실이 **밖으로 나간다** (app_crashed)
 *   ⑤ 계측을 거부한 사람에게선 **안 나간다**
 *   ⑥ 오류 문구가 통째로 실려 나가지 않는다 (140자 상한)
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;

const BASE = process.env.BASE || "http://localhost:4173";
const R = []; const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
const evs = (page) => page.evaluate(() => window.__binariEvents || []);

const b = await chromium.launch((process.env.CHROME_PATH || process.env.PW_CHROMIUM)
  ? { executablePath: process.env.CHROME_PATH || process.env.PW_CHROMIUM } : {});

/* ── ① 멀쩡할 땐 그물이 안 보인다 ───────────────────────────────────────── */
{
  const page = await b.newPage({ viewport: { width: 430, height: 932 } });
  page.setDefaultTimeout(12000);
  await page.goto(BASE); await page.waitForTimeout(1200);
  ck("평소엔 그물이 화면에 없다", (await page.locator("[data-boot-net]").count()) === 0);
  ck("평소엔 첫 방문자가 누를 것을 본다", (await page.getByRole("button").count()) > 0,
     `버튼 ${await page.getByRole("button").count()}개`);
  await page.close();
}

/* ── ②·③·④·⑥ 렌더가 던졌을 때 ─────────────────────────────────────────── */
{
  const page = await b.newPage({ viewport: { width: 430, height: 932 } });
  page.setDefaultTimeout(12000);
  await page.goto(BASE + "/?boom&trackdebug"); await page.waitForTimeout(1200);

  const rootText = await page.evaluate(() => (document.getElementById("root")?.innerText || "").trim());
  ck("빈 화면이 아니다(root 에 글자가 있다)", rootText.length > 0, `${rootText.length}자`);
  ck("그물이 떴다", (await page.locator("[data-boot-net]").count()) === 1);

  const again = page.getByRole("button", { name: "다시 열어볼래" });
  ck("누를 것이 있다", (await again.count()) === 1);

  const crashed = (await evs(page)).filter((e) => e.ev === "app_crashed");
  ck("죽었다는 사실이 밖으로 나간다", crashed.length === 1, `${crashed.length}건`);
  ck("어디서 죽었는지가 실린다", crashed[0] && typeof crashed[0].props.where === "string" && crashed[0].props.where.length > 0);
  ck("오류 문구는 140자를 안 넘는다",
     crashed[0] && String(crashed[0].props.err_msg || "").length <= 140,
     crashed[0] ? `${String(crashed[0].props.err_msg || "").length}자` : "");

  if (await again.count()) {
    await again.click(); await page.waitForTimeout(1500);
    ck("누르면 앱이 되살아난다", (await page.locator("[data-boot-net]").count()) === 0
       && (await page.getByRole("button").count()) > 0);
  } else ck("누르면 앱이 되살아난다", false, "버튼이 없어 못 눌렀다");
  await page.close();
}

/* ── ⑤ 거부한 사람에게선 안 나간다 ──────────────────────────────────────
   ⚠ 이게 이 검사의 핵심이다. 마운트가 실패하면 App 의 useEffect 가 안 돌아서
     _optout 이 기본값(false)에 머문다. 그물이 거부권을 **스스로 다시 읽지 않으면**
     거부한 사람에게서 조용히 이벤트가 나간다. */
{
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("binari.analytics_optout.v1", "1"); } catch (_) {}
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  await page.goto(BASE + "/?boom&trackdebug"); await page.waitForTimeout(1200);

  ck("거부해도 그물은 그대로 뜬다(화면은 안 뺏는다)", (await page.locator("[data-boot-net]").count()) === 1);
  ck("거부한 사람에게선 app_crashed 가 안 나간다",
     (await evs(page)).filter((e) => e.ev === "app_crashed").length === 0);
  await page.close(); await ctx.close();
}

await b.close();
const bad = R.filter((x) => !x).length;
console.log(`\n${R.length - bad}/${R.length} PASS`);
process.exit(bad ? 1 : 0);
