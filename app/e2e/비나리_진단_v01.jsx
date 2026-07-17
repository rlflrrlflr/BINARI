import { useState } from "react";

/* 비나리 진단 도구 v01 — 이 파일을 클로드 아티팩트로 열고, 버튼 4개를 위에서부터 눌러
   각 결과(✅/❌ + 원문)를 스크린샷으로 찍으면, 이 기기의 아티팩트 런타임이
   무엇을 지원하는지(판결이 어디서 막히는지) 확정할 수 있다. */

export default function App() {
  const [log, setLog] = useState([]);
  const add = (name, ok, detail) =>
    setLog((l) => [{ name, ok, detail: String(detail).slice(0, 500), at: new Date().toLocaleTimeString() }, ...l]);

  const testEnv = () => {
    try {
      const c = typeof window !== "undefined" ? window.claude : undefined;
      const keys = c ? Object.keys(c).join(", ") || "(빈 객체)" : "window.claude 없음";
      add("① 환경", !!c, `claude 객체: ${keys}\ncomplete 타입: ${typeof c?.complete}\nUA: ${navigator.userAgent.slice(0, 110)}`);
    } catch (e) { add("① 환경", false, e.message); }
  };

  const testComplete = async () => {
    try {
      if (!window.claude || typeof window.claude.complete !== "function") { add("② complete", false, "window.claude.complete 없음"); return; }
      const r = await window.claude.complete('한 단어로만 답해: "안녕"');
      add("② complete", true, `타입=${typeof r}\n값=${typeof r === "string" ? r : JSON.stringify(r).slice(0, 300)}`);
    } catch (e) { add("② complete", false, (e && (e.message || JSON.stringify(e))) || "원인 불명 오류"); }
  };

  const testFetch = async () => {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 8, messages: [{ role: "user", content: "hi라고만 답해" }] }),
      });
      const t = await r.text();
      add("③ fetch 직접", r.ok, `HTTP ${r.status}\n${t.slice(0, 250)}`);
    } catch (e) { add("③ fetch 직접", false, e.message); }
  };

  const testStorage = () => {
    try { window.localStorage.setItem("__t", "1"); window.localStorage.removeItem("__t"); add("④ localStorage", true, "사용 가능"); }
    catch (e) { add("④ localStorage", false, e.message); }
  };

  const B = { display: "block", width: "100%", padding: "16px", margin: "8px 0", fontSize: 17, borderRadius: 12, border: "1px solid #c98f3d", background: "#1c1730", color: "#f0e2b8", textAlign: "left" };
  return (
    <div style={{ minHeight: "100vh", background: "#0a0812", color: "#d8cfe6", padding: 20, fontFamily: "sans-serif" }}>
      <h2 style={{ color: "#ffe9ad", fontSize: 20 }}>비나리 진단 v01</h2>
      <p style={{ fontSize: 13, color: "#9d8fb5" }}>①→④ 순서로 누르고, 결과 화면을 캡처해 보내줘.</p>
      <button style={B} onClick={testEnv}>① 환경 검사 — window.claude가 있나</button>
      <button style={B} onClick={testComplete}>② complete 검사 — 내장 AI 호출이 되나</button>
      <button style={B} onClick={testFetch}>③ fetch 검사 — 직접 API 호출이 되나</button>
      <button style={B} onClick={testStorage}>④ 저장 검사 — localStorage가 되나</button>
      <div style={{ marginTop: 16 }}>
        {log.map((e, i) => (
          <div key={i} style={{ border: `1px solid ${e.ok ? "#3dc98f" : "#e05a5a"}`, borderRadius: 10, padding: 12, margin: "8px 0", fontSize: 13 }}>
            <b style={{ color: e.ok ? "#3dc98f" : "#e05a5a" }}>{e.ok ? "✅" : "❌"} {e.name}</b>
            <span style={{ color: "#8a7f95" }}> · {e.at}</span>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", margin: "6px 0 0", color: "#cbc0dd" }}>{e.detail}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
