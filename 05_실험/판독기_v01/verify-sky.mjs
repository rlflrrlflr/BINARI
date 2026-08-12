/* 좌표 판독기 검증. 실행: node 05_실험/판독기_v01/verify-sky.mjs
   ★ 상승궁은 알려진 대조표가 없어도 **자체 검증이 가능하다** —
     해가 뜨는 순간에는 해가 동쪽 지평선에 있으므로 **상승궁 ≈ 태양 황경**이어야 한다.
     이 성질로 검사하면 외부 자료 없이 공식의 옳고 그름이 갈린다. */
import { jdn, jdFromKST, sunLongitude, moonLongitude, nakshatra } from "./lib/decoders.mjs";
import { ascendant, midheaven, wholeSignHouse, signOf, profection, partOfFortune,
         isDayBirth, vimshottari, ashtakuta, DASHA, DASHA_TOTAL, gmst, obliquity } from "./lib/sky.mjs";

const R = []; const ck = (n, p, g = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${g ? " · " + g : ""}`); };
const SEOUL = { lat: 37.5665, lon: 126.978 };
const angDiff = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/* 검사용 가상 명식 두 개. **실제 인물의 생년월일시를 쓰지 않는다** —
   이 파일은 공개 리포에 남으므로, 한 사람을 특정할 수 있는 값(생일+생시+지역)이 들어가면 그 자체가 유출이다.
   검증에 필요한 건 "고정된 입력"이지 "진짜 입력"이 아니다. */
const FIX_A = jdFromKST(2000, 1, 1, 9, 0);      // 가상 A
const FIX_B = jdFromKST(1995, 6, 15, 21, 30);   // 가상 B — 궁합 검사의 상대

/* ── 기초 ── */
ck("황도 경사각 — 2000년경 23.44도", Math.abs(obliquity(2451545) - 23.4393) < 0.001, obliquity(2451545).toFixed(4));
ck("항성시 — 0~360 범위", [...Array(50)].every((_, i) => { const g = gmst(2451545 + i * 7.3); return g >= 0 && g < 360; }));

/* ── 상승궁: 일출 시각에 상승궁 ≈ 태양 ── */
/* 서울의 대략적 일출 시각(KST)으로 검사한다. 몇 분 오차는 황도 위 몇 도로 나타난다 */
const sunriseCases = [[2026, 3, 20, 6, 36], [2026, 6, 21, 5, 11], [2026, 9, 23, 6, 29], [2026, 12, 22, 7, 43]];
let worst = 0;
for (const [y, m, d, h, mi] of sunriseCases) {
  const jd = jdFromKST(y, m, d, h, mi);
  const diff = angDiff(ascendant(jd, SEOUL.lat, SEOUL.lon), sunLongitude(jd));
  worst = Math.max(worst, diff);
}
ck("상승궁 — 일출 순간에 태양과 거의 겹친다(오차 <8도)", worst < 8, `최대 ${worst.toFixed(1)}도`);

/* 남중 시각에는 태양이 중천(MC)과 겹쳐야 한다 */
let worstMc = 0;
for (const [y, m, d] of [[2026,3,20],[2026,6,21],[2026,9,23],[2026,12,22]]) {
  const jd = jdFromKST(y, m, d, 12, 30);   // 서울 남중은 대략 12:30
  worstMc = Math.max(worstMc, angDiff(midheaven(jd, SEOUL.lon), sunLongitude(jd)));
}
ck("중천 — 남중 무렵에 태양과 거의 겹친다(오차 <8도)", worstMc < 8, `최대 ${worstMc.toFixed(1)}도`);

/* 상승궁은 하루에 열두 자리를 모두 지나야 한다 */
const seen = new Set();
for (let i = 0; i < 48; i++) seen.add(signOf(ascendant(FIX_A + i / 48, SEOUL.lat, SEOUL.lon)));
ck("상승궁 — 하루에 열두 자리를 모두 지난다", seen.size === 12, `${seen.size}자리`);

/* ── 하우스 ── */
const jdB = FIX_A;
const asc = ascendant(jdB, SEOUL.lat, SEOUL.lon);
ck("홀사인 — 상승궁 자신은 1하우스", wholeSignHouse(asc, asc) === 1);
ck("홀사인 — 값이 항상 1~12", [...Array(360)].every((_, i) => { const h = wholeSignHouse(i, asc); return h >= 1 && h <= 12; }));
ck("낮/밤 — 정오 출생은 낮", isDayBirth(jdFromKST(2000, 6, 1, 12, 0), SEOUL.lat, SEOUL.lon) === true);
ck("낮/밤 — 자정 출생은 밤", isDayBirth(jdFromKST(2000, 6, 1, 0, 0), SEOUL.lat, SEOUL.lon) === false);

/* ── 프로펙션 ── */
ck("프로펙션 — 0세는 1하우스", profection(asc, 0).house === 1);
ck("프로펙션 — 12세면 제자리", profection(asc, 12).house === 1 && profection(asc, 12).sign === profection(asc, 0).sign);
ck("프로펙션 — 열두 해가 열두 하우스를 모두 돈다",
   new Set([...Array(12)].map((_, i) => profection(asc, i).house)).size === 12);
ck("프로펙션 — 1세는 2하우스(재물)", profection(asc, 1).house === 2 && profection(asc, 1).theme.includes("재물"));

/* ── 파트 오브 포춘 ── */
const pof = partOfFortune(jdB, asc, isDayBirth(jdB, SEOUL.lat, SEOUL.lon));
ck("파트 오브 포춘 — 0~360 범위", pof >= 0 && pof < 360, `${pof.toFixed(1)}도 · ${signOf(pof)}`);
/* 낮 공식과 밤 공식은 상승궁을 축으로 대칭이어야 한다 */
const pofD = partOfFortune(jdB, asc, true), pofN = partOfFortune(jdB, asc, false);
ck("파트 — 낮 공식과 밤 공식이 상승궁 대칭",
   Math.abs(angDiff(pofD, asc) - angDiff(pofN, asc)) < 0.01, `${pofD.toFixed(1)} / ${pofN.toFixed(1)}`);

/* ── 비민쇼타리 다샤 ── */
ck("다샤 — 아홉 시기의 합이 정확히 120년", DASHA_TOTAL === 120, String(DASHA_TOTAL));
const vd = vimshottari(jdB, 2000, 9);
ck("다샤 — 첫 시기는 남은 만큼만", vd.balance > 0 && vd.balance <= DASHA.find(([l]) => l === vd.startLord)[1],
   `${vd.startLord} ${vd.balance}년 남음`);
ck("다샤 — 아홉 시기를 돌면 시작 주인으로 돌아온다",
   vimshottari(jdB, 2000, 10).periods[9].lord === vd.startLord);
ck("다샤 — 구간이 끊기지 않는다", vd.periods.every((p, i) => i === 0 || Math.abs(p.from - vd.periods[i-1].to) < 0.05));
/* 값을 못 박지 않고 **두 모듈을 맞대어** 검사한다. 그래야 입력을 바꿔도 검사가 살아 있고,
   원래 이 검사가 잡으려던 것(sky.mjs 의 다샤가 decoders.mjs 의 달자리와 어긋나는가)도 그대로 잡힌다. */
ck("다샤 — 달자리가 판독기 v01 과 일치", vd.nakshatra === nakshatra(jdB, 2000),
   `${vd.nakshatra} / ${nakshatra(jdB, 2000)}`);
ck("다샤 — 입력을 바꿔도 두 모듈이 계속 일치", [...Array(24)].every((_, i) => {
  const j = jdFromKST(1990 + i, 1 + i % 12, 1 + i % 28, 3 + i % 20, 0);
  return vimshottari(j, 1990 + i, 1).nakshatra === nakshatra(j, 1990 + i); }));

/* ── 아쉬타쿠타 ── */
const jdH = FIX_B;
const ak = ashtakuta(jdB, 2000, jdH, 1995);
ck("궁합 — 총점이 0~36", ak.total >= 0 && ak.total <= 36, `${ak.total}/36`);
ck("궁합 — 여덟 항목이 다 채점됨", Object.keys(ak.detail).length === 8, Object.keys(ak.detail).join(","));
ck("궁합 — 자기 자신과는 나디가 0점(같은 체질)", ashtakuta(jdB, 2000, jdB, 2000).detail.나디 === 0);
ck("궁합 — 자기 자신과는 요니·가나가 만점", (() => { const x = ashtakuta(jdB,2000,jdB,2000).detail; return x.요니 === 4 && x.가나 === 6; })());
ck("궁합 — 어떤 짝이든 상한을 넘지 않는다", [...Array(120)].every((_, i) => {
  const j1 = jdFromKST(2000, 1 + i % 12, 1 + i % 28, 12, 0), j2 = jdFromKST(1995, 1 + (i * 7) % 12, 1 + (i * 3) % 28, 9, 0);
  const t = ashtakuta(j1, 2000, j2, 1995).total; return t >= 0 && t <= 36; }));

console.log("\n── 가상 명식 두 개(A·B) 판독 결과 ──");
for (const [lab, jd, yr] of [["A", jdB, 2000], ["B", jdH, 1995]]) {
  const a = ascendant(jd, SEOUL.lat, SEOUL.lon), day = isDayBirth(jd, SEOUL.lat, SEOUL.lon);
  const v = vimshottari(jd, yr, 4);
  console.log(`  ${lab}: 상승궁 ${signOf(a)} · 중천 ${signOf(midheaven(jd, SEOUL.lon))} · ${day ? "낮" : "밤"} 출생`);
  console.log(`      해는 ${wholeSignHouse(sunLongitude(jd), a)}하우스 · 달은 ${wholeSignHouse(moonLongitude(jd), a)}하우스 · 재물의 자리 ${signOf(partOfFortune(jd, a, day))}`);
  console.log(`      다샤: ${v.periods.map(p => `${p.lord}(${p.from}~${p.to}세)`).join(" → ")}`);
}
console.log(`  A·B 궁합: ${ak.total}/36 —`, Object.entries(ak.detail).map(([k, v]) => `${k} ${v}`).join(" · "));

const pass = R.filter(Boolean).length;
console.log(`\n=== 좌표 판독기 검증: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
