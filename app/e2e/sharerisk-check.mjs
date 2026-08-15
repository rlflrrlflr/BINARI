/* 공개 표면 안전 판정 — 바이럴루프판단 v01 §2 의 규칙이 코드로 지켜지는가.
   실행: node e2e/sharerisk-check.mjs (브라우저 불필요)

   왜 있나: 아홉 하늘 값은 각각 다른 주기의 나머지라, 몇 개만 모이면 중국인의 나머지 정리로
   **생년월일이 복원된다.** 문서가 명시한 사례가 촐킨(260일)×웨톤(35일) = LCM 1,820일 ≈ 5년 창.
   문제는 이게 **눈으로는 안 보인다**는 것이다 — 이미지 한 장에 이름 두 개가 예쁘게 얹혀 있을 뿐이고,
   그게 생일을 공개하고 있다는 걸 만든 사람도 모른다. 그래서 계산으로 잡는다.

   ⚠ 함수를 베끼지 않고 App.jsx 소스에서 꺼내 돌린다 — 베끼면 본체가 바뀌어도 사본만 통과한다. */
import { readFileSync } from "node:fs";

const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const grab = (name, kind = "function") => {
  const needle = kind === "function" ? `function ${name}(` : `const ${name} =`;
  const i = src.indexOf(needle);
  if (i < 0) throw new Error(`${name} 을 App.jsx 에서 찾지 못했습니다 — 이름이 바뀌었는지 확인하세요`);
  if (kind !== "function") { const e = src.indexOf("\n", i); return src.slice(i, e); }
  /* ⚠ 본문의 여는 중괄호를 찾을 때 **인자 목록을 먼저 건너뛴다.**
     v130 까지는 이름 뒤 첫 `{` 부터 짝을 맞췄는데, 인자가 구조분해면(`function f({ a, b })`)
     그 `{` 가 인자 패턴이라 **인자 목록만 잘라 내고 본문은 통째로 놓쳤다.**
     그러면 "본문에 X 가 없다" 류 검사가 전부 **거짓 통과**한다 — 실제로 그렇게 통과하고 있었다. */
  let pd = 0, k = src.indexOf("(", i);
  for (; k < src.length; k++) {
    if (src[k] === "(") pd++; else if (src[k] === ")") { pd--; if (pd === 0) break; }
  }
  let d = 0;
  for (let j = src.indexOf("{", k); j < src.length; j++) {
    if (src[j] === "{") d++; else if (src[j] === "}") { d--; if (d === 0) return src.slice(i, j + 1); }
  }
  throw new Error(`${name} 본문이 닫히지 않았습니다`);
};
const cycleSrc = (() => {
  const i = src.indexOf("const SKY_CYCLE = {");
  return src.slice(i, src.indexOf("\n};", i) + 3);
})();
const shareRisk = new Function(`${cycleSrc}
  const _gcd = (a, b) => (b ? _gcd(b, a % b) : a);
  const _lcm = (a, b) => (a / _gcd(a, b)) * b;
  ${grab("shareRisk")}
  return { shareRisk, SKY_CYCLE };`)();
const { shareRisk: risk, SKY_CYCLE } = shareRisk;

/* ── ① 문서가 직접 든 사례 ─────────────────────────────────────────────── */
{
  const pair = risk(["촐킨", "웨톤"]);
  ck("① 촐킨×웨톤은 막힌다(문서가 든 바로 그 조합)", !pair.ok, `LCM ${pair.dayLcm}일 · ${pair.level}`);
  ck("① 그 LCM 이 문서의 1,820일과 같다", pair.dayLcm === 1820, `${pair.dayLcm}일`);
  const worst = risk(["촐킨", "웨톤", "납음"]);
  ck("① 날짜+연도가 겹치면 '위험'", worst.level === "위험", worst.why.join(" / "));
  ck("① 위험 사유에 생년월일 특정이 적힌다", worst.why.some((w) => w.includes("생년월일")));
}

/* ── ② 한 장에 하나는 통과해야 한다 (안 그러면 새 공유 단위를 아예 못 만든다) ── */
for (const k of Object.keys(SKY_CYCLE)) {
  const r = risk([k]);
  const expect = !(SKY_CYCLE[k].day > 400);          // 하압(365)은 통과, 그보다 긴 날짜 주기는 단독도 위험
  ck(`② 단독 노출 — ${k}`, r.ok === expect, `${r.level}${r.why.length ? " · " + r.why[0] : ""}`);
}

/* ── ③ 규칙 세 가지가 각각 작동하는가 ──────────────────────────────────── */
{
  ck("③ 연 주기 둘이면 막힌다", !risk(["납음", "혼메이세이"]).ok, risk(["납음", "혼메이세이"]).why.join(" / "));
  ck("③ 파생 이름 셋이면 막힌다", !risk(["아칸", "달위상", "나크샤트라"]).ok);
  // 주기가 짧고 서로 배수 관계면 정보가 겹쳐 안전하다 — 규칙이 과하게 막지 않는지 본다
  const safe = risk(["아칸", "웨톤"]);               // 7 과 35 → LCM 35
  ck("③ 주기가 겹치는 짧은 조합은 통과(과잉 차단 아님)", safe.ok, `LCM ${safe.dayLcm}일`);
}

/* ── ④ 파생 이름이 아닌 것은 계산에 안 들어간다 ────────────────────────── */
{
  const r = risk(["오행", "수호신색", "판결방향"]);   // SKY_CYCLE 에 없는 것들
  ck("④ 주기 없는 값은 세지 않는다", r.ok && r.n === 0, `n=${r.n}`);
  ck("④ 빈 목록은 안전", risk([]).ok && risk([]).level === "안전");
  ck("④ 잘못된 입력에도 안 터진다", risk(null).ok && risk(undefined).ok);
}

