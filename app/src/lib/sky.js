/* ── 여러 하늘 엔진 (app 이식본) ────────────────────────────────────────────
   출처: 05_실험/판독기_v01/lib/{decoders,sky,flow}.mjs — 자체 검증 27+26+18건을 통과한 코드다.
   여기로 옮기는 이유: 각인 리포트가 사주 하나가 아니라 **여러 문명의 셈을 겹쳐서** 나오기 때문이다.
   특히 시간축(지금·앞으로)을 주는 건 셋뿐이다 — 사주의 열 해 흐름 · 인도 다샤 · 서양 프로펙션.

   ⚠ jdn·sunLongitude·moonLongitude·jdFromKST 는 App.jsx 에도 있다(사주 계산용).
     합치지 않고 둔 이유: 사주 쪽은 이미 만세력 28건 대조를 통과했고, 여기를 건드리면 그 검증이 흔들린다.
     대신 **두 벌이 같은 값을 내는지 검사로 못 박았다**(e2e/sky-check.mjs). 값이 갈리면 검사가 운다.
   ⚠ 이 파일은 계산만 한다. 무슨 말로 옮길지는 imprint.js 가 정한다. */

/* ── decoders ── */
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
/** 마야 하압 — 365일 태양력(20일 × 18달 + 와옙 5일). 촐킨과 짝을 이뤄 52년 주기를 만든다. [verified]
    ⚠ **일부러 각인·궁합에 안 붙였다(2026-08-15 판정).** 계산은 맞고 검증도 됐지만 붙일 자리가 없다:
      촐킨이 이미 "맡은 일"을 답하고 있어서 하압이 새로 답할 게 **52년 주기(캘린더 라운드)** 뿐인데,
      그건 **모든 사람에게 52세**로 똑같이 나온다. 상수는 판독이 아니다 —
      v117 에 서양 프로펙션 축을 뺀 것과 같은 이유다(200명 중 148명이 "30세"였다).
      붙일 길이 생긴다면 "하압 달 이름"을 태어난 계절의 이름으로 쓰는 쪽인데, 그건 절기와 겹친다. */
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

/** 태국 요일 점성 — 요일마다 색·행성·수호 불상이 정해져 있고 일상에 실재한다. [verified]
    ⚠ **일부러 각인·궁합에 안 붙였다(2026-08-15 판정).** 입력이 **요일 하나**인데,
      같은 요일을 자바 웨톤(neptu)과 아칸 데이네임이 이미 쓰고 있다. 붙이면 아홉 하늘 중 셋이
      **같은 입력을 세 번 읽는 꼴**이 된다 — 각인·궁합의 제1규칙이 "분업이지 투표가 아니다"이고,
      창업자 판정("그냥 사주인데 굳이 쟤네 왜 붙였지")의 답이 정확히 그거였다.
      **판독기가 있다고 다 붙이지 않는다.** 새 질문을 맡을 수 있을 때만 붙인다. */
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

/* ── sky ── */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const norm360 = (x) => ((x % 360) + 360) % 360;

/** 황도 경사각 — 시대에 따라 아주 천천히 변한다 */
export const obliquity = (jd) => 23.439291 - 0.0130042 * ((jd - 2451545.0) / 36525);

/** 그리니치 항성시(도) — 하늘이 얼마나 돌아갔는지 */
export function gmst(jd) {
  const T = (jd - 2451545.0) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * T * T - (T * T * T) / 38710000);
}
/** 지방 항성시(도) — 동경을 양수로 넣는다 */
export const lst = (jd, lonEast) => norm360(gmst(jd) + lonEast);

/** 상승궁(ASC) — 태어난 순간 동쪽 지평선에 떠오르던 황도 위치.
    서양 점성술에서 **태양·달과 함께 세 기둥**으로 치고, 프로펙션의 출발점이 된다. */
