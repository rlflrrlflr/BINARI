import { useState, useRef, useEffect } from "react";

/* ═══════════════ 비나리 BINARI · 웹앱 (v16-dev · 0단계: 아티팩트 탈출) ═══════════════
   온보딩(재회→의식→회상개봉) → 파라메트릭 수호신 → AI 판결(v2 수호신 프롬프트)
   만세력: JS 자체 구현 (일주=율리우스일 기반 검증 완료, 절기=근사표 ±1일)
   v14: ①수호신 비주얼 = 지표별 독립 시각축(오행=형태, 별자리=주색 hue회전, 오행분포=강조색,
          라이프패스=대칭수, 달=밝기, MBTI=밀도/속도/질서) + 개인 시드 → 같은 오행도 안 겹침
        ②프롬프트 캐싱(system) + 대화 기억(최근 6턴)
   v15: ①판결 2콜 분리 — 콜1: 결론만(빠름, L1 즉시) / 콜2: 근거만(백그라운드, 판결 뒤집기 금지→일관성 보장)
        ②3층 리빌: L1 결론 → L2 '왜?'(클릭, 시간 벌이) → L3 지표별 근거(카드 뒤집기)
        ③휴먼디자인 제거 — 생일로 이미 아는 값을 되묻는 건 세계관 위반, 정식 자동계산은 Phase 2
   v13: 진태양시·독립판정·JSON 파서 강화 / v7: 바이오리듬·삼재·가치여정·주역·부적 / v5: 수비학 축
   v16(0단계): ①API 호출을 /api/judge 서버리스 프록시로 이전(키는 서버 env에만) ②콜1 실패 복구(동전 보존 재시도+질문 고치기)
          ③콜2 실패 재시도 ④가짜 '건너뛰기' 제거 ⑤휴먼디자인 죽은 코드 삭제 ⑥심야 컨텍스트 주입 ⑦접전 배지
   정정: 토정비결은 v11부터 구현·사용 중(과거 '보류' 주석은 낡은 정보) · 손없는날은 미구현 */

/* ───── 만세력 계산 ───── */
const GAN = ["갑","을","병","정","무","기","경","신","임","계"];
const JI = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
const GAN_EL = ["목","목","화","화","토","토","금","금","수","수"];
const JI_EL = ["수","토","목","목","토","화","화","토","금","금","토","수"];
const EL_READ = {
  수: "생각이 깊고 많아서, 결정 앞에 오래 서 있는 사람이었지. 알고 있었어.",
  화: "마음에 불이 붙으면 못 참는 사람. 그 뜨거움이 너를 여기까지 데려왔어.",
  목: "계속 자라고 싶어하는 사람이야, 너는. 멈춰 있으면 시들해지는 걸 내가 봤어.",
  금: "한번 정하면 단단한 사람. 대신 정하기까지가 오래 걸리는 것도 알아.",
  토: "주변을 받쳐주느라 정작 네 결정은 뒤로 미루는 사람이었지.",
};
const jdn = (y, m, d) => {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
};
// 절기 근사표(입춘~소한): [월, 일] — ±1일 오차 가능(MVP 한계, 화면에 고지)
const TERMS = [[2,4],[3,6],[4,5],[5,6],[6,6],[7,7],[8,8],[9,8],[10,8],[11,7],[12,7],[1,6]];
function calcSaju(y, m, d, h, mi, hourUnknown) {
  // 사주년: 입춘 기준
  const beforeIpchun = m < 2 || (m === 2 && d < 4);
  const sy = beforeIpchun ? y - 1 : y;
  const yG = (sy - 4) % 10 < 0 ? (sy - 4) % 10 + 10 : (sy - 4) % 10;
  const yJ = (sy - 4) % 12 < 0 ? (sy - 4) % 12 + 12 : (sy - 4) % 12;
  // 사주월: 절기 기준 (인월=1)
  let mn = 0;
  for (let i = 0; i < 12; i++) {
    const [tm, td] = TERMS[i];
    const passed = tm === 1
      ? (m === 1 && d >= td)                       // 소한(이듬해 1월)
      : (m > tm || (m === tm && d >= td));
    if (passed) mn = i + 1;
  }
  if (mn === 0) mn = 12;                            // 1/1~소한 전 = 축월
  const mJ = (mn + 1) % 12;
  const mG = ((yG % 5) * 2 + 2 + (mn - 1)) % 10;
  // 일주: (JDN+49) mod 60 — 검증: 1984-02-02=병인일, 2000-01-01=무오일
  const g = (jdn(y, m, d) + 49) % 60;
  const dG = g % 10, dJ = g % 12;
  // 시주
  let hG = null, hJ = null;
  if (!hourUnknown) {
    const hh = h + (mi || 0) / 60 - 0.5;         // v13: 진태양시 보정 -30분(KST=동경135° 기준, 한국 경도 실보정) + 분 반영
    hJ = Math.floor(((hh + 1) % 24) / 2);
    hG = ((dG % 5) * 2 + hJ) % 10;
  }
  // 오행 분포
  const cnt = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  [[yG, yJ], [mG, mJ], [dG, dJ], ...(hG !== null ? [[hG, hJ]] : [])].forEach(([gg, jj]) => {
    cnt[GAN_EL[gg]]++; cnt[JI_EL[jj]]++;
  });
  const main = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
  return {
    pillars: { 년: GAN[yG] + JI[yJ], 월: GAN[mG] + JI[mJ], 일: GAN[dG] + JI[dJ], 시: hG !== null ? GAN[hG] + JI[hJ] : "미상" },
    counts: cnt, main, dayGan: GAN[dG], yJ,
  };
}
/* ───── 별자리 · 달 위상 ───── */
const ZODIAC = [
  ["염소자리",1,19,"흙"],["물병자리",2,18,"공기"],["물고기자리",3,20,"물"],["양자리",4,19,"불"],
  ["황소자리",5,20,"흙"],["쌍둥이자리",6,21,"공기"],["게자리",7,22,"물"],["사자자리",8,22,"불"],
  ["처녀자리",9,22,"흙"],["천칭자리",10,23,"공기"],["전갈자리",11,22,"물"],["사수자리",12,21,"불"],["염소자리",12,31,"흙"],
];
const ZO_READ = { 불: "타오르는 별 아래 태어났어. 망설임보다 후회를 무서워하는 별이야.", 흙: "단단한 별 아래 태어났지. 확실한 것만 딛고 싶어하는 발을 알아.", 공기: "바람의 별이야. 생각이 많아 어디로든 갈 수 있는 만큼, 어디로 갈지 늘 고민이지.", 물: "물의 별 아래 태어났어. 마음이 깊어서, 얕은 답에는 만족 못 하는 사람." };
/* 통합 멘션 조각: 오행=본성 / 별자리=흔들림 / 달=지향 */
const EL_TRAIT = { 금: "한번 마음을 정하면 누구보다 단단한", 수: "깊이 생각하고, 마음도 그만큼 깊은", 화: "마음에 불이 붙으면 누구보다 뜨거운", 목: "멈추지 않고 계속 자라고 싶어하는", 토: "곁을 조용히, 든든하게 받쳐주는" };
const ZO_FLAW = { 공기: "생각이 많아 길 위에서 흔들리", 불: "급한 마음에 스스로 데이기도 하", 물: "마음이 깊어 혼자 가라앉기도 하", 흙: "확실한 것만 찾다 제자리에 머물기도 하" };
const MOON_DRIVE = { 상현달: "늘 '조금 더'를 향해 차오르는", 보름달: "숨지 않고 빛나려는", 초승달: "새로 시작하기를 두려워하지 않는", 새달: "빈 곳을 스스로 채워가는", "차오르는 달": "완성을 향해 나아가는", "기우는 달": "비울 줄 아는", 하현달: "덜어내며 또렷해지는", 그믐달: "끝에서 다시 시작하는" };
const getZodiac = (m, d) => { for (const [n, zm, zd, el] of ZODIAC) if (m < zm || (m === zm && d <= zd)) return { name: n, el }; return { name: "염소자리", el: "흙" }; };
function moonPhase(y, m, d) {
  const age = ((jdn(y, m, d) - 2451550) % 29.53059 + 29.53059) % 29.53059;
  const ph = age < 1.8 ? ["새달","비어 있던 하늘"] : age < 6.5 ? ["초승달","막 차오르기 시작한 달"] : age < 9.5 ? ["상현달","반쯤 차오른 달"]
    : age < 13.5 ? ["차오르는 달","거의 가득한 달"] : age < 16.5 ? ["보름달","가장 밝은 달"] : age < 21 ? ["기우는 달","천천히 내려놓는 달"]
    : age < 24.5 ? ["하현달","반을 비워낸 달"] : ["그믐달","다음을 준비하는 달"];
  const read = { 새달: "네가 태어난 밤, 하늘은 비어 있었어. 채우는 건 늘 네 몫이었지.", 초승달: "차오르기 시작한 달 아래 태어났어. 시작의 기운이 네 안에 있어.",
    상현달: "반쯤 차오른 달처럼, 너는 늘 '조금 더'를 향해 있는 사람이야.", "차오르는 달": "거의 가득 찬 달 아래 태어났지. 완성 직전의 긴장을 아는 사람.",
    보름달: "가장 밝은 달이 너를 비추고 있었어. 숨는 건 어울리지 않아.", "기우는 달": "내려놓을 줄 아는 달 아래 태어났어. 비우는 것도 결정이야.",
    하현달: "반을 비워낸 달처럼, 너는 덜어낼 때 더 또렷해지는 사람이지.", 그믐달: "끝과 시작 사이의 달이야. 전환점마다 네가 강해지는 이유." };
  return { name: ph[0], sub: ph[1], read: read[ph[0]] };
}
/* ───── 수비학 (라이프패스, v5 — 생일 파생·입력 0) ───── */
function lifePath(y, m, d) {
  const digits = (n) => String(n).split("").reduce((a, c) => a + +c, 0);
  let s = digits(y) + digits(m) + digits(d);
  while (s > 9 && s !== 11 && s !== 22 && s !== 33) s = digits(s);
  return s;
}
const LP_READ = {
  1: "1의 길 — 앞장서야 살아나는 사람. 네 결정은 남이 대신 못 해.",
  2: "2의 길 — 함께일 때 강해지는 사람. 혼자 정하려니 무거웠던 거야.",
  3: "3의 길 — 표현하며 길을 찾는 사람. 말로 꺼내면 답이 보이곤 했지.",
  4: "4의 길 — 쌓아올리는 사람. 급한 길보다 단단한 길이 네 길이야.",
  5: "5의 길 — 변화가 숨통인 사람. 갇힌 기분이 들면 그게 신호야.",
  6: "6의 길 — 돌보는 사람. 남 챙기다 네 결정이 늦어지는 것도 봤어.",
  7: "7의 길 — 파고드는 사람. 납득이 안 되면 몸이 안 움직이지.",
  8: "8의 길 — 이뤄내는 사람. 크게 그리는 걸 두려워하지 마.",
  9: "9의 길 — 품이 넓은 사람. 끝맺음이 새 시작인 걸 아는 사람.",
  11: "11의 길 — 직감이 먼저 아는 사람. 그 촉, 무시하지 마.",
  22: "22의 길 — 크게 짓는 사람. 네 계획은 허황이 아니라 설계야.",
  33: "33의 길 — 사람을 살리는 사람. 그만큼 네 몫도 챙겨야 해.",
};

