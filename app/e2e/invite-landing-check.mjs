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

/* 핸들러를 직접 부른다(invite-check 와 같은 대역).
   ⚠ **`headers` 를 지어내지 마라.** 첫 판에 여기서 Origin 을 항상 넣어 줬는데,
     브라우저는 같은 출처 **GET 에 Origin 을 안 붙인다.** 그래서 실기에서 403 이 될 요청이
     검사에서는 통과했다 — 서버를 흉내 내면 흉내가 통과할 뿐이라고 이 파일 머리에 써 놓고
     내가 그렇게 했다. 이제 브라우저가 실제로 보낸 헤더를 그대로 넘긴다. */
async function api(method, { seg = [], query = {}, body = null, headers = {}, url = null } = {}) {
  /* ⚠ `query.seg` 를 안 넣는다 — Vercel 이 이 프로젝트에서 조각을 거기 안 실어 준다(라이브 실측).
     핸들러가 `req.url` 에서 직접 읽는지까지 여기서 같이 검사된다. */
  const qs = new URLSearchParams(Object.entries(query)).toString();
  const path = url || ("/api/invite" + (seg.length ? "/" + seg.map(encodeURIComponent).join("/") : "") + (qs ? "?" + qs : ""));
  const req = { method, headers, url: path, query: { ...query }, body };
  let code = 200, payload = null;
  const res = { setHeader() {}, status(c) { code = c; return res; }, json(v) { payload = v; return res; }, end() { return res; } };
  await handler(req, res);
  return { code, body: payload };
}

/* 브라우저가 실제로 부른 것을 **그대로** 핸들러에 넘기는 중계기 하나.
   ⚠ 세 군데에 손으로 복사해 뒀다가 한 곳만 고쳐서 깨뜨렸다 — 중계는 한 벌만 둔다. */
async function relay(route, tap) {
  const u = new URL(route.request().url());
  let body = null; try { body = JSON.parse(route.request().postData() || "null"); } catch (_) {}
  if (tap) tap({ m: route.request().method(), path: u.pathname, body, headers: route.request().headers() });
  const r = await api(route.request().method(), {
    url: u.pathname + u.search, query: Object.fromEntries(u.searchParams),
    body, headers: route.request().headers(),
  });
  await route.fulfill({ status: r.code, contentType: "application/json", body: JSON.stringify(r.body) });
}

_resetMem();
/* A의 좌표 — **가상 명식**이다(CLAUDE.md §운영 규칙). 실제 사람의 값을 검사에 넣지 않는다. */
const A_AXES = { dG: 2, dJ: 0, el: "화", nayin: "노방토", sun: "전갈자리", moon: "게자리",
  nak: 5, rashi: 3, wday: "월요일", pasa: "레기", neptu: 12, tone: 4, tsign: "치칸", lp: 7 };
const HDR = { origin: "https://binari-sepia.vercel.app" };   // 검사가 직접 부를 때만 쓴다
const made = await api("POST", { seg: ["new"], body: { axes: A_AXES, name: "연지" }, headers: HDR });
const ID = made.body.id;

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(9000);
const seen = [], seenHeaders = [];
await page.route("**/api/invite**", (route) => relay(route, (x) => { seen.push({ m: x.m, seg: x.path.replace(/^\/api\/invite\/?/, "").split("/").filter(Boolean) }); seenHeaders.push(x.headers); }));

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
/* ⚠ **동의 체크가 2026-08-28 에 사라졌다**(창업자: "이 칸 없애. 무조건 공유되도록").
   체크가 없어졌다고 검사까지 없애면 다음 판에 고지도 사라진다 — **자리를 옮겨** 문다:
   고를 수 있는 척하는 것이 없고, 대신 **무엇이 가는지** 버튼 위에 적혀 있어야 한다. */
ck("① 고를 수 있는 척하는 칸이 없다", (await page.locator(".invchk, input[type=checkbox]").count()) === 0);
ck("① 무엇이 가는지 버튼 바로 위에 적혀 있다",
   /누르면 .*둘 사이를 보게 돼/.test((await ask.innerText()).replace(/\n/g, " ")),
   ((await ask.innerText()).match(/누르면[^\n]*/) || ["없음"])[0]);
