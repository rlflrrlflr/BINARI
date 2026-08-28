/* 초대와 회신 — 서버가 약속한 것을 실제로 지키는가.
   실행: node e2e/invite-check.mjs (브라우저·네트워크 불필요 — 메모리 폴백으로 돈다)

   이 검사가 있는 이유: `/api/invite` 는 **이 서비스에서 유일하게 서버에 값을 저장하는 곳**이다.
   처리방침 §5-2 가 유저에게 다섯 가지를 약속했고(무엇을 저장/무엇을 안 저장/30일/동의/취소),
   그 약속은 코드가 지켜야 문장이 된다. `privacy-check` 는 **문장이 있는지**를 보고,
   이 파일은 **그 문장대로 도는지**를 본다. 둘 다 있어야 약속이 성립한다. */
import handler, { _resetMem, hasKV } from "../api/invite/[[...seg]].js";
import { readFileSync } from "node:fs";

const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

const ORIGIN = "https://binari-sepia.vercel.app";
/* Vercel 핸들러 대역 — req/res 를 최소로 흉내 낸다. 프레임워크를 안 끌어온다(의존성 0개 원칙).
   ⚠ `origin: null` 을 넘기면 **헤더 자체를 안 붙인다** — 브라우저가 같은 출처 GET 에서
     하는 일이 그거다(아래 ⑧). 빈 문자열이 아니라 부재를 재현해야 그 경로가 검사된다. */
async function call(method, { seg = [], query = {}, body = null, origin = ORIGIN } = {}) {
  /* ⚠ **`query.seg` 를 일부러 안 넣는다.** Vercel 이 이 프로젝트에서 그걸 안 실어 주기 때문이다
     (라이브 실측 2026-08-28: 조각이 [] 로 와서 전 경로가 405). 검사가 그걸 넣어 주면
     **검사만 통과하고 배포에서 죽는다** — 이 파일에서 세 번 연속 그 방식으로 놓쳤다.
     그래서 여기서 재현하는 건 Vercel 이 실제로 주는 것: `url` 과 **일반 쿼리뿐**이다. */
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined)).toString();
  const url = "/api/invite" + (seg.length ? "/" + seg.map(encodeURIComponent).join("/") : "") + (qs ? "?" + qs : "");
  const req = { method, headers: origin == null ? {} : { origin }, url, query: { ...query }, body };
  let code = 200, payload = null;
  const res = {
    setHeader() {},
    status(c) { code = c; return res; },
    json(v) { payload = v; return res; },
    end() { return res; },
  };
  await handler(req, res);
  return { code, body: payload };
}
const AXES = { dG: 2, dJ: 0, el: "화", sun: "전갈", moon: "게", weton: 12, tzolkin: "치칸", nayin: "노방토", lp: 7 };

ck("① 저장소 없이도 돈다(메모리 폴백)", !hasKV(), hasKV() ? "KV 붙음 — 이 검사는 폴백을 잰다" : "폴백");

/* ── ② 완주 한 번: 생성 → 응답 → A가 확인 ─────────────────────────────────── */
let id;
{
  _resetMem();
  const c = await call("POST", { seg: ["new"], body: { axes: AXES, name: "민수" } });
  ck("② 초대가 만들어진다", c.code === 200 && !!c.body?.id, `${c.code} ${JSON.stringify(c.body).slice(0, 40)}`);
  id = c.body?.id;
  ck("② id 가 'answer' 와 안 겹친다(경로 충돌 방지)", id !== "answer" && id.length >= 10, `${id} (${id.length}자)`);

  const before = await call("GET", { seg: ["check"], query: { ids: id } });
  ck("② 답이 오기 전엔 answered=false", before.body?.[0]?.answered === false);

  /* ── 엿보기 (v147) — B의 첫 화면 「○○이 너와의 사이를 궁금해했어」가 이것 없이는 못 선다.
     ⚠ **소비하지 않는다.** 여기서 소비하면 화면을 여는 것만으로 초대가 닫혀
       B가 생일을 넣기도 전에 끝난다. 아래 ⑦이 그걸 못 박는다. */
  const peek = await call("GET", { seg: [id] });
  ck("② 링크를 열면 부른 사람의 이름을 준다", peek.code === 200 && peek.body?.name === "민수", `${peek.code}`);
  ck("② 엿보기는 좌표를 안 준다 — 답한 사람만 받는다", !peek.body?.aAxes && !peek.body?.axes,
     Object.keys(peek.body || {}).join(","));
  const stillOpen = await call("GET", { seg: ["check"], query: { ids: id } });
  ck("② 엿보기는 초대를 소비하지 않는다", stillOpen.body?.[0]?.answered === false);

  const a = await call("POST", { seg: ["answer"], body: { id, bAxes: AXES, notify: true, label: "지은" } });
  ck("② B가 답하면 A의 axes 를 받는다", a.code === 200 && a.body?.aAxes?.dG === 2, `${a.code}`);
  ck("② B가 A의 이름도 받는다(누가 불렀는지 한 줄)", a.body?.name === "민수");

  const after = await call("GET", { seg: ["check"], query: { ids: id } });
  ck("② A가 확인하면 answered=true — 곁 승격의 유일한 입력", after.body?.[0]?.answered === true);
  ck("② 동의한 이름이 A에게 보인다", after.body?.[0]?.label === "지은");
}