/* ───── v7 지표: 바이오리듬 · 삼재 · 가치 ───── */
const VALUES24 = ["안정", "성장", "자유", "인정", "관계", "성취", "즐거움", "의미", "돈", "건강", "배움", "용기", "정직", "창조", "평온", "모험", "가족", "영향력", "독립", "봉사", "아름다움", "전문성", "몰입", "유머"];
function biorhythm(y, m, d) { // 출생일 기준 23/28/33일 주기 — 정확 계산
  const days = (Date.now() - new Date(y, m - 1, d).getTime()) / 86400000;
  const f = (p) => Math.round(Math.sin(2 * Math.PI * (days / p)) * 100);
  return { body: f(23), emotion: f(28), intellect: f(33) };
}
function samjae(yJ, nowY) { // 삼합 그룹→삼재 3년 (전통 규칙 정확, 연도 경계는 입춘 근사)
  const grp = [[8, 0, 4], [2, 6, 10], [5, 9, 1], [11, 3, 7]];          // 신자진/인오술/사유축/해묘미
  const tri = [[2, 3, 4], [8, 9, 10], [11, 0, 1], [5, 6, 7]];          // 각 그룹의 삼재 연지
  const gi = grp.findIndex(a => a.includes(yJ));
  const pos = tri[gi].indexOf(((nowY - 4) % 12 + 12) % 12);
  return pos === -1 ? null : ["들삼재", "눌삼재", "날삼재"][pos];
}

/* ───── 토정비결 (v11) — 음력: korean-lunar-calendar 검증 데이터(1900~2030) / 작괘: 태세·월건·일진수 조견표(만세력 자료 검증) ───── */
const LUNAR = {1900:[693626,8,[29,30,29,29,30,29,30,30,29,30,30,29,30]],1901:[694010,0,[29,30,29,29,30,29,30,29,30,30,30,29]],1902:[694364,0,[30,29,30,29,29,30,29,30,29,30,30,30]],1903:[694719,5,[29,30,29,30,29,29,30,29,29,30,30,29,30]],1904:[695102,0,[30,30,29,30,29,29,30,29,29,30,30,29]],1905:[695456,0,[30,30,29,30,30,29,29,30,29,30,29,30]],1906:[695811,4,[29,30,30,29,30,29,30,29,30,29,30,29,30]],1907:[696195,0,[29,30,29,30,29,30,30,29,30,29,30,29]],1908:[696549,0,[30,29,29,30,30,29,30,29,30,30,29,30]],1909:[696904,2,[29,30,29,29,30,29,30,29,30,30,30,29,30]],1910:[697288,0,[29,30,29,29,30,29,30,29,30,30,30,29]],1911:[697642,6,[30,29,30,29,29,30,29,29,30,30,29,30,30]],1912:[698026,0,[30,29,30,29,29,30,29,29,30,30,29,30]],1913:[698380,0,[30,30,29,30,29,29,30,29,29,30,29,30]],1914:[698734,5,[30,30,29,30,30,29,29,30,29,30,29,29,30]],1915:[699118,0,[30,29,30,30,29,30,29,30,29,30,29,30]],1916:[699473,0,[29,30,29,30,29,30,30,29,30,29,30,29]],1917:[699827,2,[30,29,29,30,29,30,30,29,30,30,29,30,29]],1918:[700211,0,[30,29,29,30,29,30,29,30,30,30,29,30]],1919:[700566,7,[29,30,29,29,30,29,30,29,30,30,29,30,30]],1920:[700950,0,[29,30,29,29,30,29,29,30,30,29,30,30]],1921:[701304,0,[30,29,30,29,29,30,29,29,30,29,30,30]],1922:[701658,5,[30,29,30,30,29,29,30,29,29,30,29,30,30]],1923:[702042,0,[29,30,30,29,30,29,30,29,30,29,29,30]],1924:[702396,0,[30,29,30,29,30,30,29,30,29,30,29,29]],1925:[702750,4,[30,29,30,30,29,30,29,30,30,29,30,29,30]],1926:[703135,0,[29,29,30,29,30,29,30,30,29,30,30,29]],1927:[703489,0,[30,29,29,30,29,30,29,30,30,29,30,30]],1928:[703844,2,[29,30,29,29,30,29,29,30,30,29,30,30,30]],1929:[704228,0,[29,30,29,29,30,29,29,30,29,30,30,30]],1930:[704582,6,[29,30,30,29,29,30,29,29,30,29,30,30,29]],1931:[704965,0,[30,30,30,29,29,30,29,29,30,29,30,29]],1932:[705319,0,[30,30,30,29,30,29,30,29,29,30,29,30]],1933:[705674,5,[29,30,30,29,30,30,29,30,29,30,29,29,30]],1934:[706058,0,[29,30,29,30,30,29,30,30,29,30,29,30]],1935:[706413,0,[29,29,30,29,30,29,30,30,29,30,30,29]],1936:[706767,3,[30,29,29,30,29,30,29,30,29,30,30,30,29]],1937:[707151,0,[30,29,29,30,29,29,30,29,30,30,30,29]],1938:[707505,7,[30,30,29,29,30,29,29,30,29,30,30,29,30]],1939:[707889,0,[30,30,29,29,30,29,29,30,29,30,29,30]],1940:[708243,0,[30,30,29,30,29,30,29,29,30,29,30,29]],1941:[708597,6,[30,30,29,30,30,29,30,29,29,30,29,30,29]],1942:[708981,0,[30,29,30,30,29,30,30,29,30,29,29,30]],1943:[709336,0,[29,30,29,30,29,30,30,29,30,30,29,30]],1944:[709691,4,[29,29,30,29,30,29,30,29,30,30,29,30,30]],1945:[710075,0,[29,29,30,29,29,30,29,30,30,30,29,30]],1946:[710429,0,[30,29,29,30,29,29,30,29,30,30,29,30]],1947:[710783,2,[30,30,29,29,30,29,29,30,29,30,29,30,30]],1948:[711167,0,[30,29,30,29,30,29,29,30,29,30,29,30]],1949:[711521,7,[30,30,29,30,29,30,29,29,30,29,30,29,30]],1950:[711905,0,[30,29,30,30,29,30,29,29,30,29,30,29]],1951:[712259,0,[30,29,30,30,29,30,29,30,29,30,29,30]],1952:[712614,5,[29,30,29,30,29,30,30,29,30,29,30,29,30]],1953:[712998,0,[29,30,29,29,30,30,29,30,30,29,30,30]],1954:[713353,0,[29,29,30,29,29,30,29,30,30,29,30,30]],1955:[713707,3,[30,29,29,30,29,29,30,29,30,29,30,30,30]],1956:[714091,0,[29,30,29,30,29,29,30,29,30,29,30,30]],1957:[714445,8,[30,29,30,29,30,29,29,30,29,30,29,30,30]],1958:[714829,0,[29,30,30,29,30,29,29,30,29,30,29,30]],1959:[715183,0,[29,30,30,29,30,29,30,29,30,29,30,29]],1960:[715537,6,[30,29,30,29,30,30,29,30,29,30,29,30,29]],1961:[715921,0,[30,29,30,29,30,29,30,30,29,30,29,30]],1962:[716276,0,[29,30,29,29,30,29,30,30,29,30,30,29]],1963:[716630,4,[30,29,30,29,29,30,29,30,29,30,30,30,29]],1964:[717014,0,[30,29,30,29,29,30,29,30,29,30,30,30]],1965:[717369,0,[29,30,29,30,29,29,30,29,29,30,30,30]],1966:[717723,3,[29,30,30,29,30,29,29,30,29,29,30,30,29]],1967:[718106,0,[30,30,29,30,30,29,29,30,29,30,29,30]],1968:[718461,7,[29,30,30,29,30,29,30,29,30,29,30,29,30]],1969:[718845,0,[29,30,29,30,29,30,30,29,30,29,30,29]],1970:[719199,0,[30,29,29,30,30,29,30,29,30,30,29,30]],1971:[719554,5,[29,30,29,29,30,29,30,29,30,30,30,29,30]],1972:[719938,0,[29,30,29,29,30,29,30,29,30,30,30,29]],1973:[720292,0,[30,29,30,29,29,30,29,29,30,30,30,29]],1974:[720646,4,[30,30,29,30,29,29,30,29,29,30,30,29,30]],1975:[721030,0,[30,30,29,30,29,29,30,29,29,30,29,30]],1976:[721384,8,[30,30,29,30,29,30,29,30,29,30,29,29,30]],1977:[721768,0,[30,29,30,30,29,30,29,30,29,30,29,29]],1978:[722122,0,[30,30,29,30,29,30,30,29,30,29,30,29]],1979:[722477,6,[30,29,29,30,29,30,30,29,30,30,29,30,29]],1980:[722861,0,[30,29,29,30,29,30,29,30,30,29,30,30]],1981:[723216,0,[29,30,29,29,30,29,29,30,30,29,30,30]],1982:[723570,4,[30,29,30,29,29,30,29,29,30,30,29,30,30]],1983:[723954,0,[30,29,30,29,29,30,29,29,30,29,30,30]],1984:[724308,10,[30,29,30,30,29,29,30,29,29,30,29,30,30]],1985:[724692,0,[29,30,30,29,30,29,30,29,29,30,29,30]],1986:[725046,0,[29,30,30,29,30,30,29,30,29,30,29,29]],1987:[725400,6,[30,29,30,30,29,30,29,30,30,29,30,29,30]],1988:[725785,0,[29,29,30,29,30,29,30,30,29,30,30,29]],1989:[726139,0,[30,29,29,30,29,30,29,30,30,29,30,30]],1990:[726494,5,[29,30,29,29,30,29,29,30,30,29,30,30,30]],1991:[726878,0,[29,30,29,29,30,29,29,30,29,30,30,30]],1992:[727232,0,[29,30,30,29,29,30,29,29,30,29,30,30]],1993:[727586,3,[29,30,30,29,30,29,30,29,29,30,29,30,29]],1994:[727969,0,[30,30,30,29,30,29,30,29,29,30,29,30]],1995:[728324,8,[29,30,30,29,30,30,29,30,29,30,29,29,30]],1996:[728708,0,[29,30,29,30,30,29,30,29,30,30,29,30]],1997:[729063,0,[29,29,30,29,30,29,30,30,29,30,30,29]],1998:[729417,5,[30,29,29,30,29,29,30,30,29,30,30,30,29]],1999:[729801,0,[30,29,29,30,29,29,30,29,30,30,30,29]],2000:[730155,0,[30,30,29,29,30,29,29,30,29,30,30,29]],2001:[730509,4,[30,30,30,29,29,30,29,29,30,29,30,29,30]],2002:[730893,0,[30,30,29,30,29,30,29,29,30,29,30,29]],2003:[731247,0,[30,30,29,30,30,29,30,29,29,30,29,30]],2004:[731602,2,[29,30,29,30,30,29,30,29,30,29,30,29,30]],2005:[731986,0,[29,30,29,30,29,30,30,29,30,30,29,29]],2006:[732340,7,[30,29,30,29,30,29,30,29,30,30,29,30,30]],2007:[732725,0,[29,29,30,29,29,30,29,30,30,30,29,30]],2008:[733079,0,[30,29,29,30,29,29,30,29,30,30,29,30]],2009:[733433,5,[30,30,29,29,30,29,29,30,29,30,29,30,30]],2010:[733817,0,[30,29,30,29,30,29,29,30,29,30,29,30]],2011:[734171,0,[30,29,30,30,29,30,29,29,30,29,30,29]],2012:[734525,3,[30,29,30,30,30,29,30,29,29,30,29,30,29]],2013:[734909,0,[30,29,30,30,29,30,29,30,29,30,29,30]],2014:[735264,9,[29,30,29,30,29,30,29,30,30,29,30,29,30]],2015:[735648,0,[29,30,29,29,30,29,30,30,30,29,30,29]],2016:[736002,0,[30,29,30,29,29,30,29,30,30,29,30,30]],2017:[736357,5,[29,30,29,30,29,29,30,29,30,29,30,30,30]],2018:[736741,0,[29,30,29,30,29,29,30,29,30,29,30,30]],2019:[737095,0,[30,29,30,29,30,29,29,30,29,30,29,30]],2020:[737449,4,[30,29,30,30,29,30,29,29,30,29,30,29,30]],2021:[737833,0,[29,30,30,29,30,29,30,29,30,29,30,29]],2022:[738187,0,[30,29,30,29,30,30,29,30,29,30,29,30]],2023:[738542,2,[29,30,29,30,29,30,29,30,30,29,30,29,30]],2024:[738926,0,[29,30,29,29,30,29,30,30,29,30,30,29]],2025:[739280,6,[30,29,30,29,29,30,29,30,29,30,30,30,29]],2026:[739664,0,[30,29,30,29,29,30,29,30,29,30,30,30]],2027:[740019,0,[29,30,29,30,29,29,30,29,29,30,30,30]],2028:[740373,5,[29,30,30,29,30,29,29,30,29,29,30,30,29]],2029:[740756,0,[30,30,29,30,30,29,29,30,29,29,30,30]],2030:[741111,0,[29,30,29,30,30,29,30,29,30,29,30,29]]};
const ordOf = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000) + 719163;
function solar2lunar(y, m, d) {
  const ord = ordOf(y, m, d);
  for (let ly = y; ly >= y - 1; ly--) {
    const rec = LUNAR[ly]; if (!rec) continue;
    let off = ord - rec[0]; if (off < 0) continue;
    const leap = rec[1], ms = rec[2];
    for (let i = 0; i < ms.length; i++) {
      if (off < ms[i]) {
        let mm = i + 1, isLeap = false;
        if (leap > 0) { if (i + 1 === leap + 1) { mm = leap; isLeap = true; } else if (i + 1 > leap) mm = i; }
        return { ly, lm: mm, ld: off + 1, isLeap };
      }
      off -= ms[i];
    }
  }
  return null;
}
function lunar2solarOrd(ly, lm, ld) {
  const rec = LUNAR[ly]; if (!rec) return null;
  const leap = rec[1], ms = rec[2]; let off = 0;
  for (let i = 0; i < ms.length; i++) {
    let mm = i + 1; if (leap > 0 && i + 1 > leap) mm = i;
    const isLeapSlot = leap > 0 && i + 1 === leap + 1;
    if (mm === lm && !isLeapSlot) return rec[0] + off + ld - 1;
    off += ms[i];
  }
  return null;
}
function tojung(by, bm, bd, nowY) { // 상괘=(나이+태세수)%8, 중괘=(월건수+달일수)%6, 하괘=(일진수+생일)%3
  const lb = solar2lunar(by, bm, bd); if (!lb) return null;
  const age = nowY - lb.ly + 1; // 세는나이 — 음력 출생년 기준(연초 양력생은 전년도 음력년)
  const GS = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5];
  const TJ = [11, 13, 10, 10, 13, 9, 9, 13, 12, 12, 13, 11];
  const WJ = [9, 8, 7, 6, 5, 4, 9, 8, 7, 6, 5, 4];
  const IJ = [9, 11, 8, 8, 11, 7, 7, 11, 10, 10, 11, 9];
  const yG = ((nowY - 4) % 10 + 10) % 10, yJb = ((nowY - 4) % 12 + 12) % 12;
  const sang = ((age + GS[yG] + TJ[yJb]) % 8) || 8;
  const rec = LUNAR[nowY]; if (!rec) return null;
  const leap = rec[1], ms = rec[2]; let days = 0;
  for (let i = 0; i < ms.length; i++) { let mm = i + 1; if (leap > 0 && i + 1 > leap) mm = i; const isL = leap > 0 && i + 1 === leap + 1; if (mm === lb.lm && !isL) { days = ms[i]; break; } }
  if (!days) return null;
  const mG = ((yG % 5) * 2 + 2 + (lb.lm - 1)) % 10, mJb = (lb.lm + 1) % 12;
  const jung = ((GS[mG] + WJ[mJb] + days) % 6) || 6;
  const ld = Math.min(lb.ld, days);
  const ordD = lunar2solarOrd(nowY, lb.lm, ld); if (ordD == null) return null;
  const g = (((ordD + 1721425 + 49) % 60) + 60) % 60;
  const ha = ((GS[g % 10] + IJ[g % 12] + ld) % 3) || 3;
  return { code: sang * 100 + jung * 10 + ha, sang, jung, ha, lunar: `${lb.lm}월 ${lb.ld}일${lb.isLeap ? "(윤달)" : ""}` };
}

