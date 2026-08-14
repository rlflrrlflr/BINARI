/* 판독기(讀器) — 같은 생년월일시를 서로 다른 문명의 방식으로 읽는다.
   ────────────────────────────────────────────────────────────
   전제: 태어난 순간은 하나이고, 각 문명은 그것을 읽는 서로 다른 방법을 만들었다.
   그래서 **여러 판독기가 같은 말을 하면 확신이 오르고, 갈리면 갈린다고 말한다.**
   이건 새 방법론이 아니라 이 리포가 이미 쓰는 원칙이다(발음오행 2체계 병기·억부/조후 일치 여부).

   이 파일에 담는 것은 **생년월일(시)만으로 결정론적으로 나오는 것**뿐이다.
   출생지 좌표가 필요한 것(상승궁·하우스·프로펙션)과 규칙이 큰 것(자미두수)은 여기 없다.

   ⚠ 정확도 등급을 함수마다 표시한다:
     verified  — 알려진 값으로 자체 검증됨(verify.mjs)
     derived   — 공개된 기준점에서 유도. 기준점 자체는 외부 확인 필요
     port      — app/src/App.jsx 의 검증된 구현을 옮긴 것 */

/* ── 공통 ───────────────────────────────────────────── */
export const jdn = (y, m, d) => {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
};
/* 요일 — JDN 0 은 월요일. 0=일 … 6=토 로 맞춘다 */
export const weekday = (y, m, d) => (jdn(y, m, d) + 1) % 7;
export const WEEK_KO = ["일", "월", "화", "수", "목", "금", "토"];

/* ── 동아시아 ───────────────────────────────────────── */
/** 납음오행 — 육십갑자의 '소리 기운' 30종. 년주에서 조회한다. [port] */
export const NAYIN = ["해중금","노중화","대림목","노방토","검봉금","산두화","간하수","성두토","백랍금","양류목",
  "천중수","옥상토","벽력화","송백목","장류수","사중금","산하화","평지목","벽상토","금박금",
  "복등화","천하수","대역토","차천금","상자목","대계수","사중토","천상화","석류목","대해수"];
export const nayin = (sajuYear) => NAYIN[Math.floor((((sajuYear - 4) % 60) + 60) % 60 / 2)];

/** 구성기학 본명성(本命星) — 일본에서 가장 널리 쓰이는 생년 판독. [verified]
    자릿수를 한 자리로 줄여 11에서 뺀다. 입춘 전 출생은 전년으로 친다. */
export const GUSEONG = [null, "일백수성", "이흑토성", "삼벽목성", "사록목성", "오황토성",
  "육백금성", "칠적금성", "팔백토성", "구자화성"];
export function honmeisei(year, beforeIpchun = false) {
  const y = beforeIpchun ? year - 1 : year;
  let s = String(y).split("").reduce((a, c) => a + +c, 0);
  while (s > 9) s = String(s).split("").reduce((a, c) => a + +c, 0);
  let n = 11 - s;
  if (n > 9) n -= 9;
  return { n, name: GUSEONG[n] };
}

/* ── 아메리카 ───────────────────────────────────────── */
const GMT = 584283;   // 마야 롱카운트 ↔ 율리우스일 상관수(Goodman–Martinez–Thompson)
export const TZ_SIGNS = ["이믹스(악어)","이크(바람)","아크발(밤)","칸(씨앗)","치칸(뱀)","키미(전환)","마니크(사슴)",
  "라마트(별)","물루크(물)","오크(개)","추엔(원숭이)","에브(길)","벤(갈대)","이시(재규어)","멘(독수리)",
  "키브(지혜)","카반(대지)","에츠납(부싯돌)","카우악(폭풍)","아하우(태양)"];
/** 마야 촐킨 — 260일 신성력(13톤 × 20날개). [port·verified] */
export function tzolkin(jd) {
  const n = jd - GMT;
  return { tone: ((((n + 3) % 13) + 13) % 13) + 1, sign: TZ_SIGNS[(((n + 19) % 20) + 20) % 20] };
}
export const HAAB_MONTHS = ["포프","우오","시프","솟츠","섹","술","약스킨","몰","첸","약스",
  "삭","케","마크","칸킨","무완","팍스","카얍","쿰쿠","와옙"];
