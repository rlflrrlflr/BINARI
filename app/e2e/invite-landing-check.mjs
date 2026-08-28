/* 초대 랜딩 — 링크를 받은 사람이 실제로 그 화면을 걸어 나가는가.
   실행: preview 기동 후 node e2e/invite-landing-check.mjs

   왜 브라우저로 하나: `invite-check` 는 서버가 약속을 지키는지 보고, 이건 **사람이 지나가는지**를 본다.
   둘은 다른 것을 잡는다 — TDZ 한 줄로 앱이 통째로 안 뜬 사고(v144)를 잡은 건 브라우저뿐이었다.

   ⚠ preview 는 정적 서버라 `/api/*` 가 없다. 그래서 **진짜 핸들러를 이 프로세스에서 돌려**
     page.route 로 물린다. 서버를 흉내 내면 흉내가 통과할 뿐이다 — 검사가 잡으려는 건 그 반대다. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
import handler, { _resetMem } from "../api/invite/[[...seg]].js";

const BASE = process.env.BASE || "http://localhost:4173";
const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

/* 핸들러를 직접 부른다(invite-check 와 같은 대역) */
async function api(method, { seg = [], query = {}, body = null } = {}) {
  const req = { method, headers: { origin: "https://binari-sepia.vercel.app" }, query: { ...query, seg }, body };
  let code = 200, payload = null;
  const res = { setHeader() {}, status(c) { code = c; return res; }, json(v) { payload = v; return res; }, end() { return res; } };
  await handler(req, res);
  return { code, body: payload };
}

_resetMem();
/* A의 좌표 — **가상 명식**이다(CLAUDE.md §운영 규칙). 실제 사람의 값을 검사에 넣지 않는다. */
const A_AXES = { dG: 2, dJ: 0, el: "화", nayin: "노방토", sun: "전갈자리", moon: "게자리",
  nak: 5, rashi: 3, wday: "월요일", pasa: "레기", neptu: 12, tone: 4, tsign: "치칸", lp: 7 };
const made = await api("POST", { body: { axes: A_AXES, name: "연지" } });
const ID = made.body.id;

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(9000);
const seen = [];
await page.route("**/api/invite**", async (route) => {
  const u = new URL(route.request().url());
  const rest = u.pathname.replace(/^\/api\/invite\/?/, "");
  const seg = rest ? rest.split("/").map(decodeURIComponent) : [];
  const query = Object.fromEntries(u.searchParams);
  let body = null;
  try { body = JSON.parse(route.request().postData() || "null"); } catch (_) {}
  seen.push({ m: route.request().method(), seg, body });
  const r = await api(route.request().method(), { seg, query, body });
  await route.fulfill({ status: r.code, contentType: "application/json", body: JSON.stringify(r.body) });
});