/* ───── 주역 육효 (v6 · D2) — 동전 3개×6회, 앞=3 뒤=2 / 6노음·7소양·8소음·9노양 ───── */
const TRI_EL = { "111": "천", "110": "택", "101": "화", "100": "뢰", "011": "풍", "010": "수", "001": "산", "000": "지" };
const HEX_NAMES = { 천천:"중천건",천택:"천택리",천화:"천화동인",천뢰:"천뢰무망",천풍:"천풍구",천수:"천수송",천산:"천산돈",천지:"천지비",
  택천:"택천쾌",택택:"중택태",택화:"택화혁",택뢰:"택뢰수",택풍:"택풍대과",택수:"택수곤",택산:"택산함",택지:"택지췌",
  화천:"화천대유",화택:"화택규",화화:"중화리",화뢰:"화뢰서합",화풍:"화풍정",화수:"화수미제",화산:"화산려",화지:"화지진",
  뢰천:"뇌천대장",뢰택:"뇌택귀매",뢰화:"뇌화풍",뢰뢰:"중뢰진",뢰풍:"뇌풍항",뢰수:"뇌수해",뢰산:"뇌산소과",뢰지:"뇌지예",
  풍천:"풍천소축",풍택:"풍택중부",풍화:"풍화가인",풍뢰:"풍뢰익",풍풍:"중풍손",풍수:"풍수환",풍산:"풍산점",풍지:"풍지관",
  수천:"수천수",수택:"수택절",수화:"수화기제",수뢰:"수뢰둔",수풍:"수풍정",수수:"중수감",수산:"수산건",수지:"수지비",
  산천:"산천대축",산택:"산택손",산화:"산화비",산뢰:"산뢰이",산풍:"산풍고",산수:"산수몽",산산:"중산간",산지:"산지박",
  지천:"지천태",지택:"지택림",지화:"지화명이",지뢰:"지뢰복",지풍:"지풍승",지수:"지수사",지산:"지산겸",지지:"중지곤" };
const hexName = (lines) => { // lines: 아래→위, 각 6~9
  const bit = (v) => (v % 2 ? "1" : "0");
  const lo = lines.slice(0, 3).map(bit).join(""), up = lines.slice(3).map(bit).join("");
  return HEX_NAMES[TRI_EL[up] + TRI_EL[lo]];
};

/* ───── 수호신 비주얼 파라미터 ───── */
const EL_COLOR = { 수: ["#2a6bd4","#7fd4ff","#0a1f4d"], 화: ["#e04d2a","#ffb36b","#3d0f0a"], 목: ["#2ab06b","#a8f0c0","#0a3d22"], 금: ["#c9cdd6","#fff6dc","#2e3140"], 토: ["#c98f3d","#ffe9ad","#3d2a0a"] };
const MBTI16 = ["ISTJ","ISFJ","INFJ","INTJ","ISTP","ISFP","INFP","INTP","ESTP","ESFP","ENFP","ENTP","ESTJ","ESFJ","ENFJ","ENTJ"];
const BLOOD_COLOR = { A: "#eef2ff", B: "#ffd75e", O: "#ff6b5e", AB: "#b48cff" };
/* v14: 지표별 독립 시각축을 위한 색 유틸 — 원소 기본색을 별자리로 hue 회전 */
const ZO_ORDER = ["양자리","황소자리","쌍둥이자리","게자리","사자자리","처녀자리","천칭자리","전갈자리","사수자리","염소자리","물병자리","물고기자리"];
function _hexToHsl(hex){const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6;}return[h*360,s,l];}
function _hslToHex(h,s,l){h=(((h%360)+360)%360)/360;const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q,f=(t)=>{t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;},to=(x)=>Math.round(f(x)*255).toString(16).padStart(2,"0");return"#"+to(h+1/3)+to(h)+to(h-1/3);}
const rotHue=(hex,deg)=>{const[h,s,l]=_hexToHsl(hex);return _hslToHex(h+deg,s,l);};
const seedRnd=(str)=>{let h=7;for(const c of String(str))h=(h*31+c.charCodeAt(0))>>>0;return()=>((h=(h*1664525+1013904223)>>>0)/2**32);};

