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
    { name: "희소성 통계 생성 금지", pat: /희소성 통계·비교 일화 생성 절대 금지/,
      fix: "'100명 중 1명' 류 지어낸 숫자를 막는 규칙입니다. 재물 확정 서술 완화와 한 몸입니다 — 이게 빠지면 완화가 거짓말 제조기가 됩니다." },
    { name: "명식 함수(십성·신살)", pat: /function sipseongDist\(/,
      fix: "상세 리포트와 프로필 주입의 재료입니다. 사라지면 v101 리포트가 통째로 빕니다." },
    /* 실제 사고(2026-08-02): GO 판결에서 반대 수(against)를 '찬성'이라고 표기해,
       7:1로 이긴 판결이 화면엔 "8개 중 1개 찬성"으로 찍혔다. 판결문과 표가 정반대로 읽히는 사고인데
       오류가 안 뜬다 — 유저가 스크린샷을 보내주기 전까지 아무도 몰랐다. */
    { name: "알(pip) 표기 = 지지 수", pat: /const pipLit = res \?/,
      fix: "against 는 '반대한 수'입니다. 그대로 켜면 강한 판결일수록 알이 적게 켜져 정반대로 읽힙니다. pipLit(=총합-반대)로 켜세요." },
    /* 실제 사고(2026-08-02): 판결 앞면이 "강석우, 8월 중순 넘겨서 내", 뒷면이 "…이 사람 결에 맞아, 강석우."
       한 카드에서 이름을 두 번 불렀다. 콜1과 콜2는 서로 다른 호출이라 둘 다 "결정적 순간에 이름을 부른다"를
       각자 성실히 지킨 결과다 — 프롬프트만으로는 콜2가 자기가 두 번째인 줄 알 방법이 없다. */
    { name: "이름은 한 판결에 한 번(규칙)", pat: /이름은 판결 한 건에 딱 한 번/,
      fix: "이름을 두 번 부르면 친밀함이 아니라 '외워 온 판매원' 화법이 됩니다. SYS 에 한 번 규칙을 되살리세요." },
    { name: "이름 중복을 앱이 세어 알림", pat: /const _nameUsed = /,
      fix: "규칙만으로는 못 막습니다. 콜2는 콜1이 이름을 불렀는지 모릅니다 — 앱이 verdict 를 훑어 세고 콜2에 알려줘야 합니다." },
    { name: "유저 3인칭 호칭 금지", pat: /유저를 3인칭으로 부르지 않는다/,
      fix: "'이 사람·그·본인'으로 부르면 수호신이 유저를 앞에 두고 남 얘기하듯 말하게 됩니다. 대화가 아니라 관전평이 됩니다." },
    { name: "풀네임 호명 금지", pat: /풀네임으로 부르지 않는다/,
      fix: "'강석우' 처럼 성까지 붙여 부르면 친밀감이 아니라 소환장이 됩니다. 성을 떼고 이름만 부르게 하세요." },
    /* 실제 사고(2026-08-02): 앞면 "손볼 데 다듬고 나가" / 뒷면 "손볼 데를 마저 다듬고 나가는 게 맞아".
       은유만 갈아 같은 말을 두 번 했다. 층이 셋인데 정보가 하나면 뒷면을 열 이유가 없다. */
    { name: "세 층은 서로 다른 것을 말한다", pat: /세 층은 서로 다른 것을 말한다/,
      fix: "verdict·subline·funLine 이 같은 결론을 반복하면 '왜 이렇게 봤어?'를 눌러도 새로 읽을 게 없습니다." },
    { name: "scope 계측", pat: /scope_level:/,
      fix: "S3 진입률·이탈률을 못 재면 스코프 설계가 맞는지 영영 알 수 없습니다. verdict_shown 의 scope_level/handoff_triggered 를 확인하세요." },
  ];
  for (const r of rules) {
    if (r.pat.test(src)) add("정상", `판결 품질 규칙 — ${r.name}`, "있음", "");
    else add("심각", `판결 품질 규칙 사라짐 — ${r.name}`, "코드에서 찾을 수 없음", r.fix);
  }
  /* tone(단호|격려|충고)은 프롬프트 제어값이다. 화면에 달면 앱이 스스로 "이건 격려였어"라고 고백하는 꼴이라,
     판결이 지표에서 나온 게 아니라 기분 맞춰 준 것처럼 읽힌다(실사고: 카드 헤더에 '· 격려'가 찍혀 나갔다). */
  if (/CAT_LABEL\[[^\]]*\][^<\n]*(res\.tone|sharedIn\.to)/.test(src)) {
    add("심각", "내부 톤 값이 화면에 노출", "카드 헤더가 tone(단호/격려/충고)을 렌더 중",
      "tone 은 프롬프트 제어값입니다. 헤더에서 {res.tone}·{sharedIn.to} 를 빼세요.");
  } else add("정상", "내부 톤 값 비노출", "카드 헤더에 tone 없음", "");

  /* 진입 화면 신뢰 라인은 유저에게 하는 '약속'이다 — 문장은 남았는데 근거가 바뀌면 그건 거짓말이 된다.
     그래서 문구만 보지 않고 ①만세력 문항 수가 실제와 같은지 ②질문 원문이 계측에 안 실리는지를 대조한다. */
  if (/자동검증 (\d+)문항을 통과한 엔진/.test(src)) {
    const claimed = +src.match(/자동검증 (\d+)문항을 통과한 엔진/)[1];
    let real = 0;
    try { real = (readFileSync("e2e/mansae-test.mjs", "utf8").match(/\bcheck\(/g) || []).length; } catch (_) {}
    if (real && claimed !== real) {
      add("심각", "신뢰 라인의 문항 수가 실제와 다름", `화면 표기 ${claimed}문항 vs 실제 ${real}문항`,
        "화면에 적은 숫자는 유저와의 약속입니다. App.jsx 의 문구를 실제 문항 수로 맞추거나, 검사가 세는 방식을 고치세요.");
    } else add("정상", "신뢰 라인 — 만세력 문항 수", `표기 ${claimed}문항 = 실제 ${real}문항`, "");
    // "질문 원문은 통계에 기록하지 않아요" — track() 에 q 원문이 실리면 그 줄이 그 순간 거짓 표시가 된다
    if (/track\([^)]*\{[^}]*\bq\b\s*[,:}]/.test(src)) {
      add("심각", "질문 원문이 계측에 실림", "화면엔 '질문 원문은 기록하지 않아요'라고 적혀 있음",
        "track() 에서 질문 원문을 빼고 qlen(글자수)만 보내세요. 지금 상태면 화면 문구가 거짓입니다.");
    } else add("정상", "신뢰 라인 — 질문 원문 미기록", "track() 에 q 원문 없음(qlen 만)", "");
  }

  // 티어 허용목록은 api/judge.js 에 있다 — 위 rules 루프는 App.jsx 만 보므로 여기서 따로 검사한다
  try {
    const api = readFileSync("api/judge.js", "utf8");
    if (/const TIERS = \{ free:/.test(api)) add("정상", "판결 품질 규칙 — 티어 허용목록(모델 강제 차단)", "있음", "");
    else add("심각", "티어를 허용목록으로 받지 않음", "api/judge.js 에서 TIERS 를 찾을 수 없음",
      "tier 를 허용 목록(free/paid)으로만 받으세요. 임의 모델 지정을 열어두면 클라이언트가 비싼 모델을 강제해 비용이 샙니다.");
  } catch (_) { /* 구조가 바뀌면 조용히 넘어간다 */ }
  /* 실사고(2026-08-02): 카드가 against(반대 수)를 '찬성'이라는 라벨로 표시 — "7개 중 1개 찬성".
     실제로는 6개 찬성이라, 가장 강한 GO가 화면에선 가장 약해 보였다. 숫자가 그럴듯해서 아무도 의심하지 않았다.
     라벨과 값이 다시 어긋나면 잡는다. */
  if (/\{res\.total\}개 중 \{res\.against\}개/.test(src) || /pip \$\{i < res\.against \?/.test(src)) {
    add("심각", "카드가 반대 수를 찬성처럼 표시", "표시부가 res.against(반대 표)를 그대로 렌더 중",
      "GO/STOP 판결의 표시 수는 total - against(판결을 민 표)여야 합니다. 실제로 '7개 중 1개 찬성' 사고가 났던 자리입니다.");
  } else if (/res\.total - res\.against/.test(src)) {
    add("정상", "판결 지지 수 표시", "카드가 판결을 민 표 수(total-against)를 표시", "");
  }
  // tone(단호|격려|충고)은 내부 제어값 — 화면에 노출되면 앱이 판결 포지션을 스스로 무른다(실사고: 헤더 '· 격려')
  if (/CAT_LABEL\[[^\]]*\][^<\n]*(res\.tone|sharedIn\.to)/.test(src)) {
    add("심각", "내부 톤 값이 화면에 노출", "카드 헤더가 tone(단호/격려/충고)을 렌더 중",
      "tone 은 프롬프트 제어값입니다. 헤더에서 {res.tone}·{sharedIn.to} 를 제거하세요.");
  } else {
    add("정상", "내부 톤 값 비노출", "카드 헤더에 tone 없음", "");
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

  // 콜2 상한(앱) vs 서버 클램프(judge.js) — 앱이 더 크면 서버가 잘라 근거가 조용히 사라진다
  try {
    const mt2 = +(src.match(/callClaude\(system, \[\.\.\.priorConvo, explainMsg\], (\d+)\)/) || [])[1];
    const api2 = readFileSync("api/judge.js", "utf8");
    const clamp = +(api2.match(/\|\| 320, 1\), (\d+)\)/) || [])[1];
    if (mt2 && clamp && mt2 > clamp) {
      add("심각", "서버가 근거 응답을 잘라냄", `콜2 상한 ${mt2} > 서버 클램프 ${clamp}`,
        "api/judge.js 의 max_tokens 클램프를 콜2 상한 이상으로 올리세요. 안 그러면 판결 근거가 중간에 끊깁니다.");
    } else if (mt2 && clamp) add("정상", "콜2/서버 클램프", `콜2 ${mt2} ≤ 클램프 ${clamp}`, "");
  } catch (_) { /* 구조가 바뀌면 조용히 넘어간다 */ }

  /* v105 콜3(서신) — 서버가 잘라내면 마지막 장('무엇을 걸고', 반증 조건이 있는 장)이 통째로 사라진다.
     그런데 화면엔 오류가 안 뜬다 — 네 장짜리 서신이 그냥 나올 뿐이다. 전형적인 조용한 고장이라 검사로 고정한다. */
  try {
    const mt3 = +(src.match(/const LETTER_MAXTOK = (\d+)/) || [])[1];
    const api3 = readFileSync("api/judge.js", "utf8");
    const clamp3 = +(api3.match(/\|\| 320, 1\), (\d+)\)/) || [])[1];
    if (mt3 && clamp3 && mt3 > clamp3) {
      add("심각", "서버가 서신을 잘라냄", `콜3 상한 ${mt3} > 서버 클램프 ${clamp3}`,
        "api/judge.js 의 max_tokens 클램프를 콜3 상한 이상으로 올리세요. 안 그러면 마지막 장이 조용히 사라집니다.");
    } else if (mt3 && clamp3) add("정상", "콜3(서신)/서버 클램프", `콜3 ${mt3} ≤ 클램프 ${clamp3}`, "");
    /* 서버 로그가 콜3을 콜2로 세면 티어별 비용을 못 가른다(무료 카드와 유료 서신이 한 통에 섞인다).
       실제 사고(2026-08-02): 토큰 상한으로 갈랐더니 v105.1에서 서신을 두 조각으로 쪼개며 상한이 2100까지
       내려가, 유료 서신이 call:2 로 찍혔다. 토큰은 언제든 또 내려간다 — tier 로 갈라야 안 흔들린다. */
    if (/call: tierKey === "paid" \? 3/.test(api3)) add("정상", "콜1/콜2/콜3 로그 구분", "콜3을 tier 로 가름", "");
    else add("주의", "서버 로그가 콜3을 콜2로 셈", "judge.js 의 call 분류가 tier 기준이 아님",
      "'call: tierKey === \"paid\" ? 3 : mt <= 800 ? 1 : 2' 로 바꾸세요. 토큰 상한으로 가르면 서신 길이가 바뀔 때마다 통계가 조용히 섞입니다.");
  } catch (_) { /* 구조가 바뀌면 조용히 넘어간다 */ }

  // v103: 속결 제거 — 잔재가 남으면 죽은 분기가 조용히 살아 있는 셈이다
  const quickLeft = ["looksQuick", "_quick", "QUICK_HINTS", "[판돈]"].filter((t) => src.includes(t));
  if (quickLeft.length) {
    add("주의", "속결(quick) 잔재가 남음", quickLeft.join(", "),
      "v103에서 제거한 기능입니다. 남은 참조를 지우세요 — 죽은 분기는 다음 사람이 살아 있는 줄 압니다.");
  } else add("정상", "속결 제거 완결", "quick 관련 잔재 없음", "");

  /* e2e 가 화면에 없는 버튼을 누르고 있는가 — 실제 사고(2026-07-30):
     속결 버튼을 지웠는데 verdict·v29·webgl 이 그 버튼을 클릭하고 있었다. 검진이 App.jsx 만 봐서 못 잡았고,
     테스트를 돌려야만 타임아웃으로 드러났다. 앱에 없는 버튼 이름을 클릭하는 e2e 를 여기서 잡는다. */
  try {
    const bad = [];
    for (const f of readdirSync("e2e").filter((f) => f.endsWith(".mjs"))) {
      const t = readFileSync(`e2e/${f}`, "utf8");
      for (const m of t.matchAll(/getByRole\("button",\s*\{\s*name:\s*"([^"]+)"\s*\}\)\.click\(\)/g)) {
        // 클릭하는 버튼은 App.jsx 안에 그 문구가 있어야 한다(없으면 화면에 없는 버튼을 누르는 것)
        if (!src.includes(m[1])) bad.push(`${f}: "${m[1]}"`);
      }
    }
    if (bad.length) {
      add("심각", "e2e 가 화면에 없는 버튼을 클릭", bad.join(" · "),
        "앱에서 지운 버튼을 테스트가 아직 누르고 있습니다. 해당 e2e 를 새 경로로 고치세요 — 안 고치면 테스트가 타임아웃으로만 알려줍니다.");
    } else add("정상", "e2e 버튼 문구 정합", "테스트가 누르는 버튼이 전부 앱에 존재", "");
  } catch (_) { /* 구조가 바뀌면 조용히 넘어간다 */ }

  /* v104 서신 대기 연출 — 화면 전체를 덮는 레이어라 '나가는 길'이 끊기면 유저가 갇힌다.
     되돌릴 버튼을 일부러 안 두었으므로, 타이머가 끝까지 도는 것이 유일한 탈출구다. 여기서 그 배선을 고정한다. */
  {
    const wired = [
      { name: "봉인 → 대기 전환", pat: /setTimeout\(\(\) => setLetterStage\("wait"\), LETTER_SEAL_MS\)/,
        fix: "봉인 단계에서 다음으로 넘어가지 못하면 유저가 전체화면 연출에 갇힙니다. 나가는 버튼이 없으므로 이 타이머가 유일한 출구입니다." },
      { name: "대기 → 로비 복귀", pat: /setLetterStage\(""\); setLetterSent\(true\); resetToLobby\(\)/,
        fix: "연출이 끝나면 반드시 로비로 돌아가야 합니다. 이 줄이 없으면 7초 뒤에도 화면이 그대로 덮여 있습니다." },
      { name: "로비 수호신 한마디", pat: /const LETTER_LOBBY_LINE =/,
        fix: "서신을 맡기고 돌아온 자리에서 수호신이 건네는 말입니다. 이게 없으면 결제 뒤 화면이 그냥 처음으로 되돌아간 것처럼 보입니다." },
      { name: "추가 질문 유도 문구", pat: /const LETTER_NUDGE_LINE =/,
        fix: "서신을 기다리는 동안 한 번 더 묻게 하는 말입니다. after_letter 계측과 한 몸입니다." },
      { name: "서신 후 재질문 계측", pat: /after_letter: letterSent/,
        fix: "서신을 맡긴 사람이 실제로 한 번 더 묻는지를 재는 값입니다. 없으면 유도 문구가 먹히는지 영영 알 수 없습니다." },
      { name: "S3(몸·병)에는 서신을 팔지 않음", pat: /const letterOk = !!res && res\.scope !== "S3" && scopeHint\(q\) !== "S3"/,
        fix: "S3에서 우리가 하는 일은 판단을 넘기는 것입니다. 넘긴 판단에 돈을 받으면 그건 판매가 아닙니다. 모델·규칙 중 하나라도 S3면 버튼을 숨기세요." },
      { name: "미리보기는 실제 명식에서 생성", pat: /function letterPreview\(saju, hesit\)/,
        fix: "미리보기에 자기 것이 아닌 일간이 찍히면 그 한 줄에서 신뢰가 끝납니다. saju.dayGan 에서 뽑아 쓰세요." },
      /* v105 콜3 — 서신 본문. 여기서 제일 무서운 고장은 '서신이 판결을 다시 판정하는 것'이다.
         카드는 GO 인데 서신이 STOP 이면 환불 사유가 아니라 신뢰 종료다. 그 규칙을 코드에 붙잡아 둔다. */
      { name: "서신 재판정 금지 규칙", pat: /\[확정된 판결 — 다시 판정하지 않는다\]/,
        fix: "서신은 재판이 아니라 집행 계획서입니다. 이 블록이 빠지면 카드와 서신이 반대 결론을 낼 수 있습니다." },
      { name: "서신 분업 규칙(언제·누구와)", pat: /서신은 \*\*'언제 · 누구와 · 무엇을 걸고'\*\*에 답한다/,
        fix: "무료 카드와 유료 서신을 가르는 단 하나의 규칙입니다. 없으면 서신이 카드를 길게 늘여 쓴 물건이 됩니다." },
      { name: "서신 반증 조건 요구", pat: /반증 조건.*이 판결을 뒤집어라/,
        fix: "자기가 틀릴 조건을 적는 것이 이 서신의 차별점입니다. 지우면 흔한 운세 리포트가 됩니다." },
      { name: "서신 금지선(지어낸 숫자·겁주기)", pat: /겁을 준 뒤 해결책을 파는 구조/,
        fix: "겁주기→부적 판매는 이 업계의 기본 수법이고, 우리가 하지 않기로 한 것입니다." },
      { name: "서신은 유료 모델로", pat: /LETTER_TOK\[i\], "paid"\)/,
        fix: "tier 를 안 보내면 무료 모델로 4,900원짜리를 씁니다. paid 를 명시하세요." },
      { name: "서신 재료 스냅샷", pat: /letterCtxRef\.current = \{ system, userText \}/,
        fix: "판결 시점의 재료를 잡아두지 않으면, 서신을 쓸 때 바뀐 상태가 섞여 카드와 서신이 어긋납니다." },
      { name: "반쪽 서신 차단", pat: /if \(doc\.chapters\.length < 3\) throw/,
        fix: "응답이 잘려 두 장짜리 서신이 나오면 실패로 처리해야 합니다. 반쪽을 파느니 못 썼다고 말하는 게 낫습니다." },
      /* 실제 사고(2026-08-01 04:19): 서버는 200·1,600토큰으로 잘 돌아왔는데 유저에겐 아무것도 안 왔다.
         원인 둘 — ①클라이언트가 chapters[].t/.body 라는 정확한 키만 받아서 0장 처리 ②한 방에 다섯 장을 쓰느라 29.7초.
         둘 다 화면엔 오류가 안 뜬다. 아래 셋이 그 재발을 막는다. */
      { name: "서신 키 이름 관대하게 받기", pat: /function normChapters\(json\)/,
        fix: "모델이 title/text 로 써도 서신이 살아야 합니다. 정확한 키만 받으면 4,900원짜리가 키 이름 하나로 죽습니다." },
      { name: "서신 병렬 분할", pat: /const LETTER_PARTS = \[\[0, 1\], \[2, 3, 4\]\]/,
        fix: "다섯 장을 한 번에 쓰면 실측 29.7초입니다. 두 조각을 동시에 불러 기다림을 절반으로 줄이세요." },
      { name: "서신 쓰는 중 표시", pat: /수호신이 서신을 쓰고 있어/,
        fix: "20초를 정지 화면으로 두면 사람이 먼저 떠납니다. 실제로 그렇게 한 건을 잃었습니다." },
      { name: "서신 실패 진단 정보", pat: /const letterShape = \(json, txt\)/,
        fix: "실패했을 때 '어떤 키로 왔나'가 없으면 원인을 못 짚고 서버 로그부터 뒤져야 합니다. 본문은 담지 말고 키 이름만 남기세요." },
      /* v105.2 — 유료 물건의 최소 조건: 산 사람은 언제든 다시 받는다.
         localStorage 는 iOS 에서 7일이면 비워질 수 있는 그릇이다. 본문 하나만 믿으면
         "돈은 냈는데 아무것도 없다"가 조용히 만들어진다. 그 상태를 코드가 못 만들게 고정한다. */
      { name: "영수증을 본문보다 먼저 남김", pat: /nx\[nx\.length - 1\] = \{ \.\.\.nx\[nx\.length - 1\], paid: LETTER_PRICE, lmat: _mat \}/,
        fix: "본문 생성 전에 paid·lmat 를 기록해야 합니다. 생성이 실패하거나 앱이 닫혀도 '값을 치렀다'가 남아야 다시 써 줄 수 있습니다." },
      { name: "서신 재발행", pat: /const reissueLetter = async \(i\)/,
        fix: "산 사람이 서신을 잃었을 때 되살리는 유일한 경로입니다. 값은 다시 받지 않습니다." },
      { name: "최초 발행과 재발행이 같은 함수", pat: /const runLetter = async \(mat\)/,
        fix: "발행 경로가 두 벌로 갈리면 재발행본만 조용히 규칙이 낡습니다. runLetter 하나를 양쪽이 쓰게 하세요." },
      { name: "서신함은 영수증 기준", pat: /filter\(\(\{ r \}\) => r\.paid \|\| r\.letter\)/,
        fix: "본문(letter) 기준으로 목록을 만들면 잃어버린 서신이 목록에서 통째로 사라집니다. paid 를 기준으로 잡으세요." },
      { name: "서신 번호", pat: /function letterNo\(rec\)/,
        fix: "유료 물건에는 번호가 있어야 합니다. 고객이 불러 줄 수 있어야 '그 서신'을 특정할 수 있습니다." },
      { name: "서신 파일 백업", pat: /const saveLetterFile = \(\)/,
        fix: "기기 저장소 하나에만 유료 물건을 맡기면 안 됩니다. 유저가 영구히 갖는 사본을 주세요." },
    ];
    for (const w of wired) {
      if (w.pat.test(src)) add("정상", `서신 대기 연출 — ${w.name}`, "있음", "");
      else add("심각", `서신 대기 연출 끊김 — ${w.name}`, "코드에서 찾을 수 없음", w.fix);
    }
    // 연출 길이는 '기획된 값'이다. 리팩터링으로 0 이 되거나 분 단위로 늘어나는 사고를 막는다.
    const seal = +(src.match(/const LETTER_SEAL_MS = (\d+)/) || [])[1];
    const wait = +(src.match(/const LETTER_WAIT_MS = (\d+)/) || [])[1];
    if (seal && wait && seal + wait <= 12000) add("정상", "서신 대기 시간", `봉인 ${seal / 1000}초 + 대기 ${wait / 1000}초`, "");
    else add("주의", "서신 대기 시간이 기획 범위를 벗어남", `봉인 ${seal / 1000}초 + 대기 ${wait / 1000}초`,
      "합계 12초를 넘으면 기다림이 아니라 멈춘 화면으로 읽힙니다. 5초 + 2초가 기준값입니다.");
    /* 목차는 fake door 가 재는 '약속' 그 자체다. 여기가 조용히 줄면 클릭률이 다른 물건을 잰 값이 된다.
       특히 3장(언제)·4장(누구)이 무료 카드와 서신을 가르는 지점이라, 이 둘의 존재를 이름으로 고정한다. */
    const secs = (src.match(/const LETTER_SECTIONS = \[([^\]]*)\]/) || [])[1] || "";
    const n = (secs.match(/"/g) || []).length / 2;
    const 언제 = /언제/.test(secs), 누구 = /누구/.test(secs);
    if (n === 5 && 언제 && 누구) add("정상", "서신 목차", `${n}장 · '언제'와 '누구' 포함`, "");
    else add("주의", "서신 목차가 약속과 어긋남", `${n}장 · 언제 ${언제 ? "있음" : "없음"} · 누구 ${누구 ? "있음" : "없음"}`,
      "목차는 fake door 가 재는 약속입니다. 5장 구조와 '언제(시기)'·'누구(사람)' 장이 유료의 핵심이니 이름째로 유지하세요.");
  }

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
    { name: "되물음 태그", tag: "[되물음] 유저가 방금 판결" },
    { name: "콜1 scope 필드", tag: '"scope":"S1|S2|S3"' },
    { name: "콜1 votes 필드", tag: '"votes":[{"axis":"지표명","v":"GO|STOP|중립"}]' },
    { name: "잘림 복구(repairJSON)", tag: "function repairJSON(" },
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

/* ── 검사 4-3. 결제가 붙는 날 깨어나는 검사 — tier 서버 검증 ─────────────
   지금 tier("free"|"paid")는 클라이언트 말을 그대로 믿는다. 결제가 없어 무해하지만,
   결제 라이브러리가 들어오는 순간 "누구나 paid 를 보내 비싼 모델을 무료로 쓰는" 구멍이 된다.
   package.json 에 결제가 들어오면 자동으로 켜진다(검사 6·7·10과 같은 방식). */
{
  try {
    const pkg = readFileSync("package.json", "utf8");
    const payWired = /toss|portone|iamport|stripe|paypal/i.test(pkg);
    const api = readFileSync("api/judge.js", "utf8");
    const verified = /tier[\s\S]{0,400}(영수증|receipt|verify|검증)/.test(api) && !/클라이언트 말을 그대로 믿는다/.test(api);
    if (payWired && !verified) {
      add("심각", "결제가 붙었는데 유료 티어를 클라이언트 말만 믿음", "api/judge.js 의 tier 가 서버 검증 없이 통과됨",
        "결제 영수증·토큰으로 tier='paid' 를 서버에서 검증하세요. 지금 상태면 누구나 유료 모델을 무료로 씁니다.");
    } else if (payWired) {
      add("정상", "유료 티어 서버 검증", "결제 연동 + tier 검증 있음", "");
    } else {
      add("정상", "유료 티어(대기)", "결제 미연동 — tier 는 아직 클라이언트 신뢰로 충분. 결제 붙는 날 이 검사가 깨어남", "");
    }
  } catch (_) { /* 구조가 바뀌면 조용히 넘어간다 */ }
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

/* ── 검사 5-b. 알 권리(헌장 2026-08-06) ─────────────────────────────────
   사고 #7 (2026-08-06): 리포트가 세 겹으로 숨어 있었다.
   ① 상세 리포트가 기본 접힘 ② 본문이 170px 스크롤 상자 ③ 사주 여덟 글자·오행 개수는
   온보딩 연출에만 있어서, 재방문하면(온보딩 생략) 유저가 자기 사주를 두 번 다시 못 봤다.
   실측 지적 2건이 같은 증상이었다 — "4,900원 답변이 중복됨"·"카드 뒷면을 안 알려줘서 몰랐다".
   헌장은 '모를 권리'를 판결 국면으로 좁히고 리포트에는 '알 권리'를 세웠다. 되돌아가는 걸 막는다. */
{
  const openDefault = /function MyeongsikReportBody[\s\S]{0,400}?useState\(true\)/.test(src);
  add(openDefault ? "정상" : "심각", openDefault ? "알 권리 — 상세 리포트 기본 펼침" : "알 권리 위반 — 상세 리포트가 다시 접힘",
    openDefault ? "useState(true)" : "MyeongsikReportBody 의 open 기본값이 false 입니다",
    "리포트는 유저가 이미 값을 치르고 당긴 문서입니다. 접어두면 값어치 은닉입니다 — CLAUDE.md 설계 헌장 '알 권리'.");

  const capped = /\.msrbody\{[^}]*max-height/.test(src);
  add(capped ? "심각" : "정상", capped ? "알 권리 위반 — 리포트 본문에 높이 상한" : "알 권리 — 리포트 본문 높이 제한 없음",
    capped ? ".msrbody 에 max-height 가 다시 붙었습니다" : "스크롤은 .vscroll 하나가 맡음",
    "본문을 작은 상자에 가두면 한 번에 몇 줄만 보입니다. 스크롤은 뒷면 전체(.vscroll)가 맡아야 합니다.");

  /* 뒷면이 카드 높이를 정하면 앞면 판결 아래가 텅 빈다(실측 1681px). 레이아웃 회귀는 눈으로만 잡힌다 */
  const backAbs = /\.vface\.back\{[^}]*position:absolute/.test(src);
  const rowCap = /\.vcard\{[^}]*grid-template-rows:minmax\(0,1fr\)/.test(src);
  add(backAbs && rowCap ? "정상" : "심각",
    backAbs && rowCap ? "카드 높이 — 앞면이 정함(뒷면 문서가 늘려도 안 자람)" : "카드 높이를 뒷면 문서가 정함",
    backAbs && rowCap ? ".vface.back absolute + .vcard grid-template-rows 고정" : `back-absolute=${backAbs} row-cap=${rowCap}`,
    "뒷면이 카드 크기 산정에 끼면 리포트가 길어질수록 카드가 자라고, 앞면 판결문 아래가 텅 빕니다(실측 1681px).");

  /* 여덟 글자 원판이 리포트에 있는지 — 온보딩 연출에만 있으면 재방문 유저는 영영 못 본다 */
  const hasWonpan = /각인 — 태어난 순간에 박힌 여덟 자리/.test(src) && /너 자신 \{saju\.dayGan\}/.test(src);
  add(hasWonpan ? "정상" : "심각", hasWonpan ? "리포트에 여덟 자리 원판(글자·너 자신·기운 개수)" : "리포트에 여덟 자리 원판 없음",
    hasWonpan ? "있음" : "태어난 여덟 글자가 온보딩 연출에만 있으면 재방문 유저는 다시 못 봅니다",
    "모든 판단의 뿌리입니다. 리포트 첫 절에 있어야 합니다.");
}

/* ── 검사 5-c. 용어 은닉 (창업자 지시 2026-08-12: "어떤 분석 기법이 들어갔는지 안 나왔으면 좋겠어") ─
   용어 자체는 공개 지식이지만, 그대로 쓰면 **어떤 기법을 어떤 표에 매핑했는지**가 한 화면에 통째로 읽힌다.
   화면 쪽은 report-check 이 실물로 잡는다. 여기서는 **모델에게 보내는 지시서**를 지킨다 —
   프로필에는 용어가 그대로 실려 있어서(모델의 추론 품질을 위해), 출력 금지 규칙이 빠지면 서신이 그걸 받아쓴다. */
{
  const hasBan = /\[용어 금지 —/.test(src);
  const hasMap = /비견=나란히 서는 힘/.test(src) && /신강=제 힘으로 미는 쪽/.test(src);
  const hasNote = /용어를 본문에 그대로 쓰지 마라/.test(src);
  const ok = hasBan && hasMap && hasNote;
  add(ok ? "정상" : "심각", ok ? "용어 은닉 — 서신 지시서에 출력 금지 규칙" : "용어 은닉 규칙이 빠짐",
    ok ? "[용어 금지] 절 + 바꿔 쓰는 말 표 + 프로필 주의문" : `금지절=${hasBan} 대응표=${hasMap} 프로필주의=${hasNote}`,
    "프로필에는 명리 용어가 그대로 실려 갑니다(모델이 추론해야 하니까). 출력 금지 규칙이 없으면 서신이 그 용어를 그대로 받아써서, 우리가 무슨 기법을 어떻게 조합했는지가 유료 문서에 통째로 실립니다.");

  /* 화면 쪽 최후 방어 — 리포트 렌더 구간에 용어가 상수로 박혀 있으면 잡는다 */
  const bodyStart = src.indexOf("function MyeongsikReportBody");
  const bodyEnd = src.indexOf("const ganjiIdx");
  /* 주석은 걷어내고 본다 — 주석에 적힌 '명식에서'는 유저가 볼 수 없는 글인데, 안 걷으면 이 검사가 헛울음을 운다(실측) */
  const view = (bodyStart > 0 && bodyEnd > bodyStart ? src.slice(bodyStart, bodyEnd) : "")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const leak = ["\"십성", "일간)", "명식에", "(비겁)", "(인성)", "진태양시로", "태양황경"].filter((w) => view.includes(w));
  add(leak.length ? "심각" : "정상", leak.length ? "리포트 화면에 기법 용어가 되돌아옴" : "리포트 화면 — 기법 용어 없음",
    leak.length ? leak.join(", ") : "렌더 구간 깨끗",
    "화면에 나가는 이름은 평범한 말이어야 합니다(SS_KO·EL_KO·GRP_KO·SIN_KO·STR_KO). 실물 검사는 e2e/report-check.mjs 가 합니다.");
}

/* ── 검사 5-d. 검증 가능한 사실을 지어내지 않는가 ─────────────────────────
   (실사용 제보 2026-08-14: "팩트랑 다른 게 너무 많다. 나 키 178이고, 와이프는 170이야")
   v115 의 각인은 일간·상승궁을 **cm 로 환산하는 표**를 갖고 있었다. 그 표는 어느 유파에도 없고
   우리가 지어낸 것이었다. 문제는 지어냈다는 것보다 **유저가 정답을 아는 값을 지어냈다는 것**이다 —
   맞혀도 소득이 없고 틀리면 나머지 서른 칸까지 같이 죽는다. 비대칭이 너무 크다.
   규칙: 키·나이 같은 **본인이 아는 값은 입력으로 받아서 해석**하고, 명식에서 뽑지 않는다.
   이 검사는 그 표가 되살아나는 순간 운다. */
{
  const imp = readFileSync("src/lib/imprint.js", "utf8");
  const revived = /const\s+H_(EL|ASC)\s*=/.test(imp);              // cm 환산표 부활
  const takesInput = /heightCm/.test(imp) && /H_BASE/.test(imp);   // 받아서 해석하는 경로 생존
  const wedMode = /mateMode\s*=\s*"wed"/.test(imp);                // 기혼자에게 외모 예언 안 함
  const ok = !revived && takesInput && wedMode;
  add(ok ? "정상" : "심각",
    ok ? "지어낸 사실 — 키는 받아서 해석(명식에서 안 뽑음)" : "각인이 검증 가능한 값을 다시 지어냄",
    ok ? "H_EL/H_ASC 없음 · heightCm 입력 경로 있음 · 기혼 분기 있음"
       : `cm환산표부활=${revived} 입력경로=${takesInput} 기혼분기=${wedMode}`,
    "유저가 정답을 아는 값(키·배우자 외모·결혼 시기)을 맞히려 들면, 한 줄 틀릴 때마다 9,900원짜리 문서 전체의 신뢰가 같이 무너집니다. 그런 값은 물어서 받고, 해석만 우리가 합니다.");
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