/** 마야 하압 — 365일 태양력(20일 × 18달 + 와옙 5일). 촐킨과 짝을 이뤄 52년 주기를 만든다. [verified] */
export function haab(jd) {
  const n = (((jd - GMT + 348) % 365) + 365) % 365;
  return { month: HAAB_MONTHS[Math.floor(n / 20)], day: n % 20, index: n };
}

/* ── 동남아 ─────────────────────────────────────────── */
export const PASARAN = ["레기", "파힝", "폰", "와게", "클리원"];
export const PASARAN_VAL = [5, 9, 7, 4, 8];        // 파사란 신붕(神本) 값
export const DINA_VAL   = [5, 4, 3, 7, 8, 6, 9];   // 일~토 요일 값
/** 자바 웨톤 — 7요일 × 5파사란 = 35일 주기. 인도네시아에서 궁합에 실제로 쓰인다. [derived]
    기준점: **1945-08-17 인도네시아 독립일 = 금요일 레기(Jumat Legi)**.
    이 날이 금요일이라는 것은 이 파일의 요일 함수로 확인된다(verify.mjs) — 즉 기준점이 최소한 자기모순은 아니다.
    ⚠ 처음에는 자바력 원년(1 Sura 1555 AJ = 1633-07-08 율리우스)을 '금요일 레기'로 알고 기준점으로 삼았는데,
      **그날은 금요일이 아니라 월요일이었다**(그레고리 환산·율리우스력 직접 계산이 같은 답). 그래서 폐기했다.
      절대 명칭(레기냐 파힝이냐)은 여전히 외부 확인이 필요하고, 주기성(5일·35일)만 여기서 검증된다. */
const WETON_ANCHOR = jdn(1945, 8, 17);
export function weton(y, m, d) {
  const jd = jdn(y, m, d), w = weekday(y, m, d);
  const pi = ((((jd - WETON_ANCHOR) % 5) + 5) % 5);
  return { day: WEEK_KO[w], pasaran: PASARAN[pi],
    neptu: DINA_VAL[w] + PASARAN_VAL[pi],   // 두 값의 합 — 궁합·택일에 쓴다
    name: `${WEEK_KO[w]}요일 ${PASARAN[pi]}` };
}

/** 태국 요일 점성 — 요일마다 색·행성·수호 불상이 정해져 있고 일상에 실재한다. [verified] */
export const THAI_DAY = [
  { color: "붉은색", planet: "해",   buddha: "명상하는 부처" },
  { color: "노란색", planet: "달",   buddha: "재난을 막는 부처" },
  { color: "분홍색", planet: "화성", buddha: "누워 계신 부처" },
  { color: "초록색", planet: "수성", buddha: "탁발하는 부처" },
  { color: "주황색", planet: "목성", buddha: "사색하는 부처" },
  { color: "하늘색", planet: "금성", buddha: "성찰하는 부처" },
  { color: "보라색", planet: "토성", buddha: "용이 감싼 부처" },
];
export const thaiDay = (y, m, d) => ({ day: WEEK_KO[weekday(y, m, d)], ...THAI_DAY[weekday(y, m, d)] });

/* ── 아프리카 ───────────────────────────────────────── */
/** 아칸 데이 네임 — 가나 아칸족. 태어난 요일이 곧 이름이 되고 성격을 가리킨다.
    아프리카에서 생년월일 기반 체계로는 가장 명확하다. [verified] */
export const AKAN = [
  { m: "Kwasi",  f: "Akosua", trait: "지도자 — 앞에 서는 사람" },
  { m: "Kwadwo", f: "Adwoa",  trait: "평화 — 다투지 않는 사람" },
  { m: "Kwabena",f: "Abenaa", trait: "불 — 뜨겁고 빠른 사람" },
  { m: "Kwaku",  f: "Akua",   trait: "명성 — 이름이 나는 사람" },
  { m: "Yaw",    f: "Yaa",    trait: "대지 — 단단하고 견디는 사람" },
  { m: "Kofi",   f: "Afua",   trait: "풍요 — 길러 내는 사람" },
  { m: "Kwame",  f: "Ama",    trait: "옛것 — 오래된 지혜의 사람" },
];
export function akan(y, m, d, isMale = true) {
  const w = weekday(y, m, d), a = AKAN[w];
  return { day: WEEK_KO[w], name: isMale ? a.m : a.f, trait: a.trait };
}

