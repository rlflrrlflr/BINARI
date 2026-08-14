/* ── 각인 판정 엔진 ────────────────────────────────────────────────────────
   생년월일시 → **읽을 수 있는 문서**로 바꾼다. sky.js 는 계산만 하고, 무슨 말로 옮길지는 여기가 정한다.

   창업자 지시(2026-08-12) 넷을 규칙으로 못 박은 파일이다.
   ① **뜻을 먼저, 그림은 나중.** "너는 산이다"는 아무 말도 안 한 것이다.
      → "쉽게 흔들리지 않는 사람이다. 한번 정하면 잘 안 바꾼다"가 먼저 나온다.
   ② **기법 이름은 화면에 안 나간다.** 십성·대운·용신 같은 말은 여기서 한 글자도 만들지 않는다.
   ③ **뎁스.** 짝이면 키·생김새·집안·벌이·만나는 시기까지 내려간다. "좋은 사람 만난다"로 끝내지 않는다.
   ④ **각주.** 모든 문장은 note 를 함께 낸다. 화면에서 숨기든 말든, 근거 없는 문장은 만들지 않는다.

   ⚠ 지어내지 않는다. 아래 표에 없는 조합은 문장을 내지 않고 자리를 비운다.
   ⚠ 성별이 없으면 짝·자식 자리를 비운다. 시(時)가 없으면 그렇다고 적는다. */

import {
  jdFromKST, sunLongitude, moonLongitude, jdn, sunSign, moonSign, nakshatra, tzolkin,
  ascendant, signOf, wholeSignHouse, profection, isDayBirth, vimshottari,
  seun, wolun, favor, sipseong as ssOf, GAN as GANK, JI as JIK, GANH, JIH, JI_BONGI as JB,
} from "./sky.js";

/* 간지가 한글로도 한자로도 들어온다 — 앱의 대운은 한글("임오"), 흐름 엔진은 한자("壬午").
   한쪽만 찾으면 −1 이 나오고, 그러면 여든 해가 전부 같은 값이 된다(실측으로 잡았다). 둘 다 본다. */
const gIdx = (c) => { const i = GANK.indexOf(c); return i >= 0 ? i : GANH.indexOf(c); };
const jIdx = (c) => { const i = JIK.indexOf(c); return i >= 0 ? i : JIH.indexOf(c); };

/* ── 말 표 ───────────────────────────────────────────────────────────── */
const EL_KO = { 목: "나무", 화: "불", 토: "흙", 금: "쇠", 수: "물" };
const ZO_EL = { 양자리: "불", 사자자리: "불", 사수자리: "불", 황소자리: "흙", 처녀자리: "흙", 염소자리: "흙",
  쌍둥이자리: "공기", 천칭자리: "공기", 물병자리: "공기", 게자리: "물", 전갈자리: "물", 물고기자리: "물" };

