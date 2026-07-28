// 계측 D1~D4 배관 검증 — 인계서 3절 ① 체크리스트의 자동화 버전
// 실행: npm run build && npm run preview -- --port 4173 & 후 node e2e/track-check.mjs
//
// PostHog 네트워크 없이 검증한다. ?trackdebug 를 붙이면 track()이 전송 직전의 최종 속성을
// window.__binariEvents 에 그대로 쌓으므로, "무엇이 실제로 나가는가"를 여기서 직접 읽는다.
// 판결(=/api/judge)이 필요 없는 app_open 기준이라 API 키 없이도 돈다.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;

const BASE = process.env.BASE || "http://localhost:4173";
const results = [];
const check = (name, pass, note = "") => { results.push({ name, pass, note }); console.log(`${pass ? "PASS" : "FAIL"} — ${name}${note ? " · " + note : ""}`); };

// PW_CHROMIUM: playwright 번들 버전과 설치된 크로미움이 어긋나는 환경(CI·클라우드)에서 경로를 직접 준다
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

// 새 브라우저(=새 localStorage)에서 한 번 열고, app_open 이벤트의 최종 속성을 돌려준다.
// init 은 페이지 스크립트보다 먼저 실행되므로 사전 상태(동의·신념) 주입에 쓴다.
async function open(ctx, url) {
  const page = await ctx.newPage({ viewport: { width: 390, height: 844 } });
  // 방문 기록을 지워 "30분 뒤 다시 옴"을 흉내낸다 — 아래 검사들은 매번 app_open 이 필요하다.
  // (새로고침 중복 방지 검사는 이 헬퍼를 쓰지 않고 직접 페이지를 연다)
  await page.addInitScript(() => { try { localStorage.removeItem("binari.lastvisit.v1"); } catch (_) {} });
  await page.goto(BASE + url);
  await page.waitForFunction(() => (window.__binariEvents || []).some((e) => e.ev === "app_open"), null, { timeout: 10000 });
  const props = await page.evaluate(() => window.__binariEvents.find((e) => e.ev === "app_open").props);
  await page.close();
  return props;
}
async function fresh(init) {
  const ctx = await browser.newContext();
  if (init) await ctx.addInitScript(init);
  return ctx;
}