export function ascendant(jd, latDeg, lonEast) {
  const ramc = lst(jd, lonEast) * D2R, eps = obliquity(jd) * D2R, phi = latDeg * D2R;
  const a = Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)));
  return norm360(a * R2D);
}
/** 중천(MC) — 그 순간 하늘 꼭대기에 있던 황도 위치 */
export function midheaven(jd, lonEast) {
  const ramc = lst(jd, lonEast) * D2R, eps = obliquity(jd) * D2R;
  return norm360(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) * R2D);
}
export const signOf = (lon) => ZODIAC12[Math.floor(norm360(lon) / 30) % 12];
export const signIdx = (lon) => Math.floor(norm360(lon) / 30) % 12;

/** 홀사인 하우스 — 상승궁이 든 별자리가 통째로 1하우스가 된다.
    헬레니즘 시대의 원래 방식이고, 프로펙션이 이 방식을 전제로 한다. */
export function wholeSignHouse(lon, ascLon) {
  return ((signIdx(lon) - signIdx(ascLon) + 12) % 12) + 1;
}

/** 하우스가 뜻하는 것 — 열두 삶의 자리 */
export const HOUSE_KO = [null, "몸과 나 자신", "재물과 가진 것", "형제와 가까운 이동", "집과 부모", "자식과 즐거움", "일과 몸의 수고",
  "짝과 맞상대", "위기와 남의 것", "배움과 먼 길", "직업과 이름", "친구와 바라는 것", "숨은 것과 놓아줌"];
export const SIGN_LORD = ["화성","금성","수성","달","해","수성","금성","화성","목성","토성","토성","목성"];

/** 연간 프로펙션 — **서양의 세운**. 나이만큼 하우스를 한 칸씩 옮겨 그해의 주제를 잡는다.
    한 살마다 한 칸, 열두 해마다 제자리로 돌아온다. 헬레니즘 점성술의 표준 연운 기법이다. */
export function profection(ascLon, ageYears) {
  const h = (Math.floor(ageYears) % 12) + 1;
  const sIdx = (signIdx(ascLon) + h - 1) % 12;
  return { house: h, sign: ZODIAC12[sIdx], lord: SIGN_LORD[sIdx], theme: HOUSE_KO[h] };
}

/** 파트 오브 포춘 — 아라비아 파트 중 가장 오래되고 널리 쓰인 것. **재물과 몸의 자리**로 읽는다.
    낮에 났으면 상승궁+달−해, 밤에 났으면 상승궁+해−달. */
export function partOfFortune(jd, ascLon, isDay) {
  const s = sunLongitude(jd), m = moonLongitude(jd);
  return norm360(isDay ? ascLon + m - s : ascLon + s - m);
}
/** 낮에 났나 밤에 났나 — 해가 지평선 위였는지로 가른다(섹트). 파트 계산이 이걸로 갈린다. */
export function isDayBirth(jd, latDeg, lonEast) {
  const s = sunLongitude(jd), asc = ascendant(jd, latDeg, lonEast);
  const h = wholeSignHouse(s, asc);
  return h >= 7;   // 7~12하우스 = 지평선 위
}

/* ── 인도 · 비민쇼타리 다샤 ─────────────────────────
   달이 머문 자리에서 시작해 아홉 행성이 정해진 햇수만큼 돌아간다. 합이 정확히 120년이다.
   **사주의 대운에 대응하는 인도의 시간 축**이다. */
export const DASHA = [["케투",7],["금성",20],["해",6],["달",10],["화성",7],["라후",18],["목성",16],["토성",19],["수성",17]];
export const DASHA_TOTAL = DASHA.reduce((a,[,y])=>a+y,0);   // 120

export function vimshottari(jd, year, count = 5) {
  const ayan = 23.86 + (year - 1990) * 0.01397;
  const sid = norm360(moonLongitude(jd) - ayan);
  const span = 360 / 27, idx = Math.floor(sid / span);
  const frac = (sid - idx * span) / span;          // 그 자리를 얼마나 지났나
  const start = idx % 9;
  const balance = DASHA[start][1] * (1 - frac);    // 남은 첫 시기
  const out = []; let age = 0;
  for (let i = 0; i < count; i++) {
    const [lord, yrs] = DASHA[(start + i) % 9];
    const len = i === 0 ? balance : yrs;
    out.push({ lord, from: +age.toFixed(1), to: +(age + len).toFixed(1), years: +len.toFixed(1) });
    age += len;
  }
  return { nakshatra: NAKSHATRA[idx], startLord: DASHA[start][0], balance: +balance.toFixed(2), periods: out };
}