/* 겉 — 남들 눈에 보이는 모습. 일간 오행에서 나온다. 은유가 아니라 행동으로 쓴다 */
const SURFACE = {
  목: { w: "계속 자라려는 사람", d: "가만히 있으면 시들해진다. 늘 다음 걸 본다. 멈춰 세우면 못 견딘다" },
  화: { w: "감정이 먼저 보이는 사람", d: "기분이 얼굴에 그대로 나온다. 숨기려 해도 티가 난다. 대신 뒤끝이 없다" },
  토: { w: "쉽게 흔들리지 않는 사람", d: "한번 마음을 정하면 잘 안 바꾼다. 재촉해도 서두르지 않는다. 사람들이 기대는 쪽이다" },
  금: { w: "한번 정하면 안 바꾸는 사람", d: "정하기까지가 오래 걸린다. 대신 정하고 나면 끝까지 간다. 끊고 맺는 게 분명하다" },
  수: { w: "깊이 생각하는 사람", d: "결정 앞에 오래 서 있다. 얕은 답에 만족을 못 한다. 그래서 늘 조금 늦다" },
};
/* 속 — 서양 해·달자리의 원소에서 나온다. 겉과 다를수록 이 사람의 급소가 된다 */
const INNER = {
  공기: { w: "생각이 빠르다", d: "하고 싶은 말이 늘 가득하다. 머리는 벌써 몇 걸음 앞에 가 있다" },
  불: { w: "마음이 먼저 뜨거워진다", d: "참는 게 제일 어렵다. 하고 싶으면 지금 해야 한다" },
  물: { w: "감정이 깊고 오래 간다", d: "겉으로는 잘 안 보인다. 혼자 오래 담아 둔다" },
  흙: { w: "실속부터 따진다", d: "뜬 얘기를 못 견딘다. 손에 잡히는 것만 믿는다" },
};
/* 비어 있는 자리 — 이 사람 인생의 축이 된다. 없는 것이 있는 것보다 많은 걸 정한다 */
const BLOCK = {
  식상: { t: "말이 나갈 문", s: "하고 싶은 말이 안에서만 돈다", w: "참다가 한 번에 터진다. 그리고 그게 제일 가까운 사람한테 간다",
    fix: "말을 대신할 손을 일찍 쥐여 주는 것 — 만들고 그리고 고치는 일이 입을 대신한다" },
  재성: { t: "쥐는 손", s: "돈이 지나가는 건 보이는데 손에 안 남는다", w: "크게 벌어도 남는 게 적다. 버는 재주보다 지키는 장치가 먼저다",
    fix: "정해진 돈(월급·고정 계약)으로 받고, 굴리는 건 남에게 맡기는 것" },
  관성: { t: "버티는 틀", s: "규칙이 없으면 흐트러진다", w: "남이 정한 틀을 못 견디는데, 틀이 없으면 또 무너진다. 스스로 만든 규칙만 지킨다",
    fix: "네가 직접 만든 규칙을 종이에 적어 두는 것 — 남의 규칙은 안 먹힌다" },
  인성: { t: "받는 손", s: "도움을 못 받는다", w: "부탁을 못 해서 혼자 다 진다. 도와줄 사람이 없어서가 아니라 안 불러서다",
    fix: "도와달라고 말하는 법 — 이 사람이 평생 배워야 할 기술은 이거 하나다" },
  비겁: { t: "같이 갈 사람", s: "혼자 하는 게 빠르다", w: "무리에 섞이는 게 힘들다. 그래서 짐도 혼자 진다",
    fix: "혼자 가는 걸 기본값으로 놓고 계획하는 것 — 나쁜 게 아니라 계산에 넣으라는 말이다" },
};
/* 두꺼운 자리 — 이 사람이 어디서 밥을 버나 */
const THICK = {
  식상: { job: "만들어서 내놓는 쪽", ex: "기획·창작·교육·요식처럼 결과물이 네 이름으로 나가는 일", grew: "시키는 대로 하는 게 답답했고, 네 방식으로 바꿔야 손이 움직였다" },
  재성: { job: "굴려서 남기는 쪽", ex: "영업·유통·중개·자영업처럼 거래가 곧 실력인 일", grew: "값과 이익이 먼저 보였고, 숫자로 말할 때 설득력이 붙었다" },
  관성: { job: "조직 안에서 자리를 받는 쪽", ex: "공공·법률·행정·교육·인사처럼 규칙을 다루고 오래 앉아 있는 일", grew: "규칙이 분명한 데서 오히려 편했고, 맡기면 끝까지 했다" },
  인성: { job: "배워서 푸는 쪽", ex: "연구·상담·자격이 필요한 전문직처럼 아는 만큼 값이 붙는 일", grew: "설명해 주면 빨리 알아들었고, 다 알고 나서야 움직였다" },
  비겁: { job: "제 힘으로 미는 쪽", ex: "1인 사업·프리랜서·기술직처럼 실력이 곧 간판인 일", grew: "누구 밑보다 혼자가 빨랐고, 그래서 부딪히기도 했다" },
};
const ORGAN = {
  목: { part: "간과 눈, 그리고 힘줄", sym: "눈이 빨리 피로해지고, 화를 삼키면 옆구리와 어깨가 결린다", over: "성질이 먼저 솟고 참으면 두통이 온다" },
  화: { part: "심장과 혈관", sym: "손발이 차고 가슴이 자주 두근거린다. 겨울마다 기운이 확 꺼진다", over: "열이 잘 오르고 잠이 얕다. 입안이 자주 헌다" },
  토: { part: "위장과 소화", sym: "잘 체하고, 찬 걸 먹으면 바로 탈이 난다", over: "몸이 잘 붓고 무거워진다. 생각이 많아 잠을 뒤척인다" },
  금: { part: "코와 기관지, 그리고 피부", sym: "환절기마다 기침이 오래간다. 코가 자주 막히고 살갗이 메마르다", over: "숨이 얕고 잔기침이 길다. 피부가 예민해 잘 뒤집힌다" },
  수: { part: "콩팥과 방광, 그리고 뼈", sym: "허리가 쉽게 시고 저녁이면 힘이 뚝 떨어진다", over: "아랫배가 차고 잘 붓는다. 밤에 자주 깬다" },
};
const FACE = {
  목: "갸름하고 이목구비가 또렷하다. 키에 비해 마른 인상이다",
  화: "이마가 넓고 눈이 살아 있다. 표정이 자주 바뀐다",
  토: "둥글넓적하다. 코가 크고 두툼하다. 웃으면 인상이 확 좋아진다",
  금: "윤곽이 분명하다. 코가 오뚝하고 턱선이 살아 있다. 차가워 보인다는 말을 듣는다",
  수: "부드럽고 둥근 편이다. 피부가 희고 눈에 물기가 있다",
};
const BUILD = { 목: "마르고 키가 큰 쪽", 화: "날렵하고 잘 안 찌는 쪽", 토: "뼈대가 굵고 어깨가 넓은 쪽", 금: "단단하고 균형 잡힌 쪽", 수: "살이 잘 붙는 쪽" };
const VOICE = { 목: "맑고 또렷하다", 화: "빠르고 높다", 토: "낮고 울림이 있다", 금: "또박또박 끊어진다", 수: "낮고 부드럽다" };
/* 키 — 일간 오행과 상승궁이 각각 밀어 올리거나 내린다. 추정임을 각주에 명시한다 */
const H_EL = { 목: 3, 화: 0, 토: 3, 금: 1, 수: -2 };
const H_ASC = { 사수자리: 3, 물병자리: 2, 천칭자리: 2, 양자리: 1, 사자자리: 1, 쌍둥이자리: 1,
  황소자리: -1, 게자리: -2, 처녀자리: -1, 전갈자리: 0, 염소자리: -1, 물고기자리: -1 };