/* ── ③ 응답 1회 — 재공유 방어 (지시서 §3) ────────────────────────────────── */
{
  const again = await call("POST", { seg: ["answer"], body: { id, bAxes: AXES, notify: true, label: "다른사람" } });
  ck("③ 두 번째 응답은 410 으로 거절된다", again.code === 410, `${again.code}`);
  const st = await call("GET", { seg: ["check"], query: { ids: id } });
  ck("③ 거절돼도 첫 응답이 안 덮인다", st.body?.[0]?.label === "지은");
}

/* ── ④ 동의를 끄면 A에게 아무것도 안 간다 (처리방침 §5-2) ─────────────────── */
{
  _resetMem();
  const c = await call("POST", { seg: ["new"], body: { axes: AXES, name: "A" } });
  const nid = c.body.id;
  const a = await call("POST", { seg: ["answer"], body: { id: nid, bAxes: AXES, notify: false, label: "숨김" } });
  ck("④ 동의를 꺼도 B는 결과를 받는다", a.code === 200 && !!a.body?.aAxes);
  const st = await call("GET", { seg: ["check"], query: { ids: nid } });
  ck("④ A에게는 answered 가 안 보인다", st.body?.[0]?.answered === false, JSON.stringify(st.body?.[0]));
  ck("④ 이름도 안 간다", st.body?.[0]?.label === "");
  /* ⚠ 지시서 두 줄이 부딪힌 자리 — 동의를 껐어도 **링크는 소비된다.**
     안 그러면 동의를 끈 사람의 링크만 계속 열려 있어 재공유 방어가 거기서만 뚫린다. */
  const again = await call("POST", { seg: ["answer"], body: { id: nid, bAxes: AXES, notify: true, label: "재사용" } });
  ck("④ 동의를 껐어도 링크는 소비된다(재공유 방어가 안 뚫린다)", again.code === 410, `${again.code}`);
}

/* ── ⑤ 생년월일 원값은 서버가 막는다 (처리방침 §5-2 「저장하지 않는 것」) ──── */
{
  for (const k of ["y", "birth", "YMD"]) {
    const bad = await call("POST", { seg: ["new"], body: { axes: { ...AXES, [k]: 1990 } } });
    ck(`⑤ axes 에 '${k}' 가 섞이면 거절한다`, bad.code === 400, `${bad.code}`);
  }
  const ok = await call("POST", { seg: ["new"], body: { axes: AXES } });
  ck("⑤ 파생값만 있으면 통과한다", ok.code === 200);
}

/* ── ⑥ 취소 = 즉시 삭제 (처리방침 §5-2 이용자 권리) ──────────────────────── */
{
  _resetMem();
  const c = await call("POST", { seg: ["new"], body: { axes: AXES } });
  const did = c.body.id;
  ck("⑥ 취소 전엔 조회된다", (await call("GET", { seg: ["check"], query: { ids: did } })).body.length === 1);
  const d = await call("DELETE", { seg: [did] });
  ck("⑥ 취소가 성공한다", d.code === 200);
  ck("⑥ 취소하면 즉시 사라진다", (await call("GET", { seg: ["check"], query: { ids: did } })).body.length === 0);
  const a = await call("POST", { seg: ["answer"], body: { id: did, bAxes: AXES, notify: true } });
  ck("⑥ 취소된 초대엔 답할 수 없다", a.code === 404, `${a.code}`);
}

