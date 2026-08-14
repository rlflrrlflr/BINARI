/* 흐름 — 해와 달 단위의 운(세운·월운).
   대운이 열 해짜리 배경이라면 이건 **눈앞의 시계**다. 그리고 **매년 갱신되므로 리포트를 다시 열게 만든다**
   (경쟁 8개사 중 여섯이 단발결제로 끝난다 — 리텐션이 시장 전체의 구멍이다).

   세운은 해의 간지, 월운은 **절기로 가른 달**의 간지다. 달력의 1월이 아니라 입춘·경칩… 기준이다. */
import { jdn, jdFromKST, sunLongitude } from "./decoders.mjs";

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
export { jdn, jdFromKST };