/* 짝의 자리에 앉은 성질 */
const SPOUSE = {
  비견: { w: "대등한 사람", d: "친구처럼 지낸다. 대신 서로 안 굽혀서 부딪힌다" },
  겁재: { w: "자기 일과 벌이가 확실한 사람", d: "기대오는 사람과는 오래 못 간다. 돈은 처음부터 갈라 두는 게 낫다" },
  식신: { w: "편안한 사람", d: "먹고사는 걱정이 덜하다. 대신 긴장이 없어 늘어지기도 한다" },
  상관: { w: "재주 있고 말 잘하는 사람", d: "자극이 되는 만큼 말로 상처도 주고받는다" },
  정재: { w: "알뜰하고 성실한 사람", d: "안정적이다. 대신 답답하게 느껴지는 순간이 온다" },
  편재: { w: "활달하고 씀씀이 큰 사람", d: "함께 벌이는 재미가 있다. 씀씀이는 맞춰야 한다" },
  정관: { w: "반듯하고 책임감 있는 사람", d: "기댈 만하다. 대신 원칙에서 서로 안 물러선다" },
  편관: { w: "강단 있는 사람", d: "위기에 든든하다. 평소엔 팽팽하다" },
  정인: { w: "품어 주는 사람", d: "보살핌을 받는다. 대신 어리광이 늘 수 있다" },
  편인: { w: "생각이 깊은 사람", d: "통하면 크게 통한다. 혼자 있는 시간을 많이 필요로 한다" },
};
/* 7하우스 사인 → 배우자의 겉모습. 서양 전통에서 짝의 외형을 직접 다루는 자리다 */
const H7 = {
  양자리: { h: 2, look: "다부지고 움직임이 빠르다. 이마가 넓고 눈매가 강하다", air: "먼저 말을 걸고 먼저 움직인다" },
  황소자리: { h: -1, look: "목이 짧고 몸이 탄탄하다. 피부가 좋고 목소리가 좋다", air: "느리지만 한번 정하면 안 바꾼다" },
  쌍둥이자리: { h: 2, look: "마른 편이고 팔다리가 길다. 실제 나이보다 어려 보인다", air: "말이 빠르고 손짓이 많다. 사람 많은 자리에서 빛난다" },
  게자리: { h: -1, look: "둥글고 부드럽다. 얼굴이 희고 눈이 크다", air: "먼저 챙긴다. 집을 중요하게 여긴다" },
  사자자리: { h: 1, look: "머리숱이 많고 자세가 곧다. 눈에 띈다", air: "무리의 중심에 선다. 인정받는 걸 중요하게 여긴다" },
  처녀자리: { h: 0, look: "단정하고 군더더기가 없다. 마른 편이다", air: "꼼꼼하다. 정리된 걸 좋아한다" },
  천칭자리: { h: 1, look: "이목구비가 고르고 인상이 좋다. 옷을 잘 입는다", air: "부딪히는 걸 싫어한다. 중간에 서는 사람이다" },
  전갈자리: { h: 0, look: "눈매가 깊다. 말수가 적은데 존재감이 있다", air: "속을 잘 안 보인다. 한번 믿으면 끝까지 간다" },
  사수자리: { h: 2, look: "키가 크고 다리가 길다. 잘 웃는다", air: "솔직하다. 갇히는 걸 못 견딘다" },
  염소자리: { h: 0, look: "뼈대가 분명하고 나이보다 어른스러워 보인다", air: "계획대로 간다. 책임을 먼저 진다" },
  물병자리: { h: 1, look: "체형이 길쭉하고 인상이 독특하다", air: "남과 다른 걸 좋아한다. 거리를 둔다" },
  물고기자리: { h: -1, look: "눈이 크고 인상이 순하다. 몸이 부드럽다", air: "잘 맞춰 준다. 마음이 약하다" },
};
const SS_EVENT = {
  정재: "월급이 오르거나, 계약이 하나 길게 붙거나, 집·차처럼 이름이 올라가는 물건이 생긴다",
  편재: "부업·투자·중개처럼 목돈이 오가는 판이 열린다. 크게 들어오고 크게 나간다",
  식신: "손에 익은 걸로 벌어먹는 자리가 생긴다 — 먹는 일·가르치는 일·만드는 일",
  상관: "말·글·영상·기획처럼 티 나는 걸 내놓게 된다. 대신 윗사람과 한 번은 부딪힌다",
  정관: "직함이 생기거나 승진하거나, 자격증·시험처럼 이름이 서는 일이 온다",
  편관: "책임이 갑자기 얹힌다. 이직·발령·수술·소송처럼 몰아치는 일이다",
  정인: "배움이 붙는다. 학교·자격·문서, 그리고 도와주는 어른이 나타난다",
  편인: "혼자 파는 일이 열린다 — 자격·연구·기술·상담 쪽이다",
  비견: "동업·팀·같은 처지의 사람이 붙는다. 독립을 생각하게 된다",
  겁재: "경쟁자가 생기고 돈이 샌다. 보증·동업·빌려주기 셋이 특히 그렇다",
};
const SS_BAND = {
  정재: "꾸준히 쌓이는 열 해", 편재: "크게 오가는 열 해", 식신: "손에 익은 걸로 사는 열 해",
  상관: "닫혀 있던 말이 나오는 열 해", 정관: "직함과 책임의 열 해", 편관: "눌리고 버티는 열 해",
  정인: "배움과 도움의 열 해", 편인: "혼자 깊어지는 열 해", 비견: "사람이 몰리는 열 해", 겁재: "겨루고 새는 열 해",
};
const GRP_OF = { 비견: "비겁", 겁재: "비겁", 식신: "식상", 상관: "식상", 정재: "재성", 편재: "재성", 정관: "관성", 편관: "관성", 정인: "인성", 편인: "인성" };
const DASHA_KO = {
  달: "어머니와 집이 세상의 전부인 시기", 화성: "몸이 마음보다 앞서는 시기", 라후: "바깥이 궁금해지고 흔들리는 시기",
  목성: "넓어지고 풀리는 시기", 토성: "책임이 무거워지는 시기", 수성: "말과 셈이 밝아지는 시기",
  케투: "안으로 접히는 시기", 금성: "사람과 즐거움이 느는 시기", 해: "이름이 서는 시기",
};

