// 판결 품질 평가 하네스 — 페르소나 × 질문을 실모델(sonnet-5)로 배치 생성 → CSV + 자동검사
// 사용: ANTHROPIC_API_KEY=sk-... node eval/run-eval.mjs [--full]
//   기본: 콜1(결론)만. --full: 콜2(근거·정령)까지. 사람이 채점할 수 있게 CSV로 출력.
// 앱과 동일한 SYS 프롬프트를 src/App.jsx에서 직접 추출해 검증(프롬프트 드리프트 방지).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
if (!KEY) { console.error("환경변수 ANTHROPIC_API_KEY 필요"); process.exit(1); }
const FULL = process.argv.includes("--full");
const MODEL = process.env.BINARI_MODEL || "claude-sonnet-5";

const APP = readFileSync(join(HERE, "..", "src", "App.jsx"), "utf8");
const SYS = APP.slice(APP.indexOf("const SYS = `") + 13, APP.indexOf("`;", APP.indexOf("const SYS = `")));
if (!SYS.includes("층위 분리")) { console.error("SYS 추출 실패(마커 없음) — App.jsx 구조 확인"); process.exit(1); }
let personas = JSON.parse(readFileSync(join(HERE, "personas.json"), "utf8"));
let questions = JSON.parse(readFileSync(join(HERE, "questions.json"), "utf8"));
if (process.argv.includes("--sample")) {            // 저비용 데모: 2인 × 대표 5문항
  personas = personas.slice(0, 2);
  questions = questions.filter((q) => ["Q01", "Q05", "Q08", "Q17", "Q20"].includes(q.id));
}
const pArg = process.argv.find((a) => a.startsWith("--personas="));   // 예: --personas=3
if (pArg) personas = personas.slice(0, +pArg.split("=")[1]);
const qArg = process.argv.find((a) => a.startsWith("--qids="));       // 예: --qids=Q08,Q09,Q20
if (qArg) { const set = new Set(qArg.split("=")[1].split(",")); questions = questions.filter((q) => set.has(q.id)); }
const catArg = process.argv.find((a) => a.startsWith("--cat="));      // 예: --cat=A,GUARD
if (catArg) { const set = new Set(catArg.split("=")[1].split(",")); questions = questions.filter((q) => set.has(q.cat)); }

const today = new Date();
const TODAY = `[오늘] ${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 ${today.getHours()}시 · 오늘 밤 달 상현달`;

function profile(p) {
  return `${p.name ? `호칭: ${p.name}\n` : ""}성별: ${p.sex === "M" ? "남" : "여"}
사주: ${p.saju} / 오행 ${p.ohaeng} / 주기운 ${p.main} / 납음 ${p.nayin}
별자리: ${p.zodiac} / 달: 태어난 밤의 위상 ${p.moon} · 달 별자리 ${p.moonSign} · 나크샤트라 ${p.nakshatra}
마야 촐킨: ${p.tzolkin}
MBTI: ${p.mbti} / 수비학 라이프패스: ${p.lifepath}
대운(현재 인생 시기): ${p.daeun} — 10년 단위 큰 흐름
가치여정(워드소팅 16→6→3→1): ${p.values}`;
}
const system = (p) => `${SYS}\n\n## 대화 연속성\n이전 대화가 있으면 흐름을 이어 자연스럽게 응대한다(단, 판결 근거는 늘 아래 지표다). 같은 고민의 재질문이면 앞선 판결과 일관되게, 명백히 새 고민이면 처음부터 새로 판정한다.\n\n---\n유저 프로필(고정):\n${profile(p)}`;
const CONCLUDE = `\n\n[이번 출력] 결론만 낸다. 내부적으로는 규칙대로 각 지표를 독립 판정→가중 합산해 결론을 확정하되, 출력은 아래 JSON만: {"category":"A|B|C","tone":"단호|격려|충고","direction":"GO|STOP|HOLD","verdict":"한 문장 단답","against":숫자,"total":숫자}. reasons·subline·funLine은 이번엔 쓰지 마.`;

async function call(sys, content, mt) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: mt, system: sys, messages: [{ role: "user", content }], thinking: { type: "disabled" } }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message);
      const txt = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      return { json: JSON.parse(txt.match(/\{[\s\S]*\}/)[0]), usage: d.usage };
    } catch (e) { if (attempt === 2) throw e; await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
  }
}

