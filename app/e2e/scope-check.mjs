// 응답 스코프(S1·S2·S3) · 되물음 분류기 회귀 테스트 — 브라우저 없이 도는 순수 로직 검사(빠름).
// 사용: node e2e/scope-check.mjs
//
// 왜 있나: 2026-07-28 사고(되물음 7연속 HOLD) 대응으로 들어간 두 분류기를 지킨다.
//   · isReask()   — 참이면 앱이 '앞 판결 승계' 분기로 간다. 여기가 무너지면 HOLD 나선이 돌아온다.
//   · scopeHint() — 몸·병(S3) 질문을 규칙 쪽에서 표시한다. 모델 판정과 대조해 경계 케이스를 찾는 용도.
// 정규식은 조용히 망가진다(예: `암\b` 는 한글 뒤에서 절대 매칭되지 않는다 — 실제로 이 파일이 잡았다).
// App.jsx 에서 정규식을 그대로 추출해 검사하므로, 앱과 다른 것을 잴 수 없다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "..", "src", "App.jsx"), "utf8");

function pull(name) {
  const m = SRC.match(new RegExp(`const ${name} = (/.*?/);`, "s"));
  if (!m) { console.error(`✗ ${name} 를 App.jsx 에서 찾지 못했습니다 — 이름이 바뀌었는지 확인하세요.`); process.exit(1); }
  return new RegExp(m[1].slice(1, m[1].lastIndexOf("/")), m[1].slice(m[1].lastIndexOf("/") + 1));
}
const S3_RE = pull("S3_RE"), S2_RE = pull("S2_RE"), REASK_RE = pull("REASK_RE");
const scopeHint = (s) => (S3_RE.test(s) ? "S3" : S2_RE.test(s) ? "S2" : "S1");

// [질문, 기대 스코프]
const SCOPE = [
  // S3 — 몸이 대상이면 S3. 틀리면 사람이 다치는 영역이라 여기가 제일 중요하다.
  ["올해 내 건강운 어때?", "S3"],
  ["허리 디스크 수술 받아야 할까?", "S3"],
  ["올해 안에 아이 생길까?", "S3"],
  ["둘째 가져도 될까?", "S3"],
  ["암에 걸릴까 무서워", "S3"],
  ["위암 수술 받는 게 나을까", "S3"],
  ["엄마 암 진단 받았어 어떡하지", "S3"],
  ["요즘 계속 아픈데 병원 가야 할까?", "S3"],
  ["우울증 약 끊어도 될까?", "S3"],
  // S3 오탐 방지 — 몸 얘기가 아닌데 S3로 잠기면 멀쩡한 질문이 넘김 처리된다
  ["암튼 오늘 뭐 먹지", "S1"],
  ["이 옷 살까 말까", "S1"],
  // S2 — 결정이 대상이고 몸은 사정일 뿐
  ["체력이 달리는데 지금 이직할까?", "S2"],
  ["언제 창업하는 게 좋을까?", "S2"],
  ["올해 안에 이사 갈까?", "S2"],
  // S1
  ["나 어떤 사람이야?", "S1"],
  ["밤 11시, 전남친에게 카톡 보낼까?", "S1"],
  ["오늘 뭐 먹지", "S1"],
];

// [질문, 되물음인가]
const REASK = [
  ["무슨 뜻이야?", true],
  ["어떤 사람인데? 가족? 친구? 동료?", true],
  ["그 사람이랑 나는 어떤 관계인데?", true],
  ["사람? 어떤 사람 말하는거야?", true],
  ["그래서 뭘 하라는 거야?", true],
  ["관계랑 업무가 어떻게 묶였다는건지 해석해줘", true],
  ["쉽게 말해줘", true],
  ["구체적으로 알려줘", true],
  // 되물음이 아닌 것 — 여기가 오탐나면 새 질문이 앞 판결을 물려받아 엉뚱한 답이 나간다
  ["오늘 뭐 먹지", false],
  ["이직할까 말까", false],
  ["전남친한테 연락할까", false],
  ["주말에 집에서 쉴까 나가 놀까", false],
];

let pass = 0, fail = 0;
const say = (ok, msg) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} — ${msg}`); };

console.log("── 응답 스코프 ──");
for (const [q, exp] of SCOPE) {
  const got = scopeHint(q);
  say(got === exp, `${got}${got === exp ? "" : `(기대 ${exp})`} · ${q}`);
}
console.log("\n── 되물음 ──");
for (const [q, exp] of REASK) {
  const got = REASK_RE.test(q);
  say(got === exp, `${got ? "되물음" : "새질문"}${got === exp ? "" : `(기대 ${exp ? "되물음" : "새질문"})`} · ${q}`);
}

console.log(`\n=== 스코프·되물음 체크: ${pass}/${pass + fail} PASS ===`);
if (fail) {
  console.log("\n분류기가 어긋났습니다. src/App.jsx 의 S3_RE / S2_RE / REASK_RE 를 고치세요.");
  console.log("주의: 한글 뒤에는 정규식 단어경계(\\b)가 생기지 않습니다 — `암\\b` 같은 패턴은 영원히 매칭되지 않습니다.");
  process.exit(1);
}
