#!/usr/bin/env node
/**
 * 비나리 건강검진 — 비개발자가 직접 돌려서, 코드를 읽지 않고도 앱의 고장을 알아내는 도구.
 *
 * 사용자는 AI에게 **"검진"** 한 마디만 하면 된다. 명령어를 외울 필요가 없다.
 * (직접 돌릴 때: `node health-check.mjs` — 빌드도 미리보기 서버도 이 파일이 알아서 한다)
 *
 * 설계 원칙
 *  1) 이 검사들은 "있으면 좋은 것"이 아니라 **실제로 터졌던 사고**에서 역산해 만들었다.
 *     새 사고가 나면 여기에 검사를 하나 추가한다. 그래야 같은 사고가 두 번 나지 않는다.
 *  2) 출력은 스택트레이스가 아니라 **한국어 증상 + 조치**다. 읽는 사람은 개발자가 아니다.
 *  3) 준비물은 스스로 갖춘다. 빌드가 없으면 빌드하고, 미리보기 서버가 없으면 띄웠다가 끈다.
 *     "터미널 하나 더 열고…" 같은 안내는 이 도구의 실패다.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";

const APP = "src/App.jsx";
const src = readFileSync(APP, "utf8");
const R = [];   // { level: "심각"|"주의"|"정상", title, detail, fix }
const add = (level, title, detail, fix) => R.push({ level, title, detail, fix });

/* ── 검사 1. GLSL 예약어를 변수로 쓰고 있는가 ─────────────────────────────
   사고 이력: 변수명 asm(GLSL 예약어) 때문에 sim 셰이더가 엄격한 드라이버(iOS 등)에서만
   컴파일 실패 → 조용히 열등한 렌더러로 폴백. 개발 PC에선 멀쩡해 보여서 발견이 늦었다. */
const GLSL_RESERVED = ["asm", "union", "packed", "namespace", "using", "template", "this",
  "goto", "switch", "default", "inline", "static", "extern", "external", "interface",
  "long", "short", "double", "half", "fixed", "unsigned", "input", "output", "typedef",
  "volatile", "public", "cast", "class", "enum", "sizeof"];
{
  const bad = [];
  for (const w of GLSL_RESERVED) {
    const re = new RegExp(`\\b(float|int|vec2|vec3|vec4|mat2|mat3|mat4|bool)\\s+${w}\\b`, "g");
    let m; while ((m = re.exec(src))) bad.push({ word: w, line: src.slice(0, m.index).split("\n").length });
  }
  if (bad.length) {
    add("심각", "셰이더에 GLSL 예약어를 변수명으로 사용",
      bad.map(b => `${b.line}행: '${b.word}'`).join(", "),
      "변수 이름을 바꾸세요. 이 이름들은 일부 기기(특히 iPhone)에서만 오류를 내고, 그런 기기에서는 수호신이 조용히 저품질 모드로 떨어집니다.");
  } else {
    add("정상", "셰이더 예약어", "GLSL 예약어를 변수로 쓴 곳 없음", "");
  }
}