/* ── 수비학 ─────────────────────────────────────────── */
/** 라이프패스 — 생년월일 자릿수를 줄인다. 11·22·33 은 줄이지 않는다. [port] */
export function lifePath(y, m, d) {
  const dg = (n) => String(n).split("").reduce((a, c) => a + +c, 0);
  let s = dg(y) + dg(m) + dg(d);
  while (s > 9 && s !== 11 && s !== 22 && s !== 33) s = dg(s);
  return s;
}

/* ── 하늘을 직접 재는 판독기 ─────────────────────────
   아래 넷은 태양·달의 실제 위치를 계산해서 읽는다. app/src/App.jsx 의 검증된 구현을 옮겼다. [port] */
export const jdFromKST = (y, m, d, h, mi) => jdn(y, m, d) - 0.5 + ((h + mi / 60) - 9) / 24;

export function sunLongitude(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T, Mr = M * Math.PI / 180;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) + 0.000289 * Math.sin(3 * Mr);
  const omega = 125.04 - 1934.136 * T;
  return (((L0 + C - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180)) % 360) + 360) % 360;
}
export function moonLongitude(jd) {
  const T = (jd - 2451545.0) / 36525, d = Math.PI / 180;
  const Lp = 218.3164477 + 481267.88123421 * T, D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T, Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.272095 + 483202.0175233 * T;
  const lon = Lp + 6.288774 * Math.sin(Mp * d) + 1.274027 * Math.sin((2 * D - Mp) * d)
    + 0.658314 * Math.sin(2 * D * d) + 0.213618 * Math.sin(2 * Mp * d) - 0.185116 * Math.sin(M * d)
    - 0.114332 * Math.sin(2 * F * d) + 0.058793 * Math.sin((2 * D - 2 * Mp) * d)
    + 0.057066 * Math.sin((2 * D - M - Mp) * d) + 0.053322 * Math.sin((2 * D + Mp) * d)
    + 0.045758 * Math.sin((2 * D - M) * d);
  return ((lon % 360) + 360) % 360;
}
export const ZODIAC12 = ["양자리","황소자리","쌍둥이자리","게자리","사자자리","처녀자리",
  "천칭자리","전갈자리","사수자리","염소자리","물병자리","물고기자리"];
export const NAKSHATRA = ["아슈위니","바라니","크리티카","로히니","므리가시라","아르드라","푸나르바수","푸쉬야",
  "아슐레샤","마가","푸르바팔구니","우타라팔구니","하스타","치트라","스와티","비샤카","아누라다","제슈타",
  "물라","푸르바샤다","우타라샤다","슈라바나","다니슈타","샤타비샤","푸르바바드라","우타라바드라","레바티"];
/** 서양 점성술 — 태양이 머문 자리(회귀황도 12분할) */
export const sunSign = (jd) => ZODIAC12[Math.floor(sunLongitude(jd) / 30) % 12];
/** 서양 점성술 — 달이 머문 자리 */
export const moonSign = (jd) => ZODIAC12[Math.floor(moonLongitude(jd) / 30) % 12];
/** 인도 조티샤 — 달이 머문 27자리(항성황도, 라히리 아야남샤 근사) */
export function nakshatra(jd, year) {
  const ayan = 23.86 + (year - 1990) * 0.01397;
  const sid = (((moonLongitude(jd) - ayan) % 360) + 360) % 360;
  return NAKSHATRA[Math.floor(sid / (360 / 27)) % 27];
}
/** 달의 모양 — 삭 이후 경과일로 여덟으로 가른다 */
export function moonPhase(y, m, d) {
  const age = (((jdn(y, m, d) - 2451550) % 29.53059) + 29.53059) % 29.53059;
  const n = age < 1.8 ? "새달" : age < 6.5 ? "초승달" : age < 9.5 ? "상현달" : age < 13.5 ? "차오르는 달"
    : age < 16.5 ? "보름달" : age < 21 ? "기우는 달" : age < 24.5 ? "하현달" : "그믐달";
  return { name: n, age: +age.toFixed(1) };
}