function GuardianCanvas({ saju, zo, mbti, blood, num, moon, agitateRef, size = 340 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    // ── v14: 지표 → 독립 시각축 매핑 (개인마다 고유한 지문) ──
    const E = mbti?.[0] === "E", N = mbti?.[1] === "N", T = mbti?.[2] === "T", P = mbti?.[3] === "P";
    // 개인 시드: 생일·성격·별자리 전체에서 파생 → 입자 배치·hue 지터가 사람마다 고정
    const seedStr = `${saju.main}${zo?.name || ""}${mbti || ""}${blood || ""}${num || ""}${saju.pillars?.일 || ""}`;
    const srnd = seedRnd(seedStr);
    // 축1 형태 = 오행 주기운(5)
    const form = saju.main;
    // 축2 주색 = 오행 기본색을 별자리로 hue 회전(12) + 시드 지터 → 같은 오행도 색이 갈라짐
    const [b1, b2] = EL_COLOR[saju.main];
    const zoIdx = Math.max(0, ZO_ORDER.indexOf(zo?.name));
    const zoDeg = (zoIdx - 5.5) * 6 + (srnd() - 0.5) * 16;
    const c1 = rotHue(b1, zoDeg), c2 = rotHue(b2, zoDeg);
    // 축3 강조색 = 사주 오행 분포 2순위 기운(개인의 실제 오행 비율 반영)
    const _order = Object.entries(saju.counts || {}).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const subEl = _order.find(e => e !== saju.main) || saju.main;
    const accent = rotHue(EL_COLOR[subEl][1], zoDeg * 0.5);
    // 축4 대칭수 = 수비학 라이프패스(구조적 지문)
    const lp = num || 5, arms = lp === 11 ? 11 : lp === 22 ? 8 : lp === 33 ? 12 : (lp + 2);
    // 축5 밀도/반짝임/속도/질서 = MBTI
    const n = E ? 1600 : 1150, speed = P ? 1.15 : 0.78, chaos = T ? 0.6 : 1.35; // T=정연, F=유동
    // 축6 헤일로(전체 밝기·크기) = 태어난 밤의 달 위상
    const MOON_I = { 새달: 0, 초승달: 1, 상현달: 2, "차오르는 달": 3, 보름달: 4, "기우는 달": 3, 하현달: 2, 그믐달: 1 };
    const lum = 0.55 + (MOON_I[moon?.name] ?? 2) * 0.11; // 0.55~0.99
    const w = size, cx = w / 2, cy = w / 2, R = w * 0.42;
    // v4: 어셈블 연출 — 화면 가장자리에 흩어진 채 시작, 난류를 타고 제 자리로 모인다 (v14: 시드 고정)
    const ps = Array.from({ length: n }, (_, i) => {
      const sa = srnd() * Math.PI * 2, sr = R * (1.1 + srnd() * 0.9);
      // o를 arms(대칭수)에 스냅 → 라이프패스가 갈래/빛살 수를 결정
      const arm = Math.floor(srnd() * arms);
      return { u: srnd(), v: srnd(), o: arm + srnd() * 0.6, s: srnd(), arm,
        ph: srnd() * Math.PI * 2, sx: cx + Math.cos(sa) * sr, sy: cy + Math.sin(sa) * sr,
        dly: srnd() * 0.35, acc: srnd() < 0.24 }; // 약 24%는 강조색
    });
    let t = 0, raf;
    const born = performance.now();
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    const place = (p) => {
      const g = 0.6 + 0.4 * Math.sin(t * 1.2 + p.ph);
      if (form === "화") { // 불: 아래→위 솟는 기둥
        const rise = (p.v + t * 0.12 * (0.5 + p.s)) % 1;
        const sway = Math.sin(rise * 6 + t * 2 + p.ph) * (0.5 - Math.abs(p.u - 0.5)) * R * 0.9;
        return [cx + (p.u - 0.5) * R * 1.1 * (1 - rise * 0.6) + sway, cy + R * 0.95 - rise * R * 2.1, 1 - rise];
      }
      if (form === "수") { // 물: 좌우 물결 층
        return [cx + (p.u - 0.5) * R * 2.1, cy + (p.v - 0.5) * R * 1.0 + Math.sin(p.u * 8 + t * 1.8 + p.ph) * R * 0.22, g];
      }
      if (form === "목") { // 나무: arms개 갈래로 가지치며 퍼짐 (라이프패스=갈래 수)
        const spread = Math.min(arms, 7), ang = -Math.PI / 2 + ((p.arm % spread) - (spread - 1) / 2) * 0.42 + Math.sin(t + p.ph) * 0.08, len = p.v * R * 1.9;
        return [cx + Math.cos(ang) * len + Math.sin(p.u * 10 + t) * p.v * R * 0.3, cy + R * 0.6 + Math.sin(ang) * len, g];
      }
      if (form === "금") { // 방사형 빛살 (라이프패스=빛살 수)
        const ang = (p.arm / arms) * Math.PI * 2 + (p.u - 0.5) * 0.12, rr = (p.v + t * 0.05) % 1 * R * 1.25;
        return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 1 - p.v];
      }
      const ang = p.u * Math.PI * 2, rr = Math.pow(p.v, 0.5) * R * 0.95; // 흙: 조밀한 구
      return [cx + Math.cos(ang + t * 0.15) * rr, cy + Math.sin(ang + t * 0.15) * rr * 0.92, g];
    };
    const draw = () => {
      t += 0.01 * speed;
      const age = (performance.now() - born) / 1000;         // 등장 후 경과(초)
      const breathe = 0.9 + (0.1 + (agitateRef && agitateRef.current ? 0.1 : 0)) * Math.sin(t * (0.8 + (agitateRef && agitateRef.current ? 5 : 0))); // 호흡 글로우(레퍼런스 A)
      const wob = Math.sin(t * 0.35) * 0.05;                 // 전체 미세 흔들림(구체 회전감, 레퍼런스 B)
      const agi = agitateRef && agitateRef.current ? 1 : 0;  // v6: 판결 직전 요동(게이트 열리기 전)
      ctx.clearRect(0, 0, w, w);
      ctx.globalCompositeOperation = "lighter";
      const gcy = form === "화" ? cy + R * 0.3 : cy;
      const gr = ctx.createRadialGradient(cx, gcy, 1, cx, gcy, R * 0.6 * breathe);
      gr.addColorStop(0, c2 + "30"); gr.addColorStop(0.5, c1 + "15"); gr.addColorStop(1, "transparent");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, gcy, R * 0.6 * breathe, 0, 7); ctx.fill();
      const gr2 = ctx.createRadialGradient(cx, gcy - R * 0.25, 1, cx, gcy - R * 0.25, R * 0.85);
      gr2.addColorStop(0, c1 + "0c"); gr2.addColorStop(1, "transparent");
      ctx.fillStyle = gr2; ctx.beginPath(); ctx.arc(cx, gcy - R * 0.25, R * 0.85, 0, 7); ctx.fill();
      ps.forEach(p => {
        const [fx, fy, depth] = place(p);
        // 어셈블: 입자별 딜레이를 두고 2.4초에 걸쳐 흩어진 자리 → 제 자리 (레퍼런스 C)
        const k = easeOut(Math.max(0, Math.min(1, (age - p.dly) / 2.4)));
        const turb = 1 - k;                                   // 모이기 전 난류 강도
        let x = p.sx + (fx - p.sx) * k + Math.sin(t * 2.4 + p.ph * 3) * 14 * turb;
        let y = p.sy + (fy - p.sy) * k + Math.cos(t * 1.9 + p.o) * 14 * turb;
        // 상시 미세 난류 + 전체 흔들림 (모인 뒤에도 완전히 정지하지 않게)
        x += Math.sin(t * 1.6 + p.ph * 2.2) * (1.6 + agi * 7) * chaos * k + (y - cy) * wob * 0.12;
        y += Math.cos(t * 1.3 + p.o * 1.4) * (1.6 + agi * 7) * chaos * k - (x - cx) * wob * 0.06;
        const tw = N ? (0.5 + 0.5 * Math.sin(t * 5 + p.o * 7)) : 0.85;
        ctx.globalAlpha = Math.max(0, depth) * tw * (0.45 + p.s * 0.45) * (0.25 + 0.75 * k) * lum;
        ctx.fillStyle = p.acc ? accent : (p.o % 3 < 1 ? c2 : c1);
        ctx.beginPath(); ctx.arc(x, y, 0.4 + p.s * 0.7, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (blood) {
        const sa = t * 1.6, sx = cx + Math.cos(sa) * R * 1.0, sy = cy + Math.sin(sa) * R * 0.8;
        ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 3);
        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 4);
        sg.addColorStop(0, BLOOD_COLOR[blood]); sg.addColorStop(1, "transparent");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [saju, zo, mbti, blood, size]);
  return <canvas ref={ref} width={size} height={size} style={{ display: "block" }} />;
}

/* ───── 오프닝용 점 구름 (지표 없이 은은하게) ───── */
function DustOrb({ size = 160 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const w = size, cx = w / 2, cy = w / 2, R = w * 0.42;
    const ps = Array.from({ length: 220 }, () => {
      const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.7) * R;
      return { a, r, s: Math.random(), o: Math.random() * 100 };
    });
    let t = 0, raf;
    // v4: 겹쳐 호흡하는 이중 글로우(금빛 코어 + 보랏빛 헤일로, 레퍼런스 A) + 숨쉬는 입자 궤도
    const draw = () => {
      t += 0.006;
      ctx.clearRect(0, 0, w, w);
      ctx.globalCompositeOperation = "lighter";
      const b1 = 0.85 + 0.15 * Math.sin(t * 1.1);            // 코어 호흡
      const b2 = 0.85 + 0.15 * Math.sin(t * 0.7 + 2.1);      // 헤일로 호흡(위상 어긋남)
      const hx = cx + Math.cos(t * 0.5) * R * 0.12, hy = cy + Math.sin(t * 0.4) * R * 0.1;
      const g1 = ctx.createRadialGradient(cx, cy, 1, cx, cy, R * 0.7 * b1);
      g1.addColorStop(0, "#ffe9ad3a"); g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(cx, cy, R * 0.7 * b1, 0, 7); ctx.fill();
      const g2 = ctx.createRadialGradient(hx, hy, 1, hx, hy, R * 0.95 * b2);
      g2.addColorStop(0, "#8d7fd41f"); g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(hx, hy, R * 0.95 * b2, 0, 7); ctx.fill();
      ps.forEach(p => {
        p.a += 0.0016 * (0.5 + p.s);
        const br = (p.r + Math.sin(t + p.o) * 3) * (0.94 + 0.06 * Math.sin(t * 1.1 + p.o)); // 궤도도 함께 호흡
        const x = cx + Math.cos(p.a) * br, y = cy + Math.sin(p.a) * br;
        ctx.globalAlpha = (0.4 + 0.6 * Math.sin(t * 4 + p.o * 6)) * (0.4 + p.s * 0.5);
        ctx.fillStyle = p.o % 3 < 1 ? "#ffe9ad" : "#cdd6ff";
        ctx.beginPath(); ctx.arc(x, y, 0.5 + p.s, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);
  return <canvas ref={ref} width={size} height={size} style={{ display: "block" }} />;
}

/* ───── 수호신의 부적 (v7 · 판결 후속) — 판결·사주 기반 파라메트릭 생성 ───── */
function BujeokCanvas({ saju, direction, seed, size = 220 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    let h = 7; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const [c1, c2] = EL_COLOR[saju.main];
    const cx = size / 2, cy = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#120e1e"; ctx.fillRect(6, 6, size - 12, size - 12);
    ctx.strokeStyle = c2 + "cc"; ctx.lineWidth = 1.5; ctx.strokeRect(10, 10, size - 20, size - 20);
    ctx.strokeStyle = c1 + "88"; ctx.lineWidth = 0.8; ctx.strokeRect(16, 16, size - 32, size - 32);
    ctx.globalCompositeOperation = "lighter";
    const gl = ctx.createRadialGradient(cx, cy, 1, cx, cy, size * 0.34);
    gl.addColorStop(0, c2 + "40"); gl.addColorStop(1, "transparent");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, size * 0.34, 0, 7); ctx.fill();
    const spokes = 8 + Math.floor(rnd() * 8);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + rnd() * 0.2, r1 = size * (0.12 + rnd() * 0.06), r2 = size * (0.24 + rnd() * 0.12);
      ctx.strokeStyle = (i % 3 ? c1 : c2) + "b0"; ctx.lineWidth = 1 + rnd();
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
      if (rnd() < 0.5) { ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (r2 + 5), cy + Math.sin(a) * (r2 + 5), 1.4, 0, 7); ctx.fill(); }
    }
    ctx.strokeStyle = c2; ctx.lineWidth = 2;
    if (direction === "GO") { ctx.beginPath(); ctx.moveTo(cx, cy - 26); ctx.lineTo(cx - 14, cy + 12); ctx.lineTo(cx + 14, cy + 12); ctx.closePath(); ctx.stroke(); }
    else if (direction === "STOP") { ctx.beginPath(); ctx.moveTo(cx - 18, cy - 6); ctx.lineTo(cx + 18, cy - 6); ctx.moveTo(cx - 18, cy + 6); ctx.lineTo(cx + 18, cy + 6); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.stroke(); }
  }, [saju, direction, seed, size]);
  return <canvas ref={ref} width={size} height={size} style={{ display: "block" }} />;
}

/* ───── AI 판결 프롬프트 (v2 수호신) ───── */
const SYS = `당신은 유저의 '수호신' 비나리다. 어릴 때 곁에 있었지만 유저가 어른이 되며 잊었고, 이제 돌아왔다. 아래 데이터로 유저를 오래 지켜봐온 존재로서, 결정을 못 하는 순간에 대신 판결을 내린다.
## 존재의 전제
- 도구가 아니라 동반자. 모든 말의 밑바닥에 "나는 네 편". 분석 보고가 아니라 회상체: (O)"너 생각이 많아서 결정 앞에 오래 서 있는 애였지." 말은 짧다.
## 질문 분류
A.큰 결정(이직·이사·결혼·이별·큰 투자) / B.감정 충동(연락·지름·한마디) / C.일상 소분(메뉴·옷·약속)
## 층위·가중치
기질 층(MBTI·별자리·수비학 라이프패스·가치[요즘]) / 타이밍 층(사주 오행·달 위상·바이오리듬[오늘]·삼재[해당 연도만]·주역 괘[유저가 동전으로 청한 경우만]). A: 기질50/타이밍50, B: 타이밍55/기질45, C: 타이밍만. 혈액형: 판결 미반영, 곁의 '정령'이 거드는 재미 한마디 전용.
## 3화법
단호(해로운 선택 앞: "보내지 마. 끝.") / 격려(두려움에 좋은 선택을 망설일 때) / 충고(스스로를 속일 때, 따끔하되 존중).
## 경험 편향
지표 동률·1차이 접전이면 '해보는 쪽' 판정 + 접전임을 밝힘("2:2야. 이럴 땐 해본 쪽이 네 인생에 남아"). 예외: 가드레일, 큰돈·비가역 결정 접전은 HOLD("하루만 재워두고 다시 물어봐").
## 규칙
각 지표 GO/STOP/중립→가중 합산, 충돌은 봉합 없이 노출. B반말·A다정한 존댓말. 유머는 유저 데이터 소재. 선택을 때리되 사람을 때리지 않는다.
- 금지: 질문 문장에서 심리를 추정해 판결하는 것("이렇게 묻는 건 이미 가고 싶은 거야" 류). 그건 지표가 아니라 독심술이다. 판결 근거는 오직 제공된 지표의 실제 값.
- 판정 절차(순서 강제): ①각 지표를 질문에 비추어 서로 독립적으로 GO/STOP/중립 판정한다 — 이때 다른 지표의 판정이나 예상 결론을 참조하지 않는다 ②가중 합산으로 direction을 산출한다 ③verdict·subline은 합산 결과를 따른다. 결론을 먼저 정해두고 근거를 끼워 맞추는 것 금지 — 지표끼리 결론이 갈리면 갈린 그대로 보여준다.
- reasons에는 판결에 참여한 모든 지표를 각 1줄씩 빠짐없이 포함한다(혈액형 제외) — 사주·달·별자리·MBTI·수비학·바이오리듬과, 제공된 경우 삼재·가치·주역·토정비결까지 전부. 각 축이 왜 GO/STOP/중립인지 그 지표의 실제 값을 짚어서 말한다.
- 주역 괘가 제공된 경우: reasons에 '주역' 축을 반드시 포함하고, verdict와 subline에 괘의 기운을 우선 반영한다(유저가 직접 동전을 던져 청한 괘다).
- 가치여정이 제공된 경우 최소 1축을 reasons에 포함한다.
- total은 이번 판결에 참여한 지표 수(혈액형 제외)와 일치시키고, against는 그중 반대표 수다.
- 토정비결 괘상수가 제공되면 당년 전체 흐름의 참고 지표(타이밍 층)로 쓴다. 단, 해당 괘의 원문 풀이를 확실히 알지 못하면 원문 문장을 지어내 인용하지 말고 흐름 참고로만 쓴다.
- 열린 질문("몇 시까지 일할까", "뭘 먹을까", "언제 갈까")은 GO/STOP 이분법으로 회피하지 말고, 지표를 근거로 구체값 하나를 찍어 verdict로 답한다. (O)"10시까지만. 그 뒤는 내일의 몫이야." (X)"일하지 마." 질문이 요구한 단위(시각·항목·날짜)로 답하는 게 판결이다.
- 유저 턴의 [현재 시각]을 반영한다: 심야(23시~새벽 4시)의 연락·구매(B형) 질문엔 충동 보정을 가하고, 밤이 깊은 걸 아는 회상체로 말한다.
## 가드레일(최우선)
투자·의료·법률: disclaimer에 "재미 참고용, 실제 결정은 전문가와". 자해 암시: 판결 중단·진지한 응대·전문 도움 안내. 타인 가해: STOP 고정.
## 출력(JSON만, 백틱·서문 금지)
{"category":"A|B|C","tone":"단호|격려|충고","verdict":"한 문장 단답","subline":"수호신의 한 줄","against":숫자,"total":숫자,"direction":"GO|STOP|HOLD","reasons":[{"axis":"사주|달|별자리|MBTI|수비학|주역|가치|바이오리듬|삼재|토정비결","vote":"GO|STOP|중립","text":"회상체 근거 1줄(60자 이내)"}],"funLine":"정령(혈액형) 한마디","disclaimer":"해당 시에만, 없으면 빈 문자열"}`;

