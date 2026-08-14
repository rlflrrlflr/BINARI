/* ── 궁합 판정 엔진 ───────────────────────────────────────────────────────
   창업자 요청(2026-08-14): "궁합 기능도 붙여주고."

   ⚠ **각인과 같은 원칙으로 만든다.** 궁합이야말로 "점수 하나"로 뭉개기 쉬운 자리다.
   ① **분업** — 아홉 하늘에게 같은 질문을 던져 평균 내지 않는다. 각자 **다른 것**을 본다:
      동아시아 일간=누가 주고 받나 / 일지=생활이 맞나 / 인도=여덟 항목 / 서양=성향과 감정 /
      자바=날의 무게 / 마야=역할 / 납음=소리 / 수비학=배우는 게 같나.
      점수를 합산하면 그건 아홉을 돌린 게 아니라 한 번 돌린 것과 같다.
   ② **어긋남을 감추지 않는다** — 인도는 높은데 동아시아가 낮으면 그게 이 문서의 알맹이다.
      "잘 맞아요/안 맞아요"는 어디서든 살 수 있다. 어디서 갈리는지는 여기서만 나온다.
   ③ **총점을 맨 앞에 두지 않는다** — 숫자를 먼저 보면 나머지를 안 읽는다.
   ④ **헤어지라고 말하지 않는다.** 판정은 "무엇을 조심하라"까지다. 관계를 끊는 결정은 우리 몫이 아니다. */
import {
  jdFromKST, jdn, sunSign, moonSign, nakshatra, tzolkin, nayin, weton, lifePath,
  ashtakuta, sipseong as ssOf, GAN as GANK, JI as JIK, GAN_EL, JI_EL,
} from "./sky.js";

const jong = (s) => { const c = (s || "").trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0; };
const IGA = (s) => s + (jong(s) ? "이" : "가");
const EUN = (s) => s + (jong(s) ? "은" : "는");
const dot = (s) => { const t = String(s).trim(); return /[.!?…]$/.test(t) ? t : t + "."; };
const EL_KO = { 목: "나무", 화: "불", 토: "흙", 금: "쇠", 수: "물" };
const ZO_EL = { 양자리: "불", 사자자리: "불", 사수자리: "불", 황소자리: "흙", 처녀자리: "흙", 염소자리: "흙",
  쌍둥이자리: "공기", 천칭자리: "공기", 물병자리: "공기", 게자리: "물", 전갈자리: "물", 물고기자리: "물" };
const SANG = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };   // 내가 낳는다
const GEUK = { 목: "토", 화: "금", 토: "수", 금: "목", 수: "화" };   // 내가 이긴다

/* 십이지 관계 — 전통 배당 그대로다(변환 없음).
   자0 축1 인2 묘3 진4 사5 오6 미7 신8 유9 술10 해11 */