/* §4 — '궁합'은 유료 문서 이름이다. 무료 화면에 쓰면 값을 치른 것과 헷갈린다 */
ck("① '궁합'이라는 말을 안 쓴다", !/궁합/.test(await ask.innerText()));
/* 헌장 — 결과를 보기 전엔 아무 값도 안 나간다(엿보기 한 번뿐) */
ck("① 열었을 때 나간 요청은 엿보기 하나뿐", seen.length === 1 && seen[0].m === "GET", JSON.stringify(seen.map((x) => x.m + x.seg.join())));
/* ⚠ 이게 첫 판에 놓친 것 — 브라우저는 같은 출처 GET 에 Origin 을 **안 붙인다.**
   붙는다고 착각한 채 검사가 헤더를 지어내 주고 있어서, 실기에서 403 날 요청이 통과했다. */
ck("① 그 GET 에 브라우저는 Origin 을 안 붙인다(서버가 그걸 견뎌야 한다)",
   !seenHeaders.length || !seenHeaders[0].origin, JSON.stringify(seenHeaders[0] && seenHeaders[0].origin || "(없음)"));

/* ── ② 결과 — 엔진이 만든 것을 그대로 편다 ────────────────────────────── */
await ask.locator("input.in").nth(0).fill("1987");
await ask.locator("input.in").nth(1).fill("9");
await ask.locator("input.in").nth(2).fill("3");
await ask.locator("input.in.wide").fill("지은");
/* 시·분은 노크형 — 열어서 적으면 실제로 계산에 실린다(「시를 안 쓴다」가 거짓이었다) */
await page.getByRole("button", { name: /태어난 시도 알아/ }).click();
await page.waitForTimeout(200);
ck("① 시·분을 열면 두 칸이 선다", (await ask.locator("input.in.sm").count()) === 4,
   `${await ask.locator("input.in.sm").count()}칸`);
