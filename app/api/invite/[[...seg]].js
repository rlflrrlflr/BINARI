/* 초대와 회신 — A가 부르면 B가 자기 생일을 넣고 둘 사이를 본다.
   작업지시_초대와회신_2026-08-26 §3 · 처리방침 §5-2

   ⚠ **이 파일은 이 서비스에서 유일하게 서버에 값을 저장하는 곳이다.**
     그래서 처리방침 §5-2 를 코드보다 **먼저** 고쳤다(같은 지시서 §1). 화면엔
     "저희 서버에 저장하지 않습니다"가 떠 있었고, 저장을 붙이는 순간 그게 거짓이 된다.
     이 리포엔 v127.7 전례가 있다 — 약속을 먼저 쓰고 코드가 안 따라간 사고. 방향만 반대고 결과는 같다.
     §5-2 의 문장들은 `e2e/privacy-check.mjs` 가 물고 있다. **여기를 고치면 거기도 같이 고쳐라.**

   저장하는 것 (§5-2 표 그대로):
     · A의 관계 계산용 **파생값**(axes) — 생년월일 원값이 아니다
     · 응답 여부와 시각
     · B가 동의한 경우에 한해 표시용 이름(label)
   저장하지 않는 것: 생년월일·태어난 시각 원값 · 질문 · 판결문 · 서신 · 문서
     ⚠ **B의 파생값(bAxes)도 저장하지 않는다.** 지시서 §3 의 요청 본문에는 있지만
       §2-2 「저장하는 것」에도 §10 「B의 값을 A에게 보내기 — 안 한다」에도 없다.
       받아서 버린다 — 인터페이스는 맞추되 **쓰지도 남기지도 않는다.**
       (여기 저장을 추가하려면 §5-2 표와 privacy-check 를 먼저 고쳐야 한다.)

   경로 다섯 — **전부 조각이 하나 이상 붙는다:**
     생성 POST /api/invite/new · 엿보기 GET /api/invite/:id · 응답 POST /api/invite/answer ·
     조회 GET /api/invite/check?ids= · 취소 DELETE /api/invite/:id

   ⚠ **맨 경로(`/api/invite`)를 쓰지 마라 — Vercel 이 404 를 준다.** 파일 이름이 「선택적」
     캐치올(`[[...seg]]`)이라 조각 0개도 잡힐 줄 알았는데, 이 프로젝트(Next 아닌 zero-config)에서는
     **조각이 최소 하나 있어야 함수까지 도달한다.** 라이브 실측(2026-08-28):
       GET /api/invite/zzzzzzzz → 403 JSON (함수가 답했다)
       GET /api/invite          → 404 NOT_FOUND (함수까지 안 갔다)
     그래서 첫 판에 초대 만들기가 통째로 죽었다 — 404 는 HTML 이라 앱이 JSON 을 못 읽고
     "지금은 초대를 만들 수 없어"라는 폴백 문구만 띄웠다(서버 사유가 안 실린다).
     **검사로는 못 잡는다.** 로컬 검사는 핸들러를 직접 부르고, preview 는 정적 서버라 라우팅이 없다.
     잡은 건 배포된 URL 을 직접 찔러 본 것뿐이다.

   ⚠ **예약어와 id 는 안 겹친다** — id 는 base64url 12자이고 예약어는 new·answer·check 셋뿐이다.
     ID_BYTES 를 줄이려거든 이 셋과 길이가 겹치지 않는지부터 봐라(검사가 잡는다).

   계산은 **B 기기에서** `match.js` 로 한다. 서버는 A의 axes 를 돌려줄 뿐이다.
   서버에 로직을 복제하면 같은 두 사람을 두고 화면마다 다른 말을 하게 된다 —
   이 리포가 반복해서 겪은 사고가 정확히 그것이다.

   ⚠ **저장소가 없으면 프로세스 메모리로 돈다.** 환경변수(KV_REST_API_URL·KV_REST_API_TOKEN)가
     붙기 전에도 개발·검사가 끝나도록. `api/judge.js` 의 `_hits` Map 과 같은 패턴이고,
     **한계도 같다**: 메모리 폴백은 **인스턴스당**이고 **휘발**한다 —
     Vercel 이 인스턴스를 여러 개 띄우면 A가 만든 초대를 B의 요청이 못 찾을 수 있고,
     콜드스타트마다 통째로 사라진다. 그래서 **폴백은 개발·검사용이지 운영용이 아니다.**
     운영에서 이 기능이 실제로 동작하려면 KV 프로비저닝이 선행이다(지시서 §8 창업자 몫). */
