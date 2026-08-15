/* 공유 판결 서명 — 위조된 '비나리 판결'이 돌아다니지 못하게 한다.
   Vercel 환경변수: BINARI_SHARE_SECRET(선택) · ANTHROPIC_API_KEY(필수, 서명 재료 폴백)

   왜 필요했나 (2026-08-15 실증):
     공유 링크는 `?v=<base64 JSON>` 이고 그 안에 질문·판결문이 평문으로 들어 있었다. 서명이 없어서
     **누구나 URL 을 지어내면 우리 앱이 그걸 진짜 판결 카드로 렌더했다.** BINARI 로고·神 인장까지
     붙은 채로. 실제로 "이번 달 안에 세 배는 확실해" 같은, SYS 가 명시적으로 금지한 문장을
     띄우는 카드를 만들어 확인했다.

     여기가 핵심이다 — 가드레일(자해·가해 대응, S3 의료 넘김, 투자 확정 서술 금지, 지어낸 통계 금지)은
     전부 **생성 경로**에만 걸려 있다. 표시 경로엔 하나도 없었다. URL 한 줄로 12,000자짜리
     가드레일 전체가 우회됐다. 그리고 우리는 반박도 못 한다 — 실제로 우리 앱이 렌더한 화면이니까.

   설계:
     - 서명은 HMAC-SHA256(payload, secret) 앞 16바이트. 비밀키는 서버에만 있다.
     - 검증도 서버가 한다(클라이언트에 비밀키를 줄 수 없으므로). 공유 링크로 들어온 사람만
       한 번 호출하는 경로라 비용은 무시할 만하다.
     - **실패하면 닫는다.** 서명이 없거나 틀리면 카드를 그리지 않는다. 서명 못 받으면 링크를
       아예 안 만든다 — 그래야 "?v= 가 붙은 링크는 전부 서명된 것"이 성립하고,
       검증 실패를 곧 위조로 읽을 수 있다.

   ⚠ 비밀키가 따로 없으면 ANTHROPIC_API_KEY 에서 **용도 분리해** 파생한다(HMAC 도메인 분리).
     키 자체를 서명에 쓰지 않으므로 서명에서 키를 되찾을 수 없다. 다만 API 키를 교체하면
     그전에 만든 공유 링크는 전부 무효가 된다 — 그게 곤란하면 BINARI_SHARE_SECRET 을 따로 두면 된다. */
import { createHmac, timingSafeEqual } from "node:crypto";
import { isAllowedOrigin } from "./judge.js";   // 출처 판정은 한 곳에서만 — 두 벌이 되면 한쪽만 열린다

const MAX_BODY = 8 * 1024;          // 판결 한 건이 이보다 클 이유가 없다
const SIG_BYTES = 16;               // 128비트 — 위조 시도에 충분하고 URL 도 짧게 유지된다

function secret() {
  const explicit = process.env.BINARI_SHARE_SECRET;
  if (explicit) return String(explicit);
  const base = process.env.ANTHROPIC_API_KEY;
  if (!base) return null;
  // 용도 분리 — 이 값은 서명에만 쓰이고, 여기서 원래 키를 되돌릴 수 없다
  return createHmac("sha256", String(base)).update("binari/share-signature/v1").digest("hex");
}

export function sign(payloadB64, key) {
  return createHmac("sha256", key).update(String(payloadB64)).digest("base64url").slice(0, SIG_BYTES * 2);
}

/** 서명 비교는 길이가 같을 때만 timingSafeEqual 이 되므로 길이부터 맞춘다 */
export function verify(payloadB64, sig, key) {
  const want = Buffer.from(sign(payloadB64, key));
  const got = Buffer.from(String(sig || ""));
  if (want.length !== got.length) return false;
  return timingSafeEqual(want, got);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const originOk = isAllowedOrigin(origin);
  // judge.js 와 같은 규칙 — 허용 목록을 통과한 출처에만 CORS 를 되돌려준다(임의 반사 금지)
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

  const key = secret();
  if (!key) return res.status(500).json({ error: { message: "서명 준비가 안 됐어" } });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (_) { body = null; } }
  if (!body || typeof body !== "object") return res.status(400).json({ error: { message: "본문이 없어" } });

  const p = String(body.payload || "");
  if (!p || p.length > MAX_BODY) return res.status(400).json({ error: { message: "본문 크기가 맞지 않아" } });
  if (!/^[A-Za-z0-9_-]+$/.test(p)) return res.status(400).json({ error: { message: "본문 형식이 아니야" } });

  if (body.verify) {
    // 검증만 한다. 본문은 되돌려주지 않는다 — 클라이언트가 이미 갖고 있고, 우리가 실어 보내면
    // 그 응답이 또 하나의 유출 경로가 된다(질문 원문·이름이 들어 있다).
    return res.status(200).json({ ok: verify(p, body.sig, key) });
  }
  return res.status(200).json({ sig: sign(p, key) });
}
