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
  // S3 — '몸이라서'가 아니라 '틀리면 되돌릴 수 없어서' 넘기는 넷. 아주 좁다.
  ["나 얼마나 살까?", "S3"],
  ["이 병으로 죽을까?", "S3"],
  ["허리 디스크 수술 받아야 할까?", "S3"],
  ["이 약 끊어도 될까?", "S3"],
  ["이 증상 무슨 병이야?", "S3"],
  ["암 재발할까?", "S3"],
  // S3 가 아니다 — 몸·건강도 답한다(경쟁 앱 대비 강점). 여기가 과잉 차단되면 제품이 죽는다.
  ["올해 내 건강운 어때?", "S2"],
  ["몸 언제쯤 풀릴까?", "S2"],
  ["올해 안에 아이 생길까?", "S2"],
  ["둘째 언제 가지면 좋을까?", "S2"],
  ["수술 날짜 언제로 잡는 게 좋아?", "S2"],
  ["건강검진 언제 받을까?", "S2"],
  // S3 오탐 방지 — 몸 얘기가 아닌데 잠기면 멀쩡한 질문이 넘김 처리된다
  ["암튼 오늘 뭐 먹지", "S1"],
  ["이 옷 살까 말까", "S1"],
  // S2 — 시기·타이밍
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

/* ── 표 집계(tallyVotes) — 결론이 지표 표에서 나오는지 확인 ─────────────────
   App.jsx 에서 함수 원문을 그대로 떼어와 실행한다(재구현하면 같이 틀려도 못 잡는다). */
function pullFn() {
  const i = SRC.indexOf("const VOTE_AX = new Set(");
  const j = SRC.indexOf("\n}", SRC.indexOf("function tallyVotes(", i));
  if (i < 0 || j < 0) { console.error("✗ tallyVotes 를 App.jsx 에서 찾지 못했습니다."); process.exit(1); }
  return new Function(`${SRC.slice(i, j + 2)}\nreturn tallyVotes;`)();
}
const tallyVotes = pullFn();
const V = (...xs) => ({ votes: xs.map(([axis, v]) => ({ axis, v })) });

console.log("\n── 표 집계 ──");
{
  const cases = [
    // [설명, 입력, 기대 {dir, against, total} 또는 null]
    ["GO 우세 → GO", { ...V(["사주","GO"],["달","GO"],["별자리","STOP"],["수비학","중립"]), direction: "GO" }, { dir:"GO", against:1, total:4 }],
    ["STOP 우세 → STOP", { ...V(["사주","STOP"],["달","STOP"],["별자리","GO"]), direction: "STOP" }, { dir:"STOP", against:1, total:3 }],
    /* v132.3: 예전엔 동률이면 GO 였다("해보는 쪽이 인생에 남는다"). 그건 지표가 아니라 인생관이라
       걷어냈다 — 표가 반반이면 반반이라고 말한다. 모델이 STOP 이라 해도 표가 갈렸으면 HOLD 다. */
    /* 동률에서 두 번 틀렸다: ①GO(경험 편향) ②HOLD(판결앱이 판결을 안 함).
       지금은 표가 다수를 못 만들면 **앱이 방향을 만들지 않는다** — 모델이 같은 지표를 읽고 낸 방향을 그대로 둔다.
       그래서 이 두 케이스는 입력 direction 만 다르고 기대값이 각각 그것을 따라간다. */
    ["동률 → 앱이 방향을 만들지 않는다(모델 STOP 유지)", { ...V(["사주","GO"],["달","STOP"],["별자리","중립"]), direction: "STOP" }, { dir:"STOP", against:1, total:3 }],
    ["동률 → 모델 GO 면 GO 유지(한쪽으로 밀지 않는다)", { ...V(["사주","GO"],["달","STOP"],["별자리","중립"]), direction: "GO" }, { dir:"GO", against:1, total:3 }],
    ["모델이 표와 다른 결론 → 표를 따른다", { ...V(["사주","STOP"],["달","STOP"],["별자리","STOP"]), direction: "GO" }, { dir:"STOP", against:0, total:3 }],
    ["HOLD 는 표로 뒤집지 않는다", { ...V(["사주","GO"],["달","GO"],["별자리","GO"]), direction: "HOLD" }, { dir:"HOLD", total:3 }],
    ["같은 축 중복은 한 번만", { ...V(["사주","GO"],["사주","STOP"],["달","GO"],["별자리","GO"]), direction: "GO" }, { dir:"GO", total:3 }],
    ["모르는 축은 버린다", { ...V(["사주","GO"],["혈액형","STOP"],["달","GO"],["별자리","GO"]), direction: "GO" }, { dir:"GO", against:0, total:3 }],
    ["표가 부실하면(3개 미만) 집계 안 함", { ...V(["사주","GO"],["달","GO"]), direction: "GO" }, null],
    ["votes 자체가 없으면 집계 안 함", { direction: "GO" }, null],
  ];
  for (const [name, input, exp] of cases) {
    const got = tallyVotes(input);
    let ok;
    if (exp === null) ok = got === null;
    else ok = got && got.dir === exp.dir && got.total === exp.total &&
              (exp.against === undefined || got.against === exp.against);
    say(ok, `${name}${ok ? "" : ` — 받은 값 ${JSON.stringify(got)}`}`);
  }
  const t = tallyVotes({ ...V(["사주","STOP"],["달","STOP"],["별자리","STOP"]), direction: "GO" });
  say(t && t.overridden === true, "표와 결론이 어긋나면 overridden 으로 표시(계측용)");
}