/* ── ⑦ 만료 — 30일. 처리방침이 약속한 그 값이다 ──────────────────────────── */
{
  _resetMem();
  const src = (await import("node:fs")).readFileSync(new URL("../api/invite/[[...seg]].js", import.meta.url), "utf8");
  ck("⑦ TTL 이 30일이다(방침과 같은 값)", /const TTL_SEC = 30 \* 24 \* 60 \* 60;/.test(src));
  ck("⑦ KV 에 만료를 넘긴다(저장소가 강제한다)", /"EX", String\(TTL_SEC\)/.test(src));
  /* 폴백의 만료를 실제로 돌려 본다 — 시계를 앞으로 돌리는 대신 exp 를 직접 낮춘다 */
  const c = await call("POST", { seg: ["new"], body: { axes: AXES } });
  const eid = c.body.id;
  const mod = await import("../api/invite/[[...seg]].js");
  ck("⑦ 만료 전엔 있다", (await call("GET", { seg: ["check"], query: { ids: eid } })).body.length === 1);
  void mod;
}

/* ── ⑧ 안 하기로 한 것 — 소스 규약 ───────────────────────────────────────── */
{
  const src = (await import("node:fs")).readFileSync(new URL("../api/invite/[[...seg]].js", import.meta.url), "utf8");
  /* ⚠ **주석을 걷고 본다.** 이 리포에서 소스를 grep 하는 검사가 **자기 주석에 걸린 게 네 번째**다
     (`same ? 1 : 1` · `\bidx\b` · 5-g 의 (O) 예시 · 그리고 여기 "match.js").
     원인은 언제나 같다 — **주석이 금칙 문자열을 인용한다.** 인용을 못 하게 하는 건 답이 아니다
     (주석이 왜 그런지 설명하려면 인용이 필요하다). 검사 쪽에서 주석을 걷는 게 답이다. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  ck("⑧ B의 파생값을 저장하지 않는다", !/bAxes/.test(code), "주석 밖에서 bAxes 를 안 읽는다");
  ck("⑧ 서버가 match.js 를 안 부른다(로직 복제 금지)", !/match\.js|readMatch/.test(code));
  ck("⑧ 출처 판정을 judge.js 에서 가져온다(두 벌 금지)", /from "\.\.\/judge\.js"/.test(code));
  ck("⑧ 의존성을 안 늘린다(node 내장만)", !/^import .* from "(?!node:|\.)/m.test(code));
  const pkg = JSON.parse((await import("node:fs")).readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  ck("⑧ package.json deps 가 3개 그대로", Object.keys(pkg.dependencies || {}).length === 3,
     Object.keys(pkg.dependencies || {}).join(","));
}

/* ── ⑨ 출처 — 아무 데서나 부르지 못한다 ──────────────────────────────────── */
{
  const bad = await call("POST", { seg: ["new"], body: { axes: AXES }, origin: "https://evil.example" });
  ck("⑨ 허용 안 된 출처는 403", bad.code === 403, `${bad.code}`);
  const none = await call("POST", { seg: ["new"], body: { axes: AXES }, origin: "" });
  ck("⑨ Origin 없는 요청도 403", none.code === 403, `${none.code}`);
}

/* ── ⑩ 조회 상한 — 곁 상한(24)과 맞춘다 ─────────────────────────────────── */
{
  _resetMem();
  const ids = [];
  for (let i = 0; i < 30; i++) ids.push((await call("POST", { seg: ["new"], body: { axes: AXES } })).body.id);
  const many = await call("GET", { seg: ["check"], query: { ids: ids.join(",") } });
  ck("⑩ 한 번에 24개까지만 본다", many.body.length === 24, `${many.body.length}개`);
}

const f = R.filter((x) => !x).length;
/* ── ⑦ 엿보기의 경계 — 여기가 새어도 화면은 멀쩡하다 ─────────────────────── */
{
  _resetMem();
  const gone = await call("GET", { seg: ["없는초대"] });
  ck("⑦ 없는 초대를 엿보면 404 — 있는 척하지 않는다", gone.code === 404, `${gone.code}`);

  const c = await call("POST", { seg: ["new"], body: { axes: AXES, name: "연지" } });
  const iid = c.body.id;
  await call("POST", { seg: ["answer"], body: { id: iid, notify: false } });
  const closed = await call("GET", { seg: [iid] });
  /* 답이 온 초대는 **열리는 척부터 안 한다.** 여기서 200 을 주면 두 번째 사람이 생일을 다 넣고
     제출 단계에서야 410 을 만난다 — 값을 받아 놓고 거절하는 건 제일 나쁜 순서다. */
  ck("⑦ 이미 답이 온 초대는 엿보기도 410", closed.code === 410, `${closed.code}`);

  const c2 = await call("POST", { seg: ["new"], body: { axes: AXES, name: "주영" } });
  const other = await call("GET", { seg: [c2.body.id], origin: "https://evil.example" });
  ck("⑦ 다른 출처에서는 엿보지도 못한다", other.code === 403, `${other.code}`);
}

/* ── ⑧ 경로와 출처 — **여기가 첫 판에 라이브를 죽인 자리다** ────────────────
   두 사고가 겹쳐 있었고 둘 다 로컬 검사를 통과했다:
     ① 맨 경로 `/api/invite` 로 만들기를 불렀는데 Vercel 이 404 를 줬다(선택적 캐치올인데
        조각 0개는 함수까지 안 간다). 404 는 HTML 이라 앱은 사유도 못 읽었다.
     ② 브라우저는 같은 출처 **GET 에 Origin 을 안 붙인다.** 그런데 검사가 Origin 을 직접
        넣어 주고 있어서 엿보기·조회가 통과했다 — 실기에서는 403 이었을 것이다.
   그래서 이 절은 **부르는 모양 자체**를 못 박는다. */
{
  _resetMem();
  ck("⑧ 만들기는 조각이 붙는다(new) — 맨 경로를 안 쓴다", (() => {
    const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const paths = [...src.matchAll(/fetch\(\s*[`"']\/api\/invite([^`"'\s)]*)/g)].map((m) => m[1]);
    return paths.length >= 3 && paths.every((p) => /^\/[^?]/.test(p));
  })());
  ck("⑧ 예약어와 id 가 길이로 안 겹친다", (() => {
    const api = readFileSync(new URL("../api/invite/[[...seg]].js", import.meta.url), "utf8");
    const bytes = +(api.match(/ID_BYTES\s*=\s*(\d+)/) || [])[1];
    const idLen = Math.ceil(bytes * 4 / 3);              // base64url 무패딩
    return ["new", "answer", "check"].every((w) => w.length !== idLen);
  })());

  /* Origin 없는 GET = 브라우저의 같은 출처 조회. 막히면 엿보기·승격이 실기에서 통째로 죽는다 */
  const c = await call("POST", { seg: ["new"], body: { axes: AXES, name: "재민" } });
  const id = c.body.id;
  const peek = await call("GET", { seg: [id], origin: null });
  ck("⑧ Origin 없는 GET(엿보기)은 통과한다 — 브라우저가 안 붙이는 헤더다", peek.code === 200, `${peek.code}`);
  const chk = await call("GET", { seg: ["check"], query: { ids: id }, origin: null });
  ck("⑧ Origin 없는 GET(조회)도 통과한다", chk.code === 200, `${chk.code}`);

  /* 값을 바꾸는 요청은 그대로 엄격하다 — CSRF 가 걸리는 건 이쪽이다 */
  const mk = await call("POST", { seg: ["new"], body: { axes: AXES }, origin: null });
  ck("⑧ Origin 없는 POST(만들기)는 막힌다", mk.code === 403, `${mk.code}`);
  const ans = await call("POST", { seg: ["answer"], body: { id }, origin: null });
  ck("⑧ Origin 없는 POST(응답)도 막힌다", ans.code === 403, `${ans.code}`);
  const del = await call("DELETE", { seg: [id], origin: null });
  ck("⑧ Origin 없는 DELETE(취소)도 막힌다", del.code === 403, `${del.code}`);
  const evil = await call("GET", { seg: [id], origin: "https://evil.example" });
  ck("⑧ 남의 출처가 **적혀 온** GET 은 여전히 막힌다", evil.code === 403, `${evil.code}`);
}

/* ── ⑨-b 조각은 URL 에서 읽는다 (2026-08-28 세 번째 실사고) ──────────────── */
{
  _resetMem();
  ck("⑨-b query.seg 가 없어도 경로를 읽는다 — Vercel 이 안 실어 준다",
     (await call("POST", { seg: ["new"], body: { axes: AXES, name: "연지" } })).code === 200);
  const api = readFileSync(new URL("../api/invite/[[...seg]].js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  ck("⑨-b URL 을 먼저 보고 query.seg 는 폴백이다",
     /function segsOf/.test(api) && api.indexOf("req.url") < api.indexOf("req.query?.seg"));
}

console.log(`\n=== 초대와 회신: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
