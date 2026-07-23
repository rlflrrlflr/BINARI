/* 비나리 판결 프록시 — API 키는 이 함수(서버) 안에서만 산다.
   Vercel 환경변수: ANTHROPIC_API_KEY(필수) · BINARI_MODEL(선택, 기본 claude-sonnet-5) · ALLOWED_ORIGIN(선택, 미설정 시 기본 허용 목록)
   방어(v54): Origin 필수+허용목록 · 본문 크기 상한 · max_tokens 클램프 · SYS 프리픽스 대조(임의 프롬프트 주입 차단).
   한계: Origin은 브라우저 밖(curl)에선 위조 가능 — 최종 방어선은 Anthropic 콘솔의 월 지출 한도다. */
const SYS_PREFIX = "당신은 유저의 '수호신' 비나리다";
const DEFAULT_ORIGINS = ["https://binari-sepia.vercel.app", "http://localhost:5173", "http://localhost:4173"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: { message: "POST만 받아" } });

  const allowed = process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : DEFAULT_ORIGINS;
  const origin = req.headers.origin || "";
  if (!origin || !allowed.includes(origin)) return res.status(403).json({ error: { message: "허용되지 않은 출처" } });

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
    // 북극성 계측: 카테고리(A/B/C)·방향·토큰 사용량만 로그 — 질문 원문은 남기지 않는다
    try {
      const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      const cat = (txt.match(/"category"\s*:\s*"([ABC])"/) || [])[1] || null;
      const dir = (txt.match(/"direction"\s*:\s*"(GO|STOP|HOLD)"/) || [])[1] || null;
      console.log(JSON.stringify({ at: new Date().toISOString(), call: mt <= 400 ? 1 : 2, cat, dir, usage: data.usage || null }));
    } catch {}
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: { message: "상류 호출 실패: " + (e?.message || "unknown") } });
  }
}
