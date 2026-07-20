/* 비나리 판결 프록시 — API 키는 이 함수(서버) 안에서만 산다.
   Vercel 환경변수: ANTHROPIC_API_KEY(필수) · BINARI_MODEL(선택, 기본 claude-sonnet-4-6) · ALLOWED_ORIGIN(선택)
   보호: max_tokens 상한 + 메시지 수 상한 + (선택) Origin 검사.
   정교한 rate limit은 트래픽이 생긴 뒤의 문제 — 지금의 1차 방어선은 Anthropic 콘솔의 월 지출 한도다. */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: { message: "POST만 받아" } });

  const allowed = process.env.ALLOWED_ORIGIN;
  const origin = req.headers.origin || "";
  if (allowed && origin && origin !== allowed) return res.status(403).json({ error: { message: "허용되지 않은 출처" } });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: { message: "서버에 ANTHROPIC_API_KEY가 없어 — Vercel 환경변수를 확인해" } });

  const { system, messages, max_tokens } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: { message: "messages가 비었어" } });
  if (messages.length > 40) return res.status(400).json({ error: { message: "대화가 너무 길어" } });
  const mt = Math.min(Math.max(parseInt(max_tokens, 10) || 320, 1), 2000);

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
