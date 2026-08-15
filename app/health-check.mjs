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
    /* 실사용 지적(2026-08-15): "밤 늦게 '지금 잘까 더 일할까' 물으면 반드시 '지금은 자'가 나온다."
       원인은 SYS 가 심야에 **충동 보정을 가하라**고 시킨 것이었다. 그런데 지표는 전부 생년월일과
       날짜의 함수라 **물어본 시각에 따라 변하는 축이 하나도 없다** — 시각으로 방향이 갈리면
       그건 정의상 표에서 나온 판결이 아니다(표를 센 뒤 시계로 결론을 갈아끼운 것).
       규칙은 B형에만 걸라고 썼는데 실제로 샜다: 심야 STOP 4건 중 B 1건 · A 2건 · C 1건. */
    { name: "시각이 판결 방향을 못 바꾼다", pat: /시각은 방향\(direction\)을 바꾸지 못한다/,
      fix: "심야에 방향을 뒤집으면 '표에서 나온 판결'이라는 우리 주장 자체가 거짓이 됩니다. 시각은 말투와 '언제'에만 반영하세요." },
    /* v132.3 — 판결을 지표 밖에서 미는 규칙을 전부 걷어냈다(창업자 지시 "보정 싹 다 없애고 순수하게 운세로").
       ①심야 충동 보정 ②경험 편향(동률·1차이면 해보는 쪽) — 둘 다 지표가 아니라 인생관·상식이었다.
       실측상 바뀌는 판결은 없었다(60일 77건 중 동률 0건 · dir_overridden 0건) — 원칙을 바로잡은 것이다.
       ⚠ 가드레일(자해·가해)과 S3(몸·병) 넘김은 **보정이 아니라 안전장치**라 그대로 둔다. */
    { name: "경험 편향이 되살아나지 않음", pat: /## 경험 편향/, want: false,
      fix: "'동률이면 해보는 쪽'은 지표가 아니라 인생관입니다. 표가 반반이면 반반이라고 말하세요." },
    { name: "동률을 GO로 밀지 않음", pat: /go === stop \? "GO"/, want: false,
      fix: "'동률이면 해보는 쪽'은 지표가 아니라 인생관입니다. 표가 다수를 못 만들면 앱이 방향을 만들지 마세요." },
    /* 그렇다고 동률을 HOLD 로 바꾸면 **판결앱이 판결을 안 하는 것**이 된다(창업자 지적).
       SYS 도 같은 말을 한다 — "표가 갈렸다는 이유로 HOLD 를 고르지 마라". HOLD 는 '멈추라'는 판결이지 '모르겠다'가 아니다. */
    { name: "동률을 모름(HOLD)으로 바꾸지 않음", pat: /go === stop \? "HOLD"/, want: false,
      fix: "갈림을 모름으로 바꾸면 유저에겐 회피로 읽힙니다. 표가 다수를 못 만들면 모델이 읽은 방향을 그대로 두세요." },
    /* 규칙만 지우고 재료를 남기면 아무것도 안 고쳐진다(2026-08-15 실측: 심야 보정 규칙을 지운 뒤에도
       "자라"가 계속 나왔다 — 시각이 여전히 프롬프트에 들어가고 있었다). 재료 쪽을 검사한다. */
    /* 시각은 **주되 지표 모양으로** 준다. "1시"(시계)를 주면 모델이 상식으로 읽고("1시니까 자라"),
       "축시(토)"(시진)를 주면 다른 축과 같은 자리에서 읽는다. 규칙이 아니라 재료의 모양이 결정한다 —
       '지표 정박' 규칙이 이미 있었는데도 시계를 주는 동안은 뚫렸다(2026-08-15 실측). */
    { name: "시각을 시계로 안 보냄", pat: /\$\{_nd\.getHours\(\)\}시/, want: false,
      fix: "생시각(\"N시\")을 주면 모델이 시계로 판단합니다. 시진(JI[_hj])으로 바꿔 지표 모양으로 주세요." },
    { name: "시각을 시진 지표로 보냄", pat: /지금 시진 \$\{_sijin\}/,
      fix: "택일·시진 질문엔 시각이 필요합니다. 빼지 말고 시진(축시·토)으로 주세요." },
    { name: "일반 상식 답변 금지(시각)", pat: /일반 상식으로 답하지 마라 — 이게 이 앱이 존재하는 이유다/,
      fix: "'새벽이니까 자' 류를 막는 규칙입니다. 누구나 할 수 있는 말을 하면 이 앱을 쓸 이유가 없습니다." },
    /* 유료 서신이 무료 리포트보다 험하면 안 된다. 무료 명식 리포트는 부딪히는 띠를 이미
       "미워하란 게 아니라, 큰돈·보증만 조심하란 뜻이야"로 쓰는데, 값을 받는 서신 4장에는
       그 완화가 없었다(2026-08-15). 사람을 배제하는 말은 우리가 팔 물건이 아니다. */
    { name: "서신 — 부딪히는 띠를 쓸모로 쓴다", pat: /부딪히는 띠는 반드시 '쓸모'로 쓴다/,
      fix: "무료 리포트엔 완화 문구가 있는데 유료 서신에만 없으면, 돈 받고 더 험한 말을 파는 셈입니다." },
    { name: "scope 계측", pat: /scope_level:/,
      fix: "S3 진입률·이탈률을 못 재면 스코프 설계가 맞는지 영영 알 수 없습니다. verdict_shown 의 scope_level/handoff_triggered 를 확인하세요." },
  ];
  for (const r of rules) {
    const found = r.pat.test(src);
    /* want:false 인 항목은 **없어야** 정상이다 — 걷어낸 규칙이 되살아나는 것을 잡는다.
       '있어야 할 것'만 검사하면 지운 게 슬그머니 돌아와도 아무도 모른다. */
    if (r.want === false) {
      if (found) add("심각", `걷어낸 규칙이 되살아남 — ${r.name}`, "코드에서 다시 발견됨", r.fix);
      else add("정상", `판결 품질 규칙 — ${r.name}`, "없음(의도대로)", "");
    } else if (found) add("정상", `판결 품질 규칙 — ${r.name}`, "있음", "");
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
    const shareInUrl = /encodeShare\(/.test(src) && /\?v=\$\{|[?&]v=/.test(src);
    if (shareInUrl && !/sanitize_properties/.test(src)) {
      add("심각", "질문 원문이 계측에 실림($current_url)", "공유 페이로드가 URL 에 있는데 SDK URL 정화가 없음",
        "posthog.init 에 sanitize_properties 를 넣어 $current_url·$referrer 의 v= 값을 지우세요. 실제로 22건이 이 경로로 샜습니다.");
    } else if (shareInUrl) add("정상", "신뢰 라인 — 질문 원문 미기록($current_url)", "SDK URL 정화 있음", "");
    // 주소창에 남은 페이로드는 브라우저 기록·리퍼러·스크린샷으로 계속 샌다 — 읽은 즉시 지워야 한다
    if (shareInUrl && !/history\.replaceState\(null, "", stripSharePayload/.test(src)) {
      add("주의", "공유 페이로드가 주소창에 남음", "읽은 뒤에도 ?v= 가 URL 에 그대로 있음",
        "decodeShare 직후 history.replaceState 로 페이로드를 지우세요. 계측만 막으면 브라우저 기록·리퍼러로는 계속 샙니다.");
    } else if (shareInUrl) add("정상", "공유 페이로드 주소창 정리", "읽은 즉시 URL 에서 제거", "");
  }

  /* ── 기억이 조용히 리셋되는 사고 ─────────────────────────────────────────
     두 번 났다. v114에서 MBTI 문항을, v128에서 가치여정을 없앴는데, 그때마다
     saveMemory 조건과 loadMemory 필수 조각에 '이제 안 받는 값'이 남아 있었다.
     결과는 화면에 오류 하나 없이 ①새 유저는 저장해도 로드에서 튕겨 매번 온보딩을 다시 하고
     ②기존 유저는 다음 저장 때 그 값이 빠지면서 통째로 리셋된다.
     그래서 두 곳이 **같은 조각 목록**을 쓰는지 대조한다. */
  try {
    const saveGate = (src.match(/if \(step === 3 && ([^)]+)\) \{\s*\n\s*saveMemory\(/) || [])[1] || "";
    const loadGate = (src.match(/if \(!\(m && ([^)]+)\)\) return null;/) || [])[1] || "";
    const norm = (t) => t.replace(/m\./g, "").split("&&").map((x) => x.trim()).filter(Boolean).sort().join(",");
    if (saveGate && loadGate && norm(saveGate) !== norm(loadGate)) {
      add("심각", "기억 저장·로드 조건이 어긋남", `저장 [${norm(saveGate)}] vs 로드 [${norm(loadGate)}]`,
        "두 조건은 같은 조각을 요구해야 합니다. 어긋나면 오류 없이 기억이 리셋됩니다 — 저장은 됐는데 로드가 튕기거나, 그 반대입니다.");
    } else if (saveGate && loadGate) add("정상", "기억 저장·로드 조건 일치", `둘 다 [${norm(saveGate)}]`, "");
    // 안 받는 값을 조건에 남기면 그게 곧 위 사고다 — 이름째로 막아 둔다
    const dead = ["core", "mbti", "vals8", "vals4"].filter((k) => new RegExp(`\\b${k}\\b`).test(saveGate + loadGate));
    if (dead.length) add("심각", "이제 안 받는 값이 기억 조건에 남음", dead.join(", "),
      "묻지 않는 값은 새 유저에게 항상 null 입니다. 조건에서 빼세요. 안 그러면 새 유저의 기억이 저장·복원되지 않습니다.");
  } catch (_) { /* 구조가 바뀌면 조용히 넘어간다 */ }

  /* v128 제거분이 되살아나지 않는지 — 프롬프트 축과 앱 집계 축은 짝이라 한쪽만 남으면 표가 어긋난다 */
  {
    const axInPrompt = /"axis":"[^"]*\|가치\|/.test(src) || /votes엔[^`]*·가치/.test(src);
    const axInCode = /VOTE_AX = new Set\(\[[^\]]*"가치"/.test(src);
    if (axInPrompt || axInCode) {
      add("심각", "제거한 '가치' 축이 남아 있음", `프롬프트 ${axInPrompt ? "있음" : "없음"} · 집계 ${axInCode ? "있음" : "없음"}`,
        "v128에서 가치여정을 없앴습니다. 스키마와 VOTE_AX 양쪽에서 '가치'를 빼세요 — 한쪽만 남으면 모델이 낸 표가 집계에서 걸러져 총합이 어긋납니다.");
    } else add("정상", "가치 축 제거 정합", "프롬프트·집계 양쪽에서 빠짐", "");
    if (/\bmbti\b\s*:/.test(src) || /VALUES16/.test(src)) {
      add("주의", "제거한 MBTI·가치 잔재", "계측 속성 또는 가치 목록 상수가 남음",
        "묻지 않는 값을 계속 계측하면 분석에서 항상 null 인 열이 생깁니다. 상수도 쓰이지 않으면 지우세요.");
    } else add("정상", "MBTI·가치 잔재 없음", "계측 속성·상수 모두 정리됨", "");
    /* v128.1: 저장해 둔 질감 코드를 아예 쓰지 않는다. 네 축을 명식(십성·달·일간)에서 뽑기 때문이다.
       저장값 폴백이 되살아나면 '묻지 않고 안다'가 다시 '예전에 받아둔 걸 쓴다'로 돌아간다. */
    if (/tex \|\| texture\(|mem\?\.tex|mbti \|\| texture\(/.test(src)) {
      add("주의", "저장해 둔 질감 코드 폴백이 되살아남", "texture() 앞에 저장값 폴백이 있음",
        "질감은 명식에서 뽑습니다. 저장값을 다시 쓰면 옛 유저만 다른 규칙을 타게 됩니다.");
    } else add("정상", "질감은 명식에서 파생", "저장해 둔 코드에 기대지 않음", "");
    /* 2026-08-15 규칙 교체. 예전 약속은 "질문 원문은 통계에 기록하지 않아요"였고, 이 검사는
       track() 에 q 가 실리는지를 봤다. 창업자 지시로 **질문·답변 본문을 가명처리해 기록**하게 되면서
       그 약속이 화면에서 내려갔다. 그러면 검사도 새 약속을 지켜야 한다 —
       지금 화면이 하는 약속은 "이름·연락처를 지운 뒤 기록한다"이고, 그게 거짓이 되는 경우는 둘이다:
         ① 가명처리를 안 거친 원문이 나갈 때  ② 화면 문구만 남고 가명처리가 사라졌을 때 */
    const promisesAnon = /질문과 답변은 <b>이름·연락처를 지운 뒤<\/b>/.test(src);
    const hasAnonGate = /q_anon: anon\(q, birth\.name\)/.test(src) && /function anon\(t, name\)/.test(src);
    const rawQ = /track\("question_asked"[^;]*?[{,]\s*q:\s*q[,\s}]/.test(src);
    if (rawQ) {
      add("심각", "질문 원문이 가명처리 없이 계측에 실림", "track(\"question_asked\") 에 q 원문 그대로",
        "q 는 anon(q, birth.name) 을 거쳐 q_anon 으로만 보내세요. 지금 상태면 화면 문구가 거짓입니다.");
    } else if (promisesAnon && !hasAnonGate) {
      add("심각", "화면은 '지운 뒤 기록'이라는데 지우는 장치가 없음", "anon() 경유가 코드에서 사라짐",
        "anon() 이 지워졌거나 이름이 바뀌었습니다. 화면 문구를 내리거나 가명처리를 되살리세요.");
    } else add("정상", "신뢰 라인 — 질문·답변 가명처리", "anon() 경유 확인(원문 미전송)", "");
  }

  /* 수호신 질감 — 네 축이 실제로 갈리는지는 '코드 모양'으로는 알 수 없다. 값을 넣어 돌려 봐야 안다.
     한 축이 상수로 굳으면 그 시각 채널이 죽어 모두 비슷한 수호신이 되는데, 오류가 안 뜬다.
     브라우저가 필요 없는 검사라 검진에서 같이 돌린다(1초 안에 끝난다). */
  try {
    execFileSync("node", ["e2e/texture-check.mjs"], { stdio: "pipe", timeout: 60000 });
    add("정상", "수호신 질감 다양성", "네 축이 모두 갈림(표본 4,000)", "");
  } catch (e) {
    const out = String(e.stdout || "") + String(e.stderr || "");
    const bad = (out.match(/^FAIL — .*/gm) || []).map((l) => l.replace("FAIL — ", "")).join(" / ");
    add("심각", "수호신 질감이 사람마다 안 갈림", bad || "texture-check 실패",
      "축 하나가 상수로 굳으면 모두 비슷한 수호신이 됩니다. `node e2e/texture-check.mjs` 를 돌려 어느 축인지 보세요.");
  }

  /* 공유 판결 서명 — 없으면 누구나 '비나리 판결'을 지어내 우리 앱이 진짜처럼 그린다(2026-08-15 실증).
     가드레일은 전부 생성 경로에만 있어서, 표시 경로가 열려 있으면 URL 한 줄로 전부 우회된다. */
  {
    const hasApi = existsSync("api/share.js");
    const signs = /signShare\(/.test(src) && /\?v=\$\{enc\}\.\$\{sig\}/.test(src);
    const verifies = /verifyShare\(/.test(src) && /setSharedIn\(dec \|\| false\)/.test(src);
    if (!hasApi || !signs || !verifies) {
      add("심각", "공유 판결에 서명이 없다", `api ${hasApi ? "있음" : "없음"} · 서명 ${signs ? "함" : "안 함"} · 검증 ${verifies ? "함" : "안 함"}`,
        "서명이 빠지면 누구나 URL 을 지어내 '비나리 판결' 카드를 만들 수 있습니다. api/share.js 와 signShare/verifyShare 배선을 되살리세요.");
    } else add("정상", "공유 판결 서명", "서명·검증 배선 있음", "");
    /* A-0: 서명을 붙이면서 payload 가 **서버를 거치게** 됐다. 처리방침은 그전까지
       "서버에 아무것도 저장하지 않고"라고만 적혀 있어, 서버가 값을 아예 안 본다는 뜻으로 읽혔다.
       기능과 고지는 한 몸이다 — 서명 배선이 있는데 그 고지가 없으면 그 순간 처리방침이 거짓이 된다. */
    try {
      const pv = readFileSync("public/privacy.html", "utf8");
      const told = /주소에 담긴 값이 저희 서버를 거칩니다/.test(pv);
      if (hasApi && signs && !told) {
        add("심각", "공유 서명이 처리방침에 고지되지 않음", "payload 가 서버를 거치는데 §5-1 에 설명이 없음",
          "처리방침 5-1 에 '링크를 만들 때와 열 때 값이 서버를 거친다(저장·기록 안 함)'를 적으세요. 안 적으면 그 문서가 거짓이 됩니다.");
      } else if (told) add("정상", "공유 서명 고지", "처리방침 5-1 에 서버 경유 설명 있음", "");
      // 동전 의식을 끄면 괘·육효가 안 담기는데, 고지에 남아 있으면 없는 걸 수집한다고 적은 셈이다
      if (/COIN_RITUAL = false/.test(src) && /뽑힌 괘/.test(pv)) {
        add("주의", "처리방침이 안 담기는 값을 담긴다고 적음", "동전 의식이 꺼졌는데 '뽑힌 괘'가 고지에 남음",
          "괘·육효는 지금 공유 링크·부적에 안 들어갑니다. 처리방침 5-1 에서 빼세요.");
      }
    } catch (_) { /* 처리방침을 못 읽으면 이 검사만 건너뛴다 */ }
    // 검증에 실패했는데도 카드를 그리면 서명이 있으나 마나다 — '열어두는 쪽' 실수를 이름째로 막는다
    if (signs && !/sharedIn && typeof sharedIn === "object"/.test(src)) {
      add("심각", "검증 전에 공유 판결을 그린다", "렌더 조건이 검증 상태를 안 본다",
        "sharedIn 이 객체일 때만 카드를 그리세요. 'checking'·false 상태에서 그리면 위조본이 한 프레임이라도 보입니다.");
    } else if (signs) add("정상", "검증된 공유 판결만 렌더", "객체일 때만 그림", "");
  }

  /* 공개 표면 안전 — 아홉 하늘 값은 몇 개만 모이면 생년월일이 복원된다(바이럴루프판단 v01 §2).
     눈으로는 안 보이는 종류의 사고라 계산으로 잡는다. 브라우저가 필요 없어 검진에서 같이 돌린다. */
  try {
    execFileSync("node", ["e2e/sharerisk-check.mjs"], { stdio: "pipe", timeout: 60000 });
    add("정상", "공개 이미지 안전 판정", "파생 이름 조합이 규칙을 지킴", "");
  } catch (e) {
    const out = String(e.stdout || "") + String(e.stderr || "");
    const bad = (out.match(/^FAIL — .*/gm) || []).map((l) => l.replace("FAIL — ", "")).join(" / ");
    add("심각", "공개 이미지에 생년월일 복원 위험", bad || "sharerisk-check 실패",
      "아홉 하늘 값 몇 개면 생년월일이 역산됩니다. `node e2e/sharerisk-check.mjs` 로 어느 조합인지 보세요.");
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
    /* ⚠ 위 검사는 **한 방향만** 본다 — "앱에 있는데 하네스에 없는 것". 반대쪽은 못 잡았고,
       실제로 하네스에만 `MBTI` 축이 남아 있었다(v128 발견). 축 목록은 양방향으로 대조한다. */
    const axOf = (t) => { const m = t.match(/"axis":"(사주\|[^"]+)"/); return m ? m[1] : null; };
    const aApp = axOf(src), aEv = axOf(ev);
    if (aApp && aEv && aApp !== aEv) {
      add("심각", "평가 도구와 앱의 지표 축이 다름", `앱 [${aApp}] · 하네스 [${aEv}]`,
        "축이 다르면 채점표의 찬반 개수가 앱과 다른 분모로 계산됩니다. 두 곳의 축 열거를 같게 맞추세요.");
    } else if (aApp) {
      add("정상", "지표 축 일치", `앱·하네스 모두 ${aApp.split("|").length}축`, "");
    }
  }
  /* ── 프롬프트가 시키는 축 == 앱이 세는 축인가 (v128) ──────────────────────
     이게 오늘 잡은 진짜 버그다. v114 에 MBTI 축을 없애면서 **세는 쪽(VOTE_AX)만** 고치고
     **시키는 쪽(콜1 지시문)은 열네 판 동안 안 고쳤다.** 모델은 시킨 대로 MBTI 표를 실어 보냈고
     tallyVotes 가 그걸 조용히 버렸다 — 모델은 여섯 축으로 재고 앱은 다섯 축으로 센 셈이다.
     둘을 맞대면 다음에 축을 더하거나 뺄 때 한쪽만 고치는 일이 안 생긴다. */
  {
    const setM = src.match(/const VOTE_AX = new Set\(\[([^\]]+)\]\)/);
    const askM = src.match(/votes엔 이번 판결에 참여한 지표를 전부 넣는다\(([^)]*)\)/);
    if (setM && askM) {
      const counted = new Set(setM[1].match(/"([^"]+)"/g).map((x) => x.slice(1, -1)));
      const asked = new Set(askM[1].replace(/\s*\+\s*제공된 경우\s*/, "·").split("·").map((x) => x.trim()).filter(Boolean));
      const onlyAsked = [...asked].filter((a) => !counted.has(a));
      const onlyCounted = [...counted].filter((c) => !asked.has(c));
      if (onlyAsked.length || onlyCounted.length) {
        add("심각", "모델에게 시키는 축과 앱이 세는 축이 다름",
          [onlyAsked.length ? `시키는데 안 세는 축 — ${onlyAsked.join(",")}` : "",
           onlyCounted.length ? `세는데 안 시키는 축 — ${onlyCounted.join(",")}` : ""].filter(Boolean).join(" · "),
          "콜1 지시문의 지표 나열과 VOTE_AX 를 같게 맞추세요. 어긋나면 모델이 낸 표 중 일부가 조용히 버려져 찬반 개수가 왜곡됩니다.");
      } else {
        add("정상", "시키는 축 = 세는 축", `${counted.size}축이 프롬프트와 코드에서 일치`, "");
      }
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
    /* C-3-② — 재발행이 지불 여부를 안 본다. 본문이 있으면 캐시를 여니 지금은 무해하지만,
       재료(lmat)만 있고 본문이 없는 기록은 tier="paid" 로 다시 돌린다 → 결제일에 무료 재생성 경로가 된다. */
    const reissuePaid = /reissueLetter[\s\S]{0,900}rec\.paid/.test(src);
    /* C-4 — Permissions-Policy 가 payment 을 막고 있다. 지금은 무해하고 옳지만,
       PG(Payment Request·애플페이 계열)를 붙이는 날 "원인 못 찾는 실패"로 나타난다. */
    let payBlocked = false;
    try { payBlocked = /Permissions-Policy[\s\S]{0,300}payment=\(\)/.test(readFileSync("vercel.json", "utf8")); } catch (_) {}
    const gaps = [];
    if (!verified) gaps.push("api/judge.js 의 tier 가 서버 검증 없이 통과됨");
    if (!reissuePaid) gaps.push("reissueLetter 가 rec.paid 를 안 봄(무료 재생성 경로)");
    if (payBlocked) gaps.push("vercel.json 의 Permissions-Policy 가 payment=() 로 결제 API를 차단 중");
    if (payWired && gaps.length) {
      add("심각", "결제가 붙었는데 결제 전 전제가 그대로 남음", gaps.join(" · "),
        "①결제 영수증·토큰으로 tier='paid' 를 서버에서 검증 ②서신 재발행 전에 rec.paid 확인 ③Permissions-Policy 의 payment 를 self 로 여세요. 지금 상태면 누구나 유료 모델을 무료로 씁니다.");
    } else if (payWired) {
      add("정상", "유료 티어 서버 검증", "결제 연동 + tier 검증 + 재발행 지불 확인 + payment 정책 열림", "");
    } else {
      add("정상", "유료 티어(대기)",
        `결제 미연동 — tier·재발행·payment 정책 모두 지금은 무해. 결제 붙는 날 이 검사가 셋을 한꺼번에 깨움(대기 중 ${gaps.length}건)`, "");
    }
    /* C-1 — 결제가 없는 동안 **판매처럼 보이는 표시**가 있으면 안 된다.
       v122 는 청약철회 배제 고지("열람 후에는 환불되지 않아요")를 존재하지 않는 거래에 걸어 두었다.
       뒤집어서, 결제가 붙으면 그 고지가 **반드시 있어야** 한다(전상법 제17조⑥). 양쪽을 다 본다. */
    /* ⚠ 주석은 걷어내고 본다. 이 규칙의 **왜**를 코드 옆에 적어 두는 순간 그 주석이 스스로를 잡는다(실측). */
    const view = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const refundNote = /환불되지 않아|청약\s*철회/.test(view);
    const trialBadge = /시험 발행/.test(view);
    if (!payWired && refundNote) {
      add("심각", "결제가 없는데 청약철회 배제 고지가 붙어 있음", "존재하지 않는 거래의 환불 조건을 먼저 못 박은 상태",
        "결제를 붙이기 전까지는 「시험 발행 · 값을 받지 않아」로 표시하세요. 지금 문구는 실제 판매로 읽힙니다.");
    } else if (payWired && !refundNote) {
      add("심각", "결제가 붙었는데 청약철회 배제 고지가 없음", "전자상거래법 제17조⑥ — 미리보기와 함께 알아보기 쉬운 곳에 둬야 함",
        "서신 구매 화면에 '열람 후 환불 불가' 고지를 미리보기 옆에 되살리세요.");
    } else if (!payWired) {
      add("정상", "결제 전 표시(대기)", `시험 발행 배지 ${trialBadge ? "있음" : "없음"} · 청약철회 배제 고지 없음(옳음)`, "");
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

/* ── 검사 5-d. 검증 가능한 사실을 지어내거나 되읊지 않는가 ───────────────
   (실사용 제보 2026-08-14, 두 번)
   ① "팩트랑 다른 게 너무 많다. 나 키 178이고" — v115 는 일간·상승궁을 cm 로 환산하는 표로
      키를 **예측**했다. 그 표는 어느 유파에도 없는, 우리가 지어낸 것이었다.
   ② "키가 179이기 때문에 주변의 이목을 끈다? 전문성 없어 보이고 바보 같아. 신도 아닌 거 같아"
      — v116 은 그럼 받아서 해석하자고 바꿨는데 **더 나빴다.** 179 를 받아 172 를 빼고
      "7cm 큰 쪽"이라고 되읊었다. 그건 해석이 아니라 뺄셈이고, 유저가 준 값을 되돌려주는 순간
      문서는 아는 척하는 계산기가 된다.
   결론: **키는 다루지 않는다.** 예측도 입력도 없다. 이 검사는 어느 쪽이든 되살아나면 운다. */
{
  const imp = readFileSync("src/lib/imprint.js", "utf8");
  const app = readFileSync(APP, "utf8");
  const table = /const\s+H_(EL|ASC|BASE)\s*=/.test(imp);         // cm 환산·기준선 표 부활
  const input = /heightCm/.test(imp) || /heightCm/.test(app);    // 키 입력 경로 부활
  const wedMode = /mateMode\s*=\s*"wed"/.test(imp);              // 기혼자에게 외모 예언 안 함
  const ok = !table && !input && wedMode;
  add(ok ? "정상" : "심각",
    ok ? "지어낸 사실 — 키를 예측도 입력도 하지 않음" : "각인이 다시 키를 다루기 시작함",
    ok ? "H_EL/H_ASC/H_BASE 없음 · heightCm 없음 · 기혼 분기 있음"
       : `환산표=${table} 입력경로=${input} 기혼분기=${wedMode}`,
    "유저가 정답을 아는 값(키·배우자 외모·결혼 시기)은 맞혀도 소득이 없고 틀리면 문서 전체가 무너집니다. 받아서 되읊는 것도 같습니다 — 뺄셈은 해석이 아닙니다.");
}

/* ── 검사 5-e. 각인의 말투가 한 문단 안에서 바뀌지 않는가 ─────────────────
   창업자 판정(2026-08-14): "신도 아닌 거 같아."
   원인은 표가 사전체("-다")이고 감싸는 문장이 신의 반말("-야")이었던 것이다 —
   "너는 감정이 먼저 보이는 사람이야. 기분이 얼굴에 그대로 나온다."
   실물 문장 검사는 e2e/imprint-check.mjs ⑫ 가 한다. 여기서는 **규칙이 파일에 남아 있는지**를 지킨다. */
{
  const imp = readFileSync("src/lib/imprint.js", "utf8");
  const ruleKept = /표는 전부 '-야\/-어'체로 쓴다/.test(imp);
  const childTable = /const SS_CHILD = \{/.test(imp);   // 유년 구간에 어른의 사건을 안 쓴다
  const noMeta = /이름을 은유로 짓지 않는다/.test(imp);  // "같이 갈 사람이 얇아" 류 비문 방지
  const noVague = /"자리가 N개"라고 쓰지 않는다/.test(imp);  // "그릇이 어떻니" 류 모호함 방지
  const ok = ruleKept && childTable && noMeta && noVague;
  add(ok ? "정상" : "주의",
    ok ? "각인 말투 — 네 규칙이 살아 있음" : "각인 말투 규칙이 사라짐",
    ok ? "'-야/-어'체 + 유년 구간 표 + 은유 금지 + 모호함 금지" : `말투규칙=${ruleKept} 유년표=${childTable} 은유금지=${noMeta} 모호함금지=${noVague}`,
    "표에 '-다'로 끝나는 문구를 넣으면 신의 목소리가 사전 낭독이 됩니다. 유년 구간에 어른의 사건을 쓰면 '5~14세에 월급이 오른다'가 나갑니다. 제목용 낱말을 본문에 그대로 끼우면 '같이 갈 사람이 얇아' 같은 비문이 됩니다. 그리고 '자리가 3개'·'그릇이야' 같은 말은 유저가 뭘 해야 할지 모릅니다 — 실제 상황과 행동으로 써야 합니다.");
}

/* ── 검사 5-f. 여러 문명 판독기가 실제로 물려 있는가 ───────────────────────
   창업자 지적(2026-08-14): "그냥 사주 내용이랑 꼭 같은데, 저번에 글로벌로 찾은
   생년월일로 운명을 점치는 방법들은 적용이 된 거야 만 거야?"
   감사해 보니 sky.js 에 열한 개가 계산돼 있는데 각인 본문에 영향을 준 건 셋뿐이었다.
   나머지는 각주 장식이거나 **한 번도 호출되지 않았다.** 계산해 두고 안 쓰면 없는 것과 같다.
   이 검사는 아홉이 계속 물려 있는지, 그리고 태어난 곳이 절반만 쓰이지 않는지를 지킨다. */
{
  const imp = readFileSync("src/lib/imprint.js", "utf8");
  const app = readFileSync(APP, "utf8");
  const wired = ["nayin", "honmeisei", "weton", "akan", "lifePath", "tzolkin", "moonPhase", "partOfFortune"]
    .filter((f) => new RegExp(`${f}\\(`).test(imp));
  /* 분업이어야 한다 — 같은 질문에 투표시키면 오행 어휘로 환원돼 결국 사주로 읽힌다(v118 실패).
     그리고 결과가 본문(여든 해 지도)을 실제로 바꿔야 한다. 세어만 놓으면 부록이다. */
  const hasWitness = /const sky9 = \[/.test(imp) && /putS\(/.test(imp)
    && /const clash = \[/.test(imp) && /doubleTurn/.test(imp);
  const latWired = /cityLat\(/.test(app) && /lat: cityLat/.test(app);
  const ok = wired.length >= 8 && hasWitness && latWired;
  add(ok ? "정상" : "심각",
    ok ? `여러 하늘 — 판독기 ${wired.length}종이 분업 중` : "여러 문명 판독기가 다시 장식이 됨",
    ok ? `${wired.join("·")} + 분업 절·어긋남 절 + 위도 연결` : `물린 판독기 ${wired.length}종(${wired.join("·")}) 증언절=${hasWitness} 위도=${latWired}`,
    "판독기에게 같은 질문을 던져 투표시키면 오행 어휘로 환원돼 결국 사주로 읽힙니다 — 각자 사주가 못 하는 질문을 하나씩 맡아야 하고, 그 결과가 본문을 실제로 바꿔야 합니다. 그리고 태어난 곳은 경도·위도를 모두 써야 합니다 — 위도를 안 넘기면 제주에서 태어난 사람이 서울 값을 받습니다.");
}

/* ── 검사 5-g. 판결 프롬프트가 자기 규칙을 자기 예시로 어기지 않는가 ─────
   (창업자 2026-08-14: "판결도 되게 애매모호할 때 많던데")
   실제로 그랬다. 프롬프트에 이런 **모범 예시**가 박혀 있었다:
     (O)"편재 둘에 암록까지 — 크게 들어오는 재물의 그릇이야"
   한 줄에 위반이 둘이다. ① 편재·암록은 [용어 금지] 목록의 말이고
   ② "그릇"은 읽고 나서 아무것도 모르는 은유다. **모델은 규칙보다 예시를 따른다** —
   금지 조항을 아무리 길게 써도 (O) 예시가 그걸 어기면 예시가 이긴다.
   그래서 규칙이 아니라 **예시를 검사한다.** */
{
  const app = readFileSync(APP, "utf8");
  const sys = app.slice(app.indexOf("[너는 누구인가]") >= 0 ? app.indexOf("[너는 누구인가]") : 0);
  /* (O)"..." 형태의 모범 예시를 전부 뽑는다 */
  const good = [...sys.matchAll(/\(O\)\s*"([^"]{4,120})"/g)].map((m) => m[1]);
  /* 어디에 쓰이든 금지된 은유 — 읽고 나서 아무것도 모르는 말 */
  const VAGUE = /(그릇이|그릇이야|쥘\s*팔|팔\s*힘|기운이\s*흐르|자리가\s*비었어)/;
  const bad = good.filter((g) => VAGUE.test(g));
  /* 뒷면 모호함 금지 규칙 넷이 실재하는가 */
  const backRules = ["뜻이 안 서는 은유를 서술어로", "개수만 던지기", "추상명사로 도망가기", "판정을 유예하는 어미"]
    .filter((k) => sys.includes(k));
  const ok = bad.length === 0 && good.length >= 15 && backRules.length === 4;
  add(ok ? "정상" : "심각",
    ok ? `판결 프롬프트 — 모범 예시 ${good.length}개가 자기 금칙을 안 어김` : "판결 프롬프트의 모범 예시가 자기 금칙을 어김",
    ok ? `(O) 예시 ${good.length}개 검사 · 뒷면 모호함 규칙 4종 있음`
       : `위반 예시 ${bad.length}건${bad.length ? `: "${bad[0].slice(0, 40)}…"` : ""} · 예시 ${good.length}개 · 뒷면규칙 ${backRules.length}/4`,
    "모델은 금지 조항보다 (O) 예시를 강하게 따릅니다. 예시 한 줄이 규칙 열 줄을 이깁니다 — 그래서 예시부터 지켜야 합니다.");
}

/* ── 검사 5-h. 궁합이 "점수 하나"로 뭉개지지 않는가 ────────────────────────
   (창업자 요청 2026-08-14: "궁합 기능도 붙여주고")
   궁합은 이 제품에서 **가장 뭉개기 쉬운 자리**다. 시중 서비스 대부분이 "87점, 잘 맞아요"로 끝낸다.
   그 한 줄은 어디서든 살 수 있고, 그래서 우리가 팔 이유가 없어진다.
   우리 자리는 **어디가 갈리는가**다 — 인도는 높은데 동아시아가 낮으면 그게 알맹이다.
   그리고 **헤어지라고 말하지 않는다.** 관계를 끊는 결정은 우리 몫이 아니다. */
{
  const m = readFileSync("src/lib/match.js", "utf8");
  const app = readFileSync(APP, "utf8");
  const split = /const clash =/.test(m) && /갈린다/.test(m);        // 갈림을 따로 말한다
  const noAvg = /합산 점수를 앞세우지 않는다/.test(m);              // 총점을 앞세우지 않는다
  const noBreak = /헤어지라고 말하지 않는다/.test(m);                // 금지선이 파일에 남아 있다
  const nine = (m.match(/put\(/g) || []).length >= 9;                // 아홉 축이 분업한다
  const noName = /이름도 연락처도 안 받아/.test(app);                // 남의 개인정보를 안 들고 있는다
  const ok = split && noAvg && noBreak && nine && noName;
  add(ok ? "정상" : "심각",
    ok ? "궁합 — 갈림을 말하고 총점을 앞세우지 않음" : "궁합이 점수 한 줄로 뭉개짐",
    ok ? "아홉 축 분업 · 갈림 절 · 총점 후치 · 헤어짐 금지선 · 상대 이름 미수집"
       : `갈림절=${split} 총점후치=${noAvg} 금지선=${noBreak} 아홉축=${nine} 이름미수집=${noName}`,
    "\"87점, 잘 맞아요\"는 어디서든 살 수 있습니다. 우리가 파는 건 어디가 갈리는가입니다. 그리고 상대의 이름·연락처는 받지 않습니다 — 남의 개인정보를 우리가 들고 있을 이유가 없습니다.");
}

/* ── 검사 5-i. 개인정보·법정고지 A항 다섯 (전략 세션 작업지시 2026-08-14) ──
   이 다섯은 **여섯 판(v119~v124) 동안 고쳐지지 않은 채 라이브에 있었다.** 각인이 여섯 판 연속
   넓어지는 동안 고지 줄 수는 0에서 한 번도 안 올라갔다 — 개별 실수가 아니라 **추세**였다.
   그래서 검사를 붙인다. 사람이 기억하는 것으로는 여섯 판을 못 버틴다. */
{
  const app = readFileSync(APP, "utf8");
  const imp = readFileSync("src/lib/imprint.js", "utf8");
  const bad = [];

  /* A-1 처리방침이 안내한 거부 수단이 실제로 있는가 — 속성 제거가 아니라 **전송 중단**이어야 한다 */
  if (!/const OPTOUT_KEY =/.test(app) || !/if \(_optout\) return;/.test(app)) bad.push("A-1 분석거부수단없음");
  if (!/사용 통계 수집을 끌래/.test(app)) bad.push("A-1 거부UI없음");

  /* A-2 공유 링크에 실명이 안 실리는가 — payload 필드와 **본문 호칭** 둘 다 */
  if (/n: \(birth\.name/.test(app)) bad.push("A-2 payload에 실명");
  if (!/const stripName =/.test(app)) bad.push("A-2 본문 호칭 미제거");
  if (/sharedIn\.n \?/.test(app)) bad.push("A-2 수신화면 실명 폴백");
  if (!/delete o\.n;/.test(app)) bad.push("A-2 구링크 실명 미폐기");

  /* A-3 계측에 판결·근거 원문이 안 나가는가.
     ⚠ **track() 안만 본다.** setRecords 는 로컬 판결록이라 원문을 들고 있어야 정상이다 —
        파일 전체를 보면 그걸 잡아서 헛울음이 난다(실제로 그랬다). 나가는 것과 남는 것은 다르다. */
  const trkSeg = [...app.matchAll(/track\("(verdict_shown|detail_shown)"[\s\S]{0,1600}?\}\)*;/g)].map((m) => m[0]).join("\n");
  if (!trkSeg) bad.push("A-3 계측 호출을 못 찾음(검사가 낡음)");
  if (/verdict: r1\.verdict/.test(trkSeg)) bad.push("A-3 verdict 원문 전송");
  if (/subline: r2\?\.subline/.test(trkSeg) || /funline: r2\?\.funLine/.test(trkSeg)) bad.push("A-3 뒷면 원문 전송");
  if (/axisMap\(reasons, \(r\) => r\.text\)/.test(app)) bad.push("A-3 근거 전문 전송");

  /* A-4 각인·궁합에 고지가 있는가 — **문서 하단 고정 블록**이어야 한다(절마다 붙이면 다음 판에서 또 빠진다) */
  const impNotes = (app.match(/className="ainote docnote"/g) || []).length;
  if (impNotes < 2) bad.push(`A-4 각인·궁합 고지 ${impNotes}/2`);
  if (!/의료·법률·재무 조언이 아니야/.test(app)) bad.push("A-4 의료조언 아님 고지 없음");
  if (/크게 앓을 수 있어/.test(imp)) bad.push("A-4 발병 단정 문장 부활");

  /* A-5 공유 수신 화면·부적 이미지에 AI 표시가 있는가 */
  if (!/AI가 생성한 내용 · 재미로 보는 참고용/.test(app)) bad.push("A-5 부적 이미지 AI표시 없음");
  const shareSeg = app.slice(app.indexOf("sharedcta"), app.indexOf("sharedcta") + 700);
  if (!/ainote/.test(shareSeg)) bad.push("A-5 공유 수신화면 AI표시 없음");

  add(bad.length ? "심각" : "정상",
    bad.length ? "개인정보·법정고지 A항이 되돌아옴" : "개인정보·법정고지 A항 다섯 — 전부 살아 있음",
    bad.length ? bad.join(" · ")
      : "거부수단(전송중단) · 공유 실명제거(필드+본문) · 계측 원문제거 · 각인·궁합 고정 고지 · 공유화면·부적 AI표시",
    "이 다섯은 여섯 판 동안 고쳐지지 않은 채 라이브에 있었습니다. 문서가 커질수록 고지의 필요는 줄지 않고 늘어납니다 — 절마다 붙이지 말고 하단 고정 블록 하나로 두세요.");
}

/* ── 검사 5-j. 저장 키가 규칙 밖으로 새지 않는가 (작업지시 A-6) ──────────
   `clearMemory` 도 내보내기 스윕도 **`binari.` 접두만** 본다. 그런데 새 기능은 계속 밑줄로 키를 만들었다 —
   v115 각인 선택 입력, v125 궁합 **상대방 생년월일**. 그래서 "처음부터 다시"를 눌러도 안 지워지고
   **다음 사람에게 넘어갔다.** 궁합 쪽이 특히 무겁다 — 상대는 이 앱을 쓴 적도 동의한 적도 없는 제3자다.
   ⚠ 규칙을 "binari_ 로 시작하면 실패"로 넣으면 안 된다 — `binari_bujeok` 은 다운로드 **파일명**이고
      `__binari_t` 는 localStorage **가용성 프로브**라 매번 오탐한다. **저장 호출 패턴으로 좁힌다.** */
{
  const app = readFileSync(APP, "utf8");
  const bad = [];
  const under = [...app.matchAll(/(?:localStorage|store)\.(?:get|set|remove)Item\("(binari_[A-Za-z0-9_]*)"/g)]
    .map((m) => m[1]);
  if (under.length) bad.push(`규칙 밖 저장 키 ${[...new Set(under)].join(",")}`);
  /* clearMemory 가 전량 스윕인가 — 키 하나만 지우면 "처음부터 다시"가 거짓말이 된다 */
  const cm = (app.match(/function clearMemory\(\)[\s\S]{0,900}?\n\}/) || [""])[0];
  if (!/localStorage\.key\(i\)/.test(cm) || !/indexOf\("binari\."\) === 0/.test(cm)) bad.push("clearMemory 전량스윕 아님");
  if (!/k !== INTERNAL_KEY/.test(cm)) bad.push("clearMemory 가 팀 플래그를 날림");
  if (!/_ph\?\.reset\?\.\(\)/.test(cm)) bad.push("clearMemory 에 분석 reset 없음");
  /* 구키 마이그레이션이 살아 있는가 — 없으면 이미 쓰던 사람의 값이 영영 규칙 밖에 남는다 */
  if (!/migrateUnderscoreKeys/.test(app)) bad.push("구키 마이그레이션 없음");
  /* 처리방침에 제3자 항목이 있는가 */
  const pv = readFileSync("public/privacy.html", "utf8");
  if (!/상대방의 생년월일/.test(pv)) bad.push("처리방침에 제3자 항목 없음");
  if (!/이름·연락처는 받지 않습니다/.test(pv)) bad.push("처리방침에 제3자 미수집 범위 없음");

  add(bad.length ? "심각" : "정상",
    bad.length ? "저장 키가 규칙 밖으로 샘 — 리셋에도 안 지워짐" : "저장 키 규칙 — 전부 binari. 접두 · 리셋이 전량 스윕",
    bad.length ? bad.join(" · ") : "밑줄 저장 키 0 · clearMemory 전량스윕(팀 플래그 보존) · 구키 마이그레이션 · 처리방침 제3자 항목",
    "저장 키는 전부 `binari.` 로 시작해야 리셋·내보내기 스윕에 걸립니다. 밑줄로 만들면 \"처음부터 다시\"를 눌러도 남아서 다음 사람에게 넘어갑니다 — 궁합의 상대방 생년월일은 제3자 정보라 특히 무겁습니다.");
}

/* ── 검사 5-k. 진입 모션이 다시 한꺼번에 터지지 않는가 (v128) ────────────
   창업자 지적: "그래프, 표가 나타나는 모션이 주기가 너무 짧아서 발작 일으키는 것처럼 느껴져."
   원인은 속도가 아니라 **동시성**이었다 — 문서를 여는 순간 마흔 개 블록이 같은 애니메이션을 같이 시작했다.
   다음 판에서 절 하나를 더 붙이면서 `.imp .impXXX{animation:…}` 를 그대로 따라 쓰면 증상이 그대로 돌아온다.
   그래서 **모양이 아니라 규칙을 못 박는다**: 진입 애니메이션은 뷰포트 표식(.rvin)을 거쳐야 하고,
   각인 문서 안에 무한 반복은 없어야 한다.
   ⚠ 초기 숨김(.rv)은 **JS 가 붙인다.** CSS 로 숨기면 스크립트가 죽는 순간 값을 치른 문서가 백지가 된다. */
{
  const app = readFileSync(APP, "utf8");
  const bad = [];
  const css = (app.match(/@keyframes impRise[\s\S]{0,3200}?prefers-reduced-motion[\s\S]{0,400}?\n\}/) || [""])[0];
  if (!css) bad.push("각인 모션 블록을 못 찾음");
  else {
    /* 뷰포트 표식을 안 거치고 바로 도는 진입 애니메이션이 있는가 */
    for (const m of css.matchAll(/^([^\n{]*)\{[^}]*animation:\s*imp(Rise|Wipe|Grow|Draw|Fill|Pulse)[^}]*\}/gm)) {
      const sel = m[1].trim();
      if (!/\.rvin\b/.test(sel)) bad.push(`뷰포트 표식 없이 도는 진입 모션 — ${sel.slice(0, 46)}`);
    }
    if (/animation:[^;}]*\binfinite\b/.test(css)) bad.push("각인에 무한 반복 모션이 있음");
    if (!/\.imp \.rvin\b/.test(css)) bad.push("진입 표식(.rvin) 규칙이 없음");
    if (/^\s*\.imp \.rv\s*\{[^}]*\}/m.test(css) === false) bad.push("초기 숨김(.rv) 규칙이 없음");
    if (!/prefers-reduced-motion/.test(css)) bad.push("움직임 줄이기 대응 없음");
  }
  /* .rv 는 JS 가 붙여야 한다 — CSS 만으로 숨기면 스크립트가 죽을 때 문서가 사라진다 */
  if (!/classList\.add\("rv"\)/.test(app)) bad.push("초기 숨김을 JS 가 안 붙임(스크립트 죽으면 백지)");
  if (!/IntersectionObserver/.test(app)) bad.push("뷰포트 관찰자 없음");

  add(bad.length ? "주의" : "정상",
    bad.length ? "각인 진입 모션이 한꺼번에 터질 수 있음" : "각인 진입 모션 — 화면에 들어온 것만 · 무한 반복 없음",
    bad.length ? bad.join(" · ") : "모든 진입 모션이 .rvin 을 거침 · infinite 0 · 초기 숨김은 JS · 움직임 줄이기 대응",
    "리포트 모션은 **화면에 들어온 블록만** 움직여야 합니다. `.imp .impXXX{animation:…}` 처럼 표식 없이 걸면 문서를 여는 순간 수십 개가 동시에 떨립니다.");
}

/* ── 검사 5-l. 사람을 말하는 자리의 금지어 (작업지시_역할과초대 §A-2) ──────
   창업자 화법 규칙 셋: **등급이 아니라 역할 / 총점이 아니라 축 / 좋은 말이 아니라 쓸모.**
   금지어는 그 셋을 깨는 낱말들이고, 두 무리로 갈린다:
     ① **단언** — 해결한다·풀어준다·낫게 한다. 우리가 금지한 "지어낸 확신"이 된다.
     ② **서열·부정** — 가장·1순위·최적·추천·피해라·도움이 안 된다. 규칙 1을 깬다.
     ③ **자격 참칭** — 상담·전문가·멘토. 우리는 의료도 상담도 아니다.

   ⚠ **검사 범위를 좁게 잡는 게 이 검사의 핵심이다.** "가장"·"추천" 같은 말은 앱 어디에나
      정상적으로 나온다(예: 렌더러 안내, 개발 주석). 전역으로 걸면 오탐이 쏟아지고,
      오탐이 쏟아지는 검사는 곧 무시당한다. 그래서 **사람을 두고 말하는 자리 넷**만 본다:
      서신 4장 지시 · 서신 목차 · 궁합 역할표(match.js) · 곁 사이 문구.
   ⚠ 지시문이 **금지하려고 인용하는 말**은 위반이 아니다 — 프롬프트가 (X)"소띠는 피해라"로
      나쁜 예를 보여주는 게 오히려 규칙을 지키는 방법이다. (X) 줄은 빼고 본다. */
{
  const app = readFileSync(APP, "utf8");
  const mj = readFileSync("src/lib/match.js", "utf8");
  const cut = (s, a, b) => { const i = s.indexOf(a); if (i < 0) return ""; const j = s.indexOf(b, i); return j < 0 ? s.slice(i) : s.slice(i, j); };
  /* (X) 로 시작하는 줄 = 모델에게 보여주는 나쁜 예. 금지어가 거기 있는 건 의도다. */
  const dropX = (s) => s.split("\n").filter((l) => !/\(X\)/.test(l)).join("\n");
  const ZONES = [
    ["서신 4장 지시", dropX(cut(app, `4) "누구와`, `5) "무엇을 걸고"`))],
    ["서신 목차", cut(app, "const LETTER_SECTIONS =", "\n")],
    ["궁합 역할표", cut(mj, "const ROLE = {", "\n  };")],
    ["곁 사이 문구", cut(app, "const GYEOT_REL_LINE = {", "\n};")],
  ];
  const BAN = [
    [/해결한다|해결해\s*줄|풀어준다|풀어줄|낫게\s*한다|낫게\s*해/, "단언(해결·풀어줌·낫게함)"],
    [/도와줘라|물어봐라|찾아가라/, "명령형 지시"],
    [/가장\s*(잘|좋|맞)|1순위|최적|추천(한다|해|합니다)|맞는\s*사람/, "서열(가장·1순위·최적·추천)"],
    [/도움이\s*안\s*(된|돼)|피해라|피하라|멀리\s*해라/, "부정 판정(피해라·도움이 안 된다)"],
    [/상담(사|을 받|해 ?줄)|전문가|멘토/, "자격 참칭(상담·전문가·멘토)"],
  ];
  const hits = [], missing = [];
  for (const [zone, text] of ZONES) {
    if (!text) { missing.push(zone); continue; }
    for (const [re, label] of BAN) {
      const m = re.exec(text);
      if (m) hits.push(`${zone}: "${m[0]}" (${label})`);
    }
  }
  const ok = hits.length === 0 && missing.length === 0;
  add(ok ? "정상" : "심각",
    ok ? "사람을 말하는 자리 — 금지어 없음 (등급 아닌 역할 · 좋은 말 아닌 쓸모)"
       : "사람을 말하는 자리에 금지어가 들어감",
    ok ? `검사 구역 ${ZONES.length}곳 · 금지 묶음 ${BAN.length}종`
       : [...hits, ...missing.map((z) => `구역을 못 찾음 — ${z}`)].join(" · "),
    "\"가장 잘 맞는 사람\"·\"이 사람은 피해라\"는 사람을 **등급**으로 만듭니다. 적합도가 낮아지면 등급이 내려가는 게 아니라 **역할이 바뀝니다**. 부정으로 쓰지 말고 쓸모로 바꾸세요 — \"긴장을 못 풀게 하는 자리(네가 있으면 이 사람이 움직인다)\"처럼.");
}

/* ── 검사 5-m. 곁 명부가 순위가 되지 않는가 (작업지시_역할과초대 §C·D) ─────
   **지금까지 곁에 순위가 없었던 건 원칙이 아니라 화면에 사람이 한 명뿐이었기 때문이다.**
   `MATCH_LAST_KEY` 가 한 칸·덮어쓰기라 목록 자체가 없었다. 명부를 만드는 순간 그 장치가 사라진다.
   그래서 방어를 코드로 세웠고, 여기서 그 방어가 살아 있는지 본다.
   e2e 는 동작을 돌려 보고(gyeot-roster-check), 이 검사는 **되살아나면 안 되는 것**을 본다. */
{
  const app = readFileSync(APP, "utf8");
  const bad = [];
  if (!/const GYEOT_KEY = "binari\.gyeot\./.test(app)) bad.push("명부 저장 키 없음");
  if (!/function gyeotOrder\(/.test(app)) bad.push("정렬 함수 없음");
  /* 정렬 함수 본문에 최근순(at) 말고 다른 키가 끼면 그게 순위다 */
  const ordFn = (app.match(/function gyeotOrder\([\s\S]*?\n\}/) || [""])[0];
  if (/\.rel\b|\.el\b|score|point|ratio|sc\b/.test(ordFn)) bad.push("정렬에 최근순 아닌 키가 섞임");
  /* 궤도 자리를 인덱스로 주면 앞줄 셋이 1·2·3등으로 읽힌다 */
  const viewFn = (app.match(/function gyeotView\([\s\S]*?\n\}/) || [""])[0];
  if (/ang:\s*[^,]*\bi\b/.test(viewFn)) bad.push("궤도 자리를 목록 인덱스로 줌");
  if (!/function gyeotSeat\(/.test(app)) bad.push("자리 배정 함수 없음");
  /* 화면에 개수를 찍으면 곁 탭이 친구 수 카운터가 된다(곁탭IA §5) */
  const panel = (app.match(/<ul className="gyeotlist">[\s\S]*?<\/ul>/) || [""])[0];
  if (/\.length\}/.test(panel)) bad.push("목록에 개수를 찍음");
  if (!/잘 맞는 순서가 아니야/.test(app)) bad.push("최근순임을 화면에 안 밝힘");
  /* 원값을 쌓으면 남의 생년월일을 우리가 들고 있게 된다 */
  if (/gyeotAdd\([^)]*\b(y|birth)\s*:/.test(app)) bad.push("명부에 생년월일을 넣음");
  /* 규칙이 남아 있는 것과 실제로 그렇게 도는 것은 다르다 — 동작은 e2e 가 돌려 본다 */
  if (existsSync("e2e/gyeot-roster-check.mjs")) {
    try { execFileSync("node", ["e2e/gyeot-roster-check.mjs"], { stdio: "pipe", timeout: 60000 }); }
    catch (_) { bad.push("명부 동작 검사 실패 — node e2e/gyeot-roster-check.mjs"); }
  } else bad.push("명부 동작 검사 파일이 없음");
  add(bad.length ? "심각" : "정상",
    bad.length ? "곁 명부가 순위로 읽힐 수 있음" : "곁 명부 — 최근순 하나 · 자리는 지문에서 · 개수 미표기 · 원값 미저장",
    bad.length ? bad.join(" · ") : "정렬키 1종 · 자리 배정 gyeotSeat · 목록 개수 0 · 순서 고지 있음",
    "곁 목록에 두 번째 정렬 키를 넣거나 궤도 자리를 인덱스로 주면 목록이 **순위**가 됩니다. 그러면 앱이 사람을 줄 세우게 됩니다 — 적합도가 낮아지면 등급이 내려가는 게 아니라 역할이 바뀐다는 규칙이 거기서 무너집니다.");
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