const YUKHAP = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];              // 육합 — 둘이 붙는다
const SAMHAP = [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]];                  // 삼합 — 셋이 한 무리
const HYEONG = [[2, 5, 8], [1, 10, 7], [0, 3]];                                  // 형 — 서로 깎는다
const SELF_H = [4, 6, 9, 11];                                                    // 자형 — 같은 글자끼리
const jiRel = (a, b) => {
  if (YUKHAP.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return "육합";
  if (SAMHAP.some((g) => g.includes(a) && g.includes(b) && a !== b)) return "삼합";
  if (Math.abs(a - b) === 6) return "충";
  if (HYEONG.some((g) => g.includes(a) && g.includes(b) && a !== b)) return "형";
  if (a === b && SELF_H.includes(a)) return "자형";
  if (a === b) return "같음";
  return "무관";
};
const JI_REL_W = {
  육합: { v: 2, w: "<b>둘이 붙는 짝이야.</b> 생활 리듬이 맞아서 같이 있는 게 편해. 밥때·잠때·집 안 동선이 자연스럽게 겹쳐" },
  삼합: { v: 2, w: "<b>같은 무리로 묶이는 짝이야.</b> 목표가 같은 쪽을 봐. 둘이 뭔가를 같이 벌이면 잘 굴러가" },
  같음: { v: 1, w: "<b>같은 글자를 가진 짝이야.</b> 서로를 잘 알아봐 — 설명 안 해도 통해. 대신 <b>같은 데서 같이 지친다</b>" },
  충: { v: -2, w: "<b>정면으로 부딪히는 짝이야.</b> 끌리는 힘도 세고 부딪히는 힘도 세. 조용한 사이가 되기는 어려워 — <b>나쁘다는 게 아니라 잔잔하지 않다</b>는 뜻이야" },
  형: { v: -1, w: "<b>서로를 조금씩 깎는 짝이야.</b> 크게 싸우진 않는데 사소한 게 자꾸 쌓여. 말 안 하고 넘긴 게 문제가 돼" },
  자형: { v: -1, w: "<b>같은 약점을 나눠 가진 짝이야.</b> 서로를 이해하는 만큼 <b>같은 실수를 같이 해</b> — 말릴 사람이 없어" },
  무관: { v: 0, w: "<b>서로를 밀지도 당기지도 않는 짝이야.</b> 감정이 저절로 올라오는 사이는 아니고, <b>같이 만들어 가야 하는</b> 사이야" },
};
/* 아쉬타쿠타 여덟 항목이 각각 무엇을 보는가 — 인도 전통의 항목 정의 그대로다 */
const AK_MEAN = {
  바르나: ["일에서의 결", "누가 판을 주도하나. 낮으면 둘 다 주도하려 해서 부딪혀"],
  바샤: ["서로 끌리는 힘", "처음에 끌렸던 그 힘이야. 낮으면 만나기까지가 오래 걸려"],
  타라: ["서로의 운을 밀어 주나", "같이 있을 때 일이 잘 풀리는가. 낮으면 각자 있을 때가 더 나아"],
  요니: ["몸과 잠자리의 결", "체질과 리듬이 맞는가. 낮으면 피곤한 시기에 먼저 티가 나"],
  그라하: ["생각이 통하나", "대화가 되는가. 낮으면 같은 말을 다르게 알아들어"],
  가나: ["기질이 맞나", "노는 방식·쉬는 방식이 같은가. 낮으면 주말 보내는 법에서 갈려"],
  바쿠트: ["같이 살 때의 흐름", "함께 사는 동안 일이 어떻게 풀리나. 여기가 0이면 다른 데가 높아도 무겁게 봐야 해"],
  나디: ["체질이 겹치나", "<b>인도에서 가장 무겁게 보는 항목</b>이야. 같은 체질이면 0점 — 좋고 나쁨이 아니라 <b>서로의 약점을 못 메운다</b>는 뜻이야"],
};
const LP_TASK = { 1: "혼자 서는 법", 2: "둘 사이를 잇는 법", 3: "밖으로 꺼내는 법", 4: "쌓아 올리는 법",
  5: "한 자리에 묶이지 않는 법", 6: "떠맡되 짓눌리지 않는 법", 7: "혼자 깊이 파는 법",
  8: "돈과 힘을 다루는 법", 9: "놓아주는 법", 11: "남을 비추는 법", 22: "크게 짓는 법", 33: "가르치는 법" };

/** 두 사람의 궁합. a·b 는 { saju:{idx}, birth:{y,m,d,h,min}, sex, name } */
export function readMatch({ a, b, lat = 37.5665, lon = 126.978 } = {}) {
  if (!a?.saju?.idx || !b?.saju?.idx || !a?.birth?.y || !b?.birth?.y) return null;
  const notes = [];
  const fn = (t) => { notes.push(t); return notes.length; };
  const jdOf = (p) => jdFromKST(+p.birth.y, +p.birth.m, +p.birth.d,
    p.saju.idx.hG == null ? 12 : +p.birth.h, p.saju.idx.hG == null ? 0 : (+p.birth.min || 0));
  const jdA = jdOf(a), jdB = jdOf(b);
  const elA = GAN_EL[a.saju.idx.dG], elB = GAN_EL[b.saju.idx.dG];
  const rows = [];
  const put = (from, ask, val, w, v, why) => rows.push({ from, ask, val, w, v, n: fn(`${from} — ${why}`) });

  /* ① 동아시아 · 일간 — 누가 주고 누가 받나 */
  {
    const w = elA === elB
      ? { v: 1, t: `<b>둘 다 ${EL_KO[elA]}야.</b> 같은 방식으로 세상을 봐서 말이 빠르게 통해. 대신 <b>같은 것에 약해서</b> 둘 다 무너질 땐 같이 무너져` }
      : SANG[elB] === elA ? { v: 2, t: `<b>${b.name || "상대"}가 너를 받쳐 주는 결이야.</b> 옆에 있으면 네가 편해져. 조심할 건 하나 — <b>받는 게 당연해지는 것</b>이야` }
        : SANG[elA] === elB ? { v: 1, t: `<b>네가 주는 쪽이야.</b> 챙기고 끌어 주게 돼. 오래 가려면 <b>네가 받는 통로</b>를 따로 만들어 둬야 해` }
          : GEUK[elA] === elB ? { v: -1, t: `<b>네가 밀어붙이는 결이야.</b> 결정을 네가 내리게 돼. 상대가 말수가 줄면 그건 동의가 아니라 <b>포기</b>야` }
            : { v: -1, t: `<b>상대가 너를 잡아 두는 결이야.</b> 긴장이 있는데 그 긴장이 너를 헤매지 않게 해. 대신 <b>답답하다는 말이 나오는 사이</b>야` };
    put("동아시아 · 여덟 글자", "누가 주고 누가 받나", `${EL_KO[elA]} ↔ ${EL_KO[elB]}`, w.t, w.v,
      `일간 ${GANK[a.saju.idx.dG]}(${elA}) vs ${GANK[b.saju.idx.dG]}(${elB}). 오행 생극 그대로다 — <b>변환이 없다</b>.`);
  }
  /* ② 동아시아 · 일지 — 생활이 맞나 */
  const rel = jiRel(a.saju.idx.dJ, b.saju.idx.dJ);
  put("동아시아 · 자리의 글자", "같이 사는 게 맞나", `${JIK[a.saju.idx.dJ]}·${JIK[b.saju.idx.dJ]} ${rel}`,
    JI_REL_W[rel].w, JI_REL_W[rel].v,
    `두 사람의 짝 자리 ${JIK[a.saju.idx.dJ]}·${JIK[b.saju.idx.dJ]} → <b>${rel}</b>. 십이지 합·충·형 배당 그대로다 — <b>변환이 없다</b>.`);
  /* ③ 인도 · 아쉬타쿠타 — 여덟 항목을 합치지 않고 그대로 편다 */
  const ak = ashtakuta(jdA, +a.birth.y, jdB, +b.birth.y);
  const akRows = Object.entries(ak.detail).map(([k, sc]) => {
    const max = { 바르나: 1, 바샤: 2, 타라: 3, 요니: 4, 그라하: 5, 가나: 6, 바쿠트: 7, 나디: 8 }[k];
    return { k, sc, max, label: AK_MEAN[k][0], w: AK_MEAN[k][1], ratio: sc / max };
  });
  const akLow = akRows.filter((x) => x.ratio <= 0.34), akHigh = akRows.filter((x) => x.ratio >= 0.8);
  put("인도 · 여덟 항목", "무엇이 맞고 무엇이 안 맞나", `${ak.total}/36`,
    (akHigh.length ? `<b>${akHigh.map((x) => x.label).join(" · ")}</b>${jong(akHigh[akHigh.length - 1].label) ? "이" : "가"} 잘 맞아. ` : "") +
    (akLow.length ? `대신 <b>${akLow.map((x) => x.label).join(" · ")}</b>${jong(akLow[akLow.length - 1].label) ? "이" : "가"} 낮아. ` : "낮은 항목이 없어. ") +
    `<b>총점보다 어느 항목이 낮은지가 중요해</b> — 낮은 자리가 실제로 부딪히는 자리거든.`,
    ak.total >= 24 ? 2 : ak.total >= 18 ? 1 : ak.total >= 12 ? 0 : -1,
    `아쉬타쿠타 ${ak.total}/36. 여덟 항목의 채점은 인도 전통 규칙 그대로라 <b>변환이 없다</b>. 다만 각 항목을 우리말 이름으로 옮기는 데는 <b>해석이 섞인다</b>. 그리고 <b>합산 점수를 앞세우지 않는다</b> — 숫자를 먼저 보면 나머지를 안 읽는다.`);
  /* ④ 서양 · 해자리 — 성향 / ⑤ 달자리 — 감정 */
  {
    const sA = sunSign(jdA), sB = sunSign(jdB), eA = ZO_EL[sA], eB = ZO_EL[sB];
    const same = eA === eB, warm = ["불", "공기"], cool = ["흙", "물"];
    const pair = same ? 2 : (warm.includes(eA) && warm.includes(eB)) || (cool.includes(eA) && cool.includes(eB)) ? 1 : -1;
    put("서양 · 해의 자리", "성향이 맞나", `${sA} ↔ ${sB}`,
      same ? "<b>같은 결이야.</b> 뭘 좋아하고 뭘 못 견디는지가 겹쳐 — 설명이 필요 없어"
        : pair === 1 ? "<b>다른데 통하는 결이야.</b> 같은 속도로 움직이진 않아도 방향은 비슷해"
          : "<b>속도가 다른 결이야.</b> 한쪽이 나가자고 할 때 한쪽은 쉬자고 해. 못 맞춘다는 뜻이 아니라 <b>번갈아 맞춰 줘야 한다</b>는 뜻이야",
      pair, `${sA}(${eA}) vs ${sB}(${eB}). 사원소 궁합 — <b>해석이 섞인다</b>.`);
    const mA = moonSign(jdA), mB = moonSign(jdB), meA = ZO_EL[mA], meB = ZO_EL[mB];
    put("서양 · 달의 자리", "감정이 맞나", `${mA} ↔ ${mB}`,
      meA === meB ? "<b>감정 처리 방식이 같아.</b> 화가 나면 둘 다 같은 식으로 굴어 — 그래서 회복도 빨라"
        : "<b>감정 처리 방식이 달라.</b> 한쪽은 바로 말하고 한쪽은 삭여. <b>싸움의 8할이 여기서 나와</b> — 내용이 아니라 방식에서",
      meA === meB ? 2 : -1, `달자리 ${mA}(${meA}) vs ${mB}(${meB}). 감정 축으로 옮기는 데 <b>해석이 섞인다</b>.`);
  }
  /* ⑥ 자바 · 날의 무게 — 자바 전통이 실제로 궁합·택일에 쓰는 수치다 */
  {
    const wA = weton(+a.birth.y, +a.birth.m, +a.birth.d), wB = weton(+b.birth.y, +b.birth.m, +b.birth.d);
    const sum = wA.neptu + wB.neptu;
    put("자바 · 두 날의 무게", "둘을 합치면 얼마나 무거운가", `${wA.neptu} + ${wB.neptu} = ${sum}`,
      sum >= 28 ? "<b>둘 다 무거운 날에 왔어.</b> 짐이 서로에게 얹혀. 같이 있으면 든든한데 <b>둘 다 지쳤을 때 기댈 데가 없어</b>"
        : sum <= 20 ? "<b>둘 다 가벼운 날에 왔어.</b> 잘 움직이고 잘 웃어. 대신 <b>뿌리내리는 데 남들보다 오래 걸려</b>"
          : "<b>한쪽이 무겁고 한쪽이 가벼워.</b> 무거운 쪽이 붙잡고 가벼운 쪽이 끌어 — 자바에서는 이 조합을 <b>오래 가는 짝</b>으로 봐",
      sum >= 28 || sum <= 20 ? 0 : 1,
      `웨톤 신붕 ${wA.day}·${wA.pasaran}(${wA.neptu}) + ${wB.day}·${wB.pasaran}(${wB.neptu}) = ${sum}. 자바가 택일·궁합에 실제로 쓰는 수치라 <b>변환이 없다</b>. 다만 합의 해석은 <b>해석이 섞인다</b>.`);
  }
  /* ⑦ 마야 · 두 날개 — 맡은 일이 같은가 다른가 */
  {
    const tA = tzolkin(jdn(+a.birth.y, +a.birth.m, +a.birth.d)), tB = tzolkin(jdn(+b.birth.y, +b.birth.m, +b.birth.d));
    const same = tA.sign === tB.sign;
    put("마야 · 두 날개", "맡은 일이 같은가", `${tA.sign} ↔ ${tB.sign}`,
      same ? "<b>같은 날개야.</b> 세상에 온 이유가 같아 — 같은 것에 흥분하고 같은 것에 실망해"
        : `<b>다른 날개야.</b> 마야는 이걸 나쁘게 안 봐 — <b>둘이 합쳐야 한 벌이 되는</b> 구조로 읽어. 다만 <b>서로가 뭘 하러 왔는지 자꾸 물어야 해</b>`,
      same ? 1 : 0, `촐킨 ${tA.tone}·${tA.sign} vs ${tB.tone}·${tB.sign}. 날개 이름은 그대로이고 관계 해석에는 <b>해석이 섞인다</b>.`);
  }
  /* ⑧ 동아시아 소리(납음) — 사주 안의 다른 층 */
  {
    const nA = nayin(+a.birth.y), nB = nayin(+b.birth.y);
    const eA = ["목", "화", "토", "금", "수"].find((e) => nA.includes(e));
    const eB = ["목", "화", "토", "금", "수"].find((e) => nB.includes(e));
    const good = SANG[eB] === eA || SANG[eA] === eB || eA === eB;
    put("동아시아 · 소리", "태어난 해끼리 맞나", `${nA} ↔ ${nB}`,
      good ? `<b>두 해의 소리가 서로를 밀어 줘.</b> 여덟 글자가 갈려도 이 층은 붙어 있어 — <b>이유 없이 편한 순간</b>이 여기서 나와`
        : `<b>두 해의 소리가 어긋나.</b> 큰 문제는 아닌데, <b>이유 없이 어색한 순간</b>이 있다면 여기야`,
      good ? 1 : 0, `납음 ${nA}(${eA}) vs ${nB}(${eB}). 이름에 오행이 들어 있어 <b>변환이 없다</b>.`);
  }
  /* ⑨ 수비학 — 평생 배우는 게 같은가 */
  {
    const lA = lifePath(+a.birth.y, +a.birth.m, +a.birth.d), lB = lifePath(+b.birth.y, +b.birth.m, +b.birth.d);
    const same = lA === lB;
    put("수비학 · 두 개의 길", "평생 배우는 게 같은가", `${lA} ↔ ${lB}`,
      same ? `<b>둘 다 ${LP_TASK[lA]}을 배우는 삶이야.</b> 서로를 깊이 이해해. 대신 <b>같은 데서 같이 걸려</b> — 밖에서 조언해 줄 사람이 필요해`
        : `너는 <b>${LP_TASK[lA] || "?"}</b>을, 상대는 <b>${LP_TASK[lB] || "?"}</b>을 배우는 삶이야. <b>서로가 서로의 과제를 대신 보여 주는</b> 사이야 — 답답할 때가 곧 배울 때야`,
      same ? 1 : 1, `라이프패스 ${lA} vs ${lB}. 과제 해석에는 <b>해석이 섞인다</b>.`);
  }

  /* ── 어긋남 — 어느 하늘이 좋다고 하고 어느 하늘이 아니라고 하나 ──
     이게 이 문서의 알맹이다. "잘 맞아요"는 어디서든 살 수 있지만 **어디서 갈리는지**는 여기서만 나온다. */
  const plus = rows.filter((x) => x.v >= 1), minus = rows.filter((x) => x.v <= -1);
  const split = plus.length > 0 && minus.length > 0;
  const clash = split
    ? { t: "하늘끼리 갈린다",
        w: `<b>${plus.map((x) => x.from.split(" · ")[1] || x.from).join(" · ")}</b>${jong(plus[plus.length - 1].from.split(" · ")[1] || "") ? "은" : "는"} 맞는다고 하고, ` +
           `<b>${minus.map((x) => x.from.split(" · ")[1] || x.from).join(" · ")}</b>${jong(minus[minus.length - 1].from.split(" · ")[1] || "") ? "은" : "는"} 아니라고 해. ` +
           `<b>이게 진짜 정보야.</b> 잘 통하는데 자꾸 부딪히거나, 부딪히는데 못 헤어지는 이유가 여기 있어 — ` +
           `한쪽 축만 보고 판단하면 매번 틀려.`,
        n: fn(`긍정 ${plus.length}축 · 부정 ${minus.length}축. <b>평균을 내지 않는다</b> — 갈리는 것 자체가 이 관계의 성질이다.`) }
    : { t: minus.length ? "모든 하늘이 같은 말을 한다" : "모든 하늘이 같은 말을 한다",
        w: minus.length
          ? `아홉 축이 <b>전부 어렵다고 해.</b> 이런 경우는 드물어. 안 된다는 뜻이 아니라 <b>저절로 굴러가지 않는다</b>는 뜻이야 — 둘 다 알고 애써야 하는 사이야.`
          : `아홉 축이 <b>전부 맞는다고 해.</b> 이런 경우도 드물어. 다만 편한 만큼 <b>서로를 당연하게 여기기 쉬워</b>.`,
        n: fn(`갈리는 축이 없다(긍정 ${plus.length} · 부정 ${minus.length}).`) };

  /* ── 조심할 것 — 판정이 아니라 행동으로 닫는다 ──
     ⚠ **헤어지라고 말하지 않는다.** 관계를 끊는 결정은 우리 몫이 아니다. */
  const care = [];
  if (rel === "충") care.push("크게 싸운 날 <b>그날 안에 말을 붙여.</b> 하루 넘기면 이 조합은 사흘을 가.");
  if (rel === "형" || rel === "자형") care.push("<b>사소한 걸 그때그때 말해.</b> 참았다가 한꺼번에 꺼내면 그게 제일 크게 터져.");
  if (ak.detail.나디 === 0) care.push("<b>둘 다 같은 데서 지쳐.</b> 한 사람이 무너질 때 다른 사람도 이미 힘든 상태야 — 밖에 기댈 데를 하나씩 만들어 둬.");
  if (ak.detail.바쿠트 === 0) care.push("<b>같이 사는 동안의 흐름이 낮게 나와.</b> 큰 결정(이사·창업·대출)은 한 박자 늦추고 둘이 따로 재 보고 정해.");
  if (akRows.find((x) => x.k === "그라하").ratio < 0.5) care.push("<b>같은 말을 다르게 알아들어.</b> 중요한 얘기는 말로 끝내지 말고 한 줄이라도 적어서 확인해.");
  if (elA === elB) care.push("<b>둘 다 같은 것에 약해.</b> 서로 말려 줄 사람이 없으니, 제3자의 눈을 하나 두는 게 안전해.");
  if (!care.length) care.push("특별히 못 박아 둘 위험은 안 잡혀. <b>편한 만큼 무심해지는 것</b>만 조심해.");

  /* 총점은 맨 뒤에 둔다 — 앞에 두면 나머지를 안 읽는다 */
  const score = rows.reduce((t, x) => t + x.v, 0);
  const band = score >= 6 ? "아홉 중 여럿이 맞는다고 한다" : score >= 2 ? "맞는 쪽이 조금 더 많다"
    : score >= -1 ? "반반이다" : "어려운 쪽이 더 많다";

  return {
    rows, akRows, ak, clash, care, split,
    score, band, scoreMax: rows.length * 2,
    n: fn(`아홉 축의 판정을 −2~+2 로 세어 ${score}점. <b>이 숫자를 문서 앞에 두지 않는다</b> — 궁합은 총점이 아니라 <b>어느 축이 어긋나는가</b>로 읽는 것이다.`),
    notes,
  };
}