await page.goto(`${BASE}/?inv=${ID}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);

/* ── ① 첫 화면 — 누가 불렀는지, 무엇이 나가는지 ───────────────────────── */
const ask = page.locator("section.invask");
ck("① 초대 화면이 뜬다", await ask.isVisible().catch(() => false));
const who = (await page.locator(".invwho").innerText().catch(() => "")).replace(/\n/g, " ");
ck("① 부른 사람의 이름이 첫 줄에 뜬다", who.includes("연지"), who);
/* ⚠ 이름 뒤 조사 — "연지이 궁금해했어"가 시안 첫 판에서 실제로 나갔다. 받침 없는 이름이라 「가」다. */
ck("① 이름 뒤 조사가 맞다(연지+가)", who.includes("연지가") && !who.includes("연지이"), who);

ck("① 온보딩 전체가 아니라 생일 세 칸이다", (await ask.locator("input.in").count()) <= 4,
   `${await ask.locator("input.in").count()}칸`);
ck("① 태어난 시를 안 묻는다", !/몇 시|태어난 시를/.test(await ask.innerText()));
const notice = await page.locator(".invnotice").innerText().catch(() => "");
ck("① 무엇이 나가는지 눈에 띄게 적혀 있다", /이 기기에만/.test(notice) && /안 가/.test(notice), notice.replace(/\n/g, " ").slice(0, 60));
ck("① 동의 체크는 켠 채로 시작한다", await page.locator(".invchk input").isChecked());
/* §4 — '궁합'은 유료 문서 이름이다. 무료 화면에 쓰면 값을 치른 것과 헷갈린다 */
ck("① '궁합'이라는 말을 안 쓴다", !/궁합/.test(await ask.innerText()));
/* 헌장 — 결과를 보기 전엔 아무 값도 안 나간다(엿보기 한 번뿐) */
ck("① 열었을 때 나간 요청은 엿보기 하나뿐", seen.length === 1 && seen[0].m === "GET", JSON.stringify(seen.map((x) => x.m + x.seg.join())));

/* ── ② 결과 — 엔진이 만든 것을 그대로 편다 ────────────────────────────── */
await ask.locator("input.in").nth(0).fill("1987");
await ask.locator("input.in").nth(1).fill("9");
await ask.locator("input.in").nth(2).fill("3");
await ask.locator("input.in.wide").fill("지은");
await page.getByRole("button", { name: "둘 사이를 볼게" }).click();
await page.waitForTimeout(1200);

const res = page.locator("section.invres");
ck("② 결과 화면으로 넘어간다", await res.isVisible().catch(() => false));
ck("② 아홉 칸이 다 선다", (await res.locator(".invcells li").count()) === 9,
   `${await res.locator(".invcells li").count()}칸`);
const says = await res.locator(".invcells .say").allTextContents();
ck("② 칸은 세 낱말뿐이다(총점·퍼센트·하트 없음)",
   says.every((t) => ["맞는다", "갈린다", "그 사이"].includes(t.trim())), [...new Set(says)].join("·"));
const rtxt = await res.innerText();
ck("② 총점·게이지·퍼센트가 없다", !/\d+\s*점|\d+%|\d+\s*\/\s*\d+/.test(rtxt), (rtxt.match(/\d+[점%]/) || ["없음"])[0]);
ck("② 머리글이 있다(갈림을 먼저 말한다)", (await res.locator(".chorush").innerText()).length > 6);

/* ── ③ 다음 문 — 이 지시서의 목표(k 의 분자) ──────────────────────────── */
ck("③ 세 번째 화면을 만들지 않았다 — 문이 결과 안에 있다", await res.locator(".invdoor").isVisible());
ck("③ 문이 수호신으로 이어진다", await page.getByRole("button", { name: "응, 내 것도 볼래" }).isVisible());

/* ── ④ 응답은 한 번 — 재공유 방어가 화면에서도 닫힌다 ─────────────────── */
const p2 = await b.newPage({ viewport: { width: 430, height: 932 } });
await p2.route("**/api/invite**", async (route) => {
  const u = new URL(route.request().url());
  const rest = u.pathname.replace(/^\/api\/invite\/?/, "");
  const r = await api(route.request().method(), { seg: rest ? rest.split("/").map(decodeURIComponent) : [],
    query: Object.fromEntries(u.searchParams), body: JSON.parse(route.request().postData() || "null") });
  await route.fulfill({ status: r.code, contentType: "application/json", body: JSON.stringify(r.body) });
});
await p2.goto(`${BASE}/?inv=${ID}`, { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(500);
const dead = await p2.locator("section").innerText().catch(() => "");
ck("④ 두 번째 사람은 열지 못한다", /열 수 없어/.test(dead), dead.replace(/\n/g, " ").slice(0, 50));
ck("④ 막다른 길로 두지 않는다(자기 수호신으로 가는 문)",
   await p2.getByRole("button", { name: /내 수호신/ }).isVisible().catch(() => false));
await p2.close();

/* ── ⑤ 온보딩 축약 — 생년월일 **다음** 단계에 떨어진다 ─────────────────── */
await page.getByRole("button", { name: "응, 내 것도 볼래" }).click();
await page.waitForTimeout(700);
const on = await page.locator("section.stepv").innerText().catch(() => "");
ck("⑤ 온보딩으로 이어진다", (await page.locator("section.stepv").count()) === 1);
ck("⑤ 생년월일을 다시 묻지 않는다", !/태어난 순간의 하늘로 데려가/.test(on), on.replace(/\n/g, " ").slice(0, 50));
ck("⑤ 생일 다음 칸(시)에서 시작한다", /몇 시였는지/.test(on), on.replace(/\n/g, " ").slice(0, 40));
ck("⑤ 주소에서 초대 흔적이 지워진다", !/inv=/.test(page.url()), page.url());
/* 뒤로 돌아가면 채워진 생년월일이 그대로 보여야 한다 — 안 그러면 "다시 안 묻는다"가 거짓이다 */
await page.getByRole("button", { name: "아까 장면으로 돌아갈래" }).click();
await page.waitForTimeout(400);
const ys = await page.locator("section.stepv input.in").nth(0).inputValue();
ck("⑤ 넣었던 생년월일이 실제로 실려 있다", ys === "1987", ys);

/* ══════════ A 쪽 — 부르면 자리가 서고, 답이 오면 그 자리가 사람이 된다 ══════════
   B 쪽만 도는 건 반쪽이다. 이 루프는 **A가 답을 보는 순간** 닫힌다(§5). */
{
  const pa = await b.newPage({ viewport: { width: 430, height: 932 } });
  const calls = [];
  await pa.route("**/api/invite**", async (route) => {
    const u = new URL(route.request().url());
    const rest = u.pathname.replace(/^\/api\/invite\/?/, "");
    let body = null; try { body = JSON.parse(route.request().postData() || "null"); } catch (_) {}
    calls.push({ m: route.request().method(), body });
    const r = await api(route.request().method(), { seg: rest ? rest.split("/").map(decodeURIComponent) : [],
      query: Object.fromEntries(u.searchParams), body });
    await route.fulfill({ status: r.code, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  const { onboard } = await import("./onboard.mjs");
  await onboard(pa, BASE);
  /* ⚠ **첫 곁은 초대로 안 만든다.** 창업자 게이트가 그렇다 — *"첫 입력은 공짜야. 근데 추가로
     보려면 그 사람이 입력을 해줘야 해."* 그래서 명부가 비어 있는 동안 초대 문은 아예 없고,
     궁합으로 첫 자리를 만든 뒤에야 「한 사람 더 부를래」가 선다. 검사도 그 순서를 그대로 밟는다. */
  await pa.getByRole("button", { name: "곁", exact: true }).click();
  await pa.waitForTimeout(1100);
  if (!(await pa.locator(".impask input.impnum").count())) {
    await pa.getByRole("button", { name: /부르게 돼|맞대|둘 사이/ }).first().click();
    await pa.waitForTimeout(800);
  }
  const ins = pa.locator(".impask input.impnum");
  await ins.nth(0).fill("1997"); await ins.nth(1).fill("4"); await ins.nth(2).fill("22");
  await pa.locator(".impask input.impname").fill("민수");
  await pa.getByRole("button", { name: "둘을 맞대 볼게" }).click();
  await pa.waitForTimeout(1200);
  await pa.getByRole("button", { name: /닫을게/ }).last().click();
  await pa.waitForTimeout(1800);
  /* 명부는 **두 번 두드려야 열린다**(판결 탭 awake 와 같은 문법 — gyeot-check ⑥과 같은 손짓) */
  const open = async () => { await pa.locator("canvas").first().dblclick(); await pa.waitForTimeout(700); };
  await open();
  ck("⑥ 명부가 열린다", await pa.getByRole("button", { name: "한 사람 더 부를래" }).isVisible().catch(() => false));

  await pa.getByRole("button", { name: "한 사람 더 부를래" }).click();
  await pa.waitForTimeout(250);
  ck("⑥ 부르기 전에 이름을 묻는다", await pa.locator(".gcall input").isVisible().catch(() => false));
  await pa.locator(".gcall input").fill("주영");
  await pa.getByRole("button", { name: "부를게" }).click();
  await pa.waitForTimeout(900);

  const madeIt = calls.find((c) => c.m === "POST" && c.body?.axes);
  ck("⑥ 서버로 간 건 좌표뿐 — 생년월일 원값이 없다",
     !!madeIt && !Object.keys(madeIt.body.axes).some((k) => /^(y|m|d|h|min|birth)$/i.test(k)),
     Object.keys(madeIt?.body?.axes || {}).join(","));
  ck("⑥ 이름은 서버로 안 간다(부를 사람의 이름)",
     !JSON.stringify(madeIt?.body || {}).includes("주영"), JSON.stringify(madeIt?.body?.name ?? null));

  const row = pa.locator(".gyeotlist li").filter({ has: pa.locator("input.galias") }).first();
  ck("⑥ 명부에 자리가 하나 는다", (await pa.locator(".gyeotlist li input.galias").count()) === 2,
     `${await pa.locator(".gyeotlist li input.galias").count()}자리`);
  ck("⑥ 그 자리의 이름이 실려 있다", (await pa.locator(".gyeotlist li input.galias").first().inputValue()) === "주영");
  ck("⑥ 아직은 '부른 곁'이다(흐린 층)", ((await row.getAttribute("class")) || "").includes("called"),
     (await row.getAttribute("class")) || "");
  const line = await row.locator(".grel").innerText();
  ck("⑥ 하늘을 모르는 걸 지어내지 않는다", /아직 답이 없어/.test(line), line);
  /* §5 — 승격은 밝기와 자리로만.
     ⚠ **써머리 표의 「n명」은 금지 대상이 아니다.** 그건 *사람*이 아니라 *자리*를 세는 수다
       (2026-08-17 결정: "세되, 사람을 안 센다"). 처음엔 그것까지 잡아서 검사가 틀렸다 —
       금지선은 **초대·응답을 세는 수**다. 그래서 써머리 표 밖만 본다. */
  const outside = await pa.locator("section.gyeot").evaluate((el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll(".gsumtable, .gsum").forEach((x) => x.remove());
    return c.innerText;
  });
  ck("⑥ 써머리 표 밖에는 개수·배지가 없다", !/\d\s*(명|개)/.test(outside), (outside.match(/\d+\s*[명개]/) || ["없음"])[0]);
  ck("⑥ 답한 수를 세는 말이 없다", !/답한 사람|답이 온 곁|\d+\s*명이 답/.test(await pa.locator("section.gyeot").innerText()));

  /* ── ⑦ B가 답한다 → A가 앱을 열면 그 자리가 사람이 된다 ─────────────── */
  const newId = (await api("GET", { query: { ids: "" } }), calls.find((c) => c.m === "POST" && c.body?.axes) ? null : null);
  const invId = await pa.evaluate(() => JSON.parse(localStorage.getItem("binari.invites.v1") || "[]")[0]);
  ck("⑦ 초대 id 는 A 기기에만 남는다", typeof invId === "string" && invId.length >= 10, String(invId).slice(0, 4) + "…");
  const ans = await api("POST", { seg: ["answer"], body: { id: invId, notify: true } });
  ck("⑦ 받은 사람이 답할 수 있다", ans.code === 200 && !!ans.body?.aAxes, `${ans.code}`);

  await pa.reload({ waitUntil: "domcontentloaded" });
  await pa.waitForTimeout(600);
  await pa.getByRole("button", { name: "곁", exact: true }).click();
  await pa.waitForTimeout(700);
  await open();
  const row2 = pa.locator(".gyeotlist li").filter({ has: pa.locator("input.galias") }).first();
  await pa.waitForTimeout(1200);
  ck("⑦ 답이 오면 그 자리가 '곁'이 된다", !((await row2.getAttribute("class")) || "").includes("called"),
     (await row2.getAttribute("class")) || "(없음)");
  ck("⑦ 승격해도 이름은 그대로다", (await pa.locator(".gyeotlist li input.galias").first().inputValue()) === "주영");
  const out3 = await pa.locator("section.gyeot").evaluate((el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll(".gsumtable, .gsum").forEach((x) => x.remove());
    return c.innerText;
  });
  ck("⑦ 승격을 숫자로 말하지 않는다", !/\d\s*명|답이 왔어요|N명|답한/.test(out3), (out3.match(/\d+\s*명/) || ["없음"])[0]);
  /* 한 번 승격되면 그냥 밝은 상태다 — 다시 열어도 '못 본 승격'이 쌓이지 않는다(§5) */
  ck("⑦ 저장분도 승격돼 있다(다음에 열어도 다시 안 밝아진다)",
     (await pa.evaluate(() => JSON.parse(localStorage.getItem("binari.gyeot.v1") || "[]")[0]?.tier)) === "standing");
  await pa.close();
}

await b.close();
const pass = R.filter(Boolean).length;
console.log(`\n=== 초대 랜딩: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