/* ── ⑤ 실제 공유 표면이 지금 안전한가 (현 상태 감사) ───────────────────── */
{
  // 부적은 오행 문양·수호신 색·판결만 싣는다 → 파생 이름 0개.
  // ⚠ 범위는 반드시 **함수 본문**으로 잡는다 — 두 함수 사이를 통째로 자르면 그 사이에 있는
  //   SKY_CYCLE(이름이 전부 적힌 표)이 딸려 들어와 항상 실패한다(실제로 그렇게 한 번 틀렸다).
  const poster = grab("buildBujeokPoster");
  const leaked = Object.keys(SKY_CYCLE).filter((k) => poster.includes(k));
  ck("⑤ 부적 포스터에 파생 이름이 없다", leaked.length === 0, leaked.join(", ") || "0개");
  // 공유 링크 payload 에도 없어야 한다
  const payload = (src.match(/const payload = \{ q,[^;]*;/) || [""])[0];
  const inLink = Object.keys(SKY_CYCLE).filter((k) => payload.includes(k));
  ck("⑤ 공유 링크 payload 에 파생 이름이 없다", inLink.length === 0, inLink.join(", ") || "0개");
  /* 그리고 공유 경로가 실제로 이 판정을 통과하도록 배선돼 있어야 한다.
     ⚠ v130: 여기를 `const risk = shareRisk(args.skyKinds…)` 라는 **문자열 앵커**로 잡고 있었는데,
        각인·궁합 카드를 붙이며 그 배관을 공용 함수로 뽑자 앵커가 어긋나 빨개졌다. 배선은 멀쩡했다.
        그래서 **모양이 아니라 성질**을 본다: 카드가 나가는 문이 하나이고, 그 문이 판정을 거치는가. */
  const gate = grab("saveOrShareCard");
  ck("⑤ 카드가 나가는 문이 있다", !!gate && gate.length > 200);
  ck("⑤ 그 문이 shareRisk 를 거친다", /shareRisk\(/.test(gate));
  ck("⑤ '위험'이면 이미지를 아예 안 만든다", /if \(risk\.level === "위험"\) return;/.test(gate));
  ck("⑤ 위험 판정이 **그리기 전에** 난다(그려 놓고 버리지 않는다)",
     gate.indexOf("shareRisk(") < gate.indexOf("build()"), "shareRisk → build 순서");
  /* 문을 우회하는 경로가 없는가 — 캔버스를 이미지로 바꾸는 곳은 그 문 하나뿐이어야 한다.
     새 카드를 만들며 toDataURL 을 따로 부르면 검사도 계측도 통째로 빠진다. */
  const outs = (src.match(/\.toDataURL\(/g) || []).length;
  ck("⑤ 이미지로 내보내는 곳이 그 문 하나뿐이다", outs === 1, `toDataURL ${outs}곳`);
  /* 각인·궁합 카드가 정책대로 실었는가 (바이럴루프판단 v01 §2) */
  const impCard = grab("buildImprintCard"), matCard = grab("buildMatchCard");
  const impNames = Object.keys(SKY_CYCLE).filter((k) => impCard.includes(k));
  ck("⑤ 각인 카드의 파생 이름은 하나뿐", impNames.length <= 1, impNames.join(",") || "0개");
  const matNames = Object.keys(SKY_CYCLE).filter((k) => matCard.includes(k));
  ck("⑤ 궁합 카드엔 파생 이름이 없다(상대는 제3자다)", matNames.length === 0, matNames.join(",") || "0개");
  ck("⑤ 각인 카드가 생년월일·건강·짝을 안 싣는다",
     !/birth\.|생년월일|약한 곳|짝 자리/.test(impCard));
  /* ⚠ "총점"이라는 **낱말**로 잡으면 안 된다 — 카드 발치에 "총점은 안 실어"라고 적혀 있어서
     자기 자신을 잡는다(실제로 잡았다). 막아야 하는 건 **값이 실리는 것**이므로 인자와 호출부를 본다. */
  const matArgs = (matCard.match(/^function buildMatchCard\(\{([^}]*)\}/) || ["", ""])[1];
  ck("⑤ 궁합 카드가 총점을 받지도 않는다", !/score|band|akRows|rows/.test(matArgs), matArgs.trim());
  const matCall = (src.match(/build: \(\) => buildMatchCard\(\{[\s\S]*?\}\),/) || [""])[0];
  ck("⑤ 궁합 카드 호출부가 총점·축을 안 넘긴다",
     !!matCall && !/r\.score|r\.band|r\.rows|r\.akRows/.test(matCall),
     matCall ? "깨끗" : "호출부를 못 찾음");
  /* 호출부가 선언한 skyKinds 도 규칙을 지켜야 한다 — 그림은 안 실어도 인자로 위험 조합을 넘기면 막힌다 */
  for (const [kind, m] of [["imprint", /cardKind: "imprint",[\s\S]{0,400}?skyKinds: \[([^\]]*)\]/],
                           ["match", /cardKind: "match", skyKinds: \[([^\]]*)\]/]]) {
    const mm = src.match(m);
    const kinds = mm ? (mm[1].match(/"[^"]+"/g) || []).map((x) => x.slice(1, -1)) : null;
    ck(`⑤ ${kind} 호출부의 skyKinds 가 안전 판정을 받는다`, !!kinds && risk(kinds).ok,
       kinds ? `[${kinds.join(",")}] → ${risk(kinds).level}` : "호출부를 못 찾음");
  }
}

const f = R.filter((x) => !x).length;
console.log(`\n=== 공개 표면 안전: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