/* ── 인도 · 아쉬타쿠타 36점 궁합 ─────────────────────
   두 사람의 달 자리로 여덟 항목을 채점한다. 인도 결혼 궁합의 사실상 표준이고 **점수가 나온다**.
   우리 쓸모: 형제 궁합·배우자 궁합을 사주와 나란히 놓고 교차 검증할 수 있다. */
const YONI = [0,1,2,3,3,4,5,6,5,7,8,8,9,10,7,10,11,11,12,13,9,0,12,13,1,4,2];   // 27자리 → 14동물
const YONI_NAME = ["말","코끼리","양","뱀","개","고양이","쥐","소","물소","호랑이","사슴","원숭이","몽구스","사자"];
const GANA = [0,1,0,1,0,2,0,1,2, 2,1,1,0,1,0,2,1,2, 2,1,1,0,2,1,1,1,1];        // 0신족 1인간 2악귀
const GANA_NAME = ["신족","인간","악귀"];
const NADI = [0,1,2,0,1,2,0,1,2, 2,1,0,2,1,0,2,1,0, 0,1,2,0,1,2,0,1,2];        // 0바타 1피타 2카파
const NADI_NAME = ["바타","피타","카파"];
const VARNA_BY_SIGN = [1,2,3,4,1,2,3,4,1,2,3,4];   // 별자리 → 계급(1 최하 ~ 4 최상)
const LORD_OF_SIGN = [4,5,3,1,0,3,5,4,2,6,6,2];    // 0해 1달 2목성 3수성 4화성 5금성 6토성
/* 행성 사이의 친분 — 그라하 마이트리 채점표(5점 만점) */
const FRIEND = [
  /* 해 */   [5,5,5,4,5,0.5,1],
  /* 달 */   [5,5,4,4,4,0.5,1],
  /* 화성 */ [5,4,5,0.5,5,0.5,1],
  /* 수성 */ [4,1,0.5,5,0.5,5,4],
  /* 목성 */ [5,4,5,0.5,5,0.5,1],
  /* 금성 */ [0.5,0.5,0.5,5,0.5,5,5],
  /* 토성 */ [1,1,1,4,1,5,5],
];
function nakIdxOf(jd, year) {
  const ayan = 23.86 + (year - 1990) * 0.01397;
  return Math.floor(norm360(moonLongitude(jd) - ayan) / (360 / 27)) % 27;
}
/* 한 사람의 인도 좌표 둘 — 나크샤트라(27) · 라시(12).
   ⚠ **이걸 왜 밖으로 꺼냈나**: 아쉬타쿠타는 두 사람 각각에서 **정수 두 개**만 쓴다.
     초대 회신에서는 받은 사람이 보낸 사람의 생년월일을 모른 채 계산해야 하는데,
     그때 필요한 게 율리우스일이 아니라 **이 두 정수**다. 있는 값을 이름 붙여 내보낼 뿐 —
     계산은 하나도 안 바뀐다(`ashtakuta` 가 아래에서 이걸 그대로 부른다). */