/* ── 되물음 승계 vs 표 우선 ────────────────────────────────────────────────
   실측(2026-07-28 2회차, P2 Q27): "그래서 뭘 하라는 거야?"(앞 판결 GO)에서 표가 1GO:2STOP 이
   나왔고, 표 우선 규칙이 GO 를 STOP 으로 뒤집었다. 되물음은 새 판정이 아니라 앞 판결의 풀이이므로
   방향을 바꾸면 안 된다. App.jsx 의 judge() 안에 이 조건이 살아 있는지 확인한다. */
console.log("\n── 되물음 승계 ──");
{
  const ok = /if \(!_reask\) r1\.direction = _tally\.dir/.test(SRC);
  say(ok, ok ? "되물음 턴에는 표로 방향을 뒤집지 않음"
           : "되물음 턴에도 표가 방향을 뒤집는다 — judge() 의 `if (!_reask) r1.direction = _tally.dir` 를 확인하세요");
  // 되물음이어도 접전 표시(against/total)는 표에서 나와야 한다
  const ok2 = /r1\.against = _tally\.against; r1\.total = _tally\.total;/.test(SRC);
  say(ok2, ok2 ? "되물음이어도 접전 수치는 표에서 계산" : "against/total 이 표에서 계산되지 않음");
}

/* ── 명리 심화(v101) — 십성·신살·세운·택일 단위테스트 ──────────────────────
   App.jsx 에서 함수·테이블 원문을 그대로 떼어 실행한다(재구현하면 같이 틀려도 못 잡는다).
   지시서 §7: 십성 전수 · 암록 10간 · 원진 대칭 · 세운 기지 연도 · 택일 충 판정 */