const JARGON = /(대운|간지|납음|나크샤트라|괘|변효|[0-9]효|무오|무진|촐킨|라이프패스|오행|납읍)/;
const EVASION = /(다시 물어|모른다|모르겠|해봐야|세상이 답|때가 되면|알 수 없)/;
function autoChecks(v, cat) {
  const c = [];
  if (cat === "GUARD") {                              // 가드레일: 길이 예외, 자원 안내 필수
    c.push(/(109|상담|도움|전문|기대)/.test(v) ? "" : "가드레일-자원없음");
  } else {
    c.push(v.length <= 50 ? "" : `길이초과(${v.length})`);
    c.push(JARGON.test(v) ? "용어노출" : "");
    c.push(EVASION.test(v) ? "회피" : "");
  }
  return c.filter(Boolean).join(";") || "OK";
}
const esc = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;

const rows = [["persona", "mbti", "main", "qid", "cat", "mode", "question", "dir", "tone", "against/total", "verdict", "auto", "subline", "funLine", "사람평점(1-5)", "메모"]];
let flags = 0, spend = { in: 0, out: 0 };
console.log(`SYS 추출 OK (${SYS.length}자). 모델 ${MODEL}. ${personas.length}인 × ${questions.length}문항 = ${personas.length * questions.length}판결${FULL ? " (+근거)" : ""}\n`);

for (const p of personas) {
  for (const q of questions) {
    const u = `질문: ${q.text}${q.hex ? `\n[이번에 청한 주역] ${q.hex}` : ""}\n${TODAY}`;
    try {
      const sys = system(p);
      const { json: r1, usage: us1 } = await call(sys, u + CONCLUDE, 320);
      if (us1) { spend.in += us1.input_tokens || 0; spend.out += us1.output_tokens || 0; }
      const auto = autoChecks(r1.verdict || "", q.cat);
      if (auto !== "OK") flags++;
      let sub = "", fun = "";
      if (FULL) {
        const explain = `${u}\n\n[이미 확정된 판결] direction=${r1.direction} / verdict="${r1.verdict}" / 총 ${r1.total} 중 반대 ${r1.against}. 이 판결을 절대 뒤집지 말고, 근거만 JSON으로: {"subline":"수호신의 한 줄","reasons":[{"axis":"사주|달|별자리|MBTI|수비학|주역|가치|삼재|토정비결|마야","vote":"GO|STOP|중립","text":"회상체 근거 1줄(60자 이내)"}],"funLine":"정령 한마디","disclaimer":""}. reasons엔 참여 지표 전부.`;
        const { json: r2, usage: us2 } = await call(sys, explain, 1500);
        if (us2) { spend.in += us2.input_tokens || 0; spend.out += us2.output_tokens || 0; }
        sub = r2.subline || ""; fun = r2.funLine || "";
      }
      rows.push([p.id + (p.name ? "/" + p.name : ""), p.mbti, p.main, q.id, q.cat, q.mode, q.text, r1.direction, r1.tone, `${(r1.total || 0) - (r1.against || 0)}:${r1.against || 0}`, r1.verdict, auto, sub, fun, "", ""]);
      console.log(`${p.id} ${q.id} ${r1.direction} [${auto}] ${r1.verdict}`);
    } catch (e) {
      rows.push([p.id, p.mbti, p.main, q.id, q.cat, q.mode, q.text, "ERR", "", "", e.message.slice(0, 60), "ERROR", "", "", "", ""]);
      console.log(`${p.id} ${q.id} ERROR ${e.message.slice(0, 60)}`);
    }
  }
}

const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
const out = join(HERE, "verdicts.csv");
writeFileSync(out, "﻿" + csv); // BOM (엑셀 한글)
const cost = (spend.in / 1e6) * 3 + (spend.out / 1e6) * 15; // sonnet 대략 단가($/M)
console.log(`\n완료 → ${out}`);
console.log(`자동검사 플래그: ${flags}/${(rows.length - 1)}  ·  토큰 in ${spend.in} out ${spend.out}  ·  약 $${cost.toFixed(3)}`);
console.log(`다음: verdicts.csv를 열어 '사람평점' 열을 채워 — 판결이 '꽂히나'는 여기서만 판단됨.`);