/* ── 검사 2. 같은 값이 두 곳에 있는데 서로 어긋났는가(상수 표류) ──────────
   사고 이력: 응집 시차(stg)를 한쪽 셰이더에서만 고쳐서, 시뮬레이션과 화면 표시의
   기준이 달라졌다. 눈으로는 "뭔가 이상한데" 수준이라 원인 추적이 오래 걸렸다. */
{
  // 단일 진실 원천(TUNE)로 옮긴 값은 구조적으로 어긋날 수 없다 — 그 사실 자체를 검사한다.
  const tuned = /const TUNE = \{/.test(src);
  const injected = (src.match(/\$\{TUNE\.\w+\}/g) || []).length;
  if (tuned && injected >= 3) {
    add("정상", "튜닝값 단일화(TUNE)", `${injected}곳이 한 곳에서 주입됨 — 한쪽만 바뀌는 표류가 구조적으로 불가`, "");
  } else {
    add("주의", "튜닝값이 단일화되지 않음", "같은 값이 여러 곳에 직접 박혀 있음",
      "TUNE 블록으로 옮기면 한쪽만 고쳐 어긋나는 사고를 원천 차단할 수 있습니다.");
  }
  const pairs = [
    { name: "응집 시차(stg)", re: /float stg=a_r1\.z\*([\d.]+)/g, why: "수호신이 손끝으로 모이는 순서. 두 값이 다르면 움직임과 밝기가 어긋납니다." },
    { name: "입자 수", re: /const n = E \? (\d+) : (\d+);/g, why: "렌더러마다 입자 수가 다르면 같은 사람인데 기기별로 다른 수호신이 보입니다." },
    { name: "노출 예산(F_AL)", re: /F_AL = \{ 화: ([\d.]+)/g, why: "밝기 기준. 다르면 렌더러를 바꿀 때 화면이 갑자기 밝아지거나 어두워집니다." },
    { name: "별 입자 대비", re: /mix\(([\d.]+),([\d.]+),star\)\*\(0\.90/g, why: "알갱이 위계. 다르면 두 렌더러의 질감이 달라집니다." },
  ];
  for (const p of pairs) {
    const vals = [...src.matchAll(p.re)].map(m => m.slice(1).join("/"));
    if (vals.length >= 2 && new Set(vals).size > 1) {
      add("심각", `같은 설정값이 서로 다름 — ${p.name}`, `발견된 값: ${vals.join(" vs ")}`, `${p.why} 두 곳을 같은 값으로 맞추세요.`);
    } else if (vals.length >= 2) {
      add("정상", `설정값 일치 — ${p.name}`, `${vals.length}곳 모두 ${vals[0]}`, "");
    }
  }
}

/* ── 검사 3. 같은 수식을 두 벌 유지하고 있는가(중복) ─────────────────────
   중복 자체는 당장 고장은 아니지만, 위 1·2번 사고의 원인이다. 개수를 눈에 보이게 둔다. */
{
  const cut = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
  const norm = t => t.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, "");
  try {
    const gl = norm(cut("const GL_VERT", "const GL_FRAG"));
    const fn = norm(cut("const SHAPE_FN", "const SIM_VERT"));
    const forms = t => [...t.matchAll(/u_form<([\d.]+)\)\{(.*?)\}else/gs)].map(m => m[0]);
    const g = forms(gl), f = forms(fn);
    const same = g.filter((x, i) => x === f[i]).length;
    if (same > 0) {
      add("주의", "수호신 형상 수식이 두 벌로 존재",
        `${same}개 분기가 두 곳(GL_VERT / SHAPE_FN)에 똑같이 있음`,
        "한쪽만 고치면 두 렌더러가 다르게 보입니다. 지금은 검사 2가 어긋남을 잡아주지만, 근본적으로는 한 곳으로 합치는 게 안전합니다.");
    }
  } catch (_) { /* 구조가 바뀌면 조용히 넘어간다 */ }
}

/* ── 검사 4. 화면에 반드시 있어야 할 것들(법·약속) ──────────────────────
   법정 고지가 리팩터링 중 조용히 사라지는 사고를 막는다. */
{
  const must = [
    { name: "AI 생성 고지", pat: /AI가 생성/, fix: "AI기본법 제31조 고지입니다. 삭제하면 안 됩니다." },
    { name: "만 14세 확인 게이트", pat: /_age !== null && _age < 14/, fix: "개인정보보호법 제22조의2. 없으면 과태료 대상입니다." },
    { name: "서신 가격 표시", pat: /LETTER_PRICE/, fix: "가격 없는 버튼은 지불 의사를 잴 수 없습니다." },
    { name: "환불 불가 고지", pat: /환불되지 않아/, fix: "전자상거래법 제17조⑥. 미리보기와 함께 있어야 청약철회 배제가 유효합니다." },
    { name: "위기 상황 안내(109)", pat: /자살예방상담 109/, fix: "가드레일입니다. 어떤 리팩터링에서도 지우면 안 됩니다." },
    { name: "버전 배지", pat: /APP_VER/, fix: "지금 무엇을 보고 있는지 확인하는 수단입니다." },
  ];
  for (const m of must) {
    if (m.pat.test(src)) add("정상", `화면 필수 요소 — ${m.name}`, "있음", "");
    else add("심각", `화면 필수 요소 사라짐 — ${m.name}`, "코드에서 찾을 수 없음", m.fix);
  }
}

/* ── 검사 4-2. 판결이 흐려지는 것을 막는 규칙이 살아 있는가 ────────────────
   실제 사고(2026-07-28): 유저가 "무슨 뜻이야"·"어떤 사람인데"로 7번 연속 되물었는데
   7번 다 HOLD + 추상적인 비유가 나왔다. 앱이 되물음을 '새 질문'으로 처리해 매번 재판정했고,
   되물음엔 GO/STOP 축이 없으니 전부 HOLD로 내려앉은 것. 화면엔 아무 오류도 안 뜬다 — 전형적인 조용한 고장.
   이 규칙들은 프롬프트 리팩터링에서 통째로 날아가기 쉬우므로 검사로 고정한다. */
{
  const rules = [
    { name: "제1원칙(물어본 것에 답한다)", pat: /## 제1원칙 — 물어본 것에 답한다/,
      fix: "판결이 질문을 비껴가는 것을 막는 최상위 규칙입니다. 지우면 '어떤 사람인데?'에 '사람 종류가 아니야' 같은 답이 돌아옵니다." },
    { name: "되물음 분기(프롬프트)", pat: /## 되물음에 답하기/,
      fix: "되물음을 새 판결로 처리하면 HOLD 나선에 빠집니다. 실제로 7연속 HOLD 사고가 났습니다." },
    { name: "되물음 태그(코드)", pat: /\[되물음\] 유저가 방금 판결/,
      fix: "프롬프트 규칙만 있고 태그를 안 붙이면 모델은 되물음인지 모릅니다. isReask → reaskLine 배선을 확인하세요." },
    { name: "HOLD 규칙", pat: /## HOLD는 표에서 나온다/,
      fix: "HOLD가 '판단 못 하겠음'의 기본값이 되면 앱이 아무 결정도 못 내려줍니다. HOLD도 지표에서 나와야 합니다." },
    { name: "응답 스코프(S1·S2·S3)", pat: /## 응답 스코프\(S1·S2·S3\)/,
      fix: "몸·병·임신출산(S3)에 길흉 판결이 나가는 것을 막는 규칙입니다. 오답 시 실제 피해가 발생하는 영역입니다." },
    { name: "S3 넘김 절차", pat: /### S3 넘기는 법/,
      fix: "판단을 넘기되 '지금 뭘 할지'는 남기는 절차입니다. 없으면 얼버무림과 구분되지 않습니다." },
    { name: "표 우선 판정(votes)", pat: /votes를 먼저 채우고/,
      fix: "결론을 먼저 정하고 근거를 끼워 맞추는 것을 막는 핵심 규칙입니다. 없으면 판결이 '아무나 해줄 수 있는 조언'으로 돌아갑니다." },
    { name: "표 집계(tallyVotes)", pat: /function tallyVotes\(/,
      fix: "against/total 과 direction 을 지표 표에서 계산하는 함수입니다. 없으면 모델이 숫자를 지어내도 아무도 모릅니다." },
    { name: "일반 조언 금지", pat: /일반 조언 금지 — 이게 우리가 파는 것/,
      fix: "'무리하지 마' 같은 누구에게나 하는 말을 막는 규칙입니다. 이게 빠지면 운세 앱일 이유가 사라집니다." },
    { name: "뒷면 용어·풀이 병기", pat: /반드시 쉬운 풀이를 붙여 병기한다/,
      fix: "사주 보러 가면 용어 뒤에 풀이를 붙여주듯, 근거는 '용어 — 쉬운 풀이' 형식이어야 합니다." },
    { name: "scope 계측", pat: /scope_level:/,
      fix: "S3 진입률·이탈률을 못 재면 스코프 설계가 맞는지 영영 알 수 없습니다. verdict_shown 의 scope_level/handoff_triggered 를 확인하세요." },
  ];
  for (const r of rules) {
    if (r.pat.test(src)) add("정상", `판결 품질 규칙 — ${r.name}`, "있음", "");
    else add("심각", `판결 품질 규칙 사라짐 — ${r.name}`, "코드에서 찾을 수 없음", r.fix);
  }
  // 콜1이 scope 를 안 뱉으면 계측값이 통째로 null 이 된다(조용한 고장)
  if (/"scope":"S1\|S2\|S3"/.test(src)) add("정상", "판결 품질 규칙 — 콜1 scope 필드", "있음", "");
  else add("심각", "콜1 출력 스키마에 scope 없음", "JSON 스키마에서 찾을 수 없음",
    "콜1 JSON 스키마에 \"scope\":\"S1|S2|S3\" 을 넣으세요. 없으면 scope_level 이 항상 빈 값으로 기록됩니다.");
  // 콜1 토큰 상한(앱) vs 서버 로그의 콜1/콜2 경계(judge.js) — 어긋나면 계측이 조용히 오염된다
  try {
    const mt = +(src.match(/callClaude\(system, \[\.\.\.priorConvo, concludeMsg\], (\d+)\)/) || [])[1];
    const api = readFileSync("api/judge.js", "utf8");
    const cut = +(api.match(/call: mt <= (\d+) \? 1 : 2/) || [])[1];
    if (mt && cut && mt > cut) {
      add("주의", "서버 로그가 콜1을 콜2로 셈", `콜1 상한 ${mt} > 경계 ${cut}`,
        "api/judge.js 의 'mt <= N ? 1 : 2' 에서 N 을 콜1 상한보다 크게 올리세요. 안 그러면 호출 통계가 뒤섞입니다.");
    } else if (mt && cut) add("정상", "콜1/콜2 로그 경계", `콜1 ${mt} ≤ 경계 ${cut}`, "");
  } catch (_) { /* 구조가 바뀌면 조용히 넘어간다 */ }

  // 카드 앞면에 한자 괘 이름이 돌아오는 회귀 방지 — 앞면은 쉬운 말만(층위 분리)
  //   범위: 공유 카드 앞면 ~ 판결 카드의 L1 결론. 마커가 사라졌으면(구조 변경) 조용히 통과시키지 말고 알린다.
  const fs0 = src.indexOf('<div className="vtop"><span>BINARI</span>'), fs1 = src.indexOf("{/* L1 결론 */}");
  const front = fs0 >= 0 && fs1 > fs0 ? src.slice(fs0, fs1) : null;
  if (front === null) {
    add("주의", "카드 앞면 용어 검사 불가", "앞면 구간을 찾는 표시가 사라짐",
      "카드 구조가 바뀐 것 같습니다. health-check.mjs 의 앞면 구간 표시를 새 구조에 맞춰 고치세요. 지금은 이 검사가 아무것도 못 잡습니다.");
  } else if (front.includes("卦")) {
    add("주의", "카드 앞면에 괘 이름(한자) 노출", "앞면 영역에서 '卦' 발견",
      "괘 이름은 뒷면(판결 근거)에만 두세요. 앞면은 처음 보는 사람도 읽을 수 있는 말만 둡니다.");
  } else add("정상", "카드 앞면 용어", "앞면에 어려운 말 없음", "");
}

/* ── 검사 5. 앱과 평가 하네스가 같은 것을 재고 있는가 ────────────────────
   사고 위험: 프롬프트에 태그를 붙였는데 하네스에 안 붙이면, 채점 결과가 실제 앱과 무관해진다. */
{
  // 앱과 하네스가 반드시 같이 갖고 있어야 할 문자열들. 하나라도 어긋나면 채점이 앱과 무관해진다.
  const shared = [
    { name: "판돈 태그", tag: "유저가 '속결'로 물었다" },
    { name: "되물음 태그", tag: "[되물음] 유저가 방금 판결" },
    { name: "콜1 scope 필드", tag: '"scope":"S1|S2|S3"' },
    { name: "콜1 votes 필드", tag: '"votes":[{"axis":"지표명","v":"GO|STOP|중립"}]' },
  ];
  const evalPath = "eval/run-eval.mjs";
  if (existsSync(evalPath)) {
    const ev = readFileSync(evalPath, "utf8");
    const drift = shared.filter((s) => src.includes(s.tag) && !ev.includes(s.tag)).map((s) => s.name);
    if (drift.length) {
      add("심각", "평가 도구가 앱과 다른 것을 측정 중", `앱에는 있는데 평가 하네스에 없음 — ${drift.join(", ")}`,
        "eval/run-eval.mjs에도 같은 문자열을 넣으세요. 안 그러면 채점 결과가 실제 앱 품질과 무관합니다.");
    } else {
      add("정상", "평가 도구 정합", `앱과 하네스가 같은 프롬프트를 사용(${shared.length}개 대조)`, "");
    }
  }
}

/* ── 검사 5-2. e2e 모의응답이 앱과 같은 표지로 콜1/콜2를 가르는가 ─────────
   실제 사고(2026-07-28): e2e 가 콜1 프롬프트의 "결론만" 이라는 문구로 콜1/콜2를 구분했는데,
   프롬프트를 다듬으며 그 문구가 사라지자 테스트가 콜1 자리에 콜2 응답을 물렸다.
   증상은 "판결이 화면에 안 뜸" 이었지만 원인은 앱이 아니라 테스트였다 — 진짜 회귀와 구분이 안 된다.
   그래서 표지 문자열이 앱에 실제로 존재하는지 검사한다. */
{
  const MARK = "[이미 확정된 판결]";
  const files = ["e2e/v29-check.mjs", "e2e/verdict.mjs", "e2e/webgl-check.mjs"].filter((f) => existsSync(f));
  const users = files.filter((f) => readFileSync(f, "utf8").includes(MARK));
  if (users.length && !src.includes(MARK)) {
    add("심각", "e2e 가 앱에 없는 표지로 콜1/콜2를 가름", `${users.join(", ")} 는 "${MARK}" 를 쓰는데 App.jsx 엔 없음`,
      "App.jsx 의 콜2 프롬프트에서 그 표지를 바꾼 것 같습니다. e2e 파일의 표지도 같이 바꾸세요. 안 그러면 테스트가 엉뚱한 응답을 물고 '판결이 안 뜬다'고 보고합니다.");
  } else if (users.length) {
    add("정상", "e2e 콜1/콜2 구분 표지", `${users.length}개 파일이 앱과 같은 표지 사용`, "");
  }

  /* 같은 사고의 두 번째 얼굴(2026-07-28, 병합 후 발견): 표지로 옮긴 건 complete 모의뿐이었고
     HTTP 경로 모의는 여전히 `max_tokens <= 400` 으로 갈랐다. 콜1 상한이 320→560으로 오르자
     콜1 자리에 콜2 응답이 물려 "폭포수 판결 실패"가 났다 — 앱은 멀쩡했다.
     토큰 상한은 품질 튜닝으로 수시로 바뀌는 값이므로, 분기 기준으로 쓰면 언제든 다시 깨진다. */
  const tokenSplit = [];
  for (const f of ["e2e/verdict.mjs", "e2e/v29-check.mjs", "e2e/webgl-check.mjs", "e2e/smoke.mjs"].filter(existsSync)) {
    const t = readFileSync(f, "utf8");
    const m = t.match(/max_tokens[^\n]{0,40}[<>]=?\s*(\d+)\s*\?/);
    if (m) tokenSplit.push(`${f} (${m[1]} 기준)`);
  }
  const mt1 = +(src.match(/callClaude\(system, \[\.\.\.priorConvo, concludeMsg\], (\d+)\)/) || [])[1];
  if (tokenSplit.length) {
    add("심각", "e2e 가 토큰 수로 콜1/콜2를 가름", `${tokenSplit.join(", ")} — 현재 앱의 콜1 상한은 ${mt1 || "?"}`,
      `토큰 상한은 품질을 다듬을 때마다 바뀝니다. 그 값으로 분기하면 상한이 바뀌는 날 테스트가 조용히 엉뚱한 응답을 물고 '판결이 안 뜬다'고 거짓 보고합니다. "${MARK}" 표지로 가르도록 바꾸세요.`);
  } else {
    add("정상", "e2e 분기 기준", "토큰 수가 아니라 표지로 콜1/콜2를 가름", "");
  }
}

/* ── 검사 6. 의존성 취약점 (npm audit) ───────────────────────────────────
   남이 만든 부품에서 보안 구멍이 발견되는 일은 우리가 코드를 안 건드려도 일어난다.
   중요한 구분: **사용자에게 배달되는 부품(prod)** 과 **내 컴퓨터에서만 쓰는 부품(dev)** 은
   위험의 크기가 다르다. 빌드 도구의 구멍은 사이트 방문자와 무관하다 — 겁줄 필요가 없다. */
{
  const audit = (extra) => {
    try {
      const out = execFileSync("npm", ["audit", "--json", ...extra],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 90000 });
      return JSON.parse(out).metadata.vulnerabilities;
    } catch (e) {
      // npm audit는 취약점이 있으면 종료코드가 0이 아니다 — 그래도 stdout에 결과가 들어있다.
      try { return JSON.parse(e.stdout || "").metadata.vulnerabilities; } catch { return null; }
    }
  };
  const prod = audit(["--omit=dev"]);
  if (!prod) {
    add("주의", "부품 보안 점검을 못 함", "인터넷에 연결되지 않았거나 npm 응답 없음",
      "인터넷이 되는 곳에서 다시 검진하세요. 오프라인에서는 이 검사만 건너뜁니다.");
  } else {
    const sev = prod.critical + prod.high;
    if (sev > 0) {
      add("심각", "사용자에게 배달되는 부품에 보안 구멍",
        `심각 ${prod.critical}건, 높음 ${prod.high}건`,
        "실제 사이트 방문자가 노출됩니다. AI에게 '취약한 의존성을 안전한 버전으로 올려달라'고 하세요.");
    } else if (prod.moderate + prod.low > 0) {
      add("주의", "배달되는 부품에 경미한 보안 구멍", `보통 ${prod.moderate}건, 낮음 ${prod.low}건`,
        "급하지 않습니다. 다음 정기 점검 때 함께 올리세요.");
    } else {
      add("정상", "부품 보안(사용자 도달분)", "구멍 없음", "");
    }
    const all = audit([]);
    if (all && (all.total - prod.total) > 0) {
      add("주의", "개발 도구 쪽 보안 구멍",
        `${all.total - prod.total}건 — 빌드에만 쓰이고 사이트에는 실리지 않음`,
        "방문자와는 무관합니다. 사이트가 위험한 게 아니니 서두르지 마세요. 도구를 올릴 때 회귀 위험이 있으니 검진·스모크를 함께 돌리세요.");
    }
  }
}

/* ── 검사 7. 비밀키가 사용자에게 배달되는 코드에 섞였는가 ─────────────────
   결제·로그인을 붙이면 가장 흔하고 가장 비싼 사고. 지금은 유출이 없지만,
   **없다는 사실을 계속 확인하는 것**이 이 검사의 목적이다(도입 후에 만들면 늦다). */
{
  // 어디서 나와도 사고인 것들. 남의 라이브러리 코드에 우연히 섞일 수 없는 모양만 고른다.
  const SECRET = [
    { name: "Anthropic 키", re: /sk-ant-[A-Za-z0-9_-]{8}/ },
    { name: "서버 전용 키(service_role)", re: /SUPABASE_SERVICE|SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
    { name: "결제 비밀키", re: /sk_live_[A-Za-z0-9]{8}|test_sk_[A-Za-z0-9]{12}|live_sk_[A-Za-z0-9]{12}/ },
  ];
  // 우리 코드에서만 보는 것 — 남의 번들에는 이런 모양이 흔해서 오경보가 난다.
  const OURS = [{ name: "API 키 하드코딩", re: /(api[_-]?key|apikey|secret)\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/i }];
  const targets = ["src/App.jsx"];
  if (existsSync("dist/assets")) {
    for (const f of readdirSync("dist/assets")) if (f.endsWith(".js")) targets.push(`dist/assets/${f}`);
  }
  const hits = [];
  for (const t of targets) {
    const body = readFileSync(t, "utf8");
    for (const s of SECRET) if (s.re.test(body)) hits.push(`${t}: ${s.name}`);
    if (t.startsWith("src/")) for (const s of OURS) if (s.re.test(body)) hits.push(`${t}: ${s.name}`);
  }
  if (hits.length) {
    add("심각", "비밀키가 사용자 브라우저로 전송됨", hits.join(", "),
      "브라우저에 실린 값은 누구나 볼 수 있습니다. 즉시 그 키를 폐기·재발급하고, 서버(api/) 환경변수로 옮기세요.");
  } else {
    add("정상", "비밀키 유출", `검사한 파일 ${targets.length}개 모두 깨끗함`, "");
  }

  /* 결제·로그인 도입 시에만 깨어나는 검사 — 지금은 잠들어 있다.
     "그때 가서 만들자"가 사고의 시작이라, 미리 심어 둔다. */
  const pkg = existsSync("package.json") ? readFileSync("package.json", "utf8") : "";
  // 의존성으로 들어왔을 때만 깨운다. 본문 문자열 검색은 오경보를 낸다
  // (예: 주역 척전의 `tosses`가 결제사 'toss'로 잡혔던 적이 있다).
  const dep = (re) => new RegExp(`"[^"]*${re}[^"]*"\\s*:`, "i").test(pkg);
  const hasDB = dep("supabase") || dep("firebase") || dep("prisma") || dep("mongodb") || dep("^pg$") || dep("drizzle");
  const hasPay = dep("tosspayments") || dep("iamport") || dep("portone") || dep("stripe")
    || /TossPayments\s*\(|IMP\.request_pay|PortOne\.|new Stripe\s*\(/.test(src);
  if (hasDB) {
    const srcAll = targets.map(t => readFileSync(t, "utf8")).join("\n");
    if (!/rls|row level security|policy/i.test(src) && !/auth\.uid\(\)/.test(src)) {
      add("심각", "데이터베이스를 붙였는데 접근 제한 흔적이 없음",
        "package.json에 DB 라이브러리가 있으나 코드에 행 수준 보안(RLS)·인증 검사가 보이지 않음",
        "브라우저에서 DB를 직접 부르는 구조라면, RLS를 켜지 않는 순간 남의 사주·질문이 전부 열립니다. 테이블마다 '본인 것만' 정책을 켜세요.");
    } else {
      add("정상", "DB 접근 제한", "RLS/인증 검사 흔적 있음", "");
    }
    if (/anon|public/i.test(srcAll) && /insert|update|delete/i.test(srcAll)) {
      add("주의", "익명 권한으로 쓰기가 가능한 구조일 수 있음", "클라이언트 코드에 쓰기 호출이 있음",
        "쓰기는 서버(api/)를 거치게 하는 편이 안전합니다.");
    }
  }
  if (hasPay) {
    const ok = /webhook|서버.*검증|verify/i.test(src) || existsSync("api/payment-webhook.js") || existsSync("api/confirm.js");
    add(ok ? "정상" : "심각", "결제 금액 서버 검증",
      ok ? "서버 검증 경로 있음" : "브라우저가 보낸 금액을 그대로 믿는 구조로 보임",
      ok ? "" : "금액을 브라우저에서 바꿔 100원으로 결제할 수 있습니다. 결제 승인은 반드시 서버에서 금액을 다시 확인해야 합니다.");
  }
}

/* ── 검사 8. 빌드 산출물 — 없으면 만든다 ────────────────────────────────
   "npm run build 를 실행하세요"라고 시키는 대신 그냥 한다. */
if (existsSync("dist/index.html")) {
  add("정상", "빌드 산출물", "dist/ 있음", "");
} else {
  try {
    execFileSync("npm", ["run", "build"], { stdio: "ignore", timeout: 180000 });
    add("정상", "빌드 산출물", "없어서 방금 새로 만들었음", "");
  } catch (_) {
    add("심각", "빌드 실패", "앱을 만들어내지 못했습니다",
      "코드에 문법 오류가 있을 가능성이 높습니다. AI에게 '빌드가 실패한다'고 알리세요.");
  }
}

/* ── 검사 9. (브라우저) 실제로 어떤 렌더러가 뜨는가 ──────────────────────
   가장 중요한 검사. 사고 이력: 사용자가 몇 시간 동안 실행되지도 않는 렌더러를 튜닝했고,
   앱이 아예 열리지 않는 사고(TDZ)를 빌드가 아니라 이 검사만 잡았다.
   미리보기 서버가 없으면 **직접 띄웠다가 끝나면 끈다.** */
let previewProc = null;
async function ensurePreview(base) {
  try { const r = await fetch(base); if (r.ok) return "이미 떠 있음"; } catch (_) { /* 아래에서 띄운다 */ }
  previewProc = spawn("npm", ["run", "preview"], { stdio: "ignore", detached: true });
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    try { const r = await fetch(base); if (r.ok) return "검진이 띄움"; } catch (_) { /* 아직 */ }
  }
  return null;
}
function stopPreview() {
  if (!previewProc) return;
  try { process.kill(-previewProc.pid, "SIGTERM"); } catch (_) { try { previewProc.kill(); } catch (_) {} }
  previewProc = null;
}

async function browserCheck() {
  const require = createRequire(import.meta.url);
  let pw; try { pw = require("playwright"); } catch { try { pw = require("/opt/node22/lib/node_modules/playwright"); } catch { return { noPw: true }; } }
  const base = process.env.BASE || "http://localhost:4173";
  if (!(await ensurePreview(base))) return null;
  // 브라우저 실행 실패로 검진 전체가 죽으면 안 된다 — 나머지 20여 개 검사 결과까지 같이 사라진다.
  //   (실제로 발생: playwright 를 업데이트하면 예전 브라우저 폴더와 어긋나 launch 가 예외를 던진다)
  //   CHROME_PATH 를 주면 그 브라우저로 검사한다(playwright 가 받아둔 브라우저와 어긋날 때의 탈출구).
  let b;
  const _exe = process.env.CHROME_PATH || undefined;
  try { b = await pw.chromium.launch({ executablePath: _exe, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }); }
  catch (e) { stopPreview(); return { launchErr: String(e?.message || e).split("\n")[0].slice(0, 120) }; }
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on("pageerror", e => errs.push(String(e).slice(0, 80)));
  let out = {};
  try {
    await p.goto(base, { timeout: 15000 });
    await p.waitForTimeout(2200);   // 배지가 실제 렌더러를 붙이는 데 1.2초 폴링이 걸린다
    out.badge = await p.locator(".verbadge").textContent().catch(() => null);
    out.shaders = await p.evaluate(() => {
      const c = document.createElement("canvas"); const gl = c.getContext("webgl");
      if (!gl) return { webgl: false };
      return { webgl: true, float: !!gl.getExtension("OES_texture_float"), vtf: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) };
    });
    out.errs = errs;
  } catch (e) { out.err = String(e).slice(0, 80); }
  await b.close();
  return out;
}

const bc = await browserCheck();
stopPreview();
if (bc?.noPw) {
  add("주의", "실제 화면 검사 건너뜀", "브라우저 검사 도구(playwright)가 설치돼 있지 않음",
    "이 컴퓨터에서 화면 검사를 하려면 AI에게 '검진용 브라우저 도구를 설치해줘'라고 하세요. 나머지 검사는 정상 수행됐습니다.");
} else if (bc?.launchErr) {
  add("주의", "실제 화면 검사 건너뜀 — 검사용 브라우저를 못 켰음", bc.launchErr,
    "'npx playwright install chromium' 을 한 번 실행하세요. 앱 문제가 아니라 검사 도구 문제이며, 나머지 검사 결과는 그대로 유효합니다.");
} else if (bc === null) {
  add("심각", "앱을 띄우지 못함", "미리보기 서버가 20초 안에 응답하지 않음",
    "빌드가 깨졌거나 4173 포트를 다른 프로그램이 쓰고 있습니다. AI에게 이 문장을 그대로 전하세요.");
} else if (bc.err) {
  add("심각", "앱이 열리지 않음", bc.err, "화면이 뜨기 전에 오류가 났습니다. AI에게 이 문장을 그대로 전하세요.");
} else {
  if (bc.errs?.length) add("심각", "화면에서 오류 발생", bc.errs.join(" / "), "이 오류는 사용자 화면에서도 납니다.");
  else add("정상", "화면 오류", "없음", "");
  // 배지는 `v98 · 고지 · gl` 형태 — 뒤가 실제 렌더러다. 첫 화면(생년월일 입력)에는
  // 수호신이 아직 없어 렌더러가 붙지 않는 게 정상이다.
  add("정상", "지금 보이는 버전", (bc.badge || "(배지 없음)") + (/·\s*(gl|sim|2d)\s*$/.test(bc.badge || "") ? "" : " (첫 화면이라 렌더러 미표시 — 정상)"), "");
}

/* ── 검사 10. 실제 서비스가 지금 살아 있는가 ─────────────────────────────
   여기까지의 검사는 전부 "내 컴퓨터"를 본다. 정작 사용자가 보는 건 배포된 사이트다.
   다만 이건 **검진할 때 그 순간**만 본다 — 새벽 3시에 죽으면 아무도 모른다.
   상시 감시는 §유지보수_규칙.md 의 가동 감시(UptimeRobot) 설정이 담당한다. */
{
  const LIVE = process.env.LIVE || "https://binari-sepia.vercel.app";
  try {
    const t0 = Date.now();
    const r = await fetch(LIVE, { signal: AbortSignal.timeout(12000) });
    const ms = Date.now() - t0;
    const html = await r.text();
    // 회사망·프록시 환경에서는 우리 사이트가 멀쩡해도 403/407이 돌아온다. 이걸 장애로 보고하면
    // 검진이 늑대소년이 된다 — 프록시 경유가 확실할 때는 '확인 못 함'으로 낮춘다.
    const proxied = !!(process.env.HTTPS_PROXY || process.env.https_proxy);
    if (!r.ok && proxied && [403, 405, 407, 502].includes(r.status)) {
      add("주의", "배포된 사이트 확인 못 함", `네트워크(프록시)가 막음 — HTTP ${r.status}`,
        "우리 사이트 문제가 아닐 가능성이 큽니다. 휴대폰으로 사이트를 한 번 열어 확인하세요.");
    } else if (!r.ok) {
      add("심각", "배포된 사이트가 오류를 냄", `${LIVE} → HTTP ${r.status}`,
        "지금 사용자가 앱을 못 씁니다. Vercel 대시보드에서 최근 배포를 이전 버전으로 되돌리세요(Deployments → 직전 배포 → Promote).");
    } else if (!/<div id="root"/.test(html)) {
      add("심각", "배포된 사이트가 빈 화면", "응답은 오는데 앱 뼈대가 없음",
        "빌드 산출물이 잘못 올라갔습니다. 다시 배포하세요.");
    } else {
      add("정상", "배포된 사이트", `응답 ${ms}ms`, "");
    }
  } catch (_) {
    add("주의", "배포된 사이트 확인 못 함", "인터넷에 연결되지 않았거나 응답 없음",
      "인터넷이 되는 곳에서 다시 검진하세요. 이 검사만 건너뜁니다.");
  }
}

/* ── 출력 ──────────────────────────────────────────────────────────── */
const bad = R.filter(r => r.level === "심각"), warn = R.filter(r => r.level === "주의"), ok = R.filter(r => r.level === "정상");
const line = "─".repeat(58);
console.log(`\n${line}\n  비나리 건강검진\n${line}`);
if (bad.length) {
  console.log(`\n■ 지금 고쳐야 할 것 (${bad.length}건)\n`);
  bad.forEach(r => console.log(`  ✗ ${r.title}\n     무엇이: ${r.detail}\n     어떻게: ${r.fix}\n`));
}
if (warn.length) {
  console.log(`\n■ 알아두면 좋은 것 (${warn.length}건)\n`);
  warn.forEach(r => console.log(`  △ ${r.title}\n     무엇이: ${r.detail}\n     어떻게: ${r.fix}\n`));
}
console.log(`\n■ 이상 없음 (${ok.length}건)`);
ok.forEach(r => console.log(`  ✓ ${r.title}${r.detail ? ` — ${r.detail}` : ""}`));
console.log(`\n${line}`);
console.log(bad.length ? `  결과: 문제 ${bad.length}건. 위 '어떻게'를 그대로 AI에게 전달하면 고칠 수 있습니다.`
  : warn.length ? `  결과: 당장 고칠 것은 없습니다. 주의 ${warn.length}건은 시간 날 때.`
  : `  결과: 모두 정상입니다.`);
console.log(`${line}\n`);
process.exit(bad.length ? 1 : 0);
