/* 성명학 계산 — 사격(81수리) · 수리음양 · 발음오행 · 자원오행(용신)
   ★ 이 모듈은 '자르지' 않는다. 값만 낸다. 무엇을 자를지는 filter.mjs 가 정한다. */
export const GIL = new Set([1,3,5,6,7,8,11,13,15,16,17,18,21,23,24,25,29,31,32,33,35,37,39,41,45,47,48,52,57,61,63,65,67,68,81]);
const SANG = { 목:"화", 화:"토", 토:"금", 금:"수", 수:"목" };
const GEUK = { 목:"토", 토:"수", 수:"화", 화:"금", 금:"목" };

/* 발음오행 두 체계 — ㅁㅂㅍ / ㅇㅎ 의 배속이 정반대다.
   업계는 운해식이 다수지만 학계는 해례본식이다. 어느 쪽도 단독으로 이름을 기각할 근거가 못 된다. */
export const HAERYE = { ㄱ:"목",ㅋ:"목",ㄴ:"화",ㄷ:"화",ㄹ:"화",ㅌ:"화",ㅁ:"토",ㅂ:"토",ㅍ:"토",ㅅ:"금",ㅈ:"금",ㅊ:"금",ㅇ:"수",ㅎ:"수" };
export const UNHAE  = { ㄱ:"목",ㅋ:"목",ㄴ:"화",ㄷ:"화",ㄹ:"화",ㅌ:"화",ㅁ:"수",ㅂ:"수",ㅍ:"수",ㅅ:"금",ㅈ:"금",ㅊ:"금",ㅇ:"토",ㅎ:"토" };
const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const DBL = { ㄲ:"ㄱ", ㄸ:"ㄷ", ㅃ:"ㅂ", ㅆ:"ㅅ", ㅉ:"ㅈ" };
export function initial(syl) { const c = CHO[Math.floor((syl.charCodeAt(0) - 0xAC00) / 588)]; return DBL[c] ?? c; }

const norm = (v) => (v > 81 ? v - 80 : v);
/** 사격(四格) — 원·형·이·정. 성 1자 + 이름 2자 기준. */
export function sagyeok(surStroke, a, b) {
  const four = { 원: a + b, 형: surStroke + a, 이: surStroke + b, 정: surStroke + a + b };
  const gil = Object.values(four).filter(v => GIL.has(norm(v))).length;
  return { four, gil };
}
/** 수리음양 — 홀=양, 짝=음. 순양·순음은 흉으로 본다(이건 유파 이견이 거의 없다). */
export function eumyang(strokes) {
  const yy = strokes.map(v => (v % 2 ? "양" : "음"));
  return { pattern: yy.join(""), pure: new Set(yy).size === 1 };
}
/** 발음오행 — 상생사슬 개수와 '상극 없음' 여부를 두 체계로 각각 낸다. */
export function baleum(syllables) {
  const run = (MAP) => {
    const els = syllables.map(s => MAP[initial(s)]);
    let chain = 0;
    for (let i = 0; i < els.length - 1; i++) if (SANG[els[i]] === els[i+1] || els[i] === els[i+1]) chain++;
    const noClash = els.every((e, i) => i === 0 || !(GEUK[els[i-1]] === e || GEUK[e] === els[i-1]));
    return { els, chain, total: els.length - 1, noClash };
  };
  const haerye = run(HAERYE), unhae = run(UNHAE);
  return { haerye, unhae, agree: haerye.chain === unhae.chain };
}
/** 자원오행이 용신을 채우는가 — 사주에서 0개인 오행을 채우면 가중한다. */
export function yongsinFit(jawonList, yongsin, lacking = []) {
  const hit = jawonList.filter(e => e && yongsin.includes(e));
  const fillsLack = jawonList.filter(e => e && lacking.includes(e));
  return { hit: hit.length, of: jawonList.length, fillsLack: fillsLack.length };
}
