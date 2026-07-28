/* 비나리 판결 프록시 — API 키는 이 함수(서버) 안에서만 산다.
   Vercel 환경변수: ANTHROPIC_API_KEY(필수) · BINARI_MODEL(선택, 기본 claude-sonnet-5) · ALLOWED_ORIGIN(선택, 미설정 시 기본 허용 목록)
   방어(v54): Origin 필수+허용목록 · 본문 크기 상한 · max_tokens 클램프 · SYS 프리픽스 대조(임의 프롬프트 주입 차단).
   방어(v76): CORS 응답 헤더+프리플라이트 · IP 레이트리밋 · 상류 에러 원문 미노출.

   ⚠️ 레이트리밋의 한계 — 프로세스 메모리 기반이라 "인스턴스당" 카운트다.
      Vercel이 동시에 여러 인스턴스를 띄우면 그 수만큼 한도가 곱해지고, 콜드스타트마다 초기화된다.
      우발적 폭주·단순 스크립트는 막지만 분산된 고의 공격은 못 막는다.
      실질 방어가 필요해지면 Upstash/Vercel KV 같은 공유 저장소로 옮길 것.
      그 전까지의 최종 방어선은 여전히 Anthropic 콘솔의 월 지출 한도다. */
const SYS_PREFIX = "당신은 유저의 '수호신' 비나리다";
/* ── 허용 출처 ────────────────────────────────────────────────────────────────
   여기서 막히면 판결 요청이 403이 되고, 유저 눈에는 "판결이 닿지 못했어"로만 보인다.
   자체 도메인(binari.xxx)을 붙이는 날 이 목록을 같이 안 고치면 앱이 통째로 죽는다.

   ALLOWED_ORIGIN 환경변수는 쉼표로 여러 개를 받는다. 값이 하나뿐이던 예전 방식으로는
   "새 도메인 + 기존 vercel.app(내부 테스트용)"을 동시에 열 수 없었다.
     예) ALLOWED_ORIGIN="https://binari.life,https://binari-sepia.vercel.app"
   설정하면 아래 기본 목록을 완전히 대체한다(로컬 주소도 함께 적어야 개발이 된다).

   프리뷰 배포(binari-<해시>-binari.vercel.app, binari-git-<브랜치>-binari.vercel.app)는
   패턴으로 허용한다. 끝의 `binari`는 Vercel 팀 슬러그라 남이 같은 주소를 만들 수 없다.
   이게 없으면 프리뷰 URL에서 판결이 전부 막혀 내부 테스트를 프리뷰로 돌릴 수 없다. */
const DEFAULT_ORIGINS = ["https://binari-sepia.vercel.app", "http://localhost:5173", "http://localhost:4173"];
const PREVIEW_RE = /^https:\/\/[a-z0-9][a-z0-9-]*-binari\.vercel\.app$/;
const norm = (o) => String(o || "").trim().replace(/\/+$/, "").toLowerCase();   // 끝 슬래시는 흔한 오타 — Origin 헤더엔 붙지 않는다

export function isAllowedOrigin(origin, envAllowed = process.env.ALLOWED_ORIGIN) {
  const o = norm(origin);
  if (!o) return false;                                  // Origin 없는 요청(직접 호출·서버간)은 거절
  const list = (envAllowed ? String(envAllowed).split(",") : DEFAULT_ORIGINS).map(norm).filter(Boolean);
  return list.includes(o) || PREVIEW_RE.test(o);
}

// ── 레이트리밋: IP당 고정 윈도(기본 1분 90회 = 질문 45개분, 판결 1건당 2콜) ──
//    한국 이동통신은 CGNAT로 수백 명이 한 IP를 공유한다. 광고로 모바일 트래픽이 몰리면
//    (특히 카톡 인앱브라우저) 정상 유저가 429를 맞는데, 유저 눈에는 "판결이 닿지 못했어"로만 보인다.
//    기존 30회는 광고 집행 기준으로 너무 좁아 90으로 올렸다.
//    ※ 실제 발생 여부는 이제 verdict_failed{reason:"rate_limited"} 로 관측된다 — 데이터 보고 RL_MAX 로 재조정할 것.
//      상한을 넓힌 만큼 비용 측 최종 방어선은 Anthropic 콘솔의 월 지출 한도다.
const RL_WINDOW_MS = 60_000;
const RL_MAX = Math.max(1, parseInt(process.env.RL_MAX, 10) || 90);
const RL_MAX_KEYS = 5000;              // 메모리 상한 — 만료분 정리 후에도 넘치면 오래된 것부터 버림
const _hits = new Map();               // ip -> { n, resetAt }