export function sidIdx(jd, year) {
  const ayan = 23.86 + (year - 1990) * 0.01397;
  return { nak: nakIdxOf(jd, year), rashi: Math.floor(norm360(moonLongitude(jd) - ayan) / 30) };
}
/** 아쉬타쿠타 본체 — 좌표(나크샤트라·라시)만 받는다. 생년월일이 필요 없다. */
export function ashtakutaIdx(A, rA, B, rB) {
  const s = {};
  /* 바르나(1) — 계급. 남자 쪽이 같거나 위면 1점 */
  s.바르나 = VARNA_BY_SIGN[rA] >= VARNA_BY_SIGN[rB] ? 1 : 0;
  /* 바샤(2) — 서로 끌리는가. 같은 별자리군이면 2점, 이웃이면 1점 */
  const grp = (r) => [0,4,8].includes(r) ? 0 : [1,5,9].includes(r) ? 1 : [2,6,10].includes(r) ? 2 : 3;
  s.바샤 = grp(rA) === grp(rB) ? 2 : Math.abs(rA - rB) % 6 === 0 ? 1 : 0;
  /* 타라(3) — 별자리 사이 거리. 아홉으로 나눈 나머지가 길수면 3점 */
  const t1 = ((B - A + 27) % 27 + 1) % 9, t2 = ((A - B + 27) % 27 + 1) % 9;
  const good = (t) => ![3,5,7].includes(t);
  s.타라 = (good(t1) ? 1.5 : 0) + (good(t2) ? 1.5 : 0);
  /* 요니(4) — 동물 궁합. 같으면 4점, 다르면 거리로 깎는다 */
  s.요니 = YONI[A] === YONI[B] ? 4 : (Math.abs(YONI[A] - YONI[B]) <= 3 ? 3 : Math.abs(YONI[A] - YONI[B]) <= 6 ? 2 : 1);
  /* 그라하 마이트리(5) — 두 사람 별자리 주인끼리의 친분 */
  s.그라하 = FRIEND[LORD_OF_SIGN[rA]][LORD_OF_SIGN[rB]];
  /* 가나(6) — 기질 유형. 같으면 6점 */
  s.가나 = GANA[A] === GANA[B] ? 6 : (GANA[A] === 1 || GANA[B] === 1) ? 5 : 0;
  /* 바쿠트(7) — 별자리 거리가 6·8·12면 0점 */
  const d = ((rB - rA + 12) % 12) + 1, d2 = ((rA - rB + 12) % 12) + 1;
  s.바쿠트 = ([6,8,12].includes(d) || [6,8,12].includes(d2)) ? 0 : 7;
  /* 나디(8) — 체질. **다르면 8점, 같으면 0점**(가장 무겁게 본다) */
  s.나디 = NADI[A] === NADI[B] ? 0 : 8;
  const total = Object.values(s).reduce((a, b) => a + b, 0);
  return { total: +total.toFixed(1), max: 36, detail: s,
    a: { nak: NAKSHATRA[A], yoni: YONI_NAME[YONI[A]], gana: GANA_NAME[GANA[A]], nadi: NADI_NAME[NADI[A]], rashi: ZODIAC12[rA] },
    b: { nak: NAKSHATRA[B], yoni: YONI_NAME[YONI[B]], gana: GANA_NAME[GANA[B]], nadi: NADI_NAME[NADI[B]], rashi: ZODIAC12[rB] } };
}
/** 생년월일에서 바로 — 기존 호출부가 쓰던 얼굴 그대로다. */
export function ashtakuta(aJd, aYear, bJd, bYear) {
  const a = sidIdx(aJd, aYear), b = sidIdx(bJd, bYear);
  return ashtakutaIdx(a.nak, a.rashi, b.nak, b.rashi);
}
/* ── flow ── */
export const GAN = ["갑","을","병","정","무","기","경","신","임","계"];
export const JI  = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
export const GANH = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
export const JIH  = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
export const GAN_EL = ["목","목","화","화","토","토","금","금","수","수"];
export const JI_EL  = ["수","토","목","목","토","화","화","토","금","금","토","수"];
export const JI_BONGI = [9,5,0,1,4,2,3,5,6,7,4,8];
const SAENG = { 목:"화", 화:"토", 토:"금", 금:"수", 수:"목" };
const GEUK  = { 목:"토", 토:"수", 수:"화", 화:"금", 금:"목" };