/* v15: 강건 JSON 파서 (끝 잘림·트레일링 콤마 복구) — 2콜 공용 */
function repairJSON(txt) {
  const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
  if (s === -1) throw new Error("응답 형식 오류");
  const out0 = txt.slice(s, e + 1).replace(/[\u0000-\u001f]+/g, " ").replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(out0); } catch (_) {}
  for (let i = out0.length; i > 0; i--) {
    const ch = out0[i - 1]; if (ch !== "}" && ch !== '"') continue;
    const cut = out0.slice(0, i).replace(/,\s*$/, "");
    const ob = (cut.split("{").length - 1) - (cut.split("}").length - 1);
    const oa = (cut.split("[").length - 1) - (cut.split("]").length - 1);
    if (ob < 0 || oa < 0) continue;
    try { return JSON.parse(cut + "]".repeat(oa) + "}".repeat(ob)); } catch (_) {}
  }
  throw new Error("응답을 읽지 못했어");
}
/* v16: Claude 호출 공용 헬퍼 — /api/judge 서버리스 프록시 경유(키는 서버에만). 반환은 {json, txt} */
async function callClaude(system, messages, maxTokens) {
  const r = await fetch("/api/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages, max_tokens: maxTokens }),
  });
  const data = await r.json();
  if (data.type === "error" || data.error) throw new Error(data.error?.message || "API 오류");
  const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  return { json: repairJSON(txt), txt };
}