import { randomBytes } from "node:crypto";
import { isAllowedOrigin } from "../judge.js";   // 출처 판정은 한 곳에서만 — 두 벌이 되면 한쪽만 열린다

const TTL_SEC = 30 * 24 * 60 * 60;    // 30일 — 처리방침 §5-2 가 약속한 그 값이다. 바꾸면 방침도 바꿔라
const MAX_BODY = 8 * 1024;
const MAX_IDS = 24;                    // 곁 상한과 맞춘다(명부가 24를 넘지 않는다)
const MAX_LABEL = 12;                  // 곁 이름 칸과 같은 상한
const ID_BYTES = 9;                    // base64url 12자 — "answer" 와 길이·문자셋이 겹치지 않는다

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const hasKV = () => !!(KV_URL && KV_TOKEN);

/* ── 메모리 폴백 (위 ⚠ 참조) ────────────────────────────────────────────────
   TTL 을 흉내만 낸다 — 읽을 때 만료를 검사한다. KV 는 만료를 **저장소가** 강제하고,
   그 차이가 처리방침에 적힌 "프로그램이 지우는 것이 아니라"의 근거다. */
const _mem = new Map();
const _memGet = (k) => {
  const v = _mem.get(k);
  if (!v) return null;
  if (v.exp <= Date.now()) { _mem.delete(k); return null; }
  return v.val;
};
const _memSet = (k, val) => { _mem.set(k, { val, exp: Date.now() + TTL_SEC * 1000 }); };
export const _resetMem = () => _mem.clear();     // 검사 전용

async function kv(cmd) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`kv ${r.status}`);
  const d = await r.json();
  return d?.result ?? null;
}