await ask.locator("input.in.sm").nth(2).fill("21");
await ask.locator("input.in.sm").nth(3).fill("40");
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
await p2.route("**/api/invite**", (route) => relay(route));
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
  await pa.route("**/api/invite**", (route) => relay(route, (x) => calls.push({ m: x.m, body: x.body })));
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

  /* ⚠ **부르기 전에 이름을 안 묻는다**(2026-08-28 창업자: *"받은 사람이 쓰면 되지"*).
     v155 부터 답이 올 때 그 사람 이름이 함께 오므로, 앞에서 A에게 묻는 건 같은 값을 두 번 받는 것이다.
     한 번 눌러 바로 초대가 만들어지고 자리는 **이름 없이** 선다. */
  await pa.getByRole("button", { name: "한 사람 더 부를래" }).click();
  await pa.waitForTimeout(1100);
  ck("⑥ 이름을 묻는 화면이 끼지 않는다", (await pa.locator(".gcall").count()) === 0);

  const madeIt = calls.find((c) => c.m === "POST" && c.body?.axes);
  ck("⑥ 서버로 간 건 좌표뿐 — 생년월일 원값이 없다",
     !!madeIt && !Object.keys(madeIt.body.axes).some((k) => /^(y|m|d|h|min|birth)$/i.test(k)),
     Object.keys(madeIt?.body?.axes || {}).join(","));
  ck("⑥ 초대를 만들 때 서버로 가는 이름은 **부른 사람 자기 이름**뿐이다(B 화면 첫 줄용)",
     typeof madeIt?.body?.name === "string", JSON.stringify(madeIt?.body?.name ?? null));

  const row = pa.locator(".gyeotlist li").filter({ has: pa.locator("input.galias") }).first();
  ck("⑥ 명부에 자리가 하나 는다", (await pa.locator(".gyeotlist li input.galias").count()) === 2,
     `${await pa.locator(".gyeotlist li input.galias").count()}자리`);
  ck("⑥ 답이 오기 전엔 이름이 비어 있다", (await pa.locator(".gyeotlist li input.galias").first().inputValue()) === "");
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
    const invId = await pa.evaluate(() => JSON.parse(localStorage.getItem("binari.invites.v1") || "[]")[0]);
  ck("⑦ 초대 id 는 A 기기에만 남는다", typeof invId === "string" && invId.length >= 10, String(invId).slice(0, 4) + "…");
  /* B가 동의하고 답한다 — **좌표를 함께 보낸다.** 이게 A에게 돌아오는 초대의 대가다
     (2026-08-28 창업자: "내가 초대했는데 내꺼에도 자동 반영이 되어야지"). */
  const B_AXES = { dG: 7, dJ: 4, el: "금", nayin: "검봉금", sun: "황소자리", moon: "사자자리",
    nak: 11, rashi: 1, wday: "수요일", pasa: "폰", neptu: 11, tone: 9, tsign: "이믹스", lp: 3 };
  const ans = await api("POST", { seg: ["answer"], body: { id: invId, notify: true, bAxes: B_AXES, label: "주영" }, headers: HDR });
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

  /* ── ⑧ **초대의 대가** — 자리가 채워지고 A도 둘 사이를 본다 ────────────────
     이게 없으면 게이트("그 다음부터는 그 사람이 직접 넣어야 한다")가 막다른 길이다.
     A는 그 사람 생년월일을 모르므로, 좌표가 안 오면 영영 사이를 못 본다. */
  const seat = await pa.evaluate(() => JSON.parse(localStorage.getItem("binari.gyeot.v1") || "[]")
    .find((x) => String(x.key).startsWith("inv:")) || null);
  ck("⑧ 답이 오면 자리에 하늘이 찬다(오행·일간)", seat && seat.el === "금" && seat.dg === 7,
     JSON.stringify(seat && { el: seat.el, dg: seat.dg }));
  ck("⑧ 관계 좌표가 자리에 실린다 — 사이를 A 기기에서 계산한다", !!(seat && seat.ax && seat.ax.nak === 11));
  ck("⑧ 그래도 생년월일 원값은 안 실린다",
     !Object.keys((seat && seat.ax) || {}).some((k) => /^(y|m|d|h|min|birth)$/i.test(k)));
  /* 이름은 **받은 사람이 쓴 것**이 그대로 온다 — A는 아무것도 안 적었다 */
  ck("⑧ 받은 사람이 적은 이름이 그 자리에 붙는다", seat && seat.name === "주영", seat && seat.name);
  /* ⚠ 반대 방향(「A가 적어 둔 이름은 안 덮는다」)은 **여기서 재지 않는다.**
     이 화면에선 A가 이름을 안 적으므로 그 경로가 안 밟힌다 — 처음엔 여기에 검사를 썼는데
     실제로는 아무것도 안 재는 항목이었다. 그 규칙은 `gyeot-roster-check` 가 함수로 직접 잰다. */
  const row3 = pa.locator(".gyeotlist li").filter({ has: pa.locator("input.galias") }).first();
  ck("⑧ 하늘이 차면 역할 이름이 뜬다(「아직 답이 없어」가 아니다)",
     !/답이 없어/.test(await row3.locator(".grel").innerText()), await row3.locator(".grel").innerText());
  ck("⑧ 그 행에 「둘 사이」 문이 생긴다", await row3.locator("button.gsee").isVisible().catch(() => false));
  await row3.locator("button.gsee").click();
  await pa.waitForTimeout(1200);
  const doc = await pa.locator(".imp").innerText().catch(() => "");
  ck("⑧ 생년월일을 다시 묻지 않고 바로 문서가 열린다", !/누구랑 맞대 볼까/.test(doc) && doc.length > 200,
     doc.replace(/\n/g, " ").slice(0, 60));
  ck("⑧ 아홉 축이 실제로 서 있다", /여덟 글자|아홉/.test(doc));
  await pa.close();
}

await b.close();
const pass = R.filter(Boolean).length;
console.log(`\n=== 초대 랜딩: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