try {
  /* ── D2: first-touch 고정 — 소재별 귀속의 전제. 깨지면 소재 성과를 영구히 못 잰다 ── */
  {
    const ctx = await fresh();
    const a = await open(ctx, "/?trackdebug&utm_source=meta&utm_medium=paid&utm_campaign=test&utm_content=creative_A7");
    check("D2 최초 유입에 ft_* 기록", a.ft_source === "meta" && a.ft_medium === "paid" && a.ft_campaign === "test" && a.ft_content === "creative_A7",
      `ft_source=${a.ft_source} ft_content=${a.ft_content}`);

    // 핵심: 파라미터 없는 재방문이 direct 로 덮지 않아야 한다
    const b = await open(ctx, "/?trackdebug");
    check("D2 파라미터 없는 재방문에도 ft_content 유지", b.ft_content === "creative_A7" && b.ft_source === "meta",
      `ft_source=${b.ft_source} ft_content=${b.ft_content}`);

    // 다른 소재로 재유입해도 최초 값이 이겨야 한다(first-touch)
    const c = await open(ctx, "/?trackdebug&utm_source=google&utm_content=creative_B2");
    check("D2 다른 소재 재유입에도 최초값 우선", c.ft_content === "creative_A7" && c.ft_source === "meta",
      `ft_source=${c.ft_source} ft_content=${c.ft_content}`);

    check("D2 ft_date 기록", typeof a.ft_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.ft_date), `ft_date=${a.ft_date}`);
    await ctx.close();
  }

  /* ── D2: 광고 클릭 식별자는 종류만 남기고 원값은 절대 싣지 않는다 ── */
  {
    const ctx = await fresh();
    const a = await open(ctx, "/?trackdebug&fbclid=IWAR_SECRET_VALUE_123");
    check("D2 fbclid → ft_source=meta·ft_click=fbclid", a.ft_source === "meta" && a.ft_click === "fbclid", `ft_source=${a.ft_source} ft_click=${a.ft_click}`);
    check("D2 fbclid 원값 미전송", !JSON.stringify(a).includes("IWAR_SECRET_VALUE_123"));
    await ctx.close();
  }

  /* ── D1: 내부 트래픽 플래그 — 유저 지표 오염을 막는 제외 필터의 근거 ── */
  {
    const ctx = await fresh();
    const a = await open(ctx, "/?trackdebug&i=1");
    check("D1 ?i=1 → is_internal true", a.is_internal === true, `is_internal=${a.is_internal}`);
    const b = await open(ctx, "/?trackdebug");
    check("D1 재방문에도 내부 플래그 유지", b.is_internal === true, `is_internal=${b.is_internal}`);
    await ctx.close();

    const ctx2 = await fresh();
    const c = await open(ctx2, "/?trackdebug");
    check("D1 새 브라우저는 is_internal false", c.is_internal === false, `is_internal=${c.is_internal}`);
    await ctx2.close();
  }

  /* ── 2단계 동의: 미동의 시 프로파일 키만 빠지고 이벤트·1단계 지표는 살아야 한다 ──
     belief 는 2026-07-26부터 1단계라 동의와 무관하게 전송된다(G2 게이트 표본 확보).
     대신 2단계 키(verdict/hesit/age_band 등)는 여전히 제거돼야 한다. */
  {
    const inject = () => { localStorage.setItem("binari.belief.v1", "skeptic"); };
    const ctx = await fresh(inject);                                     // 동의 없음
    const a = await open(ctx, "/?trackdebug");
    check("belief 는 동의 없이도 전송", a.belief === "skeptic", `belief=${a.belief}`);
    check("동의 없이도 1단계 지표는 전송", a.is_internal === false && typeof a.ft_source === "string" && "returning" in a && "ref" in a,
      `ref=${a.ref} returning=${a.returning}`);
    await ctx.close();

    const ctx2 = await fresh(() => {
      localStorage.setItem("binari.belief.v1", "skeptic");
      localStorage.setItem("binari.analytics_consent.v1", "1");
    });
    const b = await open(ctx2, "/?trackdebug");
    check("동의 시에도 belief 전송", b.belief === "skeptic", `belief=${b.belief}`);
    await ctx2.close();

    // stripProfile 이 2단계 키(verdict/hesit/age_band…)를 실제로 제거하는지는 여기서 못 잰다.
    // 그 키들은 verdict_shown 에만 실리고, 판결에는 /api/judge 호출이 필요하기 때문이다.
    // 프로덕션 데이터로 확인함(2026-07-26): verdict_shown 17건 중 dir 17/17 · verdict 8/17.
  }

  /* ── 온보딩 화면별 도달 — 광고 유입자가 어디서 죽는지 보려면 화면마다 1발씩 찍혀야 한다 ── */
  {
    const ctx = await fresh();
    const page = await ctx.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(BASE + "/?trackdebug");
    await page.waitForFunction(() => (window.__binariEvents || []).some((e) => e.ev === "app_open"), null, { timeout: 10000 });
    await page.getByRole("button", { name: "조각을 모으러 갈래" }).click();
    await page.waitForFunction(() => (window.__binariEvents || []).some((e) => e.ev === "onboard_step"), null, { timeout: 8000 });
    const evs = await page.evaluate(() => window.__binariEvents.map((e) => ({ ev: e.ev, step: e.props.step })));
    const steps = evs.filter((e) => e.ev === "onboard_step").map((e) => e.step);
    check("온보딩 첫 화면이 onboard_step 으로 기록", steps[0] === "name", `steps=${steps.join(",")}`);
    check("onboard_start 가 onboard_step 보다 먼저", evs.findIndex((e) => e.ev === "onboard_start") < evs.findIndex((e) => e.ev === "onboard_step"));

    // 뒤로 갔다 오면 중복 발사되면 안 된다 — 퍼널 이탈률이 왜곡된다
    await page.getByRole("button", { name: "이름 없이 갈래" }).click();
    await page.waitForTimeout(600);
    const back = page.getByText("아까 장면으로 돌아갈래");
    if (await back.count()) { await back.first().click(); await page.waitForTimeout(400); }
    const steps2 = await page.evaluate(() => window.__binariEvents.filter((e) => e.ev === "onboard_step").map((e) => e.props.step));
    check("onboard_step 화면당 1회만(중복 없음)", steps2.length === new Set(steps2).size, `steps=${steps2.join(",")}`);

    // 고정 속성이 온보딩 이벤트에도 그대로 붙어야 소재별 완주율이 갈린다
    const p = await page.evaluate(() => window.__binariEvents.find((e) => e.ev === "onboard_step").props);
    check("onboard_step 에도 ft_*·is_internal 부착", typeof p.ft_source === "string" && p.is_internal === false, `ft_source=${p.ft_source}`);
    await page.close(); await ctx.close();
  }

  /* ── 유실 방지: posthog 로드 전에 발생하는 app_open 이 큐를 타고 살아남아야 한다 ── */
  {
    const ctx = await fresh();
    const page = await ctx.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(BASE + "/?trackdebug");
    await page.waitForFunction(() => (window.__binariEvents || []).some((e) => e.ev === "app_open"), null, { timeout: 10000 });
    const first = await page.evaluate(() => window.__binariEvents[0].ev);
    check("app_open 이 첫 이벤트로 기록", first === "app_open", `first=${first}`);

    // 무료 요금제 한도 방어 — 새로고침해도 방문당 1회만 쌓여야 한다
    await page.reload();
    await page.waitForTimeout(1500);
    const opens = await page.evaluate(() => (window.__binariEvents || []).filter((e) => e.ev === "app_open").length);
    check("app_open 은 방문당 1회만(새로고침 중복 없음)", opens === 0, `재방문 후 재발사=${opens}`);

    // 습관 앱의 핵심 신호 — 시간이 지나 다시 오면 반드시 새 방문으로 세야 한다.
    // 이게 깨지면 "하루에 몇 번 열었나"를 영영 못 재고, 리텐션이 실제보다 낮게 나온다.
    await page.evaluate(() => localStorage.setItem("binari.lastvisit.v1", String(Date.now() - 31 * 60 * 1000)));
    await page.reload();
    await page.waitForTimeout(1500);
    const reopens = await page.evaluate(() => (window.__binariEvents || []).filter((e) => e.ev === "app_open").length);
    check("30분 뒤 재방문은 새 방문으로 집계", reopens === 1, `재발사=${reopens}`);
    await page.close();
    await ctx.close();
  }

  /* ── 성능 자동수집($web_vitals)이 꺼졌는지 — 전체 기록의 22%를 먹던 항목 ── */
  {
    const ctx = await fresh();
    const page = await ctx.newPage({ viewport: { width: 390, height: 844 } });
    const hits = [];
    page.on("request", (r) => { if (/posthog/i.test(r.url())) hits.push(r.url()); });
    await page.goto(BASE + "/?trackdebug");
    await page.waitForTimeout(2500);
    check("posthog 설정에 성능수집 꺼짐", await page.evaluate(() => {
      const c = window.posthog && window.posthog.config;
      return !c || c.capture_performance === false;
    }));
    await page.close(); await ctx.close();
  }
} catch (e) {
  check("실행 중 예외", false, String(e && e.message || e));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