function rateLimit(ip) {
  const now = Date.now();
  if (_hits.size > RL_MAX_KEYS) {
    for (const [k, v] of _hits) if (v.resetAt <= now) _hits.delete(k);
    while (_hits.size > RL_MAX_KEYS) _hits.delete(_hits.keys().next().value);
  }
  const cur = _hits.get(ip);
  if (!cur || cur.resetAt <= now) {
    _hits.set(ip, { n: 1, resetAt: now + RL_WINDOW_MS });
    return { ok: true, remaining: RL_MAX - 1, retryAfter: 0 };
  }
  cur.n += 1;
  if (cur.n > RL_MAX) return { ok: false, remaining: 0, retryAfter: Math.ceil((cur.resetAt - now) / 1000) };
  return { ok: true, remaining: RL_MAX - cur.n, retryAfter: 0 };
}

const clientIp = (req) =>
  String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  req.headers["x-real-ip"] ||
  req.socket?.remoteAddress ||
  "unknown";

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const originOk = isAllowedOrigin(origin);

  // 허용 목록을 통과한 출처에만 CORS를 되돌려준다(임의 반사 금지).
  if (originOk) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") return res.status(originOk ? 204 : 403).end();
  if (req.method !== "POST") return res.status(405).json({ error: { message: "POST만 받아" } });
  if (!originOk) return res.status(403).json({ error: { message: "허용되지 않은 출처" } });

  const rl = rateLimit(clientIp(req));
  res.setHeader("X-RateLimit-Limit", String(RL_MAX));
  res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    return res.status(429).json({ error: { message: "잠깐만 — 너무 빨리 물었어. 조금 뒤에 다시 청해줘." } });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: { message: "서버에 ANTHROPIC_API_KEY가 없어 — Vercel 환경변수를 확인해" } });

  const { system, messages, max_tokens } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: { message: "messages가 비었어" } });
  if (messages.length > 40) return res.status(400).json({ error: { message: "대화가 너무 길어" } });
  try { if (JSON.stringify(req.body).length > 60000) return res.status(400).json({ error: { message: "요청이 너무 커" } }); } catch { return res.status(400).json({ error: { message: "본문을 읽을 수 없어" } }); }
  const sysText = Array.isArray(system) && system[0] && typeof system[0].text === "string" ? system[0].text : "";
  if (!sysText.startsWith(SYS_PREFIX)) return res.status(400).json({ error: { message: "판결 형식이 아니야" } });
  const mt = Math.min(Math.max(parseInt(max_tokens, 10) || 320, 1), 1600);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.BINARI_MODEL || "claude-sonnet-5", max_tokens: mt, system, messages, thinking: { type: "disabled" } }),
    });
    const data = await r.json();

    // 상류 실패는 원문을 그대로 흘리지 않는다(내부 모델·조직 정보 노출 방지). 상세는 서버 로그에만.
    if (!r.ok) {
      console.error(JSON.stringify({ at: new Date().toISOString(), upstream: r.status, err: data?.error?.type || null }));
      const msg = r.status === 429 ? "수호신이 지금 너무 바빠 — 잠시 뒤에 다시 물어봐"
        : r.status >= 500 ? "하늘길이 잠시 막혔어 — 잠시 뒤에 다시 물어봐"
        : "판결을 불러오지 못했어";
      return res.status(r.status).json({ error: { message: msg } });
    }

    // 북극성 계측: 카테고리(A/B/C)·방향·토큰 사용량만 로그 — 질문 원문은 남기지 않는다
    try {
      const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      const cat = (txt.match(/"category"\s*:\s*"([ABC])"/) || [])[1] || null;
      const dir = (txt.match(/"direction"\s*:\s*"(GO|STOP|HOLD)"/) || [])[1] || null;
      const scope = (txt.match(/"scope"\s*:\s*"(S[123])"/) || [])[1] || null;   // S3(몸·병) 진입 비율은 서버 로그로도 본다
      console.log(JSON.stringify({ at: new Date().toISOString(), call: mt <= 400 ? 1 : 2, cat, dir, scope, usage: data.usage || null }));
    } catch {}
    return res.status(200).json(data);
  } catch (e) {
    console.error("upstream_fetch_failed:", e?.message || e);   // 상세는 서버 로그에만
    return res.status(502).json({ error: { message: "상류 호출 실패" } });
  }
}