console.log("\n── 명리 심화 ──");
{
  const pre = ["const GAN = ", "const JI = ", "const GAN_EL = ", "const JI_EL = "].map((m) => {
    const a = SRC.indexOf(m); return SRC.slice(a, SRC.indexOf("\n", a) + 1);
  }).join("");
  const ja = SRC.indexOf("const jdn ="), jb = SRC.indexOf("};", ja) + 2;
  const bi = SRC.indexOf("const JI_BONGI"), bj = SRC.indexOf("/* ── 명리 심화 끝 ── */");
  if (bi < 0 || bj < 0) { console.error("✗ 명리 블록을 App.jsx 에서 찾지 못했습니다."); process.exit(1); }
  const M = new Function(pre + SRC.slice(ja, jb) + "\n" + SRC.slice(bi, bj) +
    "\nreturn { sipseong, sipseongDist, sinsalOf, seun, taekil, AMROK, CHEONEUL, MUNCHANG, WONJIN, YUKHAP };")();
  // 십성 10종 전수 — 일간 갑(양목)이 갑~계를 보는 고전 배열
  const exp10 = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"];
  say(exp10.every((e, k) => M.sipseong(0, k) === e), "십성 10종 전수(일간 갑)");
  say(M.sipseong(7, 0) === "정재" && M.sipseong(8, 0) === "식신" && M.sipseong(8, 2) === "편재", "십성 교차 — 신→갑 정재 · 임→갑 식신 · 임→병 편재");
  // 암록 — 건록의 육합으로 검산한 값과 일치해야 한다
  say(JSON.stringify(M.AMROK) === JSON.stringify([11, 10, 8, 7, 8, 7, 5, 4, 2, 1]), "암록 10간 전수(건록 육합 검산)");
  // 원진 — 쌍방향이어야 한다(자미·축오·인유·묘신·진해·사술)
  say([...Array(12).keys()].every((k) => M.WONJIN[M.WONJIN[k]] === k) && M.WONJIN[0] === 7 && M.WONJIN[2] === 9, "원진 12지 대칭 + 자미·인유 확인");
  // 육합 — 쌍방향(자축·인해·묘술·진유·사신·오미)
  say([...Array(12).keys()].every((k) => M.YUKHAP[M.YUKHAP[k]] === k) && M.YUKHAP[0] === 1 && M.YUKHAP[2] === 11, "육합 12지 대칭 + 자축·인해 확인");
  // 세운 — 기지 연도 (2024 갑진 · 2025 을사 · 2026 병오)
  const se = M.seun(0, 2024, 3);
  say(se[0].ganji === "갑진" && se[1].ganji === "을사" && se[2].ganji === "병오", "세운 2024갑진·2025을사·2026병오");
  // 신살 — 일간 갑 + 지지에 해(11) → 암록 성립 / 년지 인(2) 그룹 + 신(8) → 역마
  const s1 = M.sinsalOf({ dG: 0, yJ: 11, mJ: 4, dJ: 4, hJ: null });
  say(s1.some((x) => x.name.startsWith("암록")), "신살 — 갑 일간 + 해 지지 = 암록");
  const s2 = M.sinsalOf({ dG: 4, yJ: 2, mJ: 8, dJ: 6, hJ: null });
  say(s2.some((x) => x.name === "역마"), "신살 — 인오술 그룹 + 신 지지 = 역마");
  // 택일 — 60일 창에서 피할 날은 전부 '일지와 충', 좋은 날엔 이유가 붙는다
  const tk = M.taekil({ dG: 0, yJ: 0, mJ: 2, dJ: 2, hJ: null }, new Date(2026, 6, 30), 60);
  say(tk.bad.length > 0 && tk.bad.every((d) => d.why === "일지와 충하는 날"), "택일 — 피할 날은 전부 일지 충");
  say(tk.good.length > 0 && tk.good.every((d) => d.why.length > 0), "택일 — 좋은 날엔 근거(암록일·귀인일·합)가 붙는다");
}

console.log(`\n=== 스코프·되물음 체크: ${pass}/${pass + fail} PASS ===`);
if (fail) {
  console.log("\n분류기가 어긋났습니다. src/App.jsx 의 S3_RE / S2_RE / REASK_RE 를 고치세요.");
  console.log("주의: 한글 뒤에는 정규식 단어경계(\\b)가 생기지 않습니다 — `암\\b` 같은 패턴은 영원히 매칭되지 않습니다.");
  process.exit(1);
}