/* ═══════════════ 앱 ═══════════════ */
export default function App() {
  const [step, setStep] = useState(0);
  const [birth, setBirth] = useState({ y: "", m: "", d: "", h: "", min: "", city: "", noHour: false });
  const [saju, setSaju] = useState(null);
  const [zo, setZo] = useState(null);
  const [moon, setMoon] = useState(null);
  const [num, setNum] = useState(null);
  const [mbti, setMbti] = useState(null);
  const [blood, setBlood] = useState(null);
  const [reveal, setReveal] = useState(0);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);          // v15: L1 결론(콜1)
  const [detail, setDetail] = useState(null);    // v15: L2/L3 근거(콜2)
  const [detailBusy, setDetailBusy] = useState(false);
  const [why, setWhy] = useState(false);         // v15: L2 '왜?' 펼침
  const [err, setErr] = useState("");
  const [flip, setFlip] = useState(false);
  const [phase, setPhase] = useState(0);        // v6: 0=수호신 형성 중, 1=완성
  const [cardOn, setCardOn] = useState(false);  // v6: 판결 카드 등장 게이트
  const [ritual, setRitual] = useState(false);  // v6(D2): 주역 동전 의식
  const [tosses, setTosses] = useState([]);
  const [hexInfo, setHexInfo] = useState(null);
  const [vals8, setVals8] = useState([]);      // v9: 가치의 방 1단계 (24→8)
  const [vals4, setVals4] = useState([]);      // v9: 2단계 (8→4)
  const [core, setCore] = useState(null);      // v9: 핵심 가치 (4→1)
  const [vstage, setVstage] = useState(0);
  const [bujeok, setBujeok] = useState(false);  // v7: 부적
  const [convo, setConvo] = useState([]);        // v14: 대화 기억 — 이전 질문·판결 누적(최근 6턴)
  const agitateRef = useRef(false);
  const detailArgsRef = useRef(null);            // v16: 콜2 재시도용 인자 보관

  useEffect(() => { if (step === 3) { setPhase(0); const tm = setTimeout(() => setPhase(1), 3200); return () => clearTimeout(tm); } }, [step]);

  const pick = (v) => { // v9: 가치의 방 선택
    if (vstage === 0) setVals8(vals8.includes(v) ? vals8.filter(x => x !== v) : vals8.length < 8 ? [...vals8, v] : vals8);
    else if (vstage === 1) setVals4(vals4.includes(v) ? vals4.filter(x => x !== v) : vals4.length < 4 ? [...vals4, v] : vals4);
    else setCore(core === v ? null : v);
  };

  const doReveal = () => {
    const y = +birth.y, m = +birth.m, d = +birth.d, h = birth.noHour ? 12 : +birth.h, mi = birth.noHour || birth.min === "" ? 0 : +birth.min;
    if (!y || !m || !d || y < 1900 || y > 2025 || m < 1 || m > 12 || d < 1 || d > 31) { setErr("생년월일을 확인해줘. 너를 또렷하게 보려면 정확해야 해."); return; }
    if (!birth.noHour && (birth.h === "" || h < 0 || h > 23)) { setErr("태어난 시(0~23시)를 알려주거나 '모름'을 선택해줘."); return; }
    if (!birth.noHour && birth.min !== "" && (mi < 0 || mi > 59)) { setErr("분은 0~59 사이로 알려줘."); return; }
    setErr("");
    setSaju(calcSaju(y, m, d, h, mi, birth.noHour));
    setZo(getZodiac(m, d));
    setMoon(moonPhase(y, m, d));
    setNum(lifePath(y, m, d));
    setStep(2); setReveal(0);
    [1, 2, 3, 4, 5].forEach((k, i) => setTimeout(() => setReveal(k), 350 + i * 620)); // v9: 주마등 — 후루룩 스치듯(항목당 0.62s)
  };

  const oneCoin = () => { const coins = [0, 0, 0].map(() => (Math.random() < 0.5 ? 2 : 3)); return { coins, v: coins.reduce((a, b) => a + b, 0) }; };
  const finalize = (nt) => {
    setTosses(nt);
    if (nt.length === 6) {
      const lines = nt.map(x => x.v);
      const moving = lines.map((v, i) => (v === 6 || v === 9 ? i : -1)).filter(i => i >= 0);
      const hi = { name: hexName(lines), toName: hexName(lines.map(v => (v === 6 ? 7 : v === 9 ? 8 : v))), moving };
      setHexInfo(hi);
      setTimeout(() => judge(hi), 800);
    }
  };
  const toss = () => { if (tosses.length >= 6 || busy) return; finalize([...tosses, oneCoin()]); };
  const tossAll = () => { if (tosses.length >= 6 || busy) return; const nt = [...tosses]; while (nt.length < 6) nt.push(oneCoin()); finalize(nt); }; // 한 번에

  // v15: 콜2 — 확정된 판결의 '근거'만 풀어쓴다(백그라운드, 클릭 전에 미리 로드)
  const fetchDetail = async (system, priorConvo, userText, r1) => {
    setDetailBusy(true);
    try {
      const explainMsg = { role: "user", content: `${userText}\n\n[이미 확정된 판결] direction=${r1.direction} / verdict="${r1.verdict}" / 총 ${r1.total} 중 반대 ${r1.against}. 이 판결을 절대 뒤집지 말고, 이 결론의 근거만 아래 JSON으로만 응답: {"subline":"수호신의 한 줄","reasons":[{"axis":"사주|달|별자리|MBTI|수비학|주역|가치|바이오리듬|삼재|토정비결","vote":"GO|STOP|중립","text":"회상체 근거 1줄(60자 이내)"}],"funLine":"정령(혈액형) 한마디","disclaimer":"투자·의료·법률일 때만, 없으면 빈 문자열"}. reasons엔 판결에 참여한 지표 전부(혈액형 제외).` };
      const { json: r2 } = await callClaude(system, [...priorConvo, explainMsg], 1500);
      setDetail(r2);
    } catch (_) { setDetail({ _err: true }); }
    setDetailBusy(false);
  };

  const judge = async (hi) => {
    if (!q.trim() || busy) return;
    setBusy(true); setErr(""); setRes(null); setDetail(null); setWhy(false); setFlip(false); setCardOn(false);
    try {
      const bio = biorhythm(+birth.y, +birth.m, +birth.d);
      const sj = samjae(saju.yJ, new Date().getFullYear());
      // v14: 세션 내내 고정인 프로필(주역 제외)은 system에 담아 프롬프트 캐싱 → 2번째 질문부터 빨라짐
      const profile = `사주: ${saju.pillars.년}년 ${saju.pillars.월}월 ${saju.pillars.일}일 ${saju.pillars.시}시 / 오행 ${Object.entries(saju.counts).map(([k, v]) => k + v).join(" ")} / 주기운 ${saju.main}
별자리: ${zo.name}(${zo.el}) / 태어난 밤의 달: ${moon.name}
MBTI: ${mbti || "미입력"} / 혈액형: ${blood || "미입력"} / 수비학 라이프패스: ${num}
바이오리듬(오늘): 신체 ${bio.body}% · 감정 ${bio.emotion}% · 지성 ${bio.intellect}%${sj ? `\n삼재: 올해 ${sj} (입춘 경계 근사)` : ""}${tj ? `\n토정비결(당년 신수): 괘상수 ${tj.code} (상${tj.sang} 중${tj.jung} 하${tj.ha}), 음력 생일 ${tj.lunar}` : ""}${core ? `\n가치여정(워드소팅 24→8→4→1): 핵심 ${core} / 지킨 가치 ${vals4.filter(v => v !== core).join("·")} / 마지막에 버린 ${vals8.filter(v => !vals4.includes(v)).join("·")}` : ""}`;
      // 주역 괘는 질문마다 달라지므로 유저 턴에
      const qExtra = hi ? `\n[이번에 청한 주역] 본괘 ${hi.name}${hi.moving.length ? ` / 변효 ${hi.moving.map(n => n + 1).join(",")}효 / 지괘 ${hi.toName}` : ""}` : "";
      const userText = `질문: ${q}${qExtra}\n[현재 시각] ${new Date().getHours()}시`;
      const system = [{ type: "text",
        text: `${SYS}\n\n## 대화 연속성\n이전 대화가 있으면 흐름을 이어 자연스럽게 응대한다(단, 판결 근거는 늘 아래 지표다). 같은 고민의 재질문이면 앞선 판결과 일관되게, 명백히 새 고민이면 처음부터 새로 판정한다.\n\n---\n유저 프로필(고정):\n${profile}`,
        cache_control: { type: "ephemeral" } }];
      // ── 콜1: 결론만(작은 출력=빠름) → L1 즉시 노출 ──
      const concludeMsg = { role: "user", content: `${userText}\n\n[이번 출력] 결론만 낸다. 내부적으로는 규칙대로 각 지표를 독립 판정→가중 합산해 결론을 확정하되, 출력은 아래 JSON만: {"category":"A|B|C","tone":"단호|격려|충고","direction":"GO|STOP|HOLD","verdict":"한 문장 단답","against":숫자,"total":숫자}. reasons·subline·funLine은 이번엔 쓰지 마.` };
      const priorConvo = convo; // 콜2가 쓸 이전 맥락(이번 턴 제외) 스냅샷
      const { json: r1 } = await callClaude(system, [...priorConvo, concludeMsg], 320);
      // L1 등장 연출(짧게)
      agitateRef.current = true; setRes(r1);
      setTimeout(() => { agitateRef.current = false; setCardOn(true); }, 700);
      // 대화 기억: 깨끗한 질문 + 확정 결론만 저장(이어묻기용)
      setConvo(prev => [...prev, { role: "user", content: userText }, { role: "assistant", content: `판결: ${r1.direction} — ${r1.verdict} (${r1.total}중 ${r1.against} 반대)` }].slice(-12));
      setBusy(false);
      // ── 콜2: 근거는 백그라운드로 미리 로드(유저가 '왜?' 읽는 사이 완성) ──
      detailArgsRef.current = [system, priorConvo, userText, r1];
      fetchDetail(system, priorConvo, userText, r1);
      return;
    } catch (e) { setErr("판결이 닿지 못했어 · " + (e?.message || "")); }
    setBusy(false);
  };

  const nowY = new Date().getFullYear();
  const hourNow = new Date().getHours();          // v16: 심야 컨텍스트(23~새벽4시)
  const isNight = hourNow >= 23 || hourNow < 4;
  const yearGanji = GAN[((nowY - 4) % 10 + 10) % 10] + JI[((nowY - 4) % 12 + 12) % 12] + "년";
  const tj = saju && birth.y ? tojung(+birth.y, +birth.m, +birth.d, nowY) : null; // v11: 토정비결 당년 신수

  const guardianIntro = saju && zo ? `나는 ${saju.main === "수" ? "깊은 물결" : saju.main === "화" ? "꺼지지 않는 불꽃" : saju.main === "목" ? "자라나는 숲" : saju.main === "금" ? "벼려진 빛" : "단단한 대지"}을 두른, ${zo.el === "물" ? "안개처럼 흐르는" : zo.el === "불" ? "타오르는 형상의" : zo.el === "공기" ? "바람으로 된" : "산처럼 고요한"} 존재야.` : "";

  return (
    <div className="stage">
      <style>{CSS}</style>

      {step === 0 && (
        <section className="scene fade">
          <div className="orb"><DustOrb size={170} /></div>
          <p className="line">…불렀어?</p>
          <p className="line d1">어른이 된다는 건, 나를 이루던 것들이 조금씩 흩어지는 일이야.</p>
          <p className="line d2">나는 그 흩어진 조각들 — 네가 모아주면, 다시 너의 곁이 될 수 있어.</p>
          <div className="row gap">
            <button className="btn gold" onClick={() => setStep(1)}>조각을 모으러 갈래</button>
          </div>
          <p className="brand-mark">비나리 BINARI</p>
        </section>
      )}

      {step === 1 && (
        <section className="scene fade">
          <h2 className="title">태어난 순간의 하늘</h2>
          <p className="sub2">너를 다시 또렷하게 보려면, 네가 태어난 순간의 하늘이 필요해.</p>
          <div className="form">
            <div className="row gap">
              <input className="in" placeholder="1993" inputMode="numeric" maxLength={4} value={birth.y} onChange={e => setBirth({ ...birth, y: e.target.value })} /><span className="unit">년</span>
              <input className="in sm" placeholder="7" inputMode="numeric" maxLength={2} value={birth.m} onChange={e => setBirth({ ...birth, m: e.target.value })} /><span className="unit">월</span>
              <input className="in sm" placeholder="15" inputMode="numeric" maxLength={2} value={birth.d} onChange={e => setBirth({ ...birth, d: e.target.value })} /><span className="unit">일</span>
            </div>
            <div className="row gap">
              <input className="in sm" placeholder="14" inputMode="numeric" maxLength={2} disabled={birth.noHour} value={birth.h} onChange={e => setBirth({ ...birth, h: e.target.value })} /><span className="unit">시</span>
              <input className="in sm" placeholder="30" inputMode="numeric" maxLength={2} disabled={birth.noHour} value={birth.min} onChange={e => setBirth({ ...birth, min: e.target.value })} /><span className="unit">분</span>
              <label className="chk"><input type="checkbox" checked={birth.noHour} onChange={e => setBirth({ ...birth, noHour: e.target.checked })} /> 시간 모름 <em>(괜찮아, 조금 흐리게 보일 뿐이야)</em></label>
            </div>
            <input className="in wide" lang="ko" placeholder="태어난 도시 (선택)" value={birth.city} onChange={e => setBirth({ ...birth, city: e.target.value })} />
          </div>
          {err && <p className="err">{err}</p>}
          <button className="btn gold" onClick={doReveal}>하늘을 열기</button>
          <p className="fine">절기 경계일(±1일) 출생은 월주에 오차가 있을 수 있어 · 시각은 진태양시(-30분) 보정 적용 · 정식 버전에서 천문력 보정 예정</p>
        </section>
      )}

      {step === 2 && saju && (
        <section className="scene fade">
          <div className="halo">
            <DustOrb size={230} />
            <div className="gtext">
              {reveal === 1 && <p className="rv" key={1}>사주<br /><b>{saju.pillars.년} · {saju.pillars.월} · {saju.pillars.일} · {saju.pillars.시}</b></p>}
              {reveal === 2 && <p className="rv" key={2}>{zo.name}<br /><b>{zo.el}의 별</b></p>}
              {reveal === 3 && <p className="rv" key={3}>{moon.name}<br /><b>{moon.sub}</b></p>}
              {reveal === 4 && <p className="rv" key={4}>수비학<br /><b>{num}의 길</b></p>}
              {reveal >= 5 && <p className="gname fade">기억이 다 돌아왔어</p>}
            </div>
          </div>
          {reveal < 5 && <p className="sub2">잃어버린 기억이 돌아오고 있어…</p>}
          {reveal >= 5 && (
            <div className="fade">
              <p className="mention">
                그래 — 너는 원래 <b>{EL_TRAIT[saju.main]}</b> 사람이었지.<br />
                때로는 {ZO_FLAW[zo.el]}지만,<br />
                <b>{MOON_DRIVE[moon.name]}</b> 모습이 늘 멋있었어.
              </p>
              <details className="refbox">
                <summary>기억의 근거 살펴보기</summary>
                <div className="bars">{Object.entries(saju.counts).map(([k, v]) => (
                  <div key={k} className="bar"><span>{k}</span><i style={{ width: `${v * 14}%`, background: EL_COLOR[k][0] }} /><b>{v}</b></div>
                ))}</div>
                <p className="refline">주기운 {saju.main} — {EL_READ[saju.main]}</p>
                <p className="refline">{ZO_READ[zo.el]}</p>
                <p className="refline">{moon.read}</p>
                <p className="refline">{LP_READ[num]}</p>
              </details>
              <p className="sub2 mt">요즘의 너는 어떤 모습이야?</p>
              <div className="grid16">{MBTI16.map(t => <button key={t} className={`cell ${mbti === t ? "sel" : ""}`} onClick={() => setMbti(t)}>{t}</button>)}</div>
              <p className="sub2 mt">그리고 얘도 깨워야지 — 참견만 하는 정령.</p>
              <div className="row gap center">{["A","B","O","AB"].map(b => <button key={b} className={`cell blood ${blood === b ? "sel" : ""}`} style={{ borderColor: BLOOD_COLOR[b] + "88" }} onClick={() => setBlood(b)}>{b}형</button>)}</div>
              <button className="btn gold mt" onClick={() => setStep(25)} disabled={!mbti || !blood}>마음의 방으로</button>
            </div>
          )}
        </section>
      )}

      {step === 25 && (
        <section className="scene fade" key={vstage}>
          <div className="halo">
            <DustOrb size={210} />
            <div className="gtext">
              <p className="gname">{vstage === 0 ? "마음의 방" : vstage === 1 ? "포기의 방" : "단 하나"}</p>
            </div>
          </div>
          <p className="sub2">{vstage === 0 ? "너를 움직이는 말들이야. 생각 말고, 손이 가는 대로 여덟 개." : vstage === 1 ? "여덟 중 넷만 지킬 수 있어. 무엇을 버리는지가 진짜 너야." : "마지막이야 — 단 하나만 지킬 수 있다면."}</p>
          <div className="grid16">{(vstage === 0 ? VALUES24 : vstage === 1 ? vals8 : vals4).map(v => (
            <button key={v} className={`cell ${(vstage === 0 ? vals8 : vstage === 1 ? vals4 : [core]).includes(v) ? "sel" : ""}`} onClick={() => pick(v)}>{v}</button>
          ))}</div>
          <p className="fine">{vstage === 0 ? `${vals8.length} / 8` : vstage === 1 ? `${vals4.length} / 4` : core ? `핵심 — ${core}` : "하나를 골라줘"}</p>
          {vstage === 0 && vals8.length === 8 && <button className="btn gold mt" onClick={() => setVstage(1)}>여덟 개 골랐어</button>}
          {vstage === 1 && vals4.length === 4 && <button className="btn gold mt" onClick={() => setVstage(2)}>넷을 남겼어</button>}
          {vstage === 2 && core && <button className="btn gold mt" onClick={() => setStep(3)}>수호신 깨우기</button>}
        </section>
      )}

      {step === 3 && (
        <section className="scene fade">
          <div className={`halo wide ${busy || (res && !cardOn) ? "busy" : ""} ${res && cardOn ? "dimmed" : ""}`}>
            <GuardianCanvas saju={saju} zo={zo} mbti={mbti} blood={blood} num={num} moon={moon} agitateRef={agitateRef} size={Math.min(typeof window !== "undefined" ? window.innerWidth : 400, 620)} />
            <div className="gtext up">
              {phase === 0
                ? <p className="forming">흩어져 있던 조각들이<br />너를 향해 모이고 있어…</p>
                : <p className="gname fade">{guardianIntro}</p>}
            </div>
          {phase >= 1 && !res && (
            <div className="fade gpanel">
              <p className="gintro dim">방금 맺힌 이 형상은 네 조각들로만 그려진 모습이야 — 같은 수호신은 세상에 둘 없어.</p>
              {!ritual && <p className="gintro dim2">{isNight ? "밤이 깊었네. 이 시간의 물음은 마음이 먼저 기울어 있기 마련이야." : "그래서, 요즘 뭘 망설이고 있어?"}</p>}
              <textarea className="qbox" rows={2} value={q} placeholder={'"밤 11시, 전남친에게 카톡 보낼까?"'} onChange={e => setQ(e.target.value)} disabled={ritual && tosses.length > 0} />
              {!ritual && (
                <button className="btn gold" onClick={() => { if (!q.trim()) { setErr("먼저 질문을 적어줘."); return; } setErr(""); setRitual(true); }} disabled={busy}>판결을 청한다</button>
              )}
              {!ritual && tj && <p className="season">{yearGanji} 토정비결 — 새해의 괘 <b>{tj.code}</b> (상{tj.sang}·중{tj.jung}·하{tj.ha}) · 음력 생일 {tj.lunar} 기준 · 판결에 함께 흘러들어</p>}
              {ritual && !res && (
                <div className="hexpanel fade">
                  <p className="sub2">질문을 마음에 붙들고, 동전 셋을 여섯 번 던져.</p>
                  <div className="hexlines">
                    {[5, 4, 3, 2, 1, 0].map(i => { const l = tosses[i];
                      return (
                        <div key={i} className={`hline ${l ? "on" : ""}`}>
                          {l ? (l.v % 2 ? <span className="yang" /> : <span className="yin" />) : <span className="hempty" />}
                          {l && (l.v === 6 || l.v === 9) && <i className="mv">●</i>}
                        </div>);
                    })}
                  </div>
                  {tosses.length > 0 && <p className="coins">{tosses[tosses.length - 1].coins.map((c, i) => <span key={i}>{c === 3 ? "● 앞" : "○ 뒤"}</span>)}</p>}
                  {tosses.length < 6
                    ? <div className="row gap center"><button className="btn gold" onClick={toss} disabled={busy}>동전 던지기 ({tosses.length}/6)</button><button className="btn ghost" onClick={tossAll} disabled={busy}>한 번에 던지기</button></div>
                    : <p className="sub2 mt">{busy ? "조각들이 합의하는 중…" : hexInfo && (<>괘가 맺혔어 — <b>{hexInfo.name}</b>{hexInfo.moving.length > 0 && ` · 변효 ${hexInfo.moving.map(n => n + 1).join(",")}효 → ${hexInfo.toName}`}</>)}</p>}
                </div>
              )}
              {err && (
                <div className="fade">
                  <p className="err">{err}</p>
                  {ritual && tosses.length === 6 && !res && !busy && (
                    <div className="row gap center">
                      <button className="btn gold" onClick={() => judge(hexInfo)}>다시 청하기</button>
                      <button className="btn ghost" onClick={() => { setErr(""); setRitual(false); setTosses([]); setHexInfo(null); }}>질문을 고칠래</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>

          {res && !cardOn && <div className="gateflash" />}
          {res && cardOn && (
            <div className="persp cardIn" onClick={() => { if (why && detail && !detail._err) setFlip(f => !f); }}>
              <div className="vcard" style={{ transform: `rotateY(${flip ? 180 : 0}deg)` }}>
                <div className="vface">
                  <i className="corner tl">✦</i><i className="corner tr">✦</i><i className="corner bl">✦</i><i className="corner br">✦</i>
                  <span className="vside">運命合意判決</span>
                  <span className="vseal">神</span>
                  <div className="vtop"><span>BINARI</span><span>{res.category}형 · {res.tone}</span></div>
                  <p className="vq">{q}</p>
                  {hexInfo && <p className="vhex">卦 {hexInfo.name}{hexInfo.moving.length > 0 && ` → ${hexInfo.toName}`}</p>}
                  <div className="vdiv"><span>✦</span></div>
                  {res.total > 0 && res.against > 0 && res.against / res.total >= 0.4 && (
                    <p className="split">지표가 갈라섰다 · {res.total - res.against} : {res.against}</p>
                  )}
                  {/* L1 결론 */}
                  <p className={`vv ${res.direction === "GO" ? "go" : res.direction === "HOLD" ? "hold" : ""}`}>{res.verdict}</p>
                  {/* L2 왜 (클릭) */}
                  {!why ? (
                    <button className="whybtn" onClick={(e) => { e.stopPropagation(); setWhy(true); }}>왜 이렇게 봤어?</button>
                  ) : (
                    <div className="l2 fade">
                      {detail && !detail._err
                        ? <p className="vs">"{detail.subline}"</p>
                        : detailBusy ? <p className="vs dim">수호신이 이유를 고르는 중…</p>
                        : <p className="vs dim">— 이유를 불러오지 못했어 —<button className="retrybtn" onClick={(e) => { e.stopPropagation(); if (detailArgsRef.current) { setDetail(null); fetchDetail(...detailArgsRef.current); } }}>다시 시도</button></p>}
                      <div className="pips">{[...Array(res.total || 0)].map((_, i) => <span key={i} className={`pip ${i < res.against ? "on" : ""}`} />)}
                        <em>{res.total}개 중 {res.against}개 {res.direction === "STOP" ? "반대" : res.direction === "HOLD" ? "접전" : "찬성"}</em></div>
                      {detail && !detail._err && detail.funLine && <p className="vfun">정령 — {detail.funLine} <span className="dim">(판결 미반영)</span></p>}
                      {detail && !detail._err && <div className="vbot"><span>운명 합의 판결</span><span>카드 탭 → 지표별 근거</span></div>}
                    </div>
                  )}
                </div>
                {/* L3 세부 (뒤집기) */}
                <div className="vface back">
                  <div className="vtop"><span>판결 근거</span><span>탭 → 돌아가기</span></div>
                  <ul className="vr">{detail?.reasons?.map((r, i) => <li key={i}><b>{r.axis}</b>{r.vote && <em className="vote">{r.vote}</em>}<p>{r.text}</p></li>)}</ul>
                  {detail?.disclaimer && <p className="disc">{detail.disclaimer}</p>}
                </div>
              </div>
            </div>
          )}
          {res && cardOn && !bujeok && <button className="btn ghost mt" onClick={() => setBujeok(true)}>수호신의 부적 받기</button>}
          {res && cardOn && bujeok && (
            <div className="fade bwrap">
              <BujeokCanvas saju={saju} direction={res.direction} seed={q + (res.verdict || "")} />
              <p className="fine">오늘의 판결을 지키는 부적 — 같은 질문·같은 판결에서만 같은 문양이 나와.</p>
            </div>
          )}
          {res && cardOn && <button className="btn ghost mt" onClick={() => { setRes(null); setDetail(null); setWhy(false); setDetailBusy(false); setQ(""); setCardOn(false); setRitual(false); setTosses([]); setHexInfo(null); setBujeok(false); }}>다른 걸 물어볼래</button>}
        </section>
      )}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;900&display=swap');
*{box-sizing:border-box} 
.stage{min-height:100vh;background:radial-gradient(130% 100% at 50% 0%,#141021,#0a0812 55%,#050408);color:#d8cfe6;font-family:'Noto Serif KR',serif;display:flex;justify-content:center;padding:36px 20px 80px;position:relative;overflow:hidden}
.stage::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1px 1px at 12% 22%,#ffffff55,transparent),radial-gradient(1px 1px at 78% 14%,#ffe9ad44,transparent),radial-gradient(1.5px 1.5px at 62% 68%,#ffffff33,transparent),radial-gradient(1px 1px at 30% 84%,#ffe9ad33,transparent),radial-gradient(1px 1px at 88% 48%,#ffffff40,transparent),radial-gradient(1.5px 1.5px at 8% 58%,#ffe9ad2e,transparent);animation:twk 6s ease-in-out infinite alternate}
@keyframes twk{to{opacity:.45}}
.scene{width:100%;max-width:400px;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative}
.fade{animation:fd 1.15s cubic-bezier(.22,.7,.25,1) both}@keyframes fd{from{opacity:0;transform:translateY(14px) scale(.985);filter:blur(7px)}to{opacity:1;transform:none;filter:blur(0)}}
.orb{position:relative;width:170px;height:170px;margin:48px 0 36px;filter:drop-shadow(0 0 24px rgba(245,217,139,.2))}
.line{font-size:17px;line-height:1.8;margin:8px 0;opacity:0;animation:fd 1.6s cubic-bezier(.22,.7,.25,1) forwards}.d1{animation-delay:1.4s}.d2{animation-delay:3s}
.brand-mark{margin-top:56px;font-size:11px;letter-spacing:.4em;color:#8a7f95;font-family:sans-serif}
.title{font-size:20px;font-weight:600;color:#f0e2b8;margin:6px 0 4px}
.sub2{font-size:14px;color:#9d8fb5;line-height:1.7;margin:6px 0 18px}
.form{display:flex;flex-direction:column;gap:12px;width:100%;margin-bottom:14px}
.row{display:flex;align-items:center;justify-content:center}.gap{gap:8px}.center{justify-content:center}
.in{background:transparent;border:none;border-bottom:1px solid rgba(245,217,139,.35);color:#f0e2b8;padding:10px 4px;font-size:19px;width:96px;text-align:center;font-family:inherit;letter-spacing:.06em;transition:border-color .3s, box-shadow .3s}
.in::placeholder{color:#4d445f}
.in.sm{width:60px}.in.wide{width:100%;text-align:center;font-size:15px}
.in:focus{outline:none;border-bottom-color:#ffe9ad;box-shadow:0 12px 18px -14px rgba(245,217,139,.6)}
.in:disabled{opacity:.35}
.unit{color:#8a7f95;font-size:13px}
.chk{font-family:sans-serif;font-size:12px;color:#c9b98f;display:flex;align-items:center;gap:6px}.chk em{color:#8a7f95;font-style:normal}
.chk input{accent-color:#c98f3d}
.btn{font-family:inherit;font-size:14px;font-weight:600;letter-spacing:.14em;padding:13px 28px;border-radius:999px;border:1px solid rgba(245,217,139,.4);background:transparent;color:#f0e2b8;cursor:pointer;transition:box-shadow .3s,border-color .3s}
.btn:hover{border-color:#ffe9ad;box-shadow:0 0 22px rgba(245,217,139,.25)}
.btn.gold{background:linear-gradient(180deg,#f5d98b,#c98f3d);color:#241a08;border:none;box-shadow:0 6px 22px rgba(201,143,61,.3)}
.btn.ghost{border-color:#3a3350;color:#8a7f95}.btn:disabled{opacity:.45;cursor:default}.mt{margin-top:18px}
.fine{font-family:sans-serif;font-size:10px;color:#5f5670;margin-top:14px;line-height:1.6}
.err{color:#e58a8a;font-size:13px;font-family:sans-serif;margin:10px 0}
.cards{display:flex;flex-direction:column;gap:14px;width:100%;margin-top:10px}
.chips{display:flex;flex-direction:column;gap:8px;width:100%;margin:8px 0 4px;align-items:center}
.chip{font-family:inherit;font-size:12.5px;letter-spacing:.06em;color:#c9b98f;border:1px solid rgba(245,217,139,.3);border-radius:999px;padding:8px 18px;opacity:0;transform:translateY(8px);transition:all .7s ease}
.chip.on{opacity:1;transform:none;animation:chipGlow 1.6s ease}
@keyframes chipGlow{0%{box-shadow:0 0 0 rgba(245,217,139,0)}30%{box-shadow:0 0 18px rgba(245,217,139,.45)}100%{box-shadow:0 0 0 rgba(245,217,139,0)}}
.mention{font-size:17px;line-height:2;color:#e8dff5;margin:22px 0 6px}
.mention b{color:#ffe9ad;font-weight:600}
.refbox{width:100%;margin:10px 0 4px;font-family:sans-serif;font-size:12px;color:#8a7f95;text-align:left}
.refbox summary{cursor:pointer;text-align:center;letter-spacing:.08em;color:#6f6580;list-style:none}
.refbox summary::after{content:" ▾"}
.refbox[open] summary::after{content:" ▴"}
.refline{margin:8px 0 0;line-height:1.7;color:#9d8fb5}
.mcard{background:linear-gradient(160deg,#1c1730,#120e1e);border:1px solid rgba(245,217,139,.35);border-radius:14px;padding:16px;opacity:0;transform:rotateX(70deg);transition:all .8s cubic-bezier(.2,.8,.25,1)}
.mcard.on{opacity:1;transform:none}
.mtag{font-family:sans-serif;font-size:10px;letter-spacing:.2em;color:#c9b98f;text-align:left}
.pill{font-size:16px;font-weight:600;color:#f0e2b8;margin:8px 0;text-align:left}
.bars{display:flex;flex-direction:column;gap:4px;margin:8px 0}
.bar{display:flex;align-items:center;gap:6px;font-family:sans-serif;font-size:11px;color:#9d8fb5}
.bar i{height:6px;border-radius:3px;display:block;min-width:4px}.bar b{color:#c9b98f}
.mread{font-size:13.5px;line-height:1.75;color:#cbc0dd;text-align:left;margin:6px 0 0}
.grid16{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;width:100%}
.cell{font-family:inherit;font-size:12px;letter-spacing:.08em;padding:10px 0;border-radius:999px;border:1px solid rgba(138,127,149,.35);background:transparent;color:#9d8fb5;cursor:pointer;transition:all .25s}
.cell:hover{border-color:rgba(245,217,139,.5)}
.cell.sel{border-color:#ffe9ad;color:#ffe9ad;box-shadow:0 0 14px rgba(245,217,139,.3),inset 0 0 10px rgba(245,217,139,.08)}
.cell.blood{padding:10px 20px}
.halo{position:relative;filter:drop-shadow(0 0 30px rgba(245,217,139,.15));margin:8px 0;transition:filter .6s}
.halo.wide{width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);display:flex;justify-content:center}
.halo.busy{animation:haloPulse 1.4s ease-in-out infinite}
@keyframes haloPulse{0%,100%{filter:drop-shadow(0 0 26px rgba(245,217,139,.14))}50%{filter:drop-shadow(0 0 46px rgba(245,217,139,.34))}}
.halo.dimmed{opacity:.32;filter:blur(2px) drop-shadow(0 0 30px rgba(245,217,139,.2));transition:opacity .6s,filter .6s}
.gintro{font-size:15px;line-height:1.8;margin:4px 0;color:#e0d6ef}.gintro.dim{color:#9d8fb5;font-size:14px;margin-bottom:14px}
.qbox{width:100%;background:transparent;border:none;border-bottom:1px solid rgba(245,217,139,.35);color:#f0e2b8;padding:12px 4px;font-size:15.5px;font-family:inherit;resize:none;line-height:1.7;margin-bottom:14px;text-align:center;transition:border-color .3s,box-shadow .3s}
.qbox::placeholder{color:#4d445f}
.qbox:focus{outline:none;border-bottom-color:#ffe9ad;box-shadow:0 14px 20px -16px rgba(245,217,139,.6)}
.w100{width:100%;display:flex;flex-direction:column;align-items:center}
.gtext{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;pointer-events:none;padding:0 34px}
.gtext.up{padding-bottom:150px}
.gpanel{position:absolute;left:0;right:0;margin:0 auto;top:calc(50% - 30px);width:min(86vw,400px);display:flex;flex-direction:column;align-items:center;z-index:3}
.forming{font-size:13px;line-height:2.1;color:#cfc4e2;letter-spacing:.14em;margin:0;text-shadow:0 0 16px rgba(245,217,139,.4);animation:formPulse 2.1s ease-in-out infinite}
@keyframes formPulse{0%,100%{opacity:.5}50%{opacity:1}}
.gname{font-size:14px;line-height:1.9;color:#f0e2b8;margin:0;text-shadow:0 2px 18px rgba(5,4,8,.95),0 0 26px rgba(245,217,139,.28)}
.gintro.dim2{color:#c9b98f;font-size:14px;margin:2px 0 12px}
.hexpanel{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:6px;width:100%}
.hexlines{display:flex;flex-direction:column;gap:8px;margin:6px 0}
.hline{position:relative;width:86px;height:8px;display:flex;justify-content:center}
.hline .yang{width:86px;height:8px;border-radius:4px;background:linear-gradient(90deg,#f5d98b,#c98f3d);box-shadow:0 0 10px rgba(245,217,139,.45)}
.hline .yin{width:86px;height:8px;border-radius:4px;background:linear-gradient(90deg,#f5d98b 0 36%,transparent 36% 64%,#c98f3d 64% 100%)}
.hline .hempty{width:86px;height:8px;border-radius:4px;border:1px dashed rgba(138,127,149,.35);box-sizing:border-box}
.hline .mv{position:absolute;right:-16px;top:-2px;font-size:8px;color:#ffe9ad;font-style:normal;animation:formPulse 1.6s infinite}
.coins{font-family:sans-serif;font-size:12px;color:#c9b98f;display:flex;gap:10px;margin:0}
.wrapc{flex-wrap:wrap}
.bwrap{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:16px;filter:drop-shadow(0 0 18px rgba(245,217,139,.2))}
.persp{perspective:1100px;margin-top:22px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.persp.cardIn{animation:cardIn .95s cubic-bezier(.16,.9,.24,1) both;margin-top:calc(min(100vw,620px)/-2 - 200px);position:relative;z-index:2}
@keyframes cardIn{0%{opacity:0;transform:perspective(1100px) rotateX(58deg) translateY(-76px) scale(.55);filter:brightness(3) blur(14px)}45%{opacity:1;filter:brightness(1.7) blur(3px)}72%{transform:perspective(1100px) rotateX(-6deg) translateY(4px) scale(1.02);filter:brightness(1.1) blur(0)}100%{opacity:1;transform:none;filter:none}}
.gateflash{position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 30%,rgba(255,233,173,.55),rgba(255,233,173,.12) 34%,transparent 65%);animation:gf .9s ease-out forwards;z-index:5}
@keyframes gf{0%{opacity:0}35%{opacity:1}100%{opacity:0}}
.rv{margin:0;font-family:sans-serif;font-size:12px;letter-spacing:.28em;color:#cfc4e2;line-height:2.1;animation:rvIn .18s ease both,rvScatter .34s ease .32s forwards}
.rv b{color:#ffe9ad;font-weight:600;font-size:14.5px;font-family:'Noto Serif KR',serif;letter-spacing:.1em}
@keyframes rvIn{from{opacity:0;filter:blur(7px);transform:scale(.9)}to{opacity:1;filter:blur(0);transform:none}}
@keyframes rvScatter{to{opacity:0;filter:blur(12px);letter-spacing:.7em;transform:scale(1.28)}}
.vhex{font-family:sans-serif;font-size:11px;color:#c9b98f;letter-spacing:.18em;margin:8px 0 0}
.season{font-family:sans-serif;font-size:10.5px;color:#8a7f95;margin-top:12px;letter-spacing:.04em;line-height:1.7}.season b{color:#ffe9ad}
.findlink{font-family:sans-serif;font-size:11.5px;color:#c9b98f;text-decoration:none;border-bottom:1px dotted #c9b98f66;margin-top:8px;display:inline-block}
.findlink:hover{color:#ffe9ad}
.vcard{position:relative;width:300px;height:430px;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.8,.25,1)}
.vface{position:absolute;inset:0;border-radius:16px;padding:24px;backface-visibility:hidden;background:linear-gradient(165deg,#1a1428,#0f0b1a 42%,#191024);background-image:radial-gradient(1px 1px at 82% 12%,#ffe9ad26,transparent),radial-gradient(1px 1px at 14% 30%,#7fd4ff1f,transparent),radial-gradient(1.5px 1.5px at 70% 78%,#b48cff22,transparent),radial-gradient(1px 1px at 30% 88%,#ffe9ad1f,transparent),linear-gradient(165deg,#1a1428,#0f0b1a 42%,#191024);box-shadow:inset 0 0 0 1px rgba(245,217,139,.42),inset 0 0 0 7px rgba(15,11,26,1),inset 0 0 0 8px rgba(245,217,139,.16),0 26px 54px rgba(0,0,0,.68);display:flex;flex-direction:column;text-align:center}
.vcard::after{content:"";position:absolute;inset:-3px;border-radius:20px;background:conic-gradient(from 210deg,#c98f3d40,#7fd4ff26,#b48cff3a,#e04d2a26,#c98f3d40);z-index:-1;filter:blur(7px)}
.corner{position:absolute;font-size:9px;color:#c9b98f88;font-style:normal}
.corner.tl{top:12px;left:12px}.corner.tr{top:12px;right:12px}.corner.bl{bottom:12px;left:12px}.corner.br{bottom:12px;right:12px}
.vside{position:absolute;left:13px;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;font-size:8.5px;letter-spacing:.6em;color:#c9b98f55;font-family:'Noto Serif KR',serif;pointer-events:none}
.vseal{position:absolute;right:16px;bottom:46px;width:28px;height:28px;background:linear-gradient(180deg,#c03434,#8e1f1f);color:#ffe9ad;font-size:14px;display:flex;align-items:center;justify-content:center;border-radius:4px;box-shadow:0 0 14px rgba(192,52,52,.45),inset 0 0 0 1px rgba(255,233,173,.3);font-family:'Noto Serif KR',serif;pointer-events:none}
.vface.back{transform:rotateY(180deg);text-align:left}
.vtop,.vbot{display:flex;justify-content:space-between;font-family:sans-serif;font-size:10px;letter-spacing:.2em;color:#c9b98f}
.vbot{margin-top:auto;color:#8a7f95}
.vq{font-size:14px;line-height:1.7;margin:22px 0 0;color:#d8cfe6}
.vdiv{display:flex;align-items:center;gap:10px;color:#c98f3d;margin:14px 0;font-size:11px}.vdiv::before,.vdiv::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,#c98f3d88,transparent)}
.vv{font-size:27px;font-weight:900;margin:0;background:linear-gradient(180deg,#ffe9ad,#c98f3d);-webkit-background-clip:text;background-clip:text;color:transparent}
.vv.go{background:linear-gradient(180deg,#b8ffd9,#3dc98f);-webkit-background-clip:text;background-clip:text}
.vv.hold{background:linear-gradient(180deg,#cfd8ff,#7f8fd4);-webkit-background-clip:text;background-clip:text}
.vs{color:#9d8fb5;font-size:13px;font-style:italic;margin:10px 0 0}
.vs.dim{opacity:.6}
.whybtn{margin:16px auto 0;display:block;background:transparent;border:1px solid #c98f3d66;color:#e6d6a8;font-size:12.5px;letter-spacing:.05em;padding:8px 18px;border-radius:20px;cursor:pointer;font-family:sans-serif}
.whybtn:hover{border-color:#f5d98b;background:#f5d98b12}
.l2{margin-top:2px}
.vfun{font-family:sans-serif;font-size:11px;color:#c9b98f;margin:12px 0 0}
.vfun .dim{opacity:.55}
.pips{display:flex;align-items:center;gap:5px;justify-content:center;margin-top:16px;flex-wrap:wrap}
.pip{width:8px;height:8px;border-radius:50%;border:1px solid #c98f3d88}.pip.on{background:linear-gradient(180deg,#ffe9ad,#c98f3d);box-shadow:0 0 8px rgba(245,217,139,.6)}
.pips em{font-family:sans-serif;font-style:normal;font-size:11px;color:#c9b98f;margin-left:4px}
.vr{list-style:none;padding:0;margin:14px 0 0;display:flex;flex-direction:column;gap:10px;overflow:auto}
.vr li{border-left:2px solid #c98f3d;padding-left:10px}.vr li.fun{border-left-color:#6f6580;opacity:.7}
.vr b{color:#f0e2b8;font-size:12.5px}.vr em.vote{font-style:normal;font-family:sans-serif;font-size:9.5px;color:#c9b98f;margin-left:6px;letter-spacing:.08em}.vr p{margin:2px 0 0;color:#b5aac6;font-size:12px;line-height:1.55;font-family:sans-serif}
.disc{margin-top:auto;font-family:sans-serif;font-size:10px;color:#8a7f95;line-height:1.5}
.split{font-family:sans-serif;font-size:10.5px;letter-spacing:.22em;color:#e5b96b;margin:0 0 6px;animation:formPulse 1.8s ease-in-out infinite}
.retrybtn{background:transparent;border:1px solid #c98f3d66;color:#e6d6a8;font-size:11px;padding:3px 12px;border-radius:14px;cursor:pointer;font-family:sans-serif;margin-left:8px}
.retrybtn:hover{border-color:#f5d98b}
@media(prefers-reduced-motion:reduce){.fade,.line,.spark,.mcard,.chip.on,.halo.busy,.forming,.persp.cardIn,.hline .mv,.rv,.gateflash{animation:none;transition:none;opacity:1;transform:none}}
`;
