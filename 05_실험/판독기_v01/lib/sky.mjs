/* 판독기 v02 — **출생지 좌표가 필요한** 판독기들.
   decoders.mjs 는 날짜·시각만으로 되는 것들이고, 여기는 위도·경도가 있어야 계산되는 것들이다.
   담긴 것: 상승궁(ASC)·중천(MC)·홀사인 12하우스 · 연간 프로펙션 · 파트 오브 포춘 ·
            비민쇼타리 다샤 · 아쉬타쿠타 36점 궁합.

   ★ 왜 이것들인가: 서양의 **연간 프로펙션**은 사주 세운의 대응물이고,
     인도의 **비민쇼타리 다샤**는 사주 대운의 대응물이다.
     같은 질문("올해는 어떤가 / 지금 어느 십 년인가")을 다른 문명이 어떻게 답하는지 나란히 놓을 수 있다. */
import { jdn, jdFromKST, sunLongitude, moonLongitude, ZODIAC12, NAKSHATRA } from "./decoders.mjs";

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
export function ashtakuta(aJd, aYear, bJd, bYear) {
  const A = nakIdxOf(aJd, aYear), B = nakIdxOf(bJd, bYear);
  const ayanA = 23.86 + (aYear - 1990) * 0.01397, ayanB = 23.86 + (bYear - 1990) * 0.01397;
  const rA = Math.floor(norm360(moonLongitude(aJd) - ayanA) / 30), rB = Math.floor(norm360(moonLongitude(bJd) - ayanB) / 30);
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
export { jdn, jdFromKST, sunLongitude, moonLongitude };