export function sipseong(dg, tg) {
  const me = GAN_EL[dg], ta = GAN_EL[tg], same = dg % 2 === tg % 2;
  if (me === ta) return same ? "비견" : "겁재";
  if (SAENG[me] === ta) return same ? "식신" : "상관";
  if (GEUK[me] === ta) return same ? "편재" : "정재";
  if (GEUK[ta] === me) return same ? "편관" : "정관";
  return same ? "편인" : "정인";
}
/** 십성이 그해·그달에 무엇으로 나타나는가 — 결정론적 표. 서술만 표에 두고 계산은 코드가 한다. */
export const SS_FLOW = {
  비견: "제 힘으로 미는 때 · 동료와 경쟁이 함께 온다",
  겁재: "경쟁과 지출이 는다 · 빌려주기·보증을 조심할 때",
  식신: "먹고사는 것이 순해지는 때 · 몸이 편하다",
  상관: "말과 재주가 터지는 때 · 윗사람과 부딪히기도 한다",
  정재: "꾸준한 수입이 붙는 때 · 살림이 정리된다",
  편재: "큰돈이 오가는 때 · 들어온 만큼 나가기도 한다",
  정관: "자리와 이름이 서는 때 · 책임이 늘어난다",
  편관: "압박이 몰리는 때 · 버티면 단단해진다",
  정인: "배움과 문서의 때 · 도와주는 어른이 온다",
  편인: "혼자 깊어지는 때 · 남다른 길이 열린다",
};

/** 세운 — 해의 간지. 사주년은 입춘에서 갈린다. */
export function seun(dayGanIdx, fromYear, n = 6) {
  const out = [];
  for (let y = fromYear; y < fromYear + n; y++) {
    const t = (((y - 4) % 60) + 60) % 60, g = t % 10, j = t % 12;
    out.push({ year: y, ganji: GANH[g] + JIH[j], kr: GAN[g] + JI[j],
      ganSS: sipseong(dayGanIdx, g), jiSS: sipseong(dayGanIdx, JI_BONGI[j]),
      el: [GAN_EL[g], JI_EL[j]] });
  }
  return out;
}

/** 절기로 가른 달의 시작 시각(KST 율리우스일). 사주월은 입춘(황경 315도)부터 30도씩이다. */
export function monthBoundaries(year) {
  const f = (jd, target) => { let x = sunLongitude(jd) - target; if (x > 180) x -= 360; if (x < -180) x += 360; return x; };
  const find = (target, guessJd) => {
    let a = guessJd - 20;
    for (let i = 0; i < 200; i++) {
      const b = a + 0.5;
      if (f(a, target) * f(b, target) <= 0 && Math.abs(f(a, target)) < 30) {
        let lo = a, hi = b;
        for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; (f(lo, target) * f(mid, target) <= 0) ? hi = mid : lo = mid; }
        return (lo + hi) / 2;
      }
      a = b;
    }
    return null;
  };
  const out = [];
  for (let i = 0; i < 12; i++) {
    const target = (315 + i * 30) % 360;
    const guess = jdFromKST(year, 2 + i, 5, 12, 0);
    const jd = find(target, guess);
    if (jd != null) out.push({ mn: i + 1, target, jd });
  }
  return out;
}
/** 월운 — 절기로 가른 열두 달의 간지와 십성. 달력 1월이 아니라 입춘 기준이다. */
export function wolun(dayGanIdx, yearGanIdx, year) {
  const bs = monthBoundaries(year);
  const toKST = (jd) => new Date((jd - 2440587.5 + 9 / 24) * 86400000).toISOString().slice(0, 10);
  return bs.map(({ mn, jd }) => {
    const mJ = (mn + 1) % 12, mG = ((yearGanIdx % 5) * 2 + 2 + (mn - 1)) % 10;
    return { mn, start: toKST(jd), ganji: GANH[mG] + JIH[mJ], kr: GAN[mG] + JI[mJ],
      ganSS: sipseong(dayGanIdx, mG), jiSS: sipseong(dayGanIdx, JI_BONGI[mJ]),
      el: [GAN_EL[mG], JI_EL[mJ]] };
  });
}
/** 그 해·달이 이 사람에게 순한가 거스르는가 — 용신(필요한 기운)과 대조해 점수를 낸다.
    ★ 이 점수는 '통설 해석'이다. 간지 자체는 계산값이지만 높낮이는 읽는 방식에 따라 달라진다. */
export function favor(el, yongsin, gisin) {
  let s = 0;
  for (let i = 0; i < el.length; i++) {
    const w = i === 0 ? 1 : 2;                  // 지지에 두 배 가중
    if (yongsin.includes(el[i])) s += w;
    else if (gisin.includes(el[i])) s -= w;
  }
  return s;   // -3 ~ +3
}