const SEOUL = { lat: 37.5665, lon: 126.978 };
const HANGUL_AGE = (y, now) => now.getFullYear() - y + 1;

/** 각인 한 벌을 만든다. saju/idx/counts/ladder 는 App.jsx 가 계산해 넘긴다. */
export function readImprint({ saju, ladder, birth, sex, now = new Date(), lat = SEOUL.lat, lon = SEOUL.lon }) {
  if (!saju || !saju.idx || !birth || !birth.y) return null;
  const idx = saju.idx, counts = saju.counts;
  const notes = [];
  const fn = (t) => { notes.push(t); return notes.length; };   // 각주 등록 → 번호

  /* ── 하늘 값 ── */
  const noH = idx.hG == null;
  const jd = jdFromKST(+birth.y, +birth.m, +birth.d, noH ? 12 : +birth.h, noH ? 0 : (+birth.min || 0));
  const asc = ascendant(jd, lat, lon), ascSign = signOf(asc);
  const sunH = wholeSignHouse(sunLongitude(jd), asc);
  const sun = sunSign(jd), moon = moonSign(jd);
  const day = isDayBirth(jd, lat, lon);
  const age = HANGUL_AGE(+birth.y, now), ageFull = age - 1;
  const dasha = vimshottari(jd, +birth.y, 7);

  /* ── 십성 무리 세기 ── */
  const ss = {};
  const put = (g) => { const t = ssOf(idx.dG, g); ss[t] = (ss[t] || 0) + 1; };
  [idx.yG, idx.mG].forEach(put); if (idx.hG != null) put(idx.hG);
  [idx.yJ, idx.mJ, idx.dJ].forEach((j) => put(JB[j])); if (idx.hJ != null) put(JB[idx.hJ]);
  const G = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const k in ss) G[GRP_OF[k]] += ss[k];

  const me = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"][idx.dG];
  const innerEl = ZO_EL[sun] === ZO_EL[moon] ? ZO_EL[sun] : ZO_EL[sun];   // 해·달이 갈리면 해를 따른다(태생 기질)
  const split = ZO_EL[sun] !== ZO_EL[moon];

  /* ── 축: 가장 빈 자리 ── */
  const order = ["식상", "재성", "관성", "인성", "비겁"];
  const minV = Math.min(...order.map((k) => G[k]));
  const blockKey = order.find((k) => G[k] === minV);
  const maxV = Math.max(...order.map((k) => G[k]));
  const thickKey = order.find((k) => G[k] === maxV);
  const lackEl = Object.keys(counts).filter((k) => counts[k] === 0);
  const maxEl = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  /* ── 흐름: 대운 · 다샤 · 프로펙션 ── */
  const bands = (ladder || []).filter((du) => gIdx(du.ganji[0]) >= 0 && jIdx(du.ganji[1]) >= 0).map((du) => {
    const s = ssOf(idx.dG, gIdx(du.ganji[0]));
    const d = dasha.periods.find((p) => du.startAge - 1 >= p.from && du.startAge - 1 < p.to);
    return { from: du.startAge, to: du.endAge, ss: s, el: du.el, title: SS_BAND[s], event: SS_EVENT[s],
      dasha: d ? d.lord : null, dashaKo: d ? DASHA_KO[d.lord] : null, ganji: du.ganji };
  });
  const cur = bands.find((b) => age >= b.from && age <= b.to) || null;

  /* ── 짝: 세 셈이 만나는 나이 ── */
  const spouseSS = ssOf(idx.dG, JB[idx.dJ]);
  const h7Sign = signOf((asc + 180) % 360);
  const h7 = H7[h7Sign] || H7.천칭자리;
  const profAges = [...Array(70)].map((_, i) => i).filter((a) => profection(asc, a).house === 7);
  const jupiter = dasha.periods.find((p) => p.lord === "목성");
  const relief = bands.find((b) => b.ss === "정재" || b.ss === "편재");
  /* 짝의 시기 — 세 셈에서 각각 후보를 뽑되 **혼인 가능 구간(22~45세) 안에 걸치는 것만** 센다.
     처음엔 그냥 "목성 시기 시작"을 후보로 썼는데, 사람에 따라 그게 예순여섯에 오기도 한다.
     그걸 평균에 넣으니 후보 폭이 36년·53년까지 벌어졌다(검사가 잡았다). 범위 밖은 후보가 아니다.
     그리고 겹칠 때만 "셋이 같은 때를 가리킨다"고 말한다 — 흩어진 걸 평균 내면 합의가 아니라 눈속임이다. */
  const LO = 22, HI = 45;
  const overlaps = (f, t) => t > LO && f < HI;
  const mateWhen = (() => {
    const c = [];
    /* 인도 — 금성(짝)과 목성(확장)이 이 구간에 걸치면 그 시작을 후보로 */
    for (const lord of ["금성", "목성"]) {
      const d = dasha.periods.find((x) => x.lord === lord && overlaps(x.from, x.to));
      if (d) { c.push({ k: "남쪽", a: Math.round(Math.max(d.from, LO)), why: `${lord} 시기 ${d.from}~${d.to}세` }); break; }
    }
    /* 동아시아 — 남자는 재물의 자리, 여자는 자리·책임의 자리가 짝을 맡는다 */
    const want = sex === "F" ? ["정관", "편관"] : ["정재", "편재"];
    const band = bands.find((b) => want.includes(b.ss) && overlaps(b.from, b.to));
    if (band) c.push({ k: "동쪽", a: Math.max(band.from, LO), why: `${band.from}~${band.to}세 구간` });
    /* 서양 — 짝의 자리가 그해의 주제가 되는 나이 */
    const p = profAges.filter((x) => x >= 24 && x <= 40);
    if (p.length) c.push({ k: "서쪽", a: p[0], why: `프로펙션 7하우스 해 ${p.join("·")}세` });
    if (c.length < 2) return { age: null, agree: false, spread: null, cands: c };
    const lo = Math.min(...c.map((x) => x.a)), hi = Math.max(...c.map((x) => x.a));
    const mid = c.reduce((t, x) => t + x.a, 0) / c.length;
    const near = profAges.filter((x) => x >= LO && x <= HI);
    const age = near.length ? near.reduce((x, y) => (Math.abs(x - mid) <= Math.abs(y - mid) ? x : y)) : Math.round(mid);
    return { age, agree: hi - lo <= 8, spread: hi - lo, lo, hi, cands: c };
  })();
  const mateAge = mateWhen.age;
  /* 배우자 자리를 정면으로 치는 구간 = 관계가 흔들리는 때.
     **어린 나이는 뺀다** — "세 살에 만나는 사람은 오래 못 간다"가 화면에 실제로 나왔다.
     그리고 짝을 만나기 전인지 뒤인지로 갈라야 뜻이 달라진다(전=지나갈 인연, 후=흔들리는 결혼). */
  const chung = (idx.dJ + 6) % 12, hyeong = [(idx.dJ + 3) % 12, (idx.dJ + 9) % 12];
  const shakeAll = bands.filter((b) => { const j = jIdx(b.ganji[1]); return (j === chung || hyeong.includes(j)) && b.to >= 18; });
  const shakeBefore = shakeAll.filter((b) => mateAge == null || b.from < mateAge);
  const shakeAfter = shakeAll.filter((b) => mateAge != null && b.from >= mateAge);

  /* ── 키 추정 ── */
  const base = sex === "F" ? 160 : 172;
  const bump = (H_EL[me] || 0) + (H_ASC[ascSign] || 0);
  const hLo = base + bump - 3, hHi = base + bump + 3;

  /* ── 몸 ── */
  const weakEl = lackEl.length ? lackEl : [Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0]];
  const beaten = { 목: "토", 화: "금", 토: "수", 금: "목", 수: "화" };

  const body = [
    ["키", `<b>${hLo}~${hHi}cm</b> 사이로 본다. ${bump >= 2 ? "또래보다 큰 쪽이다." : bump <= -1 ? "또래보다 작은 쪽이다." : "또래 평균 근처다."}`,
      fn(`일간 ${GANK[idx.dG]}(${me}) 보정 ${H_EL[me] >= 0 ? "+" : ""}${H_EL[me]} + 상승궁 ${ascSign} 보정 ${H_ASC[ascSign] >= 0 ? "+" : ""}${H_ASC[ascSign] || 0}. 기준은 한국 ${sex === "F" ? "여성 160" : "남성 172"}cm. <b>이 수치는 추정이다</b> — 두 축을 cm 로 환산한 값이고 유파 표준이 없다.`)],
    ["몸", `<b>${BUILD[me]}</b>이다.${(maxEl[1] >= 3 && (maxEl[0] === "토" || maxEl[0] === "수")) ? " 살이 잘 붙는다. 평생 관리해야 할 몸이다." : ""}`,
      fn(`일간 오행 ${me} 의 체상. 가장 많은 기운은 ${maxEl[0]} ${maxEl[1]}개 — ${maxEl[0] === "토" || maxEl[0] === "수" ? "부기·살집으로 본다" : "체형에 큰 영향은 없다"}.`)],
    ["얼굴", FACE[me], fn(`일간 오행 ${me} 의 상(相).`)],
    ["목소리", `${VOICE[me]}.${G.식상 === 0 ? " 말수가 적어서 더 그렇게 들린다." : ""}`,
      fn(`일간 오행 ${me} + 표현을 맡은 자리 ${G.식상}개.`)],
    ["평생 약한 곳", `<b>${ORGAN[weakEl[0]].part}.</b> ${ORGAN[weakEl[0]].sym}`,
      fn(`${weakEl[0]} ${lackEl.length ? "0개 — 명식에 한 자도 없다" : "가 가장 얇다"}.${maxEl[1] >= 3 && beaten[maxEl[0]] === weakEl[0] ? ` 게다가 가장 센 ${maxEl[0]}(${maxEl[1]}개)이 바로 그 자리를 친다.` : ""}`)],
  ];
  if (maxEl[1] >= 4) body.push(["과한 곳", `<b>${ORGAN[maxEl[0]].part}</b> 쪽이 과열된다. ${ORGAN[maxEl[0]].over}`, fn(`${maxEl[0]} ${maxEl[1]}개 — 넘치는 쪽도 병이 된다.`)]);

  /* ── 짝 ── */
  let mate = null;
  if (sex) {
    const sp = SPOUSE[spouseSS];
    mate = [
      ["키·체형", `<b>${h7.h >= 2 ? "키가 큰 편" : h7.h <= -1 ? "아담한 편" : "평균 근처"}.</b> ${h7.look}`,
        fn(`짝의 자리가 ${h7Sign} — 상승궁 ${ascSign}의 맞은편이다. 서양 전통에서 이 자리가 배우자의 겉모습을 직접 다룬다.`)],
      ["분위기", h7.air, fn(`${h7Sign}의 성질.${sunH === 7 ? " 게다가 태양이 그 자리에 든다 — 배우자가 사회적으로 드러나는 사람이 된다." : ""}`)],
      ["성격", `<b>${sp.w}</b>이다. ${sp.d}`, fn(`일지(배우자 자리)에 앉은 것이 ${spouseSS}.`)],
      ["집안", spouseSS === "정재" || spouseSS === "정관" ? "<b>반듯하다.</b> 크게 부자는 아닌데 부족하지도 않다. 결혼하고 나서 그 집에서 실질적인 도움을 받는다"
        : spouseSS === "편재" || spouseSS === "편관" ? "<b>기복이 있다.</b> 좋을 땐 크게 좋고 아닐 땐 아니다. 처음부터 셈을 분명히 해 두는 게 낫다"
        : "<b>평범하다.</b> 집안 덕을 크게 보는 쪽은 아니다",
        fn(`${spouseSS}의 성질로 본 처가·시가. 재물의 자리가 내 자리에 앉으면 덕이 있다고 본다.`)],
      ["벌이", spouseSS === "정재" ? "<b>자기 벌이가 확실하다.</b> 월급쟁이거나 전문직. 크게 버는 쪽이 아니라 끊기지 않는 쪽이다"
        : spouseSS === "편재" ? "<b>버는 폭이 크다.</b> 사업이나 성과급 쪽이다. 좋을 때와 아닐 때 차이가 크다"
        : "<b>보통이다.</b> 맞벌이가 기본값이 된다",
        fn(`${spouseSS} — 고정 수입인지 변동 수입인지를 가르는 자리다.`)],
      ["어떻게 만나나", sunH === 7 ? "<b>사람들 있는 자리에서 만난다.</b> 소개나 일 관계다. 우연히 길에서 만나는 그림이 아니다"
        : "<b>가까운 데서 만난다.</b> 오래 알던 사이거나, 같은 공간에 있던 사람이다",
        fn(`태양이 ${sunH}하우스. 7하우스면 공개된 자리, 아니면 생활 반경 안에서 본다.`)],
      ["언제 만나나",
        !mateAge ? "짚을 수 있는 값이 부족하다"
          : mateWhen.agree ? `<b>${mateAge}세 전후다.</b> 세 가지 셈이 전부 이 나이를 가리킨다`
            : `<b>${mateWhen.lo}세에서 ${mateWhen.hi}세 사이다.</b> 세 셈이 갈려서 한 해로 못 좁힌다 — 그중 <b>${mateAge}세</b>가 가장 유력하다`,
        fn(!mateAge ? `후보가 둘 미만이라 못 짚음 — 22~45세에 걸치는 값이 ${mateWhen.cands.length}개.`
          : `${mateWhen.cands.map((x) => `${x.k} ${x.a}세(${x.why})`).join(" · ")} → 폭 ${mateWhen.spread}년. ${mateWhen.agree ? "8년 이내라 <b>합의</b>로 봤다" : "8년을 넘어 <b>갈린다고 표시</b>했다"}.`)],
      ["그전에 오는 인연", shakeBefore.length ? `<b>${shakeBefore[0].from}~${shakeBefore[0].to}세에 만나는 사람은 오래 못 간다.</b> 그 사람이 나빠서가 아니라 그 자리가 흔들리게 되어 있다` : "짝을 만나기 전에 크게 흔들리는 구간은 없다",
        fn(shakeBefore.length ? `${shakeBefore[0].from}~${shakeBefore[0].to}세 구간의 글자가 배우자 자리를 충 또는 형한다. 열여덟 미만 구간은 인연으로 세지 않는다.` : "짝을 만나기 전(18세~) 구간에는 배우자 자리를 치는 글자가 없다.")],
      ["결혼 후", `<b>${["정재", "정관", "정인"].includes(spouseSS) ? "붙어 사는 부부가 된다" : "각자 몫이 분명한 부부가 된다"}.</b> ` +
        (G.식상 === 0 ? "위험은 하나다 — <b>밖에서 참은 걸 집에서 푼다.</b> 미리 알면 반은 막힌다" : "크게 부딪히는 구조는 아니다"),
        fn(`${spouseSS} + 표현을 맡은 자리 ${G.식상}개. 표현이 막히면 압력이 가장 가까운 자리로 향한다.`)],
      ["갈라설 위험", shakeAfter.length ? `<b>${shakeAfter[0].from}~${shakeAfter[0].to}세에 한 번 크게 흔들린다.</b> 그때 원인은 사람이 아니라 일과 돈이다` : "<b>낮다.</b> 결혼한 뒤로 그 자리를 정면으로 치는 구간이 없다",
        fn(shakeAfter.length ? `${shakeAfter[0].from}~${shakeAfter[0].to}세 구간이 배우자 자리를 다시 친다.` : "짝을 만난 뒤로 배우자 자리를 치는 구간이 여든까지 없다.")],
    ];
  }

  /* ── 뒤집히는 조건 ── */
  const dark = bands.filter((b) => ["편관", "정관", "겁재"].includes(b.ss));
  const trig = [
    { t: `${BLOCK[blockKey].t}이 막혔을 때`, w: `${BLOCK[blockKey].w} 신호는 이렇다 — 말수가 줄고, 대답이 짧아지고, 혼자 있으려 한다. 그 다음이 폭발이다.`,
      n: fn(`가장 빈 자리가 ${blockKey} ${G[blockKey]}개. 없는 자리가 압력이 쌓이는 자리가 된다.`) },
    { t: "여럿이 네 자리를 정할 때", w: "누가 시키는 건 참는다. 여럿이 네 몫을 대신 정하는 건 못 참는다. 가만있다가 갑자기 판을 엎고, 그러고 나서 자기를 더 미워한다.",
      n: fn(`나를 누르는 자리(관성) ${G.관성}개${dark.length ? ` + ${dark[0].from}~${dark[0].to}세 구간이 그 성질` : ""}.`) },
    { t: "몸이 처질 때", w: "마음보다 몸이 먼저 무너진다. 몸이 무너지면 성격이 바뀐다. 느긋하던 게 없어지고 짜증이 앞선다.",
      n: fn(`${weakEl[0]} 자리가 얇아 계절이 바뀔 때 먼저 신호가 온다.`) },
  ];

  /* ── 해와 달 ── */
  const yong = G.비겁 + G.인성 >= 4 ? [{ 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" }[me], { 목: "토", 화: "금", 토: "수", 금: "목", 수: "화" }[me]]
    : [{ 화: "목", 토: "화", 금: "토", 수: "금", 목: "수" }[me], me];
  const gi = ["목", "화", "토", "금", "수"].filter((e) => !yong.includes(e)).slice(0, 2);
  const yrs = seun(idx.dG, now.getFullYear(), 6).map((x) => ({ ...x, f: favor(x.el, yong, gi) }));
  const mos = wolun(idx.dG, idx.yG, now.getFullYear()).map((x) => ({ ...x, f: favor(x.el, yong, gi), m: +x.start.slice(5, 7) }));
  const hardMonths = mos.filter((x) => x.f < 0).map((x) => x.m);
  const softMonths = mos.filter((x) => x.f > 0).map((x) => x.m);

  return {
    age, ageFull, noHour: !!noH, sex: sex || null,
    core: {
      surface: SURFACE[me], inner: INNER[innerEl], split,
      block: BLOCK[blockKey], blockKey, blockN: G[blockKey],
      n1: fn(`일간 ${GANK[idx.dG]} — ${me}. 남들 눈에 보이는 결이 여기서 나온다.`),
      n2: fn(`서양 해자리 ${sun}(${ZO_EL[sun]})·달자리 ${moon}(${ZO_EL[moon]})${split ? " — 둘이 갈린다. 겉과 속이 다른 구조다" : " — 둘이 같다"}. 인도 달자리 ${nakshatra(jd, +birth.y)}. 마야 ${tzolkin(jdn(+birth.y, +birth.m, +birth.d)).tone} ${tzolkin(jdn(+birth.y, +birth.m, +birth.d)).sign}.`),
      n3: fn(`${blockKey} ${G[blockKey]}개 — 다섯 자리 중 가장 비었다. 없는 것이 있는 것보다 많은 걸 정한다.`),
    },
    body, mate, trig,
    when: { hardMonths, softMonths, years: yrs.map((y) => ({ y: y.year, f: y.f })),
      n: fn(`올해 열두 달을 절기로 갈라 채울 기운(${yong.join("·")})·부담되는 기운(${gi.join("·")}) 대비 −3~+3으로 매겼다.`) },
    job: { ...THICK[thickKey], thickKey, n: fn(`가장 두꺼운 자리가 ${thickKey} ${G[thickKey]}개.`) },
    bands, cur,
    dasha: dasha.periods.map((p) => ({ ...p, ko: DASHA_KO[p.lord] })),
    notes,
    _raw: { me, G, ss, counts, ascSign, sun, moon, sunH, h7Sign, spouseSS, yong, gi, day },
  };
}