async function getInvite(id) {
  if (!hasKV()) return _memGet(id);
  const raw = await kv(["GET", `binari:invite:${id}`]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}
async function putInvite(id, val) {
  if (!hasKV()) return _memSet(id, val);
  // EX 로 TTL 을 **저장소가** 강제한다 — 응답을 기록할 때도 남은 기간을 늘리지 않는다(아래 keepTtl)
  await kv(["SET", `binari:invite:${id}`, JSON.stringify(val), "EX", String(TTL_SEC)]);
}
async function delInvite(id) {
  if (!hasKV()) { _mem.delete(id); return; }
  await kv(["DEL", `binari:invite:${id}`]);
}

const clean = (s, n) => String(s == null ? "" : s).slice(0, n);

/* ── 경로 조각 읽기 ─────────────────────────────────────────────────────────
   ⚠ **`req.query.seg` 를 믿지 마라 — 이 프로젝트에서는 비어 온다.** 라이브 실측(2026-08-28):
     `GET /api/invite/check?ids=zzz` 가 함수까지는 오는데 seg 가 [] 이라 전부 405 로 떨어졌다.
     대괄호 파일명은 **라우팅**에만 쓰이고, 조각을 `req.query` 에 실어 주는 건 Next 쪽 동작이다.
     그래서 **URL 에서 직접 읽는다.** query.seg 는 실어 주는 환경을 위해 폴백으로만 둔다.
   ⚠ 이게 이 파일에서 나온 **세 번째** 같은 종류의 사고다(맨 경로 404 · GET Origin 403 · 조각 부재).
     셋 다 로컬 검사를 통과하고 배포에서만 죽었다. 공통 원인은 하나다 —
     **검사가 Vercel 이 주는 모양이 아니라 내가 준 모양으로 req 를 만들었다.**
     지금 `e2e/invite-check.mjs` 는 `url` 만 주고 `query.seg` 를 **일부러 안 준다.** 그렇게 둬라. */
function segsOf(req) {
  const path = String(req.url || "").split("?")[0];
  const m = path.match(/\/invite\/?(.*)$/);
  const fromUrl = m && m[1] ? m[1].split("/").filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch (_) { return x; } }) : [];
  if (fromUrl.length) return fromUrl;
  const raw = req.query?.seg;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  /* ⚠ **브라우저는 같은 출처 GET 에 `Origin` 을 안 붙인다**(fetch 규격: GET·HEAD 는 제외).
     그래서 `isAllowedOrigin` 만으로 막으면 **엿보기와 조회가 실기에서 전부 403** 이 된다.
     `judge`·`share` 는 전부 POST 라 이 리포가 여태 이걸 만난 적이 없었다.
     ⚠ 이걸 검사가 못 잡은 이유도 적어 둔다 — 브라우저 검사에서 내가 **핸들러에 Origin 을 직접
       넣어 줬다.** 서버를 흉내 내면 흉내가 통과할 뿐이라고 주석에 써 놓고 내가 그렇게 했다.
       지금은 검사가 브라우저의 실제 헤더를 그대로 넘긴다.
     **값을 바꾸는 요청(POST·DELETE)은 그대로 엄격하다** — CSRF 가 걸리는 건 그쪽이고,
     GET 둘은 상태를 안 바꾼다(엿보기는 소비도 안 한다). */
  const mutating = req.method === "POST" || req.method === "DELETE";
  const originOk = origin ? isAllowedOrigin(origin) : !mutating;
  if (origin && originOk) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") return res.status(originOk ? 204 : 403).end();
  if (!originOk) return res.status(403).json({ error: { message: "허용되지 않은 출처" } });

  const seg = segsOf(req);

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (_) { body = null; } }
  try { if (body && JSON.stringify(body).length > MAX_BODY) return res.status(400).json({ error: { message: "요청이 너무 커" } }); }
  catch (_) { return res.status(400).json({ error: { message: "본문을 읽을 수 없어" } }); }

  try {
    // ── 응답: B가 생일을 넣었다 ────────────────────────────────────────────
    if (req.method === "POST" && seg[0] === "answer") {
      const id = clean(body?.id, 64);
      if (!id) return res.status(400).json({ error: { message: "초대가 없어" } });
      const inv = await getInvite(id);
      if (!inv) return res.status(404).json({ error: { message: "만료됐거나 없는 초대야" } });
      /* ⚠ **응답 1회.** 이미 답한 초대는 거절한다 — 이게 재공유 방어다(지시서 §3).
         누가 링크를 다시 퍼뜨려도 두 번째 사람은 열지 못한다. 처리방침 §5-2 가 약속한 문장이다. */
      if (inv.answered) return res.status(410).json({ error: { message: "이미 답이 온 초대야" } });

      const notify = body?.notify === true;
      /* ⚠ **지시서 두 줄이 부딪혀서 이렇게 갈랐다.**
         §3 은 "notify=false 면 answered 를 기록하지 않는다"고 하고, 같은 절이
         "응답 1회 + 만료가 재공유 방어"라고 한다. 전자를 글자대로 따르면 **동의를 끈 사람의 링크만
         계속 열려 있게** 되어 후자가 깨진다 — 하필 방어가 제일 필요한 쪽에서.
         그래서 **소비는 언제나 하고(answered 기록), A에게 보이는 것만 동의로 가른다.**
         지켜야 할 뜻("동의가 진짜 선택지여야 한다" = A가 아무것도 못 얻는다)은 그대로고,
         처리방침 §5-2 의 "보낸 이에게는 아무것도 전달되지 않습니다"도 아래 GET 이 지킨다. */
      inv.answered = { at: Date.now(), notify, label: notify ? clean(body?.label, MAX_LABEL) : "" };
      /* ⚠ body.bAxes 는 **읽지 않는다.** 위 파일 머리 주석 참조 — 받아서 버린다. */
      await putInvite(id, inv);
      // B가 계산할 재료만 돌려준다. 계산은 B 기기의 match.js 가 한다(서버에 로직 복제 금지)
      return res.status(200).json({ aAxes: inv.axes, name: clean(inv.name, MAX_LABEL) });
    }

    // ── 취소: A가 지운다 = 즉시 삭제 (처리방침 §5-2 이용자 권리) ───────────
    if (req.method === "DELETE") {
      const id = clean(seg[0] || body?.id, 64);
      if (!id) return res.status(400).json({ error: { message: "초대가 없어" } });
      await delInvite(id);
      return res.status(200).json({ ok: true });
    }

    /* ── 엿보기: B가 링크를 열었다 (v147) ─────────────────────────────────
       **소비하지 않는다.** 돌려주는 건 A가 적어둔 표시용 이름 하나뿐 —
       화면 첫 줄("○○이 너와의 사이를 궁금해했어")이 그것 없이는 못 선다.
       ⚠ 좌표(axes)는 여기서 안 준다. 그건 응답한 사람만 받는다 —
         안 그러면 링크를 쥔 누구나 A의 좌표를 조용히 긁어 갈 수 있다.
       ⚠ 소비를 안 하므로 **재공유 방어는 그대로다**(응답은 여전히 1회).
         이미 답이 온 초대는 여기서도 410 으로 닫는다 — 열리는 척부터 하지 않는다. */
    if (req.method === "GET" && seg[0] && seg[0] !== "check") {
      const inv = await getInvite(clean(seg[0], 64));
      if (!inv) return res.status(404).json({ error: { message: "만료됐거나 없는 초대야" } });
      if (inv.answered) return res.status(410).json({ error: { message: "이미 답이 온 초대야" } });
      return res.status(200).json({ ok: true, name: clean(inv.name, MAX_LABEL) });
    }

    // ── 조회: A가 앱을 열 때. 곁 승격의 유일한 입력 ────────────────────────
    if (req.method === "GET" && seg[0] === "check") {
      const ids = String(req.query?.ids || "").split(",").map((x) => clean(x, 64)).filter(Boolean).slice(0, MAX_IDS);
      if (!ids.length) return res.status(200).json([]);
      const out = [];
      for (const id of ids) {
        const inv = await getInvite(id);
        if (!inv) continue;                                  // 만료·취소는 조용히 빠진다
        /* ⚠ **동의를 안 한 응답은 A에게 answered 로 보이지 않는다.**
           처리방침 §5-2: "동의하지 않으면 … 보낸 이에게는 아무것도 전달되지 않습니다."
           서버는 소비 사실을 알지만 A에게는 안 알린다 — 그 한 비트가 곧 제3자 제공이다. */
        const shown = !!(inv.answered && inv.answered.notify);
        out.push({ id, answered: shown, label: shown ? inv.answered.label : "", at: inv.at });
      }
      return res.status(200).json(out);
    }

    // ── 생성: A가 초대를 만든다 ────────────────────────────────────────────
    if (req.method === "POST" && seg[0] === "new") {
      const axes = body?.axes;
      if (!axes || typeof axes !== "object" || Array.isArray(axes)) {
        return res.status(400).json({ error: { message: "사이를 볼 값이 없어" } });
      }
      /* ⚠ **생년월일 원값이 섞여 오는 것을 서버가 막는다.** 클라이언트만 믿으면
         어느 판에서 누가 y/m/d 를 넣어 보내고, 그 순간 처리방침 §5-2 가 거짓이 된다. */
      const BANNED = ["y", "m", "d", "h", "min", "birth", "birthday", "ymd"];
      const hit = Object.keys(axes).find((k) => BANNED.includes(k.toLowerCase()));
      if (hit) return res.status(400).json({ error: { message: `생년월일 원값은 안 받아 — '${hit}'` } });

      const id = randomBytes(ID_BYTES).toString("base64url");
      await putInvite(id, { axes, name: clean(body?.name, MAX_LABEL), at: Date.now(), answered: null });
      return res.status(200).json({ id });
    }

    return res.status(405).json({ error: { message: "지원하지 않는 요청이야" } });
  } catch (e) {
    // 저장소 오류의 원문을 흘리지 않는다(judge.js 와 같은 규칙) — 상세는 서버 로그에만
    console.error(JSON.stringify({ at: new Date().toISOString(), invite: String(e?.message || e) }));
    return res.status(500).json({ error: { message: "초대를 처리하지 못했어" } });
  }
}
