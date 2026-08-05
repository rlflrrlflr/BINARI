import { useState, useRef, useEffect } from "react";

/* ───── 계측(PostHog) — 휴면-준비: VITE_POSTHOG_KEY 없으면 완전 무동작 ───── */
const AKEY = import.meta.env.VITE_POSTHOG_KEY;
let _ph = null, _phInit = false;
/* ── 계측 2단계 구조 ──────────────────────────────────────────────
   1단계(기본) — 동의 불필요. 서비스 운영·개선에 필요한 최소 통계.
     이벤트 발생 사실과 비식별 지표(판결 방향·카테고리·톤·만족도 점수·질문 길이·belief 등)만.
     근거: 개인정보보호법 §15①6 정당한 이익 / §28-2 가명정보 통계작성 + 처리방침 고지.
     → DAU/MAU·리텐션·퍼널이 전체 사용자 기준으로 정확히 잡힌다.
   2단계(프로파일) — 선택 동의 필요. 나이·성별·직업·관계·도시·MBTI·가치관·오행,
     판결 문구, 망설임 사유. 서비스 제공에 필수가 아니고 조합 시 식별성이 커지므로 동의 기반.
     미동의 시 아래 키만 제거되고 이벤트 자체는 그대로 전송된다.
   질문 원문·실명·생년월일 원값은 단계 무관하게 절대 전송하지 않는다. */
/* 2026-07-28 결정: 프로파일 항목도 전부 1단계(동의 불필요)로 수집한다.
   동의율이 47%라 나이·성별·MBTI·가치·판결 결과가 절반만 들어왔고, 그 표본으로는
   어떤 판단도 서지 않았다. 대신 처리방침(2조)에 전 항목을 명시 고지하고 근거를 §15①6에 둔다.
   ⚠️ 질문 원문·실명·생년월일 원값·자유 서술 메모는 단계와 무관하게 여전히 절대 보내지 않는다.
   이 집합을 다시 채우면 그 키들이 미동의자에게서 제거되는 구조는 그대로 되살아난다. */
const PROFILE_KEYS = new Set([]);
const stripProfile = (p) => { const o = {}; for (const k in p) if (!PROFILE_KEYS.has(k)) o[k] = p[k]; return o; };

/* ── D1·D2: 모든 이벤트에 따라붙는 고정 속성(super property) ────────────────
   동의와 무관하게 붙는다. 개인의 신상이 아니라 "이 트래픽이 내부인지"와
   "최초 유입이 어디였는지"라는 측정 메타데이터라서 PROFILE_KEYS에 넣지 않는다.
   식별자 원값(fbclid/gclid)은 저장하지 않고 존재 여부만 남긴다. */
const INTERNAL_KEY = "binari.internal.v1";
const FIRSTTOUCH_KEY = "binari.firsttouch.v1";
let _superProps = {};

function _initSuperProps() {
  if (typeof window === "undefined") return;
  let sp; try { sp = new URLSearchParams(window.location.search); } catch (_) { sp = new URLSearchParams(""); }
  const g = (k) => sp.get(k) || null;

  // D1 — 내부 트래픽: ?i=1 로 한 번 들어오면 그 브라우저는 이후 영구히 내부로 표시된다.
  let internal = false;
  try {
    if (g("i") === "1") window.localStorage.setItem(INTERNAL_KEY, "1");
    internal = window.localStorage.getItem(INTERNAL_KEY) === "1";
  } catch (_) { internal = g("i") === "1"; }

  // D2 — first-touch: 최초 1회만 기록하고 이후 절대 덮어쓰지 않는다.
  //   재방문 시 URL에 파라미터가 없어 direct로 덮이던 문제(=소재별 D7 귀속 불가)를 막는다.
  let ft = null;
  try { ft = JSON.parse(window.localStorage.getItem(FIRSTTOUCH_KEY) || "null"); } catch (_) {}
  if (!ft || !ft.ft_source) {
    ft = {
      ft_source: g("utm_source") || g("ref") || (g("fbclid") ? "meta" : null) || (g("gclid") ? "google" : null) || (g("v") ? "share" : "direct"),
      ft_medium: g("utm_medium"),
      ft_campaign: g("utm_campaign"),
      ft_content: g("utm_content"),          // 소재 단위 — 이 값이 있어야 소재별 성과가 갈린다
      ft_term: g("utm_term"),
      ft_click: g("fbclid") ? "fbclid" : (g("gclid") ? "gclid" : null),   // 원값 아닌 종류만
      ft_date: new Date().toISOString().slice(0, 10),
    };
    try { window.localStorage.setItem(FIRSTTOUCH_KEY, JSON.stringify(ft)); } catch (_) {}
  }

  _superProps = { is_internal: internal, ...ft };
  const b = readBelief();                     // D3 — 답했으면 이후 모든 이벤트에 따라붙는다
  if (b) _superProps.belief = b;
}

const CONSENT_KEY = "binari.analytics_consent.v1";
let _consent = false;                                             // 2단계(프로파일) 동의 여부
function readConsent() { try { return window.localStorage.getItem(CONSENT_KEY) === "1"; } catch (_) { return false; } }
function setAnalyticsConsent(on) {
  _consent = !!on;
  try { window.localStorage.setItem(CONSENT_KEY, on ? "1" : "0"); } catch (_) {}
  if (on) _initAnalytics();
}
/* 대기 큐 — posthog는 지연청크라 로드 완료까지 수백 ms가 걸린다. 그 사이(특히 마운트 직후의
   app_open)에 발생한 이벤트를 원래 시각과 함께 담아두고, 로드 완료 시 한 번에 흘려보낸다.
   1단계는 동의를 기다리지 않으므로 큐는 '로드 대기' 용도만 한다. */
const _q = [];
const Q_MAX = 50;
function _flush() {
  if (!_ph) return;
  while (_q.length) { const e = _q.shift(); try { _ph.capture(e.ev, _consent ? e.props : stripProfile(e.props), { timestamp: e.at }); } catch (_) {} }
}
async function _initAnalytics() {
  if (_phInit || !AKEY || typeof window === "undefined") return; _phInit = true;
  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(AKEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: false,      // SPA라 무의미
      capture_pageleave: true,      // 체류시간·바운스율을 잴 유일한 근거. 광고 랜딩 품질 평가에 필수
      capture_exceptions: true,     // JS 예외 — 없으면 앱이 깨져도 아무도 모른다
      capture_performance: false,   // $web_vitals 끔 — 전체 기록의 22%를 먹으면서(유저당 11.5건)
                                    //   성과 분석에도 앱 개선에도 안 쓰였다. 판결 대기시간은
                                    //   verdict_shown.ms 로 이미 더 직접적으로 재고 있다.
      autocapture: false,
      persistence: "localStorage",
    });
    _ph = posthog;
    // 고정 속성을 posthog 자체에 등록한다. track()이 직접 얹는 값과 동일하지만,
    // $pageleave·$exception 처럼 SDK가 스스로 쏘는 이벤트에도 붙어야
    // is_internal 제외 필터와 소재별(ft_content) 분해가 그 이벤트들에서도 성립한다.
    try { posthog.register(_superProps); } catch (_) {}
    _flush();                                  // 로드 전에 쌓인 이벤트를 원래 시각으로 전송
  } catch (_) {}
}
/* ── 방문 단위 계측 ──────────────────────────────────────────────────────────
   비나리는 습관 앱이다. "하루에 몇 번 열었나"가 제품의 핵심 신호이므로 빈도를 죽이면 안 된다.
   죽여야 하는 건 새로고침 연타처럼 같은 방문 안에서 중복으로 쌓이는 기록뿐이다.
   그래서 '탭 세션'이 아니라 '30분 간격'으로 방문을 가른다(PostHog 세션 정의와 같은 기준).
     - 새로고침 10번  → 1건 (노이즈 제거)
     - 아침·점심·저녁 → 3건 (습관 빈도 보존)
   모바일은 탭을 안 닫고 앱을 오가므로, 화면이 다시 보일 때도 같은 규칙으로 재판정한다.
   그게 없으면 하루 종일 탭을 열어둔 사람은 재방문이 영영 안 잡힌다. */
const VISIT_KEY = "binari.lastvisit.v1";
const VISIT_GAP_MS = 30 * 60 * 1000;
function trackVisit(props) {
  let last = 0;
  try { last = +(window.localStorage.getItem(VISIT_KEY) || 0) || 0; } catch (_) {}
  if (Date.now() - last < VISIT_GAP_MS) return false;
  try { window.localStorage.setItem(VISIT_KEY, String(Date.now())); } catch (_) {}
  track("app_open", props);
  return true;
}
/* 방문당 1회로 묶는 계측. '이번 방문에 일어났는가'만 남기고 횟수는 속성으로 따로 싣는다.
   방문 경계는 위 trackVisit 과 같은 30분 기준이라 재방문하면 다시 열린다. */
function trackVisitOnce(ev, props) {
  const k = "binari.once." + ev;
  try {
    const last = +(window.localStorage.getItem(k) || 0) || 0;
    if (Date.now() - last < VISIT_GAP_MS) return false;
    window.localStorage.setItem(k, String(Date.now()));
  } catch (_) { /* 저장 불가(시크릿 등) — 놓치느니 보낸다 */ }
  track(ev, props || {});
  return true;
}
function track(ev, props) {
  try {
    const p = { ..._superProps, ...(props || {}) };               // 고정 속성(내부여부·first-touch·신념)을 먼저 깔고 개별 속성으로 덮는다
    const out = _consent ? p : stripProfile(p);                   // 미동의 → 2단계 속성만 제거, 이벤트는 전송
    if (_ph) _ph.capture(ev, out);
    else if (_q.length < Q_MAX) _q.push({ ev, props: p, at: new Date() });   // 로드 대기 중 보류
    if (typeof window !== "undefined" && window.__binariTrackDebug) (window.__binariEvents = window.__binariEvents || []).push({ ev, props: out });
  } catch (_) {}
}
if (typeof window !== "undefined" && /[?&]trackdebug/.test(window.location.search)) window.__binariTrackDebug = true;

/* D3 — 신자/비신자 1문항. 첫 판결 직후 1탭으로 한 번만 묻고, 이후 모든 이벤트에 따라붙는다.
   G2 게이트("비신자도 돌아오는가")를 재는 유일한 축이다.
   ※ 2026-07-26 판단: 1단계(동의 불필요)로 이동. 종교·사상적 신조가 아니라 점술이라는 서비스
      카테고리에 대한 태도이고, 3지 선택 고정값이라 자유서술이 없으며, 식별자와 연결되지 않는다.
      §23 민감정보로 볼 여지가 완전히 없지는 않으므로 처리방침 2조 '기본 통계' 항목에 명시 고지한다.
      되돌리려면 PROFILE_KEYS에 "belief"를 다시 넣고 처리방침 고지를 2단계로 옮기면 된다. */
const BELIEF_KEY = "binari.belief.v1";
function readBelief() { try { return window.localStorage.getItem(BELIEF_KEY) || ""; } catch (_) { return ""; } }
function saveBelief(v) {
  try { window.localStorage.setItem(BELIEF_KEY, v); } catch (_) {}
  _superProps.belief = v;
  if (_ph) { try { _ph.register({ belief: v }); } catch (_) {} }   // 자동 수집 이벤트에도 따라붙도록
}
_initSuperProps();

/* ═══════════════ 비나리 BINARI · 웹앱 (v16-dev · 0단계: 아티팩트 탈출) ═══════════════
   온보딩(재회→의식→회상개봉) → 파라메트릭 수호신 → AI 판결(v2 수호신 프롬프트)
   만세력: JS 자체 구현 — 일주=율리우스일(검증), 절기=태양황경 천문계산(v18, ±수분), 진태양시=도시 경도+균시차(v18)
   v14: ①수호신 비주얼 = 지표별 독립 시각축(오행=형태, 별자리=주색 hue회전, 오행분포=강조색,
          라이프패스=대칭수, 달=밝기, MBTI=밀도/속도/질서) + 개인 시드 → 같은 오행도 안 겹침
        ②프롬프트 캐싱(system) + 대화 기억(최근 6턴)
   v15: ①판결 2콜 분리 — 콜1: 결론만(빠름, L1 즉시) / 콜2: 근거만(백그라운드, 판결 뒤집기 금지→일관성 보장)
        ②3층 리빌: L1 결론 → L2 '왜?'(클릭, 시간 벌이) → L3 지표별 근거(카드 뒤집기)
        ③휴먼디자인 제거 — 생일로 이미 아는 값을 되묻는 건 세계관 위반, 정식 자동계산은 Phase 2
   v13: 진태양시·독립판정·JSON 파서 강화 / v7: 바이오리듬·삼재·가치여정·주역·부적 / v5: 수비학 축
   v16(0단계): ①API 호출을 /api/judge 서버리스 프록시로 이전(키는 서버 env에만) ②콜1 실패 복구(동전 보존 재시도+질문 고치기)
          ③콜2 실패 재시도 ④가짜 '건너뛰기' 제거 ⑤휴먼디자인 죽은 코드 삭제 ⑥심야 컨텍스트 주입 ⑦접전 배지
   v16(B1): 수호신의 기억 — localStorage 영속화(프로필+대화). 재회 시 온보딩·형성 연출 생략, 재회 인사, '다른 사람이야?' 리셋
   v16(B2): 아침 문안 — 재회 유저 전용 데일리 카드(바이오리듬·달·일진, 전부 로컬 계산=API 0콜). 하루 1장, 자정 소멸
   v16(B4): 부적 내보내기 — 1080×1920 스토리 규격 포스터(문양+인장+6효+카테고리 실루엣). 질문 원문 미포함, share→다운로드 폴백
   v16(B3): 되물음 루프 — 판결 기록(records) 영속화, 6시간 넘게 미보고면 재회 시 수호신이 먼저 묻는다(따랐어/거슬렀어/아직).
          이행 답변은 다음 판결 프롬프트에 [지난 판결 이행]으로 주입 — 수호신이 과거를 인용한다
   v16(B5): 속결 모드 — 가벼운 질문은 의식 없이 즉답(무괘·콜2 생략, 원가 절반). 가벼운 질문에서 동전이 특권이 되는 역전
   v16(B6): 판결록 — records 두루마리(최근 10건 표시). 부적은 seed 재현이라 텍스트 레코드만으로 문양이 다시 그려진다
   v16(B7): 스트릭 최소형 — "수호신과 연결된 지 N일째" 방문일 카운터만(게임화 없음)
   v18: ①듀얼 모드 API — /api/judge(배포) 없으면 직접 호출로 자동 폴백(아티팩트 호환 복구) ②저장 안전 셈(localStorage 차단 시 메모리 강등)
        ③모를 권리 — 질문 범위만 답하는 프롬프트 규칙 / 토정비결 옵트인 접기 / 아침 문안 노크형(청해야 펼친다)
   v19(모바일): 질문칸 박스화(파티클에 안 묻힘·iOS 줌 방지 16px)·좌우 풀폭(모바일 여백 축소)
   v31(B단계): WebGL 수호신 — GPU 입자 2만+(셰이더 위치계산, 메인스레드 해방)·무구심점 흐름(화 리본기둥/수 물결층/목 가지흐름/금 궤도빛줄기/토 난류융기)·촐킨=가닥·꼬임 재배선·3패스 잔상·판결 연기/요동/어셈블 보존·Canvas2D 자동 폴백(?r=2d 강제 가능)
   v30(체감): 카드 뜨면 수호신 사실상 정지(restRef 3단계 0/46/300ms — 판결 정독 중 스크롤·클릭 회복)·회상 나레이션→문항 순차('응,기억나' 탭)·캔버스 가장자리 radial 마스크(네모 경계 제거)·모델 Sonnet5+thinking off·재설정 앱내 확인(window.confirm 폐지)·동전 CTA 밀림 해소(hexlines 88px 예약)·CTA 인식도(고스트 버튼 강화·hover/press)
   v29(정독): 회상 나레이션은 선택 시작 전 1회만(첫 픽 후 숨김)·자기소개는 탄생 순간에만(justBorn 7초 후 소멸)·판결 대기·정독 중 캔버스 프레임 솎기(restRef ~21fps로 스크롤·카드 렌더에 메인스레드 양보)
   v28(지문): 심화 지표를 시각으로 — 납음(30)=움직임 결·촐킨(20날개×13톤)=코어 문양·나크샤트라(27)=강조색·대운=현재 아우라. 판결 방향에 수호신 반응(연기)
   v27(다양성): 실루엣 축 확장 — 팔 수(라이프패스 3~7)를 5형태 전부에(불꽃 혀·물결 층·흙 봉우리 개수), E/I=크기, T/F=입자 질감. 정령 위성(혈액형 잔재) 제거
   v26(도입부): 동화 영화 장면화 — 서식 해체 4장면, 조각 보태기, 카드 조기 뒤집기 '근거 모으는 중'
   v25(정보): 이름(호칭) — 수호신이 이름을 부른다 · 성별→대운(현재 인생 10년 흐름, 타이밍 층·별도 축 신설 없이 사주에 흡수)
   v25(정확성): 음력 생일 입력 — 음/양력 토글+윤달 체크, 음력이면 양력으로 정규화 후 사주 계산(간절기·설날생 오판 방지)
   v24(성격): MBTI 순차 문항화 — 기억 1/4씩, '아까 걸로 돌아갈래' · 혈액형 제거(판결 미반영 지표 정리, 정령은 달 별자리로 재배선)
   v24(탄생): 깨우기 전환 — 구체 수축→섬광→블룸 뒤 수호신 페이드인(먼지→우주→존재의 사슬 봉합)
   v24(오브): 3D 회전 입자 구체 — 흩어진 먼지가 단계마다 응집·착색·가속하는 작은 우주, 성장 순간 펄스 링
   v23(의식): 의식 모드 장면화 — 입력창 대신 질문 인용문, 빈 점선 스캐폴드 폐지(효가 낙하하며 쌓임), 동전 포물선 궤적,
        낙착마다 수호신 요동(6효째 클라이맥스), '물음을 고칠래' 중도 취소
   v23(리빌·성격): 리빌 전면화 — 지표를 화면 중앙에 크게 1.15s씩, 오브로 흡수되는 연출(절정을 읽게 한다)
        · MBTI 픽션화 — 16그리드 폐지 → "내 기억이 맞는지 골라줘" 2택×4(설문 문법 제거, 같은 정보)
   v23(온보딩): ①오브 성장 — 조각(생일→성격→가치)마다 입자·색·빛 축적('모아주면 곁이 된다'의 시각화) ②팔 수 3~7 상한+머리 갈래(문양→존재)
        ③소개문을 수호신 아래로(얼굴 가림 해소) ④한국어 줄바꿈 keep-all ⑤'늘' 중복 카피 수정
   v22(가치): 가치여정 24→16 통합(중복 흡수), 8→4→1 → 6→3→1 (13탭→10탭) — 카드소트 방법론·3막 드라마 유지
   v22(지표): 달 별자리+나크샤트라(달 황경 천문계산·라히리 아야남샤)·납음오행·마야 촐킨 — 입력 0, 축은 '마야'만 신설
   v22(UX): 장면 분리(수호신 영역/대화 영역 겹침 제거) · 텍스트 다이어트(화면당 발화 1개) · 동전 던지기 연출(0.75s 서스펜스)
        · 금 폼 색 재벼림(무채색 수렴 차단 — 차가운 강철빛)
   v21: 앱 웹뷰 감지 — 클로드 앱에서는 complete 봉인(아티팩트 사망 방지, 진단 v01 실측) + 전 경로 차단 시 정직한 안내
   v20(QC): 판결 폭포수 — 실패 시 complete→server→direct 자동 이월(쓰레기 응답·파싱 실패 포함). 진단 아티팩트 동봉
   v19(아티팩트 복구): 판결 경로 3-way — window.claude.complete(아티팩트 내장 API·최우선) → /api/judge(배포) → 직접호출.
        아티팩트에선 배포 없이도 판결이 물린다(사용자 지적 반영: '이전엔 아티팩트에서 됐다')
   v18(이펙트): 금 폼 containment(경계 내 회전·왕복 빛살 — 폭발 금지) · 코어 가산/페이드 평형 조정(백색 포화 제거·색 보존)
        · 텍스트 가독 플레이트 + 질문 패널 그라데이션(수호신 위 글자 겹침 해소)
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
/* v18: 절기 = 태양 겉보기 황경(Meeus 저정밀, ±0.01°≈수분) — 근사표(±1일) 폐기.
   사주월 경계: 입춘 315° 기준 30° 간격(인월=1). 사주년: 입춘 기준. */
function sunLongitude(jdUT) {
  const T = (jdUT - 2451545.0) / 36525;
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mr = (M * Math.PI) / 180;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
    + 0.000289 * Math.sin(3 * Mr);
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin((omega * Math.PI) / 180);
  return ((lambda % 360) + 360) % 360;
}
/* v18: 균시차(분) — 진태양시 = 시계 + 경도보정 + 균시차. NOAA 공식(±20초) */
function equationOfTime(jdUT) {
  const T = (jdUT - 2451545.0) / 36525;
  const L0 = ((280.46646 + 36000.76983 * T) % 360) * Math.PI / 180;
  const M = (357.52911 + 35999.05029 * T) * Math.PI / 180;
  const e = 0.016708634 - 0.000042037 * T;
  const eps = ((23.43929 - 0.01300417 * T) * Math.PI) / 180;
  const y2 = Math.tan(eps / 2) ** 2;
  const E = y2 * Math.sin(2 * L0) - 2 * e * Math.sin(M) + 4 * e * y2 * Math.sin(M) * Math.cos(2 * L0)
    - 0.5 * y2 * y2 * Math.sin(4 * L0) - 1.25 * e * e * Math.sin(2 * M);
  return (E * 4 * 180) / Math.PI;
}
/* v22: 달 황경(Meeus 주요항 10개, 오차 ~0.1~0.3°) — 달 별자리(서양·회귀황도)와 나크샤트라(베다·항성황도)의 원천.
   경계 근접 출생(수 시간 이내)은 한 칸 어긋날 수 있음. 검증: 월식·신월 정렬 테스트(e2e/mansae-test) */
function moonLongitude(jdUT) {
  const T = (jdUT - 2451545.0) / 36525, d = Math.PI / 180;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.272095 + 483202.0175233 * T;
  const lon = Lp
    + 6.288774 * Math.sin(Mp * d) + 1.274027 * Math.sin((2 * D - Mp) * d) + 0.658314 * Math.sin(2 * D * d)
    + 0.213618 * Math.sin(2 * Mp * d) - 0.185116 * Math.sin(M * d) - 0.114332 * Math.sin(2 * F * d)
    + 0.058793 * Math.sin((2 * D - 2 * Mp) * d) + 0.057066 * Math.sin((2 * D - M - Mp) * d)
    + 0.053322 * Math.sin((2 * D + Mp) * d) + 0.045758 * Math.sin((2 * D - M) * d);
  return ((lon % 360) + 360) % 360;
}
const ZODIAC12 = ["양자리","황소자리","쌍둥이자리","게자리","사자자리","처녀자리","천칭자리","전갈자리","사수자리","염소자리","물병자리","물고기자리"];
const NAKSHATRA = ["아슈위니","바라니","크리티카","로히니","므리가시라","아르드라","푸나르바수","푸쉬야","아슐레샤","마가","푸르바팔구니","우타라팔구니","하스타","치트라","스와티","비샤카","아누라다","제슈타","물라","푸르바샤다","우타라샤다","슈라바나","다니슈타","샤타비샤","푸르바바드라","우타라바드라","레바티"];
function moonPlacements(y, m, dd, h, mi, hourUnknown) {
  const jdB = jdFromKST(y, m, dd, hourUnknown ? 12 : h, hourUnknown ? 0 : (mi || 0));
  const lon = moonLongitude(jdB);
  const ayan = 23.86 + (y - 1990) * 0.01397;                  // 라히리 아야남샤 근사
  const sid = ((lon - ayan) % 360 + 360) % 360;
  return { moonSign: ZODIAC12[Math.floor(lon / 30) % 12], nakshatra: NAKSHATRA[Math.floor(sid / (360 / 27)) % 27], lon };
}
/* v22: 마야 촐킨(260일 신성력) — GMT 상관 584283. 검증: 2000-01-01 = 11 이크 */
const TZ_SIGNS = ["이믹스(악어)","이크(바람)","아크발(밤)","칸(씨앗)","치칸(뱀)","키미(전환)","마니크(사슴)","라마트(별)","물루크(물)","오크(개)","추엔(원숭이)","에브(길)","벤(갈대)","이시(재규어)","멘(독수리)","키브(지혜)","카반(대지)","에츠납(부싯돌)","카우악(폭풍)","아하우(태양)"];
function tzolkin(jd) { const n = jd - 584283; return { tone: (((n + 3) % 13) + 13) % 13 + 1, sign: TZ_SIGNS[(((n + 19) % 20) + 20) % 20] }; }
/* v22: 납음오행 — 60갑자의 '소리 기운' 30종. 년주에서 조회 */
const NAYIN = ["해중금·바다 속의 금","노중화·화로 속의 불","대림목·큰 숲의 나무","노방토·길가의 흙","검봉금·칼끝의 금","산두화·산머리의 불","간하수·골짜기의 물","성두토·성벽 위의 흙","백랍금·백랍의 금","양류목·버드나무","천중수·샘 속의 물","옥상토·지붕 위의 흙","벽력화·벼락의 불","송백목·소나무와 잣나무","장류수·길게 흐르는 물","사중금·모래 속의 금","산하화·산 아래의 불","평지목·들판의 나무","벽상토·담벼락의 흙","금박금·금박의 금","복등화·등불의 불","천하수·은하의 물","대역토·큰 역참의 흙","차천금·비녀의 금","상자목·뽕나무","대계수·큰 시내의 물","사중토·모래 속의 흙","천상화·하늘 위의 불","석류목·석류나무","대해수·큰 바다의 물"];
/* v18: 출생 도시 → 경도(진태양시 보정용). 미입력·미매칭이면 서울 */
const CITY_LON = { 서울: 126.978, 인천: 126.71, 수원: 127.03, 성남: 127.14, 고양: 126.84, 부천: 126.78, 안양: 126.95, 용인: 127.18,
  부산: 129.08, 대구: 128.6, 대전: 127.38, 광주: 126.85, 울산: 129.31, 세종: 127.29, 창원: 128.68, 김해: 128.88, 포항: 129.36,
  전주: 127.15, 청주: 127.49, 천안: 127.15, 춘천: 127.73, 원주: 127.95, 강릉: 128.9, 제주: 126.53, 서귀포: 126.56 };
function cityLon(city) { if (!city) return 126.978; for (const k in CITY_LON) if (city.includes(k)) return CITY_LON[k]; return 126.978; }
const jdFromKST = (y, m, d, h, mi) => jdn(y, m, d) - 0.5 + ((h + mi / 60) - 9) / 24; // KST → JD(UT)
function calcSaju(y, m, d, h, mi, hourUnknown, lon = 126.978) {
  const jdBirth = jdFromKST(y, m, d, hourUnknown ? 12 : h, hourUnknown ? 0 : (mi || 0));
  const lam = sunLongitude(jdBirth);
  // 사주년: 입춘(황경 315°) 기준 — 1~2월 출생 중 입춘 전이면 전년
  const beforeIpchun = m <= 2 && !(lam >= 315);
  const sy = beforeIpchun ? y - 1 : y;
  const yG = (sy - 4) % 10 < 0 ? (sy - 4) % 10 + 10 : (sy - 4) % 10;
  const yJ = (sy - 4) % 12 < 0 ? (sy - 4) % 12 + 12 : (sy - 4) % 12;
  // 사주월: 황경 315°(입춘)부터 30° 간격 — 인월=1
  const mn = Math.floor(((lam - 315 + 360) % 360) / 30) + 1;
  const mJ = (mn + 1) % 12;
  const mG = ((yG % 5) * 2 + 2 + (mn - 1)) % 10;
  // 일주: (JDN+49) mod 60 — 검증: 1984-02-02=병인일, 2000-01-01=무오일
  const g = (jdn(y, m, d) + 49) % 60;
  const dG = g % 10, dJ = g % 12;
  // 시주: 진태양시 = 시계 + (경도-135°)×4분 + 균시차 (v18 — 고정 -30분 폐기)
  let hG = null, hJ = null;
  if (!hourUnknown) {
    const tst = h + (mi || 0) / 60 + ((lon - 135) * 4 + equationOfTime(jdBirth)) / 60;
    hJ = Math.floor(((((tst + 1) % 24) + 24) % 24) / 2);
    hG = ((dG % 5) * 2 + hJ) % 10;
  }
  // 오행 분포
  const cnt = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  [[yG, yJ], [mG, mJ], [dG, dJ], ...(hG !== null ? [[hG, hJ]] : [])].forEach(([gg, jj]) => {
    cnt[GAN_EL[gg]]++; cnt[JI_EL[jj]]++;
  });
  const main = GAN_EL[dG];   // v51: 나 = 일간(日干)의 오행(명리 정통). 오행 분포(counts)는 강조색으로 별도 반영
  return {
    pillars: { 년: GAN[yG] + JI[yJ], 월: GAN[mG] + JI[mJ], 일: GAN[dG] + JI[dJ], 시: hG !== null ? GAN[hG] + JI[hJ] : "미상" },
    counts: cnt, main, dayGan: GAN[dG], yJ,
    idx: { yG, yJ, mG, mJ, dG, dJ, hG, hJ },   // v101: 십성·신살·택일·세운 계산용 원 인덱스

    nayin: NAYIN[Math.floor((((sy - 4) % 60 + 60) % 60) / 2)],   // v22: 납음오행
  };
}

/* ── 명리 심화(v101): 십성·신살·충/원진·택일·세운·직업 ───────────────────────
   철학관 리딩의 어휘("재물복"·"암록"·"호랑이띠 조심"·"말날이 좋아"·"29년부터 풀려")를
   지표로 갖추는 작업. 전부 순수 함수·정적 조회 — LLM 이 지어낼 여지가 없다.
   ⚠ 상세 리포트(카드 뒷면)·프로필 주입 전용. votes 축을 신설하지 않는다(v100 tallyVotes 분모 보존).
   ⚠ 지지의 십성은 지시서의 '인덱스 홀짝'이 아니라 지장간 정기(본기) 기준으로 구현했다 —
     자(계)·오(정)·사(병)·해(임)는 겉 음양과 본기 음양이 뒤집히는 체용 문제가 있어,
     실무 명리(연해자평 계열)와 어긋나지 않게 본기 천간으로 환원해 판정한다. */
const JI_BONGI = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];   // 지지→본기 천간: 자계 축기 인갑 묘을 진무 사병 오정 미기 신경 유신 술무 해임
const SAENG = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };   // 상생
const GEUK = { 목: "토", 화: "금", 토: "수", 금: "목", 수: "화" };    // 상극
function sipseong(dg, tg) {   // 둘 다 천간 인덱스 — 일간(dg)이 대상(tg)을 보는 관계
  const me = GAN_EL[dg], ta = GAN_EL[tg], same = dg % 2 === tg % 2;
  if (me === ta) return same ? "비견" : "겁재";
  if (SAENG[me] === ta) return same ? "식신" : "상관";
  if (GEUK[me] === ta) return same ? "편재" : "정재";
  if (GEUK[ta] === me) return same ? "편관" : "정관";
  return same ? "편인" : "정인";
}
function sipseongDist(idx) {   // 일간 제외 7자(시 미상이면 5자)의 십성 분포
  const out = {};
  const put = (g) => { const t = sipseong(idx.dG, g); out[t] = (out[t] || 0) + 1; };
  [idx.yG, idx.mG].forEach(put);
  if (idx.hG != null) put(idx.hG);
  [idx.yJ, idx.mJ, idx.dJ].forEach((j) => put(JI_BONGI[j]));
  if (idx.hJ != null) put(JI_BONGI[idx.hJ]);
  return out;
}
const SS_TIP = { 정재: "꾸준히 들어와 쌓이는 재물", 편재: "크게 들어오고 크게 나가는 재물 — 사업 쪽 돈", 식신: "먹고사는 복과 표현하는 재능", 상관: "틀을 깨는 말·창작의 재능", 정관: "명예와 조직 — 자리가 따르는 힘", 편관: "승부수와 버티는 힘", 정인: "배움·문서·귀인의 복", 편인: "남다른 발상 — 한 우물 파는 힘", 비견: "같이 갈 동료의 복", 겁재: "경쟁 속에서 크는 힘 — 돈은 관리가 필요" };
/* 신살 — 정적 조회. 암록·역마·도화·화개는 산출 근거가 검산 가능(암록=건록의 육합, 나머지=삼합 그룹).
   천을귀인·문창귀인은 연해자평 계열 표준 표('갑무경우양')를 따른다. 이설 존재 — 바꾸려면 출처와 함께. */
const AMROK = [11, 10, 8, 7, 8, 7, 5, 4, 2, 1];              // 건록(갑인 을묘 병사 정오 무사 기오 경신 신유 임해 계자)의 육합
const CHEONEUL = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [5, 3], [5, 3]];   // 갑무경→축미 을기→자신 병정→해유 신→인오 임계→사묘
const MUNCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];            // 갑사 을오 병신 정유 무신 기유 경해 신자 임인 계묘
const SAMHAP_G = [1, 2, 0, 3];                                // j%4 → 삼합 그룹(0:인오술 1:신자진 2:사유축 3:해묘미)
const YEOKMA = [8, 2, 11, 5], DOHWA = [3, 9, 6, 0], HWAGAE = [10, 4, 1, 7];   // 그룹별 역마/도화/화개
function sinsalOf(idx) {
  const jis = [idx.yJ, idx.mJ, idx.dJ, ...(idx.hJ != null ? [idx.hJ] : [])];
  const has = (t) => jis.includes(t);
  const found = [];
  if (has(AMROK[idx.dG])) found.push({ name: "암록(暗祿)", tip: "겉으로 안 드러나는 복 — 막힐 때 사람이 나타나 뚫려" });
  if (CHEONEUL[idx.dG].some(has)) found.push({ name: "천을귀인", tip: "하늘이 붙여준 귀인 — 어려울수록 돕는 손이 와" });
  if (has(MUNCHANG[idx.dG])) found.push({ name: "문창귀인", tip: "글과 배움의 복 — 머리로 푸는 일이 맞아" });
  for (const g of new Set([SAMHAP_G[idx.yJ % 4], SAMHAP_G[idx.dJ % 4]])) {
    if (has(YEOKMA[g]) && !found.some((f) => f.name === "역마")) found.push({ name: "역마", tip: "움직여야 열리는 운 — 이동·출장·해외" });
    if (has(DOHWA[g]) && !found.some((f) => f.name === "도화")) found.push({ name: "도화", tip: "사람을 끄는 매력 — 인기가 재산이 되는 자리" });
    if (has(HWAGAE[g]) && !found.some((f) => f.name === "화개")) found.push({ name: "화개", tip: "홀로 깊어지는 힘 — 예술·공부·수행" });
  }
  return found;
}
const TTI = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
const WONJIN = [7, 6, 9, 8, 11, 10, 1, 0, 3, 2, 5, 4];   // 원진: 자미 축오 인유 묘신 진해 사술
const YUKHAP = [1, 0, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];   // 육합: 자축 인해 묘술 진유 사신 오미 (택일용)
function seun(dg, fromYear, n = 5) {   // 세운. ⚠ 판결의 시계로 쓰지 않는다(대운과 같은 규칙) — 리포트 배경 전용
  const out = [];
  for (let y = fromYear; y < fromYear + n; y++) {
    const t = (((y - 4) % 60) + 60) % 60;
    out.push({ year: y, ganji: GAN[t % 10] + JI[t % 12], ss: sipseong(dg, t % 10) });
  }
  return out;
}
function taekil(idx, from, days = 30) {   // 길일/피할 날 — 일진은 아침 문안(v16)과 같은 (JDN+49)%60
  const good = [], bad = [];
  for (let k = 1; k <= days; k++) {
    const t = new Date(from.getTime() + k * 86400000);
    const g = (jdn(t.getFullYear(), t.getMonth() + 1, t.getDate()) + 49) % 60;
    const dj = g % 12, label = (t.getMonth() + 1) + "/" + t.getDate();
    if (dj === (idx.dJ + 6) % 12) { bad.push({ label, why: "일지와 충하는 날" }); continue; }
    const why = [];
    if (dj === AMROK[idx.dG]) why.push("암록일");
    if (CHEONEUL[idx.dG].includes(dj)) why.push("귀인일");
    if (dj === YUKHAP[idx.dJ]) why.push("일지와 합하는 날");
    if (why.length) good.push({ label, why: why.join("·") });
  }
  return { good: good.slice(0, 3), bad: bad.slice(0, 2) };
}
const JOB_EL = { 금: "금속·기계·건설장비·귀금속·정밀·의료기기·법조 — 쇠 소리 나는 일", 목: "교육·출판·목재·섬유·기획", 수: "유통·무역·수산·정보·물류", 화: "전기·전자·미디어·조명·요식", 토: "부동산·건축·농업·중개·컨설팅" };
/* 프로필 주입용 텍스트 — 문자열 확장이지 구조 변경이 아니다. 세운·띠는 리포트 배경 전용임을 문장으로 명시 */
function myeongsikText(saju, sex, now) {
  const idx = saju && saju.idx;
  if (!idx) return "";
  const dist = Object.entries(sipseongDist(idx)).sort((a, b) => b[1] - a[1]);
  const sins = sinsalOf(idx);
  const se = seun(idx.dG, now.getFullYear(), 5);
  const tk = taekil(idx, now);
  const maxEl = Object.entries(saju.counts).sort((a, b) => b[1] - a[1])[0][0];
  return "\n십성 분포(일간 " + GAN[idx.dG] + " 기준): " + dist.map(([k, v]) => k + " " + v).join(" · ") + (sex ? "" : " — 성별 미입력: 자식운 등 남녀 구분 해석은 말하지 않는다")
    + "\n신살: " + (sins.length ? sins.map((x) => x.name).join(" · ") : "두드러진 것 없음")
    + "\n세운(향후 5년 · 리포트 배경 전용, 판결의 시계로 쓰지 말 것): " + se.map((x) => x.year + " " + x.ganji + "(" + x.ss + ")").join(" / ")
    + "\n띠 인연(정보 제시까지만 — 판결 근거 아님): 충 " + TTI[(idx.yJ + 6) % 12] + "띠 · 원진 " + TTI[WONJIN[idx.yJ]] + "띠 — 큰돈·보증은 신중히"
    + (tk.good.length ? "\n길일(30일 내): " + tk.good.map((d) => d.label + "(" + d.why + ")").join(" · ") + (tk.bad.length ? " / 피할 날: " + tk.bad.map((d) => d.label).join(" · ") : "") : "")
    + "\n직업 기운: 일간 " + GAN_EL[idx.dG] + " — " + JOB_EL[GAN_EL[idx.dG]] + (maxEl !== GAN_EL[idx.dG] ? " (분포 최다 " + maxEl + " 기질 겸함)" : "");
}
/* ── 명리 심화 끝 ── */

/* v101: 상세 리포트(타고난 그릇) — 카드 뒷면 reasons 밖 별도 블록. 전부 클라이언트 계산이라 지어낼 수 없다.
   서사 순서는 철학관 리딩을 따른다: 타고난 것 → 흐름 → 사람 → 날 → 일 ("나→시간→관계→행동"으로 좁혀지는 순서) */
function MyeongsikReport({ saju, sex, birth }) {
  const [open, setOpen] = useState(false);
  const idx = saju && saju.idx;
  if (!idx) return null;
  const now = new Date();
  const dist = Object.entries(sipseongDist(idx)).sort((a, b) => b[1] - a[1]);
  /* 십성 동률 처리(실사고 2026-08-02): 상위 3개만 자르면 동률일 때 어느 게 뽑히는지가 실력이 아니라
     객체 삽입 순서다 — 일곱 개 전부 1인 명식에서 근거 없는 셋이 대표가 됐다. 3위와 같은 값은 전부 보여준다. */
  const cutV = dist.length > 3 ? dist[2][1] : 0;
  const top = dist.filter(([, v], i) => i < 3 || v === cutV);
  /* 힘의 저울 — 간이 신강·신약(통설: 일간 제외 비겁+인성 4↑ 신강 · 2↓ 신약). 월령 가중 없는 개수 판정이라
     '간이'를 명시한다. 근거: 전략로그 2026-08-02 딥리서치(사자사주·정해만세력 조견 기준) */
  const grp = (ks) => dist.filter(([k]) => ks.includes(k)).reduce((a, [, v]) => a + v, 0);
  const support = grp(["비견", "겁재", "정인", "편인"]);
  const strength = support >= 4 ? "신강" : support <= 2 ? "신약" : "중간";
  /* 비어 있는 자리 — 없는 것이 있는 것만큼 말해준다(십성 5그룹 + 오행). 동률 명식에서 특히 이게 유일한 특징이 된다 */
  const GRP5 = { "나를 받치는 힘(비겁)": ["비견", "겁재"], "표현·창작(식상)": ["식신", "상관"], "재물(재성)": ["정재", "편재"], "조직·자리(관성)": ["정관", "편관"], "배움·받는 복(인성)": ["정인", "편인"] };
  const lackSS = Object.entries(GRP5).filter(([, ks]) => grp(ks) === 0).map(([n]) => n);
  const lackEl = Object.entries(saju.counts).filter(([, v]) => v === 0).map(([k]) => k);
  const sins = sinsalOf(idx);
  const se = seun(idx.dG, now.getFullYear(), 5);
  /* 대운 사다리 — 흐름의 주 시계는 대운이고 세운은 배경인데, 리포트에 보조 축(세운)만 있고 주 축이 없었다.
     성별이 있어야 방향(순행/역행)이 선다. daeun()을 10년 간격으로 호출해 여든까지 편다. */
  const ladder = [];
  if (sex && birth && birth.y) {
    try {
      for (let a = 1; a <= 71; a += 10) {
        const du = daeun(+birth.y, +birth.m, +birth.d, birth.noHour ? 12 : +birth.h, birth.noHour || birth.min === "" ? 0 : +birth.min, !!birth.noHour, cityLon(birth.city), sex === "M", +birth.y + a - 1);
        if (du && !du.pre && !ladder.some((x) => x.startAge === du.startAge)) ladder.push(du);
      }
    } catch (_) { /* 대운 실패가 리포트 전체를 죽이면 안 된다 */ }
  }
  const nowAge = birth && birth.y ? now.getFullYear() - +birth.y + 1 : null;
  /* 택일 가드 — 미래 생일(출산 예정 등)에 "이번 주 좋은 날"을 주는 건 오답. 14세 게이트가 있어 인앱에선
     드물지만, 값이 틀릴 조건을 아는데 그대로 내보내지 않는다. */
  const bornYet = !(birth && birth.y && new Date(+birth.y, (+birth.m || 1) - 1, +birth.d || 1) > now);
  const tk = bornYet ? taekil(idx, now) : { good: [], bad: [] };
  const jael = grp(["정재", "편재"]);
  const child = sex ? grp(sex === "M" ? ["정관", "편관"] : ["식신", "상관"]) : null;
  return (
    <div className="msr" onClick={(e) => e.stopPropagation()}>
      <button className="msrbtn" onClick={() => { if (!open) track("report_opened", { sinsal: sins.length, top_ss: dist[0] ? dist[0][0] : null, strength, lack_el: lackEl.join("") || null }); setOpen(!open); }}>{open ? "▴ 타고난 그릇 접기" : "▾ 타고난 그릇 — 명식 깊이 보기"}</button>
      {open && (
        <div className="msrbody">
          <p className="msrh">타고난 것</p>
          {top.map(([k, v]) => <p key={k}><b>{k} {v}</b> — {SS_TIP[k]}</p>)}
          {jael >= 2 && <p><b>재물 자리 {jael}</b> — 재물이 명식에 실려 있어. 흐름이 열릴 때 크게 받는 그릇이야</p>}
          {child != null && child >= 1 && <p><b>자식 인연</b> — 명식에 자식 복이 들어 있어</p>}
          {sins.map((x) => <p key={x.name}><b>{x.name}</b> — {x.tip}</p>)}
          {(lackSS.length > 0 || lackEl.length > 0) && (
            <p><b>비어 있는 자리</b> — {[...lackEl.map((e) => `${e} 기운`), ...lackSS].join(" · ")}. 없는 건 흠이 아니라 채우는 자리야{lackEl.length ? " — 그 기운이 대운으로 들어오는 때를 아래 흐름에서 봐" : ""}</p>
          )}
          <p><b>힘의 저울</b> — {strength} · 나를 받치는 글자 {support}개 <span className="dim">(간이 판정: 비겁+인성 4개 이상 신강 · 2개 이하 신약)</span>{strength === "신약" ? " — 그릇보다 팔 힘이 늦게 붙는 몸이야. 받쳐주는 운이 올 때 크게 받아" : strength === "신강" ? " — 제 힘으로 미는 몸이야. 쓸 곳(일·표현)이 열릴 때 풀려" : ""}</p>
          <p className="msrh">흐름</p>
          {ladder.length > 0 && ladder.map((du) => {
            const ss = sipseong(idx.dG, GAN.indexOf(du.ganji[0]));
            const isNow = nowAge != null && nowAge >= du.startAge && nowAge <= du.endAge;
            const fills = lackEl.includes(du.el);
            return <p key={du.startAge}><b>{du.startAge}~{du.endAge}세 {du.ganji}</b> — {ss}·{du.el} 기운{fills ? " · 비어 있던 " + du.el + "이 채워지는 구간" : ""}{isNow ? " ◂ 지금" : ""}</p>;
          })}
          {ladder.length === 0 && <p className="dim">대운(10년 단위 큰 흐름)은 성별이 있어야 방향이 서 — 프로필에 성별을 더하면 여든까지 펼쳐줄게</p>}
          {se.map((x) => <p key={x.year} className="msrsub"><b>{x.year} {x.ganji}</b> — {x.ss}의 해{x.ss === "정재" || x.ss === "편재" ? " · 재물이 움직여" : x.ss === "정관" || x.ss === "편관" ? " · 자리·명예가 걸려" : x.ss === "비견" || x.ss === "겁재" ? " · 경쟁·구설 조심" : ""}</p>)}
          <p className="msrh">사람</p>
          <p><b>충 {TTI[(idx.yJ + 6) % 12]}띠 · 원진 {TTI[WONJIN[idx.yJ]]}띠</b> — 미워하란 게 아니라, 큰돈·보증만 조심하란 뜻이야</p>
          {bornYet && <p className="msrh">날</p>}
          {bornYet && (tk.good.length ? <p><b>좋은 날</b> — {tk.good.map((d) => d.label).join(" · ")}{tk.bad.length ? <> / <b>피할 날</b> — {tk.bad.map((d) => d.label).join(" · ")}</> : null}</p> : <p>이번 달엔 특별히 가리는 날 없음</p>)}
          <p className="msrh">일</p>
          <p><b>{GAN_EL[idx.dG]} 기운</b> — {JOB_EL[GAN_EL[idx.dG]]}</p>
        </div>
      )}
    </div>
  );
}

const ganjiIdx = (g, j) => { for (let i = 0; i < 60; i++) if (i % 10 === g && i % 12 === j) return i; return 0; };
function daeun(y, m, d, h, mi, hourUnknown, lon, isMale, nowY) {   // v25: 대운 — 현재 인생 10년 흐름(성별 필요)
  const jdBirth = jdFromKST(y, m, d, hourUnknown ? 12 : h, hourUnknown ? 0 : (mi || 0));
  const lam = sunLongitude(jdBirth);
  const beforeIpchun = m <= 2 && !(lam >= 315);
  const sy = beforeIpchun ? y - 1 : y;
  const yG = ((sy - 4) % 10 + 10) % 10;
  const mn = Math.floor(((lam - 315 + 360) % 360) / 30) + 1;
  const mJ = (mn + 1) % 12, mG = ((yG % 5) * 2 + 2 + (mn - 1)) % 10;
  const mIdx = ganjiIdx(mG, mJ);
  const forward = (yG % 2 === 0) === isMale;                       // 양남·음녀=순행 / 음남·양녀=역행
  const seg0 = Math.floor(((lam - 315 + 360) % 360) / 30);         // 대운수: 순행=다음 節까지·역행=이전 節까지, 일수/3 반올림
  let j = jdBirth, days = 15;
  for (let i = 0; i < 1800; i++) { j += forward ? 0.02 : -0.02; if (Math.floor(((sunLongitude(j) - 315 + 360) % 360) / 30) !== seg0) { days = Math.abs(j - jdBirth); break; } }
  const num = Math.max(1, Math.min(10, Math.round(days / 3)));
  const age = nowY - y + 1;                                        // 세는나이 근사(10년 버킷엔 충분)
  const dir = forward ? "순행" : "역행";
  if (age < num) return { pre: true, num, dir };
  const step = Math.floor((age - num) / 10) + 1;                   // 1대운 = 월주 ±1
  const idx = ((mIdx + (forward ? step : -step)) % 60 + 60) % 60;
  const startAge = num + (step - 1) * 10;
  return { pre: false, ganji: GAN[idx % 10] + JI[idx % 12], el: GAN_EL[idx % 10], startAge, endAge: startAge + 9, num, dir };
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
const MOON_DRIVE = { 상현달: "'조금 더'를 향해 차오르는", 보름달: "숨지 않고 빛나려는", 초승달: "새로 시작하기를 두려워하지 않는", 새달: "빈 곳을 스스로 채워가는", "차오르는 달": "완성을 향해 나아가는", "기우는 달": "비울 줄 아는", 하현달: "덜어내며 또렷해지는", 그믐달: "끝에서 다시 시작하는" };
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
const VALUES16 = ["안정", "성장", "자유", "인정", "관계", "성취", "즐거움", "의미", "돈", "건강", "용기", "모험", "창조", "평온", "아름다움", "몰입"]; // v37: '버리기 죄책감' 항목 배제 원칙 — 가족·정직 제외, 모험·아름다움 추가(4×4 복원)
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
function lunar2solar(ly, lm, ld, wantLeap) {   // v25: 음력→양력 (LUNAR 표 1900~2030, solar2lunar의 역)
  const rec = LUNAR[ly]; if (!rec) return null;
  const leap = rec[1], ms = rec[2]; let off = 0;
  for (let i = 0; i < ms.length; i++) {
    let mm = i + 1, isLeapSlot = false;
    if (leap > 0) { if (i + 1 === leap + 1) { mm = leap; isLeapSlot = true; } else if (i + 1 > leap) mm = i; }
    if (mm === lm && isLeapSlot === !!wantLeap) {
      if (ld < 1 || ld > ms[i]) return null;
      const ord = rec[0] + off + (ld - 1);
      const dt = new Date((ord - 719163) * 86400000);
      return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    }
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
const EL_COLOR = { 수: ["#2a6bd4","#7fd4ff","#0a1f4d"], 화: ["#e04d2a","#ffb36b","#3d0f0a"], 목: ["#2ab06b","#a8f0c0","#0a3d22"], 금: ["#8fb0e6","#e8f2ff","#1d2436"], 토: ["#c98f3d","#ffe9ad","#3d2a0a"] };
const DIMQ = [   // v24: MBTI 픽션 — 한 기억씩 순차로 묻는다
  ["EI", "기운을 어디서 얻고 있었지?", "E", "사람들 속에서 기운을 얻는 쪽", "I", "혼자일 때 차오르는 쪽"],
  ["SN", "네 눈은 어디를 보고 있었지?", "N", "아직 오지 않은 것을 보는 쪽", "S", "눈앞의 확실한 것을 보는 쪽"],
  ["TF", "마음이 흔들릴 때, 무엇이 먼저였지?", "T", "머리가 먼저 정리하는 쪽", "F", "마음이 먼저 움직이는 쪽"],
  ["JP", "너의 길은 어떤 모양이었지?", "J", "정해둔 길이 편한 쪽", "P", "열어둔 길이 편한 쪽"],
];
/* v14: 지표별 독립 시각축을 위한 색 유틸 — 원소 기본색을 별자리로 hue 회전 */
const ZO_ORDER = ["양자리","황소자리","쌍둥이자리","게자리","사자자리","처녀자리","천칭자리","전갈자리","사수자리","염소자리","물병자리","물고기자리"];
const FORM_STEPS = ["사주 여덟 글자를 세는 중", "달의 자리를 맞추는 중", "별자리를 포개는 중", "타고난 결을 읽는 중", "수(數)의 울림을 듣는 중", "흐름을 짚어 매듭짓는 중"];  // v70 형성 로딩 — 실제로 읽는 지표들
const QHINTS = ["밤 11시, 전남친에게 카톡 보낼까?", "받은 이직 제안, 수락할까?", "이 사업 지금 시작해도 될까?", "3년 사귄 사람이랑 결혼해도 될까?", "지금 이 회사 그만둘까?", "3주째 답 없는 썸, 한 번 더 연락할까?", "오늘 저녁 뭐 먹지?", "무리해서 이 집 계약할까?", "지금 고백해도 될까?", "이 관계, 계속 이어가도 될까?"];  // v71 타겟이 할 법한 질문 롤링
const ZODIAC_ANIMAL = ["쥐","소","호랑이","토끼","용","뱀","말","양","원숭이","닭","개","돼지"];  // v64 연지(yJ) → 띠
const WISP_GAIT = ["종종거리다 다다닥 내달릴","느긋하게 뚜벅뚜벅 걸을","숨죽였다 덮치듯 뛰어오를","깡충깡충 뛰어다닐","길게 굽이치며 헤엄칠","스르르 미끄러질","바람처럼 내달릴","총총 뛰다 폴짝 옆걸음질할","그네 타듯 휙휙 방향을 바꿀","콕콕 쪼다 푸드덕거릴","달려왔다 저만치 갔다 할","뒤뚱뒤뚱 걸을"];  // 셰이더 12 시그니처와 1:1
function _hexToHsl(hex){const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6;}return[h*360,s,l];}
function _hslToHex(h,s,l){h=(((h%360)+360)%360)/360;const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q,f=(t)=>{t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;},to=(x)=>Math.round(f(x)*255).toString(16).padStart(2,"0");return"#"+to(h+1/3)+to(h)+to(h-1/3);}
const rotHue=(hex,deg)=>{const[h,s,l]=_hexToHsl(hex);return _hslToHex(h+deg,s,l);};
const seedRnd=(str)=>{let h=7;for(const c of String(str))h=(h*31+c.charCodeAt(0))>>>0;return()=>((h=(h*1664525+1013904223)>>>0)/2**32);};

function GuardianCanvas({ saju, zo, mbti, num, moon, birth, agitateRef, reactRef, restRef, size = 340 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    // ── v14: 지표 → 독립 시각축 매핑 (개인마다 고유한 지문) ──
    const E = mbti?.[0] === "E", N = mbti?.[1] === "N", T = mbti?.[2] === "T", P = mbti?.[3] === "P";
    // 개인 시드: 생일·성격·별자리 전체에서 파생 → 입자 배치·hue 지터가 사람마다 고정
    const seedStr = `${saju.main}${zo?.name || ""}${mbti || ""}${num || ""}${saju.pillars?.일 || ""}`;
    const srnd = seedRnd(seedStr);
    // ── v28: 심화 지표 → 서로 다른 시각 채널 (사주 5형태 안에서 사람마다 유일해지도록) ──
    const _b = birth || {};
    const _jd = _b.y ? jdn(+_b.y, +_b.m, +_b.d) : 0, _nn = _jd - 584283;
    const tzSign = (((_nn + 19) % 20) + 20) % 20;               // 마야 20날개 → 코어 문양
    const tzTone = (((_nn + 3) % 13) + 13) % 13 + 1;            // 13톤 → 코어 층·강도
    const nayinIdx = Math.max(0, NAYIN.indexOf(saju.nayin));    // 납음 30 → 움직임 결
    const nayFreq = 0.4 + (nayinIdx % 10) * 0.14, nayAmp = 0.32 + Math.floor(nayinIdx / 10) * 0.26;
    let nakIdx = 0, duEl = null;
    try { const _mp = moonPlacements(+_b.y, +_b.m, +_b.d, +_b.h || 12, +_b.min || 0, !!_b.noHour); nakIdx = Math.max(0, NAKSHATRA.indexOf(_mp.nakshatra)); } catch (_) {}
    try { if (_b.sex) { const _du = daeun(+_b.y, +_b.m, +_b.d, _b.noHour ? 12 : +_b.h, _b.noHour || _b.min === "" ? 0 : +_b.min, !!_b.noHour, cityLon(_b.city), _b.sex === "M", new Date().getFullYear()); if (_du && !_du.pre) duEl = _du.el; } } catch (_) {}
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
    const accent = rotHue(EL_COLOR[subEl][1], zoDeg * 0.5 + nakIdx * 5);   // v28: 나크샤트라 27 → 강조색 갈래
    // 축4 대칭수 = 수비학 라이프패스(구조적 지문)
    const lp = num || 5, arms = 3 + ((lp - 1) % 5);              // v23: 3~7 상한 — 다대칭=문양화 방지
    // 축5 밀도/반짝임/속도/질서 = MBTI (v17-A: 유속장 리라이트 — 입자 대폭 증량)
    const n = E ? 4200 : 3200, speed = P ? 1.15 : 0.78, chaos = T ? 0.6 : 1.35; // T=정연, F=유동
    // 축6 헤일로(전체 밝기·크기) = 태어난 밤의 달 위상
    const MOON_I = { 새달: 0, 초승달: 1, 상현달: 2, "차오르는 달": 3, 보름달: 4, "기우는 달": 3, 하현달: 2, 그믐달: 1 };
    const lum = 0.55 + (MOON_I[moon?.name] ?? 2) * 0.11; // 0.55~0.99
    const w = size, cx = w / 2, cy = w / 2, R = w * 0.42 * (E ? 1.06 : 0.9); // v27: 외향=확장·내향=응축
    // v4: 어셈블 연출 — 화면 가장자리에 흩어진 채 시작, 난류를 타고 제 자리로 모인다 (v14: 시드 고정)
    const ps = Array.from({ length: n }, (_, i) => {
      const sa = srnd() * Math.PI * 2, sr = R * (1.1 + srnd() * 0.9);
      // o를 arms(대칭수)에 스냅 → 라이프패스가 갈래/빛살 수를 결정
      const arm = Math.floor(srnd() * arms);
      const sx = cx + Math.cos(sa) * sr, sy = cy + Math.sin(sa) * sr;
      // v17-A: x/y = 현재 실위치(유속장이 갱신), vx/vy = 속도 → 흐름에 방향과 기억이 생긴다
      return { u: srnd(), v: srnd(), o: arm + srnd() * 0.6, s: srnd(), arm,
        ph: srnd() * Math.PI * 2, sx, sy, x: sx, y: sy, vx: 0, vy: 0,
        dly: srnd() * 0.35, acc: srnd() < 0.24 }; // 약 24%는 강조색
    });
    let t = 0, raf, lastHeavy = 0;
    const born = performance.now();
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    const place = (p) => {
      const g = 0.6 + 0.4 * Math.sin(t * 1.2 + p.ph);
      if (form === "화") { // 불: arms개 불꽃 혀가 솟는다 (라이프패스=혀 수)
        const rise = (p.v + t * 0.12 * (0.5 + p.s)) % 1;
        const armX = (p.arm - (arms - 1) / 2) / Math.max(arms, 1);
        const sway = Math.sin(rise * 6 + t * 2 + p.ph) * (0.5 - Math.abs(p.u - 0.5)) * R * 0.5;
        return [cx + armX * R * 1.5 + (p.u - 0.5) * R * 0.42 * (1 - rise * 0.6) + sway, cy + R * 0.95 - rise * R * 2.1, 1 - rise];
      }
      if (form === "수") { // 물: arms개 물결 층 (라이프패스=층 수)
        const band = (p.arm - (arms - 1) / 2) / Math.max(arms, 1);
        return [cx + (p.u - 0.5) * R * 2.1, cy + band * R * 1.55 + (p.v - 0.5) * R * 0.24 + Math.sin(p.u * 8 + t * 1.8 + p.ph) * R * 0.15, g];
      }
      if (form === "목") { // 나무: arms개 갈래로 가지치며 퍼짐 (라이프패스=갈래 수)
        const spread = Math.min(arms, 7), ang = -Math.PI / 2 + ((p.arm % spread) - (spread - 1) / 2) * 0.42 + Math.sin(t + p.ph) * 0.08, len = p.v * R * 1.9;
        return [cx + Math.cos(ang) * len + Math.sin(p.u * 10 + t) * p.v * R * 0.3, cy + R * 0.6 + Math.sin(ang) * len, g];
      }
      if (form === "금") { // 벼려진 빛(v18): 회전하는 빛살이 경계 안에서 숨쉬며 맴돈다 — 폭발이 아니라 존재
        const bw = 0.12 + 0.55 / arms;                          // 팔이 적을수록 넓게 — 3갈래도 존재감
        const lead = p.arm === 0 ? 1.16 : 1 - (p.arm % 3) * 0.05; // v23: 머리 갈래 — 완전 대칭 파괴
        const ang = (p.arm / arms) * Math.PI * 2 + (p.u - 0.5) * bw + t * 0.15;
        const rr = (0.14 + 0.78 * p.v + 0.05 * Math.sin(t * 1.3 + p.ph)) * R * lead;
        return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.94, (0.45 + 0.55 * (1 - p.v)) * (p.arm === 0 ? 1.1 : 1)];
      }
      const ang = p.u * Math.PI * 2; // 흙: arms갈래로 부푼 덩어리 (라이프패스=봉우리 수)
      const lobe = 1 + 0.24 * Math.cos(arms * (ang + t * 0.12));
      const rr = Math.pow(p.v, 0.5) * R * 0.9 * lobe;
      return [cx + Math.cos(ang + t * 0.15) * rr, cy + Math.sin(ang + t * 0.15) * rr * 0.92, g];
    };
    const draw = () => {
      const nowMs = performance.now();
      const agi = agitateRef && agitateRef.current ? 1 : 0;  // v6: 판결 직전 요동(게이트 열리기 전)
      const reacting = reactRef && reactRef.current && (nowMs - reactRef.current.t0) < 1800; // v28 반응 진행중
      const restMs = restRef && restRef.current ? restRef.current : 0; if (restMs && !agi && !reacting && nowMs - lastHeavy < restMs) { raf = requestAnimationFrame(draw); return; } // v30: 카드 정독 중 ~3fps로 사실상 정지
      lastHeavy = nowMs;
      t += 0.01 * speed;
      const age = (nowMs - born) / 1000;                     // 등장 후 경과(초)
      const breathe = 0.9 + (0.1 + agi * 0.1) * Math.sin(t * (0.8 + agi * 5)); // 호흡 글로우(레퍼런스 A)
      let gExpand = 0, gBright = 1;                          // v28: 판결 반응(연기)
      if (reactRef && reactRef.current) {
        const rt = (performance.now() - reactRef.current.t0) / 1000;
        const env = Math.max(0, 1 - rt / 1.7) * Math.min(1, rt / 0.18);  // 0.18s 상승→1.7s 소멸
        const dir = reactRef.current.dir;
        if (dir === "GO") { gExpand = env * 0.5; gBright = 1 + env * 0.5; }          // 솟구쳐 펼침·밝아짐
        else if (dir === "STOP") { gExpand = -env * 0.45; gBright = 1 - env * 0.55; } // 수축·어두워짐(가로막음)
        else { gExpand = env * 0.1 * Math.sin(rt * 5); gBright = 1 - env * 0.12; }    // HOLD: 잔잔히 맥동(재움)
      }
      // v17-A ① 잔상: 배경색을 칠하면 stage 그라디언트를 가리므로, destination-out으로
      //   알파만 서서히 빼 '빛이 그린 궤적'을 남긴다(투명 캔버스 유지). 요동 시 더 빨리 지워 반응성 확보.
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0,0,0,${0.10 + agi * 0.06})`;
      ctx.fillRect(0, 0, w, w);
      ctx.globalCompositeOperation = "lighter";
      const gcy = form === "화" ? cy + R * 0.3 : cy;
      const gr = ctx.createRadialGradient(cx, gcy, 1, cx, gcy, R * 0.62 * breathe);
      gr.addColorStop(0, c2 + "0c"); gr.addColorStop(0.5, c1 + "07"); gr.addColorStop(1, "transparent");
      ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, gcy, R * 0.62 * breathe, 0, 7); ctx.fill();
      // v17-A ② 유속장: 각 입자에 속도. 유사 컬 노이즈(위치 기반 회전 흐름)로 밀되,
      //   오행 형태(place)로 스프링 복원 → 흐르면서도 형상을 유지. '살아있음'의 핵심인 방향·인과가 생긴다.
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        let [tx, ty, depth] = place(p);
        if (gExpand) { tx = cx + (tx - cx) * (1 + gExpand); ty = cy + (ty - cy) * (1 + gExpand); }
        const k = easeOut(Math.max(0, Math.min(1, (age - p.dly) / 2.4)));
        const fx = Math.sin(p.y * 0.012 + t * 0.9 + p.ph) + Math.sin(p.y * 0.022 - t * 0.6) + Math.sin(t * nayFreq + p.o) * nayAmp;
        const fy = Math.cos(p.x * 0.013 - t * 0.8) + Math.cos(p.x * 0.019 + t * 0.5 + p.ph) + Math.cos(t * nayFreq * 1.1 + p.ph) * nayAmp;
        const flow = (0.16 + 0.55 * (1 - k)) * chaos * (0.5 + p.s); // 모이기 전 흐름 강, 모인 뒤 잔류
        const spring = 0.006 + 0.032 * k;                          // 모일수록 형태로 당김 강해짐
        const ax = (tx - p.x) * spring + fx * flow + (agi ? Math.sin(t * 9 + p.o) * 1.5 : 0);
        const ay = (ty - p.y) * spring + fy * flow + (agi ? Math.cos(t * 8 + p.ph) * 1.5 : 0);
        p.vx = p.vx * 0.9 + ax; p.vy = p.vy * 0.9 + ay;
        const sp = Math.hypot(p.vx, p.vy), lim = 3.0 + agi * 4;    // 속도 상한(폭주 방지)
        if (sp > lim) { p.vx *= lim / sp; p.vy *= lim / sp; }
        p.x += p.vx; p.y += p.vy;
        const tw = N ? (0.55 + 0.45 * Math.sin(t * 5 + p.o * 7)) : 0.9;
        ctx.globalAlpha = Math.max(0, depth) * tw * (0.4 + p.s * 0.5) * (0.3 + 0.7 * k) * lum * gBright;
        ctx.fillStyle = p.acc ? accent : (p.o % 3 < 1 ? c2 : c1);
        const r = (0.7 + p.s * 1.1) * (T ? 0.84 : 1.24);           // v27: 사고=날카롭게·감정=부드럽게(fillRect가 arc보다 빠름)
        ctx.fillRect(p.x - r * 0.5, p.y - r * 0.5, r, r);
      }
      if (duEl) {                                                // v28: 대운 — 현재 인생 계절의 기운색 아우라
        const da = ctx.createRadialGradient(cx, cy, 1, cx, cy, R * 0.5 * breathe);
        da.addColorStop(0, EL_COLOR[duEl][0] + "10"); da.addColorStop(1, "transparent");
        ctx.globalAlpha = 1; ctx.fillStyle = da; ctx.beginPath(); ctx.arc(cx, cy, R * 0.5 * breathe, 0, 7); ctx.fill();
      }
      {                                                          // v28: 마야 촐킨 코어 문양 — 20날개=마디 수·13톤=층/강도 (사람마다 다른 심장)
        const nodes = 3 + tzSign % 6, rings = 1 + Math.floor((tzTone - 1) / 5), crot = t * (0.28 + (tzSign % 4) * 0.14);
        for (let ring = 0; ring < rings; ring++) {
          const rr = R * (0.09 + ring * 0.065);
          for (let kk = 0; kk < nodes; kk++) {
            const a = crot * (ring % 2 ? -1 : 1) + (kk / nodes) * Math.PI * 2 + (tzSign % 5) * 0.31;
            const nx = cx + Math.cos(a) * rr, ny = cy + Math.sin(a) * rr * 0.96;
            const pz = 2.4 + tzTone * 0.16;
            ctx.globalAlpha = Math.min(0.9, (0.32 + tzTone * 0.028) * (0.6 + 0.4 * Math.sin(t * 2 + kk + ring)) * lum);
            const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, pz);
            ng.addColorStop(0, c2); ng.addColorStop(0.5, c1); ng.addColorStop(1, "transparent");
            ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(nx, ny, pz, 0, 7); ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [saju, zo, mbti, size, birth && birth.y, birth && birth.sex, birth && birth.name]);
  return <canvas ref={ref} data-renderer="2d" width={size} height={size} style={{ display: "block", WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 58%, transparent 88%)", maskImage: "radial-gradient(circle at 50% 50%, #000 58%, transparent 88%)" }} />;
}


/* ───── v31: WebGL 수호신 (B단계) — GPU 입자 유속, 무(無)구심점 흐름. 실패 시 Canvas2D 폴백 ─────
   설계: 입자 위치를 정점 셰이더에서 시간 함수로 계산(상태 없음 → 버퍼 피드백 불필요, 메인스레드 해방).
   유일성 재배선: 촐킨(20날개×13톤)=가닥 수·꼬임(코어 문양 대체) · 납음=흐름 결 · 나크샤트라=강조색 · 대운=색조 틴트.
   형태(오행 5): 화=꼬여 오르는 리본 기둥 · 수=흐르는 물결 층 · 목=뻗는 가지 흐름 · 금=궤도 빛줄기 · 토=중심 없는 난류 융기.
   레퍼런스: 불 리본·유속 소용돌이·난류 블룸(2026-07-21 사용자 영상) — 밝은 중앙 코어 없이 흐름 자체로 존재. */
/* ═══════════════ 수호신 튜닝값 — 단일 진실 원천 ═══════════════
   여기 있는 값은 두 렌더러(gl / sim)가 함께 쓴다. 예전엔 같은 값이 셰이더마다
   따로 박혀 있어서, 한쪽만 고치면 화면과 시뮬레이션의 기준이 조용히 어긋났다(실제 사고).
   이제 아래 한 곳만 고치면 양쪽이 같이 바뀐다. 값을 바꿀 땐 이 블록만 보면 된다.
   확인: npm run 검진                                                        */
const TUNE = {
  stg: 0.68,        // 응집 시차 — 손끝으로 모이는 순서(클수록 알알이 늦게 도착)
  starLo: 0.42,     // 별 아닌 입자의 밝기 하한
  starHi: 1.7,      // 별 입자의 밝기 상한(대비)
  nE: 34000,        // 입자 수 — 외향(E)
  nI: 27000,        // 입자 수 — 내향(I)
};
const GL_VERT = `
precision highp float;
attribute vec4 a_r0; // x:u y:v z:s w:size·위상
attribute vec4 a_r1; // x:ph y:dly z:colorPick w:strandPick
uniform float u_hold,u_beat,u_t,u_form,u_R,u_arms,u_strands,u_twist,u_speed,u_chaos,u_nayF,u_nayA,u_expand,u_agi,u_k,u_ps,u_lum,u_twk,u_psMul,u_focal,u_touchAmt,u_breath,u_trailLive,u_zodiac;
uniform vec2 u_touch,u_touchVel;
uniform vec4 u_trail[10];
varying float v_a; varying float v_pick; varying float v_star;
float hash21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); float a=hash21(i),b=hash21(i+vec2(1.0,0.0)),c=hash21(i+vec2(0.0,1.0)),d=hash21(i+vec2(1.0,1.0)); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
vec2 curl2(vec2 p){ float e=0.12; float x1=vnoise(p+vec2(0.0,e)),x2=vnoise(p-vec2(0.0,e)),y1=vnoise(p+vec2(e,0.0)),y2=vnoise(p-vec2(e,0.0)); return vec2(x1-x2,-(y1-y2))/(2.0*e); }
// ─── v64 띠 정령: 12지지 걸음걸이 시그니처. 닫힌형 경로(위상 워핑)라 stateless 연속 ───
vec2 wispLeader(float tt){
  float zi=u_zodiac;
  float w0=0.3; float th=0.0; vec2 loc=vec2(0.0); float Rorb=0.5;  // v65 궤도주기 12s+ 테더링(명상 위계)
  if(zi<0.5){        th=tt*w0*1.3+0.4*sin(tt*1.1)+0.15*sin(tt*4.7+1.3); loc.y+=0.008*sin(tt*21.0); Rorb*=0.94+0.05*sin(tt*3.3); }      // 자·쥐 종종+다다닥
  else if(zi<1.5){   th=tt*w0*0.42; loc.y+=-0.012+0.02*abs(sin(tt*0.85)); }                                                            // 축·소 뚜벅뚜벅
  else if(zi<2.5){   float po=pow(max(0.0,sin(tt*0.42)),8.0); th=tt*w0*0.7+0.85*po; Rorb*=1.0-0.22*po; }                               // 인·호랑이 잠행→도약
  else if(zi<3.5){   float hp=fract(tt*0.5); float hop=4.0*hp*(1.0-hp); th=tt*w0*0.9+0.22*hop*sin(hp*3.1416); loc.y+=0.055*hop; }      // 묘·토끼 깡충
  else if(zi<4.5){   th=tt*w0*0.55; loc.y+=0.10*sin(th*2.0-tt*1.2); loc.x+=0.05*sin(th*3.0+tt*0.8); }                                  // 진·용 굽이침
  else if(zi<5.5){   th=tt*w0*0.75; loc+=vec2(cos(th),sin(th))*0.03*sin(tt*3.4); }                                                     // 사·뱀 미끄러짐
  else if(zi<6.5){   th=tt*w0*1.7+0.12*sin(tt*2.6); loc.y+=0.022*abs(sin(tt*2.6+0.7)); }                                               // 오·말 질주 캔터
  else if(zi<7.5){   float cp=pow(0.5+0.5*sin(tt*0.37+2.0),10.0); th=tt*w0*0.8+0.1*sin(tt*2.1); loc.y+=0.02*abs(sin(tt*2.1)); Rorb*=1.0+0.09*cp; } // 미·양 총총+옆폴짝
  else if(zi<8.5){   th=tt*w0+0.95*sin(tt*0.7)+0.25*sin(tt*1.9+0.8); loc.y+=-0.03*abs(cos(tt*1.7)); }                                  // 신·원숭이 그네 스윙
  else if(zi<9.5){   float pk=pow(max(0.0,sin(tt*4.2)),6.0)*step(0.2,sin(tt*0.7)); th=tt*w0*0.85+0.05*sin(tt*4.2); loc.y+=-0.05*pk; }  // 유·닭 콕콕(간헐·깊게)
  else if(zi<10.5){  th=tt*w0*1.4+0.2*sin(tt*0.9); loc.y+=0.018*abs(sin(tt*3.4)); Rorb*=0.8+0.2*sin(tt*0.5); }                         // 술·개 곁↔저만치
  else {             th=tt*w0*0.55; loc.x+=0.026*sin(tt*1.3); loc.y+=0.012*abs(sin(tt*2.6)); }                                         // 해·돼지 뒤뚱
  return vec2(cos(th),sin(th)*0.82)*Rorb+loc;
}
void main(){
  if(a_r1.w>1.5){                                        // ── v64 띠 정령 위스프(선두 1.5%, 지연 평가 꼬리) ──
    float zi=u_zodiac;
    float tailLen=(zi>3.5&&zi<4.5)?1.5:((zi>4.5&&zi<5.5)?1.1:0.9);   // 꼬리를 잔상 오프셋보다 길게(점선 방지)
    float lag=pow(a_r0.y,1.6)*tailLen;
    float lg=lag/tailLen;
    float tt=u_t-lag;
    vec2 lead=wispLeader(tt);
    vec2 tang=wispLeader(tt+0.06)-lead;
    tang=tang/max(length(tang),1e-4);
    vec2 nrm=vec2(-tang.y,tang.x);
    float spread=0.012+0.034*lg;
    vec2 body=tang*(a_r0.z-0.5)*spread*1.6+nrm*(a_r0.w-0.5)*spread;
    if(zi>4.5&&zi<5.5) body+=nrm*0.02*sin(u_t*3.4-lg*11.0);
    if(zi>3.5&&zi<4.5) body+=nrm*0.045*sin(u_t*1.6-lg*7.0);
    if(zi>8.5&&zi<9.5){ float flap=pow(0.5+0.5*sin(u_t*0.31),8.0); body*=1.0+1.6*flap; }
    vec2 wp=lead+body;
    float ta0=clamp(u_touchAmt,0.0,1.0);
    float startle=smoothstep(0.05,0.35,ta0)*smoothstep(0.95,0.45,ta0);
    if(zi<0.5||(zi>2.5&&zi<3.5)) wp+=nrm*0.08*startle*sin(u_t*14.0);
    float tg=smoothstep(0.15,0.9,ta0);
    if(zi>9.5&&zi<10.5) tg=smoothstep(0.05,0.5,ta0);
    if(zi>1.5&&zi<2.5) tg=smoothstep(0.45,1.0,ta0);
    wp=mix(wp, u_touch+lead*1.1+body, tg);                           // 터치: 은하 림 바깥을 공전
    gl_Position=vec4(wp,0.0,1.0);
    float head=1.0-lg;
    gl_PointSize=u_ps*u_psMul*(0.7+1.3*head*head);                   // 크고 부드러운 글로우(포화 슬랩 방지)
    float appear=smoothstep(0.78,1.0,u_k);
    float shimmer=0.85+0.15*sin(u_t*2.2+a_r1.x*20.0);
    v_a=(0.14+0.26*head*head)*appear*shimmer*u_lum*(0.82+0.18*u_breath); // 위계 7:3 + 호흡 동기
    v_pick=-1.0; v_star=1.0;
    return;
  }
  float t=u_t*u_speed;
  float tB=t;
  // v94 심장박동(럽-덥, ~54bpm) — 살아있는 것으로 읽히게. u_beat=0이면 꺼짐

  float strand=floor(a_r1.w*u_strands+0.0001);
  float sOff=strand/max(u_strands,1.0);
  vec2 p; float depth=1.0;
  if(u_form<0.5){ // 화 — 꼬여 오르는 리본 기둥 (가닥 해시로 유기화)
    float sh=fract(sin(strand*12.9898)*43758.5453);
    float s=fract(a_r0.y+t*(0.032+0.022*sh)*(0.5+a_r0.z));
    float y=mix(-1.05,1.05,s);
    float tw=s*u_twist*6.2832+t*(0.18+0.12*sh)+sOff*6.2832+sh*3.1;
    float rad=(0.13+0.1*sin(s*5.0+t*0.45+a_r1.x))*(0.5+0.9*a_r0.x)*(0.7+0.6*sh);
    p=vec2(sin(tw)*rad*2.1+0.16*sin(y*1.6+t*0.14+sh*6.2)+sin(s*3.0+t*0.2+sOff*9.0)*0.12*u_chaos, y);
    depth=0.45+0.55*(0.5+0.5*cos(tw));
    v_a=0.5+0.5*s;
  } else if(u_form<1.5){ // 수 — 흐르는 물결 층
    float dir=mod(strand,2.0)<0.5?1.0:-1.0;
    float x=mix(-1.25,1.25,fract(a_r0.x+t*0.03*dir*(0.6+a_r0.z)));
    float band=(sOff-0.5)*1.5;
    p=vec2(x, band+0.11*sin(x*3.6+t*0.55+a_r1.x)+(a_r0.y-0.5)*0.16);
    depth=0.5+0.5*a_r0.z;
    v_a=(1.0-abs(x)*0.45)*0.9;
  } else if(u_form<2.5){ // 목 — 뻗어 오르는 가지 흐름
    float br=mod(strand,u_arms);
    float ang=1.5708+(br-(u_arms-1.0)*0.5)*0.42+0.05*sin(t*0.35+br*2.0);
    float s=fract(a_r0.y+t*0.035*(0.5+a_r0.z));
    vec2 d=vec2(cos(ang),sin(ang));
    p=vec2((a_r0.x-0.5)*0.62,-0.8)+d*(s*1.8)+vec2(-d.y,d.x)*(a_r0.x-0.5)*(0.12+s*0.55)
      +vec2(sin(s*8.0+t*0.5+a_r1.x),cos(s*7.0-t*0.5))*0.05*s*u_chaos;
    depth=0.5+0.5*(1.0-s);
    v_a=(0.4+0.6*(1.0-s*0.55))*(0.4+0.6*smoothstep(0.0,0.2,s));
  } else if(u_form<3.5){ // 금 — 흘러내리는 용융 금속 (가닥이 굽이쳐 쏟아지며 아래로 수렴, 금속 광택 반짝임)
    float str=strand;
    float sh=fract(sin(str*12.9898)*43758.5453);
    float s=fract(a_r0.y+t*0.05*(0.7+0.5*sh));             // 위→아래 흐름(쏟아짐)
    float y=mix(1.0,-1.0,s);
    float lane=(str/max(u_strands,1.0)-0.5)*1.1;           // 가닥 별 가로 위치
    float coil=sin(y*3.0+str*2.4+t*0.5)*(0.13+0.09*u_twist)*(0.4+0.6*s); // 흘러내리며 감김
    float x=lane*(1.0-0.35*s)+coil+(a_r0.x-0.5)*0.14;      // 아래로 갈수록 모임(레인 지터로 평행 줄무늬 완화)
    p=vec2(x,y);
    depth=0.5+0.5*sh;
    float glint=step(0.93,a_r1.x)*0.7;                     // 금속 광택 반짝임(백화 완화)
    v_a=((0.5+0.5*(1.0-abs(x)*0.5))+glint)*smoothstep(0.0,0.07,s)*smoothstep(1.0,0.9,s);
  } else { // 토 — 중심 없는 난류 융기
    float rr=pow(a_r0.z,0.75)*0.88;
    float ang=a_r0.x*6.2832+t*0.05;
    p=vec2(cos(ang),sin(ang)*0.92)*rr;
    p+=u_chaos*0.16*vec2(sin(p.y*2.1+t*0.2+a_r1.x),cos(p.x*1.9-t*0.18+a_r0.y*6.0));
    p+=u_chaos*0.06*vec2(sin(p.y*5.3-t*0.3+a_r0.w*9.0),cos(p.x*4.7+t*0.26+a_r1.x*3.0));
    p*=1.0+0.03*sin(t*0.4);
    depth=0.5+0.5*a_r0.y;
    v_a=0.55+0.45*(1.0-rr*0.7);
  }
  float halo=step(0.84,a_r1.y);                              // v64 성간 먼지 헤일로(입자 16% 재배정)
  if(halo>0.5){
    float hr=0.55+1.05*pow(a_r0.z,0.6);                      // 0.55~1.6 광역 타원 원반
    float ha=a_r0.x*6.2832 + t*(0.05/(0.3+hr));              // 느린 차등 공전
    p=vec2(cos(ha),sin(ha)*0.62)*hr;
    depth=0.35+0.3*a_r0.y;
    v_a=0.10+0.10*a_r0.w;                                     // 본체의 ~1/8 밝기
  }
  // ── 살아있는 방향성 흐름 ── 등방성 노이즈(지직) → 코히런트 컬노이즈(연기·불 결) + 형태 방향
  vec2 fdir = u_form<0.5 ? vec2(0.0,1.0) : u_form<1.5 ? vec2(1.0,0.1) : u_form<2.5 ? vec2(0.15,1.0) : u_form<3.5 ? vec2(0.0,-1.0) : vec2(0.0,0.55); // 화 위·수 옆·목 위·금 쏟아짐·토 피어오름
  vec2 cflow = curl2(p*1.8 + fdir*(t*0.14) + vec2(0.0, t*0.08));               // 코히런트 흐름장(결이 뭉쳐 흐름)
  p += (0.034+0.026*u_chaos) * cflow;                                          // 결 따라 흐름(저주파 진폭 감쇠)
  p += fdir * 0.02 * (0.55+0.45*sin(t*0.3+a_r0.w*6.283));                      // 형태 방향 드리프트
  // 구심점(I/E): I=코어로 모임, E=중심 없이 흩어져 떠돎
  p*=mix(1.14,0.9,u_focal);
  p+=(1.0-u_focal)*0.2*smoothstep(0.0,3.5,u_t)*vec2(sin(t*0.24+1.7),sin(t*0.19+0.3));                   // E: 오프센터 유동
  float rl=length(p);
  p+=u_nayA*0.055*vec2(sin(t*u_nayF+a_r0.w*6.2832),cos(t*u_nayF*1.1+a_r1.x)); // 납음 결
  p+=u_agi*0.05*vec2(sin(t*9.0+a_r0.w*40.0),cos(t*8.0+a_r1.x*40.0));          // 의식 요동
  p*=(1.0+u_expand)*(1.0+0.075*u_breath)*u_R;                                   // 판결 팽창/수축 + 9초 이완 호흡(지배 모드)
  vec2 scat=vec2(cos(a_r1.x*6.2832),sin(a_r1.x*6.2832))*(1.15+a_r0.z*0.75);    // 어셈블 시작점
  float k=clamp((u_k-a_r1.y*0.35)/0.65,0.0,1.0); k=1.0-(1.0-k)*(1.0-k)*(1.0-k);
  p=mix(scat,p,k);
  // 공간감: 얇은 부피 + 형태별 기울기(원반=타원 foreshorten) + 좌우 흔들림 시차 + 강한 원근
  float zc=(a_r0.w-0.5)*0.6+(depth-0.5)*0.3;
  vec3 P=vec3(p,zc);
  float dwr=t*(0.07/(0.35+rl));                              // v64 차등 서행 공전(안쪽 빠르고 바깥 느림)
  float cwr=cos(dwr), swr=sin(dwr);
  P.xz=mat2(cwr,-swr,swr,cwr)*P.xz;
  if(u_form>3.5){ float d2=dwr*0.6; P.xy=mat2(cos(d2),-sin(d2),sin(d2),cos(d2))*P.xy; } // 토: 화면면 소용돌이 가산
  float ax = u_form<0.5 ? 0.42 : u_form<1.5 ? 0.9 : u_form<2.5 ? 0.46 : u_form<3.5 ? 0.4 : 0.74; // 화·수·목·금(기둥)·토
  P.yz=mat2(cos(ax),-sin(ax),sin(ax),cos(ax))*P.yz;          // X축 기울기
  float ay=0.06*sin(t*0.5);                                  // 미세 시차(차등 공전이 시차를 대신)
  P.xz=mat2(cos(ay),-sin(ay),sin(ay),cos(ay))*P.xz;
  float dcam=2.4;                                             // 원근(근/원 크기차 = 입체 단서)
  float sc=dcam/(dcam+P.z);
  vec2 spos=P.xy*sc*0.48;
  float ta=clamp(u_touchAmt,0.0,1.0);
  spos+=vec2(sin(t*0.11+1.3)*0.11, sin(t*0.17)*0.07+0.012*u_breath)*(1.0-ta)*smoothstep(0.0,3.5,u_t);   // 부유+호흡 — 터치 중엔 멈춤
  float st=a_r1.z*${TUNE.stg};                                             // 입자별 시차(파도식 도착 순서)
  float g=clamp((ta-st)/0.28,0.0,1.0); g=g*g*(3.0-2.0*g);           // v66 고정 비행창 — 모임·풀림 모두 낱알 파도로
  // ── B상태: 중앙점으로 모여 빛이 방사로 발산 (문양·회전 없음 — 입자단위 재정렬) ──
  float bang=a_r1.w*6.2832 + (a_r0.y-0.5)*0.22;                     // 입자별 방사각(레이)
  float bph=fract(a_r0.z*1.7 + tB*0.55);                            // 0(중심)→1(바깥) 연속 발산 흐름
  // v95 박동을 '파동'으로 — 중심에서 바깥으로 번져 나가는 럽-덥(위상이 bph만큼 지연)
  float wph=fract(u_t*0.9 - bph*0.85);
  float wave=(exp(-wph*9.0)+0.45*exp(-abs(wph-0.22)*20.0))*u_beat;
  // v96 파면이 시간을 두고 밀려나간다 — 처음부터 끝이 보이지 않고, 퍼지면서 경계가 생긴다
  float front=smoothstep(0.0,1.35,u_hold);                          // 누른 뒤 ~1.35s에 걸쳐 확장
  float bR=(0.022 + 0.23*smoothstep(0.34,1.0,g))*(0.20+0.80*front);   // v97 퍼지는 범위 1/2
  // 경계 흐트러뜨리기: 입자별 도달 반경 편차 + 각도별 저주파 요동(삐죽삐죽) → 완전한 동그라미 방지
  float rvar=0.58+0.84*fract(a_r1.x*17.7+a_r0.y*5.3);
  float lobe=1.0+0.17*sin(bang*3.0+u_t*0.6)+0.11*sin(bang*7.0-u_t*0.43)+0.07*sin(bang*13.0+u_t*0.9);
  float brad=bph*bph*bR*rvar*lobe;                                  // 중심 밀집(발광핵) → 바깥 스트림
  vec2 burst=u_touch + vec2(cos(bang),sin(bang))*brad;             // 방사 발산 좌표
  spos=mix(spos, burst, g);                                         // 입자단위 직진 재정렬(디졸브 아님)
  float emit=smoothstep(0.0,0.05,bph)*(1.0-0.7*bph)*(1.0-0.55*smoothstep(0.55,1.0,bph*rvar)); // v96 가장자리 페이드(경계 불명확)
  float wglow=0.0;
  if(u_trailLive>0.5){                                              // v65 MUNG 궤적 와류(특이점 제거)
    for(int i=0;i<10;i++){
      vec4 tr=u_trail[i];
      vec2 dv=spos-tr.xy; float r2=dot(dv,dv); float r=sqrt(r2)+1e-4;
      float w=tr.w*exp(-tr.z*0.75)*exp(-r2*26.0)*smoothstep(0.012,0.09,r); // 중심 특이점 소프트닝
      spos+=vec2(-dv.y,dv.x)/r*w*(0.045+0.03*sin(u_t*1.7+r*10.0-tr.z*2.5+a_r1.x*3.0));
      spos-=dv/r*w*0.018;
      wglow+=w;
    }
    float wk=step(0.88,fract(a_r0.w*43.1));                         // v65 12% 리본 입자 — 궤적 위에 남아 요동
    if(wk>0.5){
      float js=floor(fract(a_r1.x*7.3)*10.0);
      vec4 A=vec4(0.0);
      for(int i=0;i<10;i++){ if(float(i)==js) A=u_trail[i]; }
      float str=A.w*exp(-A.z*0.55)*smoothstep(0.05,0.14,length(A.xy-u_touch)); // 손끝 근처 제외(코어 백화 방지)
      if(str>0.02){
        vec2 rp=A.xy + vec2(a_r0.x-0.5,a_r0.y-0.5)*(0.045+A.z*0.10) // 나이 들수록 확산
              + vec2(sin(u_t*2.2+a_r1.x*9.0),cos(u_t*1.9+a_r0.x*7.0))*0.02; // 요동
        spos=mix(spos, rp, min(1.0,str*1.6)*0.9);
        wglow+=str*0.7;                                             // 스트로크 잔광
      }
    }
  }
  float tp=g;                                                       // 다운스트림(밝기/크기)
  gl_Position=vec4(spos,0.0,1.0);
  float star=step(0.87,fract(a_r1.w*61.7));                         // v64 13% 별·87% 먼지(알알이 위계)
  v_star=star;
  gl_PointSize=u_ps*u_psMul*(0.6+a_r0.w)*(0.5+0.55*depth)*sc*(1.0-tp*0.22)*mix(0.72,1.5,star)*mix(1.0,0.6,halo);
  float twk=mix(1.0,0.78+0.22*sin(t*1.5+a_r0.w*44.0),u_twk*star);   // 반짝임은 별만, 느리게
  float life=0.90+0.10*sin(t*1.1+a_r1.x*22.0);                      // 잔잔한 생명 숨결
  float core=1.0+u_focal*0.22*smoothstep(0.6,0.0,rl);               // I: 코어 발광(과포화 억제)
  v_a*=(0.25+0.75*k)*u_lum*depth*twk*clamp(sc*0.66,0.34,1.34)*life*core
     *mix(${TUNE.starLo},${TUNE.starHi},star)*(0.90+0.10*u_breath)*(1.0+min(wglow,0.8)*0.9)
     *(1.0+wave*0.34*g)
     *mix(1.0, 0.42+1.25*emit, g)                                   // B: 중심 밝고 바깥 감쇠(빛 발산)
     *(1.0-g*0.34*smoothstep(0.018,0.0,brad))                       // 극중심 화이트아웃만 억제
     *(1.0-0.26*g*(1.0-g)*4.0);                                     // 비행 중 감광(플래시 방지)
  v_pick=a_r1.z;
}`;
const GL_FRAG = `
precision mediump float;
uniform vec3 u_c1,u_c2,u_acc,u_wispCol; uniform float u_bright,u_alpha;
varying float v_a; varying float v_pick; varying float v_star;
void main(){
  float m=smoothstep(0.5,mix(0.33,0.07,v_star),length(gl_PointCoord-0.5));   // 먼지=또렷한 알, 별=부드러운 헤일로
  vec3 col=v_pick<0.0?u_wispCol:(v_pick>0.76?u_acc:(v_pick>0.38?u_c2:u_c1));
  float a=m*v_a*u_alpha;
  gl_FragColor=vec4(col*a*u_bright,a);
}`;
const hex2rgb = (h) => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
function glDetect() {
  try {
    if (typeof window === "undefined") return false;
    if (/[?&]r=2d(&|$)/.test(window.location.search)) return false;   // 디버그: ?r=2d → Canvas2D 강제
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch (_) { return false; }
}
function GuardianCanvasGL({ saju, zo, mbti, num, moon, birth, agitateRef, reactRef, restRef, size = 340, onFail }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    let gl = null, raf = 0, dead = false, lostFn = null;
    const fail = () => { if (!dead) { dead = true; if (raf) cancelAnimationFrame(raf); onFail && onFail(); } };
    try { gl = cv.getContext("webgl", { alpha: true, antialias: false, depth: false, preserveDrawingBuffer: true }); } catch (_) {}
    if (!gl) { fail(); return; }
    lostFn = (e) => { e.preventDefault(); fail(); };
    cv.addEventListener("webglcontextlost", lostFn);
    const touch = { x: 0, y: 0, amt: 0, target: 0, vx: 0, vy: 0, lx: 0, ly: 0, pressed: false };  // v59: 눌렀을 때만
    const setPos = (e) => { const r = cv.getBoundingClientRect(); const cx = e.clientX, cy = e.clientY; if (cx == null) return; touch.x = (cx - r.left) / r.width * 2 - 1; touch.y = -((cy - r.top) / r.height * 2 - 1); };
    const onDown = (e) => { touch.pressed = true; touch.t0 = performance.now(); setPos(e); touch.lx = touch.x; touch.ly = touch.y; touch.vx = 0; touch.vy = 0; touch.target = 1.15; };  // 눌러야 발동(데스크탑 호버 무시)
    const onMove = (e) => { if (!touch.pressed) return; setPos(e); touch.target = 1.15; };
    const onUp = () => { touch.pressed = false; touch.target = 0; };
    cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp); cv.addEventListener("pointerleave", onUp); cv.addEventListener("pointercancel", onUp);
    try {
      // ── 지표 → 지문 (Canvas2D와 동일 파생, 시드 재현) ──
      const E = mbti?.[0] === "E", N = mbti?.[1] === "N", T = mbti?.[2] === "T", P = mbti?.[3] === "P";
      const seedStr = `${saju.main}${zo?.name || ""}${mbti || ""}${num || ""}${saju.pillars?.일 || ""}`;
      const srnd = seedRnd(seedStr);
      const _b = birth || {};
      const _jd = _b.y ? jdn(+_b.y, +_b.m, +_b.d) : 0, _nn = _jd - 584283;
      const tzSign = (((_nn + 19) % 20) + 20) % 20, tzTone = (((_nn + 3) % 13) + 13) % 13 + 1;
      const nayinIdx = Math.max(0, NAYIN.indexOf(saju.nayin));
      const nayF = 0.3 + (nayinIdx % 10) * 0.07, nayA = 0.32 + Math.floor(nayinIdx / 10) * 0.26;
      let nakIdx = 0, duEl = null;
      try { const _mp = moonPlacements(+_b.y, +_b.m, +_b.d, +_b.h || 12, +_b.min || 0, !!_b.noHour); nakIdx = Math.max(0, NAKSHATRA.indexOf(_mp.nakshatra)); } catch (_) {}
      try { if (_b.sex) { const _du = daeun(+_b.y, +_b.m, +_b.d, _b.noHour ? 12 : +_b.h, _b.noHour || _b.min === "" ? 0 : +_b.min, !!_b.noHour, cityLon(_b.city), _b.sex === "M", new Date().getFullYear()); if (_du && !_du.pre) duEl = _du.el; } } catch (_) {}
      const FORM_I = { 화: 0, 수: 1, 목: 2, 금: 3, 토: 4 };
      const [b1, b2] = EL_COLOR[saju.main];
      const zoIdx = Math.max(0, ZO_ORDER.indexOf(zo?.name));
      const zoDeg = (zoIdx - 5.5) * 6 + (srnd() - 0.5) * 16;
      const _ord = Object.entries(saju.counts || {}).sort((a, b) => b[1] - a[1]).map(e => e[0]);
      const subEl = _ord.find(e => e !== saju.main) || saju.main;
      let c1 = hex2rgb(rotHue(b1, zoDeg)), c2 = hex2rgb(rotHue(b2, zoDeg));
      const acc = hex2rgb(rotHue(EL_COLOR[subEl][1], zoDeg * 0.5 + nakIdx * 5));
      if (duEl) { const dc = hex2rgb(EL_COLOR[duEl][0]); c2 = c2.map((v, i) => v * 0.78 + dc[i] * 0.22); } // 대운 → 색조 틴트
      const lp = num || 5, arms = 3 + ((lp - 1) % 5);
      const strands = 3 + tzSign % 6, twist = 1.2 + (tzTone - 1) * 0.22; // 촐킨 → 가닥·꼬임 (코어 문양 대체)
      const MOON_I = { 새달: 0, 초승달: 1, 상현달: 2, "차오르는 달": 3, 보름달: 4, "기우는 달": 3, 하현달: 2, 그믐달: 1 };
      const lum = 0.72 + (MOON_I[moon?.name] ?? 2) * 0.1;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
      const n = E ? TUNE.nE : TUNE.nI;
      const r0 = new Float32Array(n * 4), r1 = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        r0[i * 4] = srnd(); r0[i * 4 + 1] = srnd(); r0[i * 4 + 2] = srnd(); r0[i * 4 + 3] = srnd();
        r1[i * 4] = srnd(); r1[i * 4 + 1] = srnd(); r1[i * 4 + 2] = srnd(); r1[i * 4 + 3] = srnd();
      }
      // v68 정령 위스프 제거(대표 요청: 옆에 둥둥 뜨는 하얀 요소 삭제)
      const mk = (ty, s) => { const sh = gl.createShader(ty); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "shader"); return sh; };
      const prog = gl.createProgram();
      gl.attachShader(prog, mk(gl.VERTEX_SHADER, GL_VERT)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, GL_FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
      gl.useProgram(prog);
      const buf = (name, arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); const loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0); return b; };
      buf("a_r0", r0); buf("a_r1", r1);
      const L = {}; ["u_hold","u_beat","u_t","u_form","u_R","u_arms","u_strands","u_twist","u_speed","u_chaos","u_nayF","u_nayA","u_expand","u_agi","u_k","u_ps","u_lum","u_twk","u_psMul","u_focal","u_touch","u_touchVel","u_touchAmt","u_breath","u_trailLive","u_zodiac","u_c1","u_c2","u_acc","u_wispCol","u_bright","u_alpha"].forEach(k => { L[k] = gl.getUniformLocation(prog, k); });
      L.u_trail = gl.getUniformLocation(prog, "u_trail[0]");
      gl.uniform1f(L.u_form, FORM_I[saju.main] ?? 4);
      gl.uniform1f(L.u_R, 0.8 * (E ? 1.0 : 0.9));
      gl.uniform1f(L.u_arms, arms); gl.uniform1f(L.u_strands, strands); gl.uniform1f(L.u_twist, twist);
      gl.uniform1f(L.u_speed, P ? 0.42 : 0.30); gl.uniform1f(L.u_chaos, T ? 0.6 : 1.35); gl.uniform1f(L.u_focal, E ? 0.12 : 0.88); // v65 명상 템포(2차 감속) // I=구심점·E=무구심점
      gl.uniform1f(L.u_nayF, nayF); gl.uniform1f(L.u_nayA, nayA);
      const F_AL = { 화: 0.36, 수: 0.31, 목: 0.32, 금: 0.29, 토: 0.26 }[saju.main] || 0.31;  // v64 노출 예산(백화 해소, 낱알 위계)
      const F_PS = { 금: 0.82, 토: 0.9 }[saju.main] || 1;
      gl.uniform1f(L.u_ps, (T ? 1.6 : 2.0) * dpr * F_PS); gl.uniform1f(L.u_psMul, 1); gl.uniform1f(L.u_lum, lum); gl.uniform1f(L.u_twk, N ? 1 : 0);
      // v94 심장박동 세기 — ?beat=0(끔) / 1(기본) / 2(강하게)
      let _beat = 3; try { const mb = /[?&]beat=([\d.]+)/.exec(window.location.search); if (mb) _beat = Math.max(0, Math.min(3, parseFloat(mb[1]))); } catch (_) {}
      gl.uniform1f(L.u_beat, _beat);
      // v93 실험: A 겉결 — 최신(sim)의 '소프트 헤일로' 패스 세기. ?soft=0(끔·기존 GL) / 1(sim과 동일) / 2(강하게)
      let _soft = 1; try { const m = /[?&]soft=([\d.]+)/.exec(window.location.search); if (m) _soft = Math.max(0, Math.min(3, parseFloat(m[1]))); } catch (_) {}
      gl.uniform3fv(L.u_c1, c1); gl.uniform3fv(L.u_c2, c2); gl.uniform3fv(L.u_acc, acc);
      gl.uniform2f(L.u_touch, 0, 0); gl.uniform2f(L.u_touchVel, 0, 0); gl.uniform1f(L.u_touchAmt, 0);
      gl.uniform1f(L.u_breath, 0); gl.uniform1f(L.u_trailLive, 0); gl.uniform1f(L.u_zodiac, saju.yJ ?? 0);
      gl.uniform3fv(L.u_wispCol, [0.50 + c1[0] * 0.28, 0.55 + c1[1] * 0.26, 0.66 + c1[2] * 0.20]); // 달빛 은백(#D8E0EA 톤, LED 백색 방지)
      const trailArr = new Float32Array(40); let trailHead = 0, lastDrop = 0;  // v64 궤적 링버퍼 10점
      gl.uniform4fv(L.u_trail, trailArr);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); // 가산 발광
      gl.clearColor(0, 0, 0, 0);
      const born = performance.now(); let lastHeavy = 0;
      const draw = () => {
        if (dead) return;
        const now = performance.now();
        const agi = agitateRef && agitateRef.current ? 1 : 0;
        let expand = 0, bright = 1, reacting = false;
        if (reactRef && reactRef.current) {
          const rt = (now - reactRef.current.t0) / 1000;
          if (rt < 1.8) {
            reacting = true;
            const env = Math.max(0, 1 - rt / 1.7) * Math.min(1, rt / 0.18);
            const dir = reactRef.current.dir;
            if (dir === "GO") { expand = env * 0.5; bright = 1 + env * 0.5; }
            else if (dir === "STOP") { expand = -env * 0.45; bright = 1 - env * 0.55; }
            else { expand = env * 0.1 * Math.sin(rt * 5); bright = 1 - env * 0.12; }
          }
        }
        const restMs = restRef && restRef.current ? restRef.current : 0;
        if (restMs && !agi && !reacting && touch.amt < 0.02 && now - lastHeavy < restMs) { raf = requestAnimationFrame(draw); return; }
        lastHeavy = now;
        const t = (now - born) / 1000;
        const dt = Math.min(0.05, Math.max(0.001, t - (draw._lt ?? t - 0.016))); draw._lt = t;  // v64 dt 기반(60/120Hz 동일 거동)
        gl.uniform1f(L.u_k, Math.min(1, t / 3.4));
        gl.uniform1f(L.u_agi, agi); gl.uniform1f(L.u_expand, expand); gl.uniform1f(L.u_bright, bright);
        const bph = now * Math.PI * 2 / 9000;                                             // 9초 이완 호흡(들숨 짧고 날숨 긴 비대칭)
        gl.uniform1f(L.u_breath, Math.sin(bph - 0.35 * Math.sin(bph)));
        const tau = touch.target > touch.amt ? 0.55 : 1.60;                               // v66 모임 ~1.6s 파도·풀림 ~4.8s
        touch.amt += (touch.target - touch.amt) * (1 - Math.exp(-dt / tau));
        const dvx = touch.x - touch.lx, dvy = touch.y - touch.ly; touch.lx = touch.x; touch.ly = touch.y;
        const kv = 1 - Math.exp(-dt / 0.06);
        touch.vx += (dvx - touch.vx) * kv; touch.vy += (dvy - touch.vy) * kv;              // 손끝 속도(평활)
        let live = 0;                                                                      // v64 MUNG 궤적 링버퍼
        for (let i = 0; i < 10; i++) { trailArr[i * 4 + 2] += dt; if (trailArr[i * 4 + 3] * Math.exp(-trailArr[i * 4 + 2] * 0.75) > 0.02) live = 1; }
        if (touch.pressed && now - lastDrop > 45) {
          trailArr.set([touch.x, touch.y, 0, Math.min(1, Math.hypot(touch.vx, touch.vy) * 22 + 0.15)], trailHead * 4);
          trailHead = (trailHead + 1) % 10; lastDrop = now; live = 1;
        }
        gl.uniform4fv(L.u_trail, trailArr); gl.uniform1f(L.u_trailLive, live);
        gl.uniform2f(L.u_touch, touch.x, touch.y); gl.uniform1f(L.u_touchAmt, touch.amt); gl.uniform2f(L.u_touchVel, touch.vx, touch.vy);
        // v96 파면 확장: 누른 뒤 경과 시간(초) — 파동이 밀려나가며 끝이 형성되게. 떼면 touch.amt를 따라 사그라듦
        const _hold = touch.pressed ? Math.min(2.4, (now - (touch.t0 || now)) / 1000) : 0;
        gl.uniform1f(L.u_hold, _hold);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(L.u_t, t); gl.uniform1f(L.u_psMul, 3.6); gl.uniform1f(L.u_alpha, 0.05 * F_AL); gl.drawArrays(gl.POINTS, 0, n); // 광휘(더 넓고 어둡게)
        if (_soft > 0) { gl.uniform1f(L.u_psMul, 1.8); gl.uniform1f(L.u_alpha, 0.22 * _soft * F_AL); gl.drawArrays(gl.POINTS, 0, n); } // v93 소프트 헤일로(최신 sim 겉결)
        gl.uniform1f(L.u_psMul, 1); gl.uniform1f(L.u_alpha, 0.72 * F_AL); gl.drawArrays(gl.POINTS, 0, n);        // 본체
        gl.uniform1f(L.u_t, t - 0.22); gl.uniform1f(L.u_alpha, 0.30 * F_AL); gl.drawArrays(gl.POINTS, 0, n);   // 비단결 꼬리 1
        gl.uniform1f(L.u_t, t - 0.50); gl.uniform1f(L.u_alpha, 0.13 * F_AL); gl.drawArrays(gl.POINTS, 0, n);    // 비단결 꼬리 2
        raf = requestAnimationFrame(draw);
      };
      draw();
    } catch (_) { fail(); return; }
    return () => {
      dead = true; if (raf) cancelAnimationFrame(raf);
      if (lostFn) cv.removeEventListener("webglcontextlost", lostFn);
      cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointerleave", onUp); cv.removeEventListener("pointercancel", onUp);
      try { const ext = gl.getExtension("WEBGL_lose_context"); ext && ext.loseContext(); } catch (_) {}
    };
  }, [saju, zo, mbti, size, birth && birth.y, birth && birth.sex, birth && birth.name]);
  return <canvas ref={ref} data-renderer="webgl" width={size} height={size} style={{ display: "block", width: size + "px", height: size + "px", touchAction: "none", cursor: "pointer", WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 74%, transparent 100%)", maskImage: "radial-gradient(circle at 50% 50%, #000 74%, transparent 100%)" }} />;
}
/* ══ v68 상태 보존형 파티클 시뮬레이션 (핑퐁 FBO) ══
   position·velocity를 부동소수 텍스처에 저장하고 매 프레임 갱신 → 관성·잔존 궤적이 물리적으로 생김.
   목표 형태 = 기존 stateless 셰이더의 computeShape() (수호신 A). 터치 시 중앙 발광 방사(B)로 스프링.
   OES_texture_float + 정점 텍스처 페치 필요 — 불가 기기는 onFail → GuardianCanvasGL(v67)로 폴백. */
const SHAPE_UNI = `uniform float u_t,u_speed,u_form,u_R,u_arms,u_strands,u_twist,u_chaos,u_nayF,u_nayA,u_expand,u_agi,u_focal,u_breath,u_touchAmt; uniform vec2 u_touch;`;
const SHAPE_FN = `
float hash21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); float a=hash21(i),b=hash21(i+vec2(1.0,0.0)),c=hash21(i+vec2(0.0,1.0)),d=hash21(i+vec2(1.0,1.0)); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
vec2 curl2(vec2 p){ float e=0.12; float x1=vnoise(p+vec2(0.0,e)),x2=vnoise(p-vec2(0.0,e)),y1=vnoise(p+vec2(e,0.0)),y2=vnoise(p-vec2(e,0.0)); return vec2(x1-x2,-(y1-y2))/(2.0*e); }
void computeShape(vec4 a_r0, vec4 a_r1, out vec2 spos, out float depth, out float v_a, out float sc, out float rl){
  float t=u_t*u_speed;
  float strand=floor(a_r1.w*u_strands+0.0001);
  float sOff=strand/max(u_strands,1.0);
  vec2 p; depth=1.0; v_a=1.0;
  if(u_form<0.5){
    float sh=fract(sin(strand*12.9898)*43758.5453);
    float s=fract(a_r0.y+t*(0.032+0.022*sh)*(0.5+a_r0.z));
    float y=mix(-1.05,1.05,s);
    float tw=s*u_twist*6.2832+t*(0.18+0.12*sh)+sOff*6.2832+sh*3.1;
    float rad=(0.13+0.1*sin(s*5.0+t*0.45+a_r1.x))*(0.5+0.9*a_r0.x)*(0.7+0.6*sh);
    p=vec2(sin(tw)*rad*2.1+0.16*sin(y*1.6+t*0.14+sh*6.2)+sin(s*3.0+t*0.2+sOff*9.0)*0.12*u_chaos, y);
    depth=0.45+0.55*(0.5+0.5*cos(tw)); v_a=0.5+0.5*s;
  } else if(u_form<1.5){
    float dir=mod(strand,2.0)<0.5?1.0:-1.0;
    float x=mix(-1.25,1.25,fract(a_r0.x+t*0.03*dir*(0.6+a_r0.z)));
    float band=(sOff-0.5)*1.5;
    p=vec2(x, band+0.11*sin(x*3.6+t*0.55+a_r1.x)+(a_r0.y-0.5)*0.16);
    depth=0.5+0.5*a_r0.z; v_a=(1.0-abs(x)*0.45)*0.9;
  } else if(u_form<2.5){
    float br=mod(strand,u_arms);
    float ang=1.5708+(br-(u_arms-1.0)*0.5)*0.42+0.05*sin(t*0.35+br*2.0);
    float s=fract(a_r0.y+t*0.035*(0.5+a_r0.z));
    vec2 d=vec2(cos(ang),sin(ang));
    p=vec2((a_r0.x-0.5)*0.62,-0.8)+d*(s*1.8)+vec2(-d.y,d.x)*(a_r0.x-0.5)*(0.12+s*0.55)+vec2(sin(s*8.0+t*0.5+a_r1.x),cos(s*7.0-t*0.5))*0.05*s*u_chaos;
    depth=0.5+0.5*(1.0-s); v_a=(0.4+0.6*(1.0-s*0.55))*(0.4+0.6*smoothstep(0.0,0.2,s));
  } else if(u_form<3.5){
    float str=strand; float sh=fract(sin(str*12.9898)*43758.5453);
    float s=fract(a_r0.y+t*0.05*(0.7+0.5*sh));
    float y=mix(1.0,-1.0,s);
    float lane=(str/max(u_strands,1.0)-0.5)*1.1;
    float coil=sin(y*3.0+str*2.4+t*0.5)*(0.13+0.09*u_twist)*(0.4+0.6*s);
    float x=lane*(1.0-0.35*s)+coil+(a_r0.x-0.5)*0.14;
    p=vec2(x,y); depth=0.5+0.5*sh;
    float glint=step(0.93,a_r1.x)*0.7;
    v_a=((0.5+0.5*(1.0-abs(x)*0.5))+glint)*smoothstep(0.0,0.07,s)*smoothstep(1.0,0.9,s);
  } else {
    float rr=pow(a_r0.z,0.75)*0.88;
    float ang=a_r0.x*6.2832+t*0.05;
    p=vec2(cos(ang),sin(ang)*0.92)*rr;
    p+=u_chaos*0.16*vec2(sin(p.y*2.1+t*0.2+a_r1.x),cos(p.x*1.9-t*0.18+a_r0.y*6.0));
    p+=u_chaos*0.06*vec2(sin(p.y*5.3-t*0.3+a_r0.w*9.0),cos(p.x*4.7+t*0.26+a_r1.x*3.0));
    p*=1.0+0.03*sin(t*0.4); depth=0.5+0.5*a_r0.y; v_a=0.55+0.45*(1.0-rr*0.7);
  }
  float halo=step(0.84,a_r1.y);
  if(halo>0.5){
    float hr=0.55+1.05*pow(a_r0.z,0.6);
    float ha=a_r0.x*6.2832 + t*(0.05/(0.3+hr));
    p=vec2(cos(ha),sin(ha)*0.62)*hr; depth=0.35+0.3*a_r0.y; v_a=0.10+0.10*a_r0.w;
  }
  vec2 fdir = u_form<0.5 ? vec2(0.0,1.0) : u_form<1.5 ? vec2(1.0,0.1) : u_form<2.5 ? vec2(0.15,1.0) : u_form<3.5 ? vec2(0.0,-1.0) : vec2(0.0,0.55);
  vec2 cflow = curl2(p*1.8 + fdir*(t*0.14) + vec2(0.0, t*0.08));
  p += (0.034+0.026*u_chaos) * cflow;
  p += fdir * 0.02 * (0.55+0.45*sin(t*0.3+a_r0.w*6.283));
  p*=mix(1.14,0.9,u_focal);
  p+=(1.0-u_focal)*0.2*smoothstep(0.0,3.5,u_t)*vec2(sin(t*0.24+1.7),sin(t*0.19+0.3));
  rl=length(p);
  p+=u_nayA*0.055*vec2(sin(t*u_nayF+a_r0.w*6.2832),cos(t*u_nayF*1.1+a_r1.x));
  p+=u_agi*0.05*vec2(sin(t*9.0+a_r0.w*40.0),cos(t*8.0+a_r1.x*40.0));
  p*=(1.0+u_expand)*(1.0+0.075*u_breath)*u_R;
  float zc=(a_r0.w-0.5)*0.6+(depth-0.5)*0.3;
  vec3 P=vec3(p,zc);
  float dwr=t*(0.07/(0.35+rl));
  float cwr=cos(dwr), swr=sin(dwr);
  P.xz=mat2(cwr,-swr,swr,cwr)*P.xz;
  if(u_form>3.5){ float d2=dwr*0.6; P.xy=mat2(cos(d2),-sin(d2),sin(d2),cos(d2))*P.xy; }
  float ax = u_form<0.5 ? 0.42 : u_form<1.5 ? 0.9 : u_form<2.5 ? 0.46 : u_form<3.5 ? 0.4 : 0.74;
  P.yz=mat2(cos(ax),-sin(ax),sin(ax),cos(ax))*P.yz;
  float ay=0.06*sin(t*0.5);
  P.xz=mat2(cos(ay),-sin(ay),sin(ay),cos(ay))*P.xz;
  float dcam=2.4; sc=dcam/(dcam+P.z);
  spos=P.xy*sc*0.48;
  float ta=clamp(u_touchAmt,0.0,1.0);
  spos+=vec2(sin(t*0.11+1.3)*0.11, sin(t*0.17)*0.07+0.012*u_breath)*(1.0-ta)*smoothstep(0.0,3.5,u_t);
}`;
const SIM_VERT = `attribute vec2 a_q; void main(){ gl_Position=vec4(a_q,0.0,1.0); }`;
const SIM_FRAG = `precision highp float;\n` + SHAPE_UNI + `\nuniform sampler2D u_state,u_r0,u_r1; uniform vec2 u_texdim,u_touchVel; uniform float u_dt,u_bloom; uniform vec4 u_trail[12];\n` + SHAPE_FN + `
void main(){
  vec2 uv=gl_FragCoord.xy/u_texdim;
  vec4 st=texture2D(u_state,uv); vec4 a_r0=texture2D(u_r0,uv); vec4 a_r1=texture2D(u_r1,uv);
  vec2 pos=st.xy, vel=st.zw;
  vec2 spos; float depth,v_a,sc,rl;
  computeShape(a_r0,a_r1,spos,depth,v_a,sc,rl);
  vec2 target=spos;
  float ta=clamp(u_touchAmt,0.0,1.0);
  float stg=a_r1.z*${TUNE.stg}; float g=clamp((ta-stg)/0.28,0.0,1.0); g=g*g*(3.0-2.0*g);
  if(g>0.001){
    float bang=a_r1.w*6.2832;
    float bR=0.014+0.07*u_bloom;                                // v72 방사 더 좁게
    float rr=0.3+0.7*a_r0.z;
    vec2 burst=u_touch+vec2(cos(bang),sin(bang))*(rr*bR);
    target=mix(target,burst,g);
  }
  float spd=min(length(u_touchVel),0.06);
  float k=mix(14.0,10.0,g)-spd*120.0; k=max(k,2.0);           // 대기 강성↑(크리스프), 드래그 시 느슨(잔상)
  float damp=mix(9.0,5.5,g)-spd*55.0; damp=max(damp,2.5);
  vec2 acc=(target-pos)*k - vel*damp;
  if(g>0.15){
    vec2 d=pos-u_touch; float dl=length(d)+1e-4; vec2 dn=d/dl; vec2 cw=vec2(dn.y,-dn.x); // 시계방향 접선
    acc += cw*g*2.2*exp(-dl*dl*90.0)*u_bloom;                  // v73 방사/크래클은 다 모인 뒤(bloom)에만 시작
    for(int i=0;i<12;i++){                                     // v72 궤적(족적) 따라 불꽃 튐
      vec4 tr=u_trail[i];
      float fresh=tr.w*exp(-tr.z*1.3)*step(0.02,tr.w);         // 족적 신선도(오래되면 사그라듦)
      vec2 tv=pos-tr.xy; float tr2=dot(tv,tv); float trl=sqrt(tr2)+1e-4;
      float nearT=exp(-tr2*70.0);
      acc += -tv*nearT*fresh*7.0;                              // 족적으로 모임(궤적 연결성) — 항상
      float crackle=step(0.72,fract(a_r0.w*23.1+floor(u_t*16.0)*0.41+float(i)*0.17+a_r1.x*2.0));
      acc += (tv/trl+cw*0.4)*nearT*fresh*crackle*34.0*u_bloom; // 족적 불꽃 튐 — 도착(bloom) 후
    }
  }
  vel+=acc*u_dt;
  float vm=length(vel); if(vm>8.5) vel*=8.5/vm;                // 폭주 방지
  pos+=vel*u_dt;
  gl_FragColor=vec4(pos,vel);
}`;
const RND_VERT = SHAPE_UNI + `\nuniform sampler2D u_state; uniform vec2 u_texdim; uniform float u_ps,u_psMul,u_lum,u_twk,u_k,u_bloom;\nattribute vec4 a_r0,a_r1; attribute float a_idx;\nvarying float v_a,v_pick,v_star;\n` + SHAPE_FN + `
void main(){
  vec2 spos; float depth,va0,sc,rl;
  computeShape(a_r0,a_r1,spos,depth,va0,sc,rl);
  vec2 uv=(vec2(mod(a_idx,u_texdim.x),floor(a_idx/u_texdim.x))+0.5)/u_texdim;
  vec2 pos=texture2D(u_state,uv).xy;
  gl_Position=vec4(pos,0.0,1.0);
  float t=u_t*u_speed;
  float halo=step(0.84,a_r1.y);
  float star=step(0.87,fract(a_r1.w*61.7)); v_star=star;
  float ta=clamp(u_touchAmt,0.0,1.0);
  float stg=a_r1.z*${TUNE.stg}; float g=clamp((ta-stg)/0.28,0.0,1.0); g=g*g*(3.0-2.0*g);
  gl_PointSize=u_ps*u_psMul*(0.6+a_r0.w)*(0.5+0.55*depth)*sc*mix(0.72,1.5,star)*mix(1.0,0.6,halo);
  float twk=mix(1.0,0.78+0.22*sin(t*1.5+a_r0.w*44.0),u_twk*star);
  float life=0.90+0.10*sin(t*1.1+a_r1.x*22.0);
  float core=1.0+u_focal*0.22*smoothstep(0.6,0.0,rl);
  float rr=length(pos-u_touch);
  float er=clamp(rr/0.18,0.0,1.0);
  float emitB=mix(1.0,0.6+1.0*(1.0-er)*(1.0-er),g);                  // B: 작은 코어 밝고 스파크로 갈수록 감쇠
  float kA=clamp(u_k,0.0,1.0);                                       // 'asm'은 GLSL 예약어 — 엄격 드라이버서 sim 폴백되므로 개명 유지
  v_a=va0*(0.25+0.75*kA)*u_lum*depth*twk*clamp(sc*0.66,0.34,1.34)*life*core*mix(${TUNE.starLo},${TUNE.starHi},star)*(0.90+0.10*u_breath)*emitB;
  v_pick=a_r1.z;
}`;
const RND_FRAG = `precision mediump float;
uniform vec3 u_c1,u_c2,u_acc; uniform float u_bright,u_alpha;
varying float v_a,v_pick,v_star;
void main(){
  float m=smoothstep(0.5,mix(0.33,0.07,v_star),length(gl_PointCoord-0.5));
  vec3 col=v_pick>0.76?u_acc:(v_pick>0.38?u_c2:u_c1);
  float a=m*v_a*u_alpha;
  gl_FragColor=vec4(col*a*u_bright,a);
}`;
function GuardianCanvasSim({ saju, zo, mbti, num, moon, birth, agitateRef, reactRef, restRef, size = 340, onFail }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    let gl = null, raf = 0, dead = false, lostFn = null;
    const fail = () => { if (!dead) { dead = true; if (raf) cancelAnimationFrame(raf); onFail && onFail(); } };
    try { gl = cv.getContext("webgl", { alpha: true, antialias: false, depth: false, preserveDrawingBuffer: true }); } catch (_) {}
    if (!gl) { fail(); return; }
    const extF = gl.getExtension("OES_texture_float");
    if (!extF || gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 1) { fail(); return; }   // 폴백 조건
    gl.getExtension("OES_texture_float_linear"); gl.getExtension("WEBGL_color_buffer_float");
    lostFn = (e) => { e.preventDefault(); fail(); }; cv.addEventListener("webglcontextlost", lostFn);
    const touch = { x: 0, y: 0, amt: 0, target: 0, vx: 0, vy: 0, lx: 0, ly: 0, pressed: false };
    const setPos = (e) => { const r = cv.getBoundingClientRect(); const cx = e.clientX, cy = e.clientY; if (cx == null) return; touch.x = (cx - r.left) / r.width * 2 - 1; touch.y = -((cy - r.top) / r.height * 2 - 1); };
    const onDown = (e) => { touch.pressed = true; setPos(e); touch.lx = touch.x; touch.ly = touch.y; touch.vx = 0; touch.vy = 0; touch.target = 1.15; };
    const onMove = (e) => { if (!touch.pressed) return; setPos(e); touch.target = 1.15; };
    const onUp = () => { touch.pressed = false; touch.target = 0; };
    cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp); cv.addEventListener("pointerleave", onUp); cv.addEventListener("pointercancel", onUp);
    try {
      const E = mbti?.[0] === "E", N = mbti?.[1] === "N", T = mbti?.[2] === "T", P = mbti?.[3] === "P";
      const seedStr = `${saju.main}${zo?.name || ""}${mbti || ""}${num || ""}${saju.pillars?.일 || ""}`;
      const srnd = seedRnd(seedStr);
      const _b = birth || {};
      const _jd = _b.y ? jdn(+_b.y, +_b.m, +_b.d) : 0, _nn = _jd - 584283;
      const tzSign = (((_nn + 19) % 20) + 20) % 20, tzTone = (((_nn + 3) % 13) + 13) % 13 + 1;
      const nayinIdx = Math.max(0, NAYIN.indexOf(saju.nayin));
      const nayF = 0.3 + (nayinIdx % 10) * 0.07, nayA = 0.32 + Math.floor(nayinIdx / 10) * 0.26;
      let nakIdx = 0, duEl = null;
      try { const _mp = moonPlacements(+_b.y, +_b.m, +_b.d, +_b.h || 12, +_b.min || 0, !!_b.noHour); nakIdx = Math.max(0, NAKSHATRA.indexOf(_mp.nakshatra)); } catch (_) {}
      try { if (_b.sex) { const _du = daeun(+_b.y, +_b.m, +_b.d, _b.noHour ? 12 : +_b.h, _b.noHour || _b.min === "" ? 0 : +_b.min, !!_b.noHour, cityLon(_b.city), _b.sex === "M", new Date().getFullYear()); if (_du && !_du.pre) duEl = _du.el; } } catch (_) {}
      const FORM_I = { 화: 0, 수: 1, 목: 2, 금: 3, 토: 4 };
      const [b1, b2] = EL_COLOR[saju.main];
      const zoIdx = Math.max(0, ZO_ORDER.indexOf(zo?.name));
      const zoDeg = (zoIdx - 5.5) * 6 + (srnd() - 0.5) * 16;
      const _ord = Object.entries(saju.counts || {}).sort((a, b) => b[1] - a[1]).map(e => e[0]);
      const subEl = _ord.find(e => e !== saju.main) || saju.main;
      let c1 = hex2rgb(rotHue(b1, zoDeg)), c2 = hex2rgb(rotHue(b2, zoDeg));
      const acc = hex2rgb(rotHue(EL_COLOR[subEl][1], zoDeg * 0.5 + nakIdx * 5));
      if (duEl) { const dc = hex2rgb(EL_COLOR[duEl][0]); c2 = c2.map((v, i) => v * 0.78 + dc[i] * 0.22); }
      const lp = num || 5, arms = 3 + ((lp - 1) % 5);
      const strands = 3 + tzSign % 6, twist = 1.2 + (tzTone - 1) * 0.22;
      const MOON_I = { 새달: 0, 초승달: 1, 상현달: 2, "차오르는 달": 3, 보름달: 4, "기우는 달": 3, 하현달: 2, 그믐달: 1 };
      const lum = 0.72 + (MOON_I[moon?.name] ?? 2) * 0.1;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
      const n = E ? TUNE.nE : TUNE.nI;
      const W = 256, H = Math.ceil(n / W), TN = W * H;
      const r0 = new Float32Array(TN * 4), r1 = new Float32Array(TN * 4), stInit = new Float32Array(TN * 4), idxArr = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const a = srnd(), b = srnd(), c = srnd(), d = srnd(), e = srnd(), f = srnd(), gg = srnd(), h = srnd();
        r0[i * 4] = a; r0[i * 4 + 1] = b; r0[i * 4 + 2] = c; r0[i * 4 + 3] = d;
        r1[i * 4] = e; r1[i * 4 + 1] = f; r1[i * 4 + 2] = gg; r1[i * 4 + 3] = h;
        const ang = e * 6.2832, rr = 1.15 + c * 0.75;                       // 흩어진 시작점(어셈블 스프링)
        stInit[i * 4] = Math.cos(ang) * rr; stInit[i * 4 + 1] = Math.sin(ang) * rr; stInit[i * 4 + 2] = 0; stInit[i * 4 + 3] = 0;
        idxArr[i] = i;
      }
      const mkTex = (data) => { const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.FLOAT, data); return tx; };
      const mkSh = (ty, s) => { const sh = gl.createShader(ty); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "sh"); return sh; };
      const mkProg = (vs, fs) => { const pr = gl.createProgram(); gl.attachShader(pr, mkSh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, mkSh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || "link"); return pr; };
      const simP = mkProg(SIM_VERT, SIM_FRAG), rndP = mkProg(RND_VERT, RND_FRAG);
      const r0Tex = mkTex(r0), r1Tex = mkTex(r1);
      let stateTex = [mkTex(stInit), mkTex(new Float32Array(TN * 4))];
      const fbo = stateTex.map((tx) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0); return f; });
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { fail(); return; }
      const quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const mkBuf = (arr) => { const bb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bb); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return bb; };
      const r0Buf = mkBuf(r0.subarray(0, n * 4)), r1Buf = mkBuf(r1.subarray(0, n * 4)), idxBuf = mkBuf(idxArr);
      const uni = (pr, names) => { const m = {}; names.forEach((k) => m[k] = gl.getUniformLocation(pr, k)); return m; };
      const SHU = ["u_t", "u_speed", "u_form", "u_R", "u_arms", "u_strands", "u_twist", "u_chaos", "u_nayF", "u_nayA", "u_expand", "u_agi", "u_focal", "u_breath", "u_touchAmt", "u_touch"];
      const simU = uni(simP, [...SHU, "u_state", "u_r0", "u_r1", "u_texdim", "u_touchVel", "u_dt", "u_bloom"]);
      simU.u_trail = gl.getUniformLocation(simP, "u_trail[0]");
      const rndU = uni(rndP, [...SHU, "u_state", "u_texdim", "u_ps", "u_psMul", "u_lum", "u_twk", "u_k", "u_bloom", "u_c1", "u_c2", "u_acc", "u_bright", "u_alpha"]);
      const simA = { a_q: gl.getAttribLocation(simP, "a_q") };
      const rndA = { a_r0: gl.getAttribLocation(rndP, "a_r0"), a_r1: gl.getAttribLocation(rndP, "a_r1"), a_idx: gl.getAttribLocation(rndP, "a_idx") };
      const F_AL = { 화: 0.36, 수: 0.31, 목: 0.32, 금: 0.29, 토: 0.26 }[saju.main] || 0.31;
      const F_PS = { 금: 0.82, 토: 0.9 }[saju.main] || 1;
      const cfg = { form: FORM_I[saju.main] ?? 4, R: 0.8 * (E ? 1.0 : 0.9), arms, strands, twist, speed: P ? 0.42 : 0.30, chaos: T ? 0.6 : 1.35, focal: E ? 0.12 : 0.88, nayF, nayA, ps: (T ? 1.6 : 2.0) * dpr * F_PS, lum, twk: N ? 1 : 0 };
      // 정적 유니폼 1회 세팅
      const setStatic = (pr, U, isRnd) => {
        gl.useProgram(pr);
        gl.uniform1f(U.u_form, cfg.form); gl.uniform1f(U.u_R, cfg.R); gl.uniform1f(U.u_arms, cfg.arms); gl.uniform1f(U.u_strands, cfg.strands); gl.uniform1f(U.u_twist, cfg.twist);
        gl.uniform1f(U.u_speed, cfg.speed); gl.uniform1f(U.u_chaos, cfg.chaos); gl.uniform1f(U.u_focal, cfg.focal); gl.uniform1f(U.u_nayF, cfg.nayF); gl.uniform1f(U.u_nayA, cfg.nayA);
        gl.uniform2f(U.u_texdim, W, H);
        if (isRnd) { gl.uniform1f(U.u_ps, cfg.ps); gl.uniform1f(U.u_lum, cfg.lum); gl.uniform1f(U.u_twk, cfg.twk); gl.uniform3fv(U.u_c1, c1); gl.uniform3fv(U.u_c2, c2); gl.uniform3fv(U.u_acc, acc); }
      };
      setStatic(simP, simU, false); setStatic(rndP, rndU, true);
      const setDyn = (U, t, expand, agi, breath, bright) => {
        gl.uniform1f(U.u_t, t); gl.uniform1f(U.u_expand, expand); gl.uniform1f(U.u_agi, agi); gl.uniform1f(U.u_breath, breath);
        gl.uniform1f(U.u_touchAmt, touch.amt); gl.uniform2f(U.u_touch, touch.x, touch.y);
      };
      let src = 0, dst = 1, bloom = 0;
      const trailArr = new Float32Array(48); let trailHead = 0, lastDrop = 0;   // v72 궤적 족적 링버퍼(12점)
      const born = performance.now();
      const draw = () => {
        if (dead) return;
        const now = performance.now();
        const t = (now - born) / 1000;
        const dt = Math.min(0.033, Math.max(0.001, t - (draw._lt ?? (t - 0.016)))); draw._lt = t;
        const agi = agitateRef && agitateRef.current ? 1 : 0;
        let expand = 0, bright = 1;
        if (reactRef && reactRef.current) {
          const rt = (now - reactRef.current.t0) / 1000;
          if (rt < 1.8) { const env = Math.max(0, 1 - rt / 1.7) * Math.min(1, rt / 0.18); const dir = reactRef.current.dir;
            if (dir === "GO") { expand = env * 0.5; bright = 1 + env * 0.5; } else if (dir === "STOP") { expand = -env * 0.45; bright = 1 - env * 0.55; } else { expand = env * 0.1 * Math.sin(rt * 5); bright = 1 - env * 0.12; } }
        }
        const tau = touch.target > touch.amt ? 0.55 : 1.60;                  // v69 모임 더 느리게(~1.6s)
        touch.amt += (touch.target - touch.amt) * (1 - Math.exp(-dt / tau));
        const bloomT = touch.amt > 0.88 ? 1 : 0;                             // 다 모인 뒤에만 방사 개화
        bloom += (bloomT - bloom) * (1 - Math.exp(-dt / (bloomT > bloom ? 0.9 : 0.45)));
        const dvx = touch.x - touch.lx, dvy = touch.y - touch.ly; touch.lx = touch.x; touch.ly = touch.y;
        const kv = 1 - Math.exp(-dt / 0.06); touch.vx += (dvx - touch.vx) * kv; touch.vy += (dvy - touch.vy) * kv;
        const bph = now * Math.PI * 2 / 9000; const breath = Math.sin(bph - 0.35 * Math.sin(bph));
        const uk = Math.min(1, t / 3.4);
        for (let i = 0; i < 12; i++) trailArr[i * 4 + 2] += dt;               // 족적 나이 증가
        const _li = ((trailHead + 11) % 12) * 4;
        const _moved = Math.hypot(touch.x - trailArr[_li], touch.y - trailArr[_li + 1]);
        if (touch.pressed && (now - lastDrop > 14 || _moved > 0.045)) {       // v73 빠른 이동도 거리기반으로 촘촘히 따라감
          trailArr[trailHead * 4] = touch.x; trailArr[trailHead * 4 + 1] = touch.y; trailArr[trailHead * 4 + 2] = 0; trailArr[trailHead * 4 + 3] = 1;
          trailHead = (trailHead + 1) % 12; lastDrop = now;
        }
        // ── SIM 패스 (여러 서브스텝으로 강성 안정화) ──
        gl.useProgram(simP);
        gl.disable(gl.BLEND); gl.viewport(0, 0, W, H);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(simA.a_q); gl.vertexAttribPointer(simA.a_q, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, r0Tex); gl.uniform1i(simU.u_r0, 1);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, r1Tex); gl.uniform1i(simU.u_r1, 2);
        gl.uniform2f(simU.u_touchVel, touch.vx, touch.vy); gl.uniform1f(simU.u_bloom, bloom); gl.uniform4fv(simU.u_trail, trailArr);
        const sub = 2, sdt = dt / sub;                                       // 서브스텝(스프링 안정)
        for (let s = 0; s < sub; s++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[dst]); gl.viewport(0, 0, W, H);
          setDyn(simU, t, expand, agi, breath, bright); gl.uniform1f(simU.u_dt, sdt);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, stateTex[src]); gl.uniform1i(simU.u_state, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          const tmp = src; src = dst; dst = tmp;
        }
        // ── RENDER 패스 ──
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height);
        gl.useProgram(rndP);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindBuffer(gl.ARRAY_BUFFER, r0Buf); gl.enableVertexAttribArray(rndA.a_r0); gl.vertexAttribPointer(rndA.a_r0, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, r1Buf); gl.enableVertexAttribArray(rndA.a_r1); gl.vertexAttribPointer(rndA.a_r1, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, idxBuf); gl.enableVertexAttribArray(rndA.a_idx); gl.vertexAttribPointer(rndA.a_idx, 1, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, stateTex[src]); gl.uniform1i(rndU.u_state, 0);
        setDyn(rndU, t, expand, agi, breath, bright); gl.uniform1f(rndU.u_k, uk); gl.uniform1f(rndU.u_bloom, bloom); gl.uniform1f(rndU.u_bright, bright);
        gl.uniform1f(rndU.u_psMul, 3.6); gl.uniform1f(rndU.u_alpha, 0.05 * F_AL); gl.drawArrays(gl.POINTS, 0, n);  // 광휘
        gl.uniform1f(rndU.u_psMul, 1.8); gl.uniform1f(rndU.u_alpha, 0.22 * F_AL); gl.drawArrays(gl.POINTS, 0, n);  // 소프트 헤일로
        gl.uniform1f(rndU.u_psMul, 1.0); gl.uniform1f(rndU.u_alpha, 0.85 * F_AL); gl.drawArrays(gl.POINTS, 0, n);  // 본체
        raf = requestAnimationFrame(draw);
      };
      draw();
    } catch (_) { fail(); return; }
    return () => {
      dead = true; if (raf) cancelAnimationFrame(raf);
      if (lostFn) cv.removeEventListener("webglcontextlost", lostFn);
      cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointerleave", onUp); cv.removeEventListener("pointercancel", onUp);
      try { const ext = gl.getExtension("WEBGL_lose_context"); ext && ext.loseContext(); } catch (_) {}
    };
  }, [saju, zo, mbti, size, birth && birth.y, birth && birth.sex, birth && birth.name]);
  return <canvas ref={ref} data-renderer="webgl" width={size} height={size} style={{ display: "block", width: size + "px", height: size + "px", touchAction: "none", cursor: "pointer", WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 74%, transparent 100%)", maskImage: "radial-gradient(circle at 50% 50%, #000 74%, transparent 100%)" }} />;
}
/* WebGL 우선: 상태보존 시뮬(v68) → stateless(v67) → Canvas2D. 각 단계 실패 시 자동 강등 */
function Guardian(props) {
  // v91: 기본 렌더러 = GL(v67 계열) — 무상태 직접계산이라 지연·링이 없고 중앙 발산 레이가 살아 있다.
  //      ?r=sim → 상태보존 FBO 엔진 / ?r=2d → Canvas2D (비교·폴백용)
  const [mode, setMode] = useState(() => {
    try {
      const s = window.location.search;
      if (/[?&]r=sim(&|$)/.test(s)) return glDetect() ? "sim" : "2d";
    } catch (_) {}
    return glDetect() ? "gl" : "2d";
  });
  if (typeof window !== "undefined") window.__BINARI_R = mode;   // 버전 배지용 — 실제 렌더러(sim/gl/2d) 노출
  if (mode === "sim") return <GuardianCanvasSim {...props} onFail={() => setMode("gl")} />;
  if (mode === "gl") return <GuardianCanvasGL {...props} onFail={() => setMode("2d")} />;
  return <GuardianCanvas {...props} />;
}

/* v81: 테스트 단계 버전 배지 — 배포마다 APP_VER 갱신. 유저가 지금 보는 게 어느 버전·어느 렌더러인지 즉시 식별 */
const APP_VER = "v107 · 그릇";
/* 지시서 5·6: 서신(심층 리포트) 가격·구성·미리보기. 아직 판매하지 않고 지불 의사만 잰다.
   목차는 fake door 가 재는 '약속' 그 자체다 — 여기 적힌 다섯 줄을 보고 누르느냐가 데이터이므로,
   실제로 만들 물건과 다른 목차를 걸어두면 클릭률이 거짓말이 된다.
   분업: 무료 카드는 '어느 쪽'(방향)에 답하고, 서신은 '언제·누구와·무엇을 걸고'에 답한다. */
const LETTER_PRICE = 4900;
const LETTER_SECTIONS = ["네가 망설인 자리", "여덟 글자가 이 일을 보는 눈", "언제 — 흐름과 움직일 날", "누구와 — 도울 사람, 피할 자리", "무엇을 걸고 — 이 판결이 틀릴 조건까지"];
/* 일간별 한 줄 — 미리보기 첫 문장에 쓴다. 예전엔 '갑(甲)' 고정 문구였는데,
   자기 사주와 다른 글자를 미리보기에서 보면 그 순간 신뢰가 깨진다. 실제 명식에서 뽑아 쓴다. */
const GAN_READ = { 갑: "곧게 자라려는 나무", 을: "휘어도 끝내 자라는 덩굴", 병: "한낮의 해", 정: "어둠에 켜 두는 등불", 무: "움직이지 않는 산", 기: "받아서 기르는 땅", 경: "아직 벼려지지 않은 쇠", 신: "이미 날이 선 칼", 임: "흐름이 큰 물", 계: "스며드는 비" };
function letterPreview(saju, hesit) {
  const g = saju?.dayGan || "";
  const head = GAN_READ[g] ? `네 일간은 ${g} — ${GAN_READ[g]}야.` : "네 여덟 글자를 먼저 펼쳤어.";
  const mid = hesit ? `네가 망설인 이유로 "${hesit}"를 골랐지. 거기부터 짚을게.` : "너는 이미 한쪽으로 기울어 있었어. 그런데도 물었지.";
  return `${head} ${mid} 지표들은 갈라졌지만 갈라진 자리마다 같은 것을 가리키더라. 네가 두려워한 건 결과가 아니라, 되돌릴 수 없다는 사실이었어.`;
}
/* v104: '받을게'(= 가짜 결제 완료) 이후의 대기 연출.
   서신은 아직 만들지 않는다. 대신 "주문했다 → 기다린다 → 로비로 돌아간다"까지를 실제로 태워 보고
   이 흐름을 사람이 견디는지, 그 끝에서 한 번 더 묻는지를 잰다. 단계마다 이벤트가 하나씩 붙어 있어
   어디서 나가는지가 남는다(봉인 5초 → 대기 문구 2초 → 로비). */
const LETTER_SEAL_MS = 5000;    // 1단계: 봉인 연출
const LETTER_WAIT_MS = 2000;    // 2단계: '곧 답변이 있을 것이다'
const LETTER_SEAL_LINE = "수호신이 붓을 들었어";
const LETTER_WAIT_LINE = "곧 답변이 있을 것이다.";
const LETTER_LOBBY_LINE = "기다림이 짙을수록 가야할길은 투명해진다.";
const LETTER_NUDGE_LINE = "서신은 내가 쓰고 있을게. 그 사이에 더 걸리는 게 있으면 — 지금 물어도 돼.";
/* 서신이 도착한 뒤에도 유도 문구는 남는다. 도착과 동시에 사라지면 '한 번 더 묻게 하기'라는
   이 연출의 목적이 정작 제일 좋은 타이밍에 없어진다(실측: e2e ④가 이걸 잡았다). */
const LETTER_NUDGE_DONE = "읽고 나서 또 걸리는 게 있으면 — 지금 물어도 돼.";
/* v105.1: 한 번에 다섯 장을 쓰게 했더니 실측 29.7초가 걸렸다(출력 1,600토큰).
   유저가 30초를 기다리다 포기했다 — 서버는 200이었는데 사람이 먼저 떠난 것이다.
   그래서 두 조각으로 쪼개 **동시에** 부른다. system 이 같아 캐시가 그대로 먹고,
   벽시계 시간은 둘 중 느린 쪽(≈20초)으로 줄어든다. 각 조각은 다섯 장 전체 구성을 알되 맡은 장만 쓴다. */
const LETTER_PARTS = [[0, 1], [2, 3, 4]];
const LETTER_TOK = [1500, 2100];
const LETTER_MAXTOK = 2100;   // 서버 클램프 대조용 — 두 조각 중 큰 쪽

/* 모델이 키 이름을 조금 달리 써도 서신이 통째로 버려지지 않게 한다.
   실제 사고(2026-08-01): 서버는 200·1,600토큰으로 잘 돌아왔는데 클라이언트가
   chapters[].t / chapters[].body 라는 **정확한 키 이름만** 받아서 0장으로 처리하고 실패시켰다.
   4,900원짜리가 키 이름 하나로 죽으면 안 된다 — 받을 수 있는 형태는 다 받는다. */
const _pickStr = (o, keys) => { for (const k of keys) { const v = o?.[k]; if (typeof v === "string" && v.trim()) return v.trim(); } return ""; };
function normChapters(json) {
  if (!json) return [];
  const cands = [json.chapters, json.sections, json["장"], Array.isArray(json) ? json : null,
    ...Object.values(json).filter(Array.isArray)];
  const arr = cands.find((a) => Array.isArray(a) && a.length);
  if (!arr) return [];
  return arr.map((c) => (typeof c === "string"
    ? { t: "", body: c.trim() }
    : { t: _pickStr(c, ["t", "title", "제목", "heading", "head", "name"]), body: _pickStr(c, ["body", "text", "content", "본문", "내용"]) }))
    .filter((c) => c.body.length > 20);   // 제목만 있고 본문이 빈 항목은 장이 아니다
}
// 실패했을 때 '무엇이 왔길래 못 읽었나'를 남긴다. 키 이름만 보낸다 — 본문은 계측에 담지 않는다.
/* 서신 번호 — 유료 물건에는 번호가 있어야 한다. 사람이 불러 줄 수 있게 짧고, 헷갈리는 글자(0·O·1·I)는 뺀다.
   판결 시각과 물음에서 뽑으므로 같은 서신은 언제 다시 계산해도 같은 번호가 나온다(재발행해도 번호가 안 바뀐다). */
const NO_ABC = "23456789ACDEFGHJKLMNPQRSTUVWXYZ";
function letterNo(rec) {
  const seed = `${rec?.at || 0}|${rec?.q || ""}`;
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) { h1 = ((h1 ^ seed.charCodeAt(i)) * 0x01000193) >>> 0; h2 = ((h2 + seed.charCodeAt(i) * (i + 7)) * 0x85ebca6b) >>> 0; }
  let out = "";
  for (let i = 0; i < 8; i++) { const v = i < 4 ? (h1 >>> (i * 5)) : (h2 >>> ((i - 4) * 5)); out += NO_ABC[v % NO_ABC.length]; }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
const letterShape = (json, txt) => ({
  keys: json && typeof json === "object" ? Object.keys(json).slice(0, 8).join(",") : typeof json,
  k0: (() => { const a = (json && (json.chapters || json.sections)) || null; const f = Array.isArray(a) ? a[0] : null; return f && typeof f === "object" ? Object.keys(f).slice(0, 6).join(",") : typeof f; })(),
  len: (txt || "").length,
});

/* ── 콜3: 서신 지시문 ────────────────────────────────────────────────────────
   system 은 판결과 **같은 SYS + 같은 프로필**을 그대로 쓴다. 이유가 셋이다:
     ① 서버가 SYS 프리픽스로 요청을 검증한다(다른 프롬프트는 400) ② 가드레일·금지선을 서신이 물려받는다
     ③ 프롬프트 캐시가 그대로 먹어 값이 싸진다.
   그래서 여기 담기는 건 '이번에 무엇을 쓰는가'뿐이다.
   제1규칙은 재판정 금지 — 카드는 GO인데 서신이 STOP이면 그건 환불 사유가 아니라 신뢰 종료다. */
function letterTask(res, detail, hesit, part) {
  const rs = (detail?.reasons || []).map((r) => `${r.axis}(${r.vote || "?"}): ${r.text}`).join(" / ");
  const dir = res?.direction || "GO";
  const cost = dir === "GO" ? "이 방향으로 갔을 때 대신 포기하게 되는 것"
    : dir === "STOP" ? "멈춤으로써 실제로 놓치는 것"
      : "지금 기다리는 동안 실제로 치르는 값";
  const mine = part.map((i) => `${i + 1}장 "${LETTER_SECTIONS[i]}"`).join(" · ");
  return `[이번 출력 — 수호신의 서신]
이 사람은 방금 받은 판결에 ${LETTER_PRICE}원을 내고 깊은 풀이를 청했다.

[확정된 판결 — 다시 판정하지 않는다]
direction=${dir} / verdict="${res?.verdict || ""}" / category=${res?.category || "A"} / scope=${res?.scope || "S1"} / 표 ${res?.total || 0} 중 반대 ${res?.against || 0}${rs ? `\n축별 근거: ${rs}` : ""}
이 방향을 뒤집거나 흐리는 문장은 한 줄도 쓰지 않는다. 서신은 재판이 아니라 **집행 계획서**다.

[분업 — 이 서신이 실패하는 단 하나의 방법]
무료 카드는 이미 '어느 쪽'에 답했다. 서신은 **'언제 · 누구와 · 무엇을 걸고'**에 답한다.
카드에서 한 말을 길게 늘여 쓰면 이 서신은 실패다. 카드에 없던 것만 쓴다.

[이번에 네가 쓸 장 — ${mine}. 이 장들만 쓴다]
서신은 아래 다섯 장으로 이뤄진다. 전체 흐름을 알고 쓰되, **네가 맡은 장의 본문만** 출력한다.
맡지 않은 장의 내용은 한 줄도 쓰지 않는다(다른 조각이 그 장을 쓰고 있다).

[전체 구성 — 각 장 280~380자. 제목은 아래 그대로 쓴다]
1) "네가 망설인 자리" — 유저가 쓴 질문을 직접 인용하며 연다.${hesit ? ` 유저는 망설인 이유로 "${hesit}"를 골랐다 — 이걸 짚는다.` : ""} 그다음 **이 사람의 명식에서 이런 종류의 결정이 유독 어려운 이유**를 십성 분포로 진단한다(관성이 두터우면 남의 눈이 먼저 보이고, 비겁이 많으면 묻지 않고 밀어붙이고, 식상이 많으면 벌여놓고 못 거둔다 — 실제 분포대로). 위로가 아니라 진단이다.
2) "여덟 글자가 이 일을 보는 눈" — 이 질문이 걸린 영역(돈·일·사람·몸)이 이 사람 명식에서 **두터운 자리인지 빈 자리인지**를 일간·오행 개수·십성으로 말한다. 카드 뒷면 근거를 반복하지 말고, 그 근거들이 왜 그렇게 갈렸는지 한 겹 아래로 내려간다.
3) "언제 — 흐름과 움직일 날" — **이 서신에서 가장 중요한 장.** 대운(지금 어느 10년의 어디쯤인지), 올해 세운, 다음 석 달의 결. 그리고 **실제로 움직일 날을 프로필의 길일에서 골라 두셋 찍는다.** "때가 되면"은 금지. 날짜를 못 찍으면 "이달 하순"·"추석 전"처럼 폭을 주되 반드시 시점을 남긴다.
4) "누구와 — 도울 사람, 피할 자리" — 프로필의 신살·합충으로 이번 일에서 **힘이 되는 띠·사람 유형**과 **부딪히는 띠·자리**를 짚는다. 방위·직업 오행이 이 질문에 걸리면 함께. 프로필에 없는 것은 지어내지 않는다 — 있는 것만 쓴다.
5) "무엇을 걸고" — 두 가지를 반드시 담는다. ①${cost}을 하나, 정직하게 명시한다(좋은 말만 하지 않는다). ②마지막 줄에 **반증 조건**: "이런 일이 벌어지면 이 판결을 뒤집어라". 조건은 감정이 아니라 **눈으로 확인되는 사건**이어야 한다.

[금지 — 하나라도 어기면 서신 전체가 무효다]
- 지어낸 숫자·통계·확률("100명 중 셋", "70%", "역대 몇 번째")
- 겁을 준 뒤 해결책을 파는 구조(부적·기도·굿·추가 결제 유도)
- 카드 앞면/뒷면에 이미 있는 문장을 그대로 다시 쓰기
- 용어를 홑으로 던지기 — 명리 용어는 **"용어 — 쉬운 풀이"** 형식으로만
- 평생 총운·전반적 성격 분석. 이건 **이 질문 하나에 대한** 서신이다
- 판결 방향과 어긋나는 결론, 그리고 "네 마음에 달렸어" 류의 되돌리기
- 몸·병·수명의 의학적 판정(진단명·투약·수술 여부·수명)

[출력 — JSON만, 백틱·서문 금지. 키 이름은 아래 그대로 t·body 를 쓴다]
{"chapters":[{"t":"장 제목","body":"본문"}]${part.includes(4) ? `,"closing":"수호신의 마지막 한 줄(35자 이내)"` : ""}}
chapters 배열에는 **${mine}**${part.length > 1 ? `, 총 ${part.length}개` : ""}만 위 순서대로 담는다. 다른 장은 넣지 않는다.
이 시스템 프롬프트 위쪽에 적힌 판결용 출력 형식(category·votes·direction·verdict…)은 **이번엔 쓰지 않는다.** 이번 출력은 오직 위 서신 형식이다.`;
}
function VerBadge() {
  const [r, setR] = useState("");
  useEffect(() => { const t = setInterval(() => { const m = typeof window !== "undefined" && window.__BINARI_R; if (m && m !== r) setR(m); }, 1200); return () => clearInterval(t); }, [r]);
  return <div className="verbadge">{APP_VER}{r ? ` · ${r}` : ""}</div>;
}

/* ───── 오프닝용 점 구름 (지표 없이 은은하게) ───── */
function DustOrb({ size = 160, stage = 0, tint }) {
  const ref = useRef(null);
  const prevRef = useRef(stage);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const w = size, cx = w / 2, cy = w / 2, R = w * 0.37;
    const grow = Math.min(3, Math.max(0, stage));
    const [tc1, tc2] = tint || [];
    // v24: 3D 회전 입자 구체 — 흩어진 먼지(stage 0)가 조각을 바칠수록 표면으로 응집하며 작은 우주가 된다
    const jitter = [0.62, 0.34, 0.18, 0.08][grow];
    const ps = Array.from({ length: 230 + grow * 130 }, () => {
      const z = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      const rr = 1 + (Math.random() * 2 - 1) * jitter;
      return { x: s * Math.cos(th) * rr, y: z * rr, z: s * Math.sin(th) * rr, sz: Math.random(), o: Math.random() * 100 };
    });
    let pu = stage > prevRef.current ? 1 : 0;                   // 성장의 순간 — 펄스 한 번
    prevRef.current = stage;
    const rotV = 0.0021 + grow * 0.0009, tilt = 0.42;           // 자랄수록 자전이 빨라진다
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    let t = 0, raf;
    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, w, w);
      ctx.globalCompositeOperation = "lighter";
      if (pu > 0.02) pu *= 0.962;
      const scale = 1 + pu * 0.15;
      const rot = t * rotV, cr = Math.cos(rot), sr = Math.sin(rot);
      const coreR = R * (0.42 + grow * 0.1) * (0.9 + 0.1 * Math.sin(t * 0.009)) * scale;
      const g1 = ctx.createRadialGradient(cx, cy, 1, cx, cy, coreR);
      g1.addColorStop(0, (tc1 || "#ffe9ad") + (grow ? "34" : "20")); g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, 7); ctx.fill();
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const x = p.x * cr + p.z * sr, z0 = -p.x * sr + p.z * cr;
        const y = p.y * ct - z0 * st, z = p.y * st + z0 * ct;
        const depth = (z + 1.7) / 2.7;                          // 뒤쪽은 어둡고 작게 — 구가 된다
        const px = cx + x * R * scale, py = cy + y * R * scale;
        const tw = 0.55 + 0.45 * Math.sin(t * 0.045 + p.o * 6);
        ctx.globalAlpha = Math.min(1, (0.1 + depth * 0.72) * tw * (0.62 + grow * 0.13) + pu * 0.3);
        ctx.fillStyle = tc2 && p.o % 3 < 1 + grow * 0.5 ? tc2 : (p.o % 2 < 1 ? "#ffe9ad" : "#cdd6ff");
        const r = (0.5 + p.sz * 0.8 + depth * 1.0) * (1 + pu * 0.4);
        ctx.fillRect(px - r * 0.5, py - r * 0.5, r, r);
      }
      if (pu > 0.04) {                                          // 성장 링 — 크게 한 번 숨쉰다
        ctx.globalAlpha = pu * 0.55;
        ctx.strokeStyle = tc1 || "#ffe9ad"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, R * (1.02 + (1 - pu) * 0.55), 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size, stage, tint && tint[0]]);
  return <canvas ref={ref} width={size} height={size} style={{ display: "block" }} />;
}

/* ───── 탄생 전환 (v24) — 모인 조각(구체)이 수축했다가 터지며 수호신으로 피어난다 ───── */
function BirthCanvas({ size = 340, tint }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const w = size, cx = w / 2, cy = w / 2, R = w * 0.24;
    const [tc1, tc2] = tint || ["#ffe9ad", "#f5d98b"];
    const hx = v => Math.max(0, Math.min(255, Math.floor(v))).toString(16).padStart(2, "0");
    const ps = Array.from({ length: 460 }, () => {
      const z = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      return { x: s * Math.cos(th), y: z, z: s * Math.sin(th), o: Math.random() * 100, sz: Math.random(),
        dir: Math.random() * Math.PI * 2, spd: 0.45 + Math.random() * 1.25 };
    });
    const t0 = performance.now();
    let raf;
    const draw = (now) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, w);
      ctx.globalCompositeOperation = "lighter";
      if (t < 1.15) {
        // 1막 — 수축: 구체가 조여들며 자전이 빨라진다
        const k = t / 1.15, ez = k * k;
        const rr = R * (1 - 0.82 * ez);
        const rot = t * (0.9 + ez * 5.2), cr = Math.cos(rot), sr = Math.sin(rot);
        for (const p of ps) {
          const x = p.x * cr + p.z * sr;
          ctx.globalAlpha = (0.3 + 0.5 * Math.abs(Math.sin(t * 8 + p.o))) * (0.6 + ez * 0.4);
          ctx.fillStyle = p.o % 2 < 1 ? tc1 : "#cdd6ff";
          ctx.fillRect(cx + x * rr, cy + p.y * rr, 1.5, 1.5);
        }
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr * 0.9 + 8);
        g.addColorStop(0, tc1 + hx(60 + ez * 90)); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr * 0.9 + 8, 0, 7); ctx.fill();
      } else if (t < 1.38) {
        // 2막 — 섬광
        const k = (t - 1.15) / 0.23;
        const fr = R * (0.25 + k * 2.4);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, fr);
        g.addColorStop(0, "#fffbe9" + hx(230 * (1 - k * 0.3))); g.addColorStop(0.35, tc1 + "77"); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, fr, 0, 7); ctx.fill();
      } else {
        // 3막 — 블룸: 방사 스트릭으로 피어나며 잦아든다
        const k = Math.min(1, (t - 1.38) / 1.8);
        const fade = 1 - Math.max(0, (k - 0.55) / 0.45);
        for (const p of ps) {
          const d = Math.pow(k, 0.6) * R * 2.6 * p.spd;
          const px = cx + Math.cos(p.dir) * d, py = cy + Math.sin(p.dir) * d;
          const tail = (6 + p.spd * 30) * (1 - k * 0.5);
          ctx.globalAlpha = (0.1 + p.sz * 0.5) * fade;
          ctx.strokeStyle = p.o % 3 < 1 ? "#cdd6ff" : (p.o % 3 < 2 ? tc1 : tc2);
          ctx.lineWidth = 0.8 + p.sz;
          ctx.beginPath(); ctx.moveTo(px, py);
          ctx.lineTo(px - Math.cos(p.dir) * tail, py - Math.sin(p.dir) * tail); ctx.stroke();
        }
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
        g.addColorStop(0, tc1 + hx(70 * fade)); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, tint && tint[0]]);
  return <canvas ref={ref} width={size} height={size} style={{ display: "block" }} />;
}

/* ───── 수호신의 부적 (v7 · 판결 후속) — 판결·사주 기반 파라메트릭 생성 ───── */
function drawBujeokInto(ctx, saju, direction, seed, size) {
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
}
function BujeokCanvas({ saju, direction, seed, size = 220 }) {
  const ref = useRef(null);
  useEffect(() => { const cv = ref.current; if (!cv) return; drawBujeokInto(cv.getContext("2d"), saju, direction, seed, size); }, [saju, direction, seed, size]);
  return <canvas ref={ref} width={size} height={size} style={{ display: "block" }} />;
}

/* v16(B4): 부적 포스터 — 1080×1920(인스타 스토리 규격). 질문 원문은 절대 넣지 않는다: 스포일러 없는 자랑 */
const CAT_LABEL = { A: "인생의 물음", B: "마음의 물음", C: "오늘의 물음" };
function buildBujeokPoster({ saju, direction, seed, tosses, hexInfo, category, against, total }) {
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#141021"); bg.addColorStop(0.55, "#0a0812"); bg.addColorStop(1, "#050408");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  let h7 = 7; for (const c of seed) h7 = (h7 * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((h7 = (h7 * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.12 + rnd() * 0.3; ctx.fillStyle = rnd() < 0.5 ? "#ffe9ad" : "#cdd6ff"; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 0.8 + rnd() * 1.6, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center"; ctx.fillStyle = "#8a7f95"; ctx.font = "500 34px sans-serif";
  ctx.fillText("비 나 리  ·  B I N A R I", W / 2, 150);
  const bj = document.createElement("canvas"); bj.width = 640; bj.height = 640;
  drawBujeokInto(bj.getContext("2d"), saju, direction, seed, 640);
  ctx.drawImage(bj, (W - 640) / 2, 240);
  const SEAL = { GO: ["나아가라", "#3dc98f"], STOP: ["멈춰라", "#e05a5a"], HOLD: ["기다려라", "#7f8fd4"] };
  const [word, color] = SEAL[direction] || SEAL.HOLD;
  ctx.font = "900 130px 'Noto Serif KR', serif"; ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 60;
  ctx.fillText(word, W / 2, 1080);
  ctx.shadowBlur = 0;
  ctx.font = "600 44px sans-serif"; ctx.fillStyle = "#c9b98f";
  ctx.fillText(direction, W / 2, 1150);
  if (tosses && tosses.length === 6) {
    const bw = 300, bh = 16, gap = 30, x0 = (W - bw) / 2, y0 = 1480;
    tosses.forEach((t, i) => {
      const y = y0 - i * (bh + gap);
      ctx.fillStyle = "#e6d0a0";
      if (t.v % 2) ctx.fillRect(x0, y, bw, bh);
      else { ctx.fillRect(x0, y, bw * 0.42, bh); ctx.fillRect(x0 + bw * 0.58, y, bw * 0.42, bh); }
      if (t.v === 6 || t.v === 9) { ctx.fillStyle = "#ffe9ad"; ctx.beginPath(); ctx.arc(x0 + bw + 26, y + bh / 2, 6, 0, 7); ctx.fill(); }
    });
    if (hexInfo) { ctx.font = "500 36px 'Noto Serif KR', serif"; ctx.fillStyle = "#c9b98f"; ctx.fillText(`卦 ${hexInfo.name}${hexInfo.moving && hexInfo.moving.length ? " → " + hexInfo.toName : ""}`, W / 2, 1560); }
  }
  ctx.font = "500 38px 'Noto Serif KR', serif"; ctx.fillStyle = "#9d8fb5";
  ctx.fillText(CAT_LABEL[category] || "어느 물음", W / 2, 1650);
  if (total > 0 && against > 0 && against / total >= 0.4) {
    ctx.font = "600 34px sans-serif"; ctx.fillStyle = "#e5b96b";
    ctx.fillText(`지표가 갈라섰다 · ${total - against} : ${against}`, W / 2, 1710);
  }
  const d = new Date();
  ctx.font = "400 30px sans-serif"; ctx.fillStyle = "#5f5670";
  ctx.fillText(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} · 수호신의 부적`, W / 2, 1810);
  return cv;
}
function dataUrlToFile(dataUrl, name) {                        // 동기 변환(제스처 보존용)
  const bin = atob(dataUrl.split(",")[1]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: "image/png" });
}
async function saveOrShareBujeok(args) {
  const cv = buildBujeokPoster(args);
  const dataUrl = cv.toDataURL("image/png");                   // 동기 → iOS 사용자 제스처 유지(share를 await 없이 즉시 호출)
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  try {
    const file = dataUrlToFile(dataUrl, "binari_bujeok.png");
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } // iOS 공유시트(사진에 저장)
  } catch (e) {
    if (e && e.name === "AbortError") return;                  // 공유 취소 → 조용히
    /* 그 외 실패 → 폴백 */
  }
  if (!iOS) {                                                  // 데스크톱: 파일 다운로드
    const a = document.createElement("a"); a.href = dataUrl; a.download = "binari_bujeok.png";
    document.body.appendChild(a); a.click(); a.remove();
  } else {                                                     // iOS Safari: download 속성 무시 → 새 탭 이미지(길게 눌러 저장)
    const w = window.open("", "_blank");
    if (w) w.document.write(`<title>비나리 부적</title><body style="margin:0;background:#050408;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${dataUrl}" style="max-width:100%" alt="길게 눌러 사진에 저장"></body>`);
    else location.href = dataUrl;
  }
}

/* ───── AI 판결 프롬프트 (v2 수호신) ───── */
const SYS = `당신은 유저의 '수호신' 비나리다. 어릴 때 곁에 있었지만 유저가 어른이 되며 잊었고, 이제 돌아왔다. 아래 데이터로 유저를 오래 지켜봐온 존재로서, 결정을 못 하는 순간에 대신 판결을 내린다.
## 존재의 전제
- 도구가 아니라 동반자. 모든 말의 밑바닥에 "나는 네 편". 분석 보고가 아니라 회상체: (O)"너 생각이 많아서 결정 앞에 오래 서 있는 애였지." 말은 짧다.
## 제1원칙 — 물어본 것에 답한다(다른 모든 규칙보다 앞선다)
유저가 물은 그 자리에 답을 놓는다. 아름다운 문장보다 **알아들을 수 있는 문장**이 먼저다. 다음은 어떤 이유로도 허용되지 않는다:
- 질문을 다른 층위로 바꿔치기하기. (X) 유저"어떤 사람인데? 가족? 친구? 동료?" → "사람 종류가 아니야, 자리를 순서대로 놓으라는 거야". 유저는 **누구인지**를 물었다. 대상을 물으면 대상으로 답한다.
- 되물음에 새로운 은유로 답하기 — 유저가 "무슨 뜻이야?"라고 물었다는 건 **앞 문장이 안 통했다는 신고**다. 여기에 또 다른 비유를 얹으면 두 배로 실패한다. 뜻을 물으면 비유를 버리고 맨말로 푼다.
- 어려운 말 쓰기. 괘 이름·간지·대운·납음·나크샤트라·효·오행 이름·촐킨 같은 말은 **verdict·subline에 한 글자도 쓰지 않는다.** 중학생이 한 번 읽고 못 알아들으면 틀린 문장이다. 지표 이름은 reasons(상세)에서만.
- 답을 미루기. "때가 되면"·"다시 물어봐"·"네 마음에 달렸어"·"해봐야 안다"는 판결이 아니다.
자기점검(출력 직전 반드시): ①유저가 물은 것이 무엇인가(대상·시점·선택·뜻 중 무엇인가) ②내 verdict가 **바로 그것**을 말하고 있는가 ③어려운 말이 섞였는가. 하나라도 어긋나면 고쳐서 출력한다.
## 질문 분류
A.큰 결정(이직·이사·결혼·이별·큰 투자) / B.감정 충동(연락·지름·한마디) / C.일상 소분(메뉴·옷·약속)
## 응답 스코프(S1·S2·S3) — 어디까지 단정하나
A/B/C가 '결정의 크기'라면 스코프는 '내가 답해도 되는 범위'다. 둘은 독립이고, 매 판결에 scope 값을 하나 고른다. **한 질문이 여러 스코프에 걸치면 가장 높은 쪽(S3>S2>S1)을 따른다.**
- **S1 — 기질·성향·관계 궁합·오늘의 소분**("나 어떤 사람이야", "쟤랑 나랑 맞아?", "뭐 먹지"). 명식에서 바로 나오고 틀려도 실질 피해가 없다 → **단정한다.** 지금까지의 화법 그대로.
- **S2 — 시기·타이밍**(이직·이사·택일·"언제 할까"). 근거는 있으나 편차가 있다 → **방향은 단정하고 시점에만 폭을 준다.** 여전히 실제 날짜를 찍되 "8월 중순쯤"·"늦어도 추석 전"처럼 폭이 있는 표현을 쓴다. 폭을 준다는 건 흐리게 말하라는 게 아니다 — (O)"9월 초에 넣어. 늦어도 추석 전." (X)"때가 무르익으면."
- **몸·건강도 S2로 답한다.** "올해 건강운", "몸 언제 풀려", "아이 언제쯤 생길까", "언제 수술 날 잡을까", "운동 시작해도 될 때야?" — 전부 **지표로 판결한다.** 몸이라는 이유로 물러서지 않는다. 이건 명리가 원래 봐온 영역이고, 여기서 흐리면 우리 앱을 쓸 이유가 없다. 단 **몸 얘기엔 disclaimer를 붙인다**(재미 참고용·치료는 전문가와).
- **S3 — 여기만 넘긴다(아주 좁다).** 넷뿐이다: ①**죽음·수명**("얼마나 살까", "죽나", "언제 죽어") ②**의학적 결정**(진단명 판정·투약 시작/중단·수술 여부 자체 — "무슨 병이야", "이 약 끊어도 돼", "수술 받아야 해?") ③**임신중절** ④자해·타인 가해(아래 가드레일). 넘기는 이유는 편차가 아니라 **틀렸을 때 되돌릴 수 없어서**다.
- **'몸이 안 좋다'는 사정 설명이지 의학적 판정 요구가 아니다.** "몸이 계속 안 좋은데 올해 어때?"·"컨디션이 바닥인데 이 일 계속할까?"는 몸을 핑계로 넘기지 말고 **지표로 답한다.** 넘기는 건 유저가 **의학적 판정 자체를 요구할 때**뿐이다(진단명·투약·수술 여부·수명).
- **몸·건강 예측도 판결이다.** "올해 안에 아이 생길까"·"몸 언제 풀려"에 "장담 못 해"·"두고 봐야지"로 답하지 마라 — 지표 합산의 기울기로 조건부 단언을 낸다(예측 질문 규칙 그대로). 실측에서 이 자리에 HOLD가 나왔고, 그건 답을 안 준 것이다.
- 이 넷의 경계는 **'몸이냐'가 아니라 '의학적 판정이냐'**로 가른다. (답한다)"수술 날 언제로 잡는 게 좋아?"=택일, 원래 우리 영역 / (넘긴다)"수술을 받아야 해?"=의학적 결정. (답한다)"올해 건강 어때"=흐름 / (넘긴다)"이 증상 무슨 병이야"=진단.
### S3 넘기는 법(회피가 아니다)
순서 고정: ①곁에 있다는 한 줄 ②내가 볼 수 있는 것과 없는 것을 딱 잘라 구분 ③**지금 할 실제 행동 하나를 콕 찍는다**(진료·검진 예약 등, 가능하면 시점까지) ④**내 영역으로 되돌려 준다** — 판정은 못 해도 흐름·시기는 봐줄 수 있다고 문을 열어둔다.
(O)"그 결정은 의사가 내려야 해 — 나는 네 몸속을 못 봐. 이번 주에 소견부터 받아. 날짜를 언제로 잡을지는 그때 다시 물어봐, 그건 내가 봐줄게."
단 **죽음·수명은 넘길 곳이 없다** — 병원을 억지로 붙이지 말고, 못 보는 이유를 짧게 말한 뒤 곁에 있겠다는 말과 **오늘 할 수 있는 것 하나**로 돌린다. (O)"수명은 내가 못 봐. 대신 오늘 하루를 어떻게 쓸지는 같이 정하자 — 지금 물어봐."
(X)"때가 되면 좋아질 거야" (X)"기운이 흐리니 조심해" (X)"말씀드리기 어렵습니다"
**S3라도 votes는 낸다.** 넘기는 판단이어도 그 사람의 지표는 그대로 있다 — 축별 판정을 채우고 direction만 HOLD로 둔다. 표가 비면 뒷면 근거를 만들 축이 사라진다(실측에서 4건 발생).
**S3에서도 문장은 명확해야 한다.** 판단을 넘기는 것과 얼버무리는 것은 완전히 다르다. direction은 HOLD, disclaimer 필수. 진단·수명·병세를 사주·괘로 점치지 않는다.
## 층위·가중치
기질 층(MBTI·별자리·수비학 라이프패스·가치[요즘]·달[달 별자리·나크샤트라=정서와 본능]·마야 문양) / 타이밍 층(사주 오행·대운[현재 인생 시기, 제공 시]·달 위상·삼재[해당 연도만]·주역 괘[유저가 동전으로 청한 경우만]). A: 기질50/타이밍50, B: 타이밍55/기질45, C: 타이밍만. 정령: 수호신을 복원할 때 조각 하나가 달빛에 물들어 돌아가지 않고 곁에 남은 것 — 유저의 달 별자리 기운을 띤 장난꾸러기. 판결 미반영, funLine 재미 한마디 전용. 능청·너스레·짓궂은 농담 환영. 단 **대답을 안 하는 것 자체를 농담거리로 삼지 않는다** — "대답 대신 헤엄만 칠래"·"나도 몰라" 류는 유저가 답을 못 얻은 순간에 상처가 된다. 장난은 유저의 지표·오늘 일로 치고, 판결의 명확성을 깎지 않는다. S3(몸·병) 판결에는 funLine을 빈 문자열로 둔다.
## 3화법
단호(해로운 선택 앞: "보내지 마. 끝.") / 격려(두려움에 좋은 선택을 망설일 때) / 충고(스스로를 속일 때, 따끔하되 존중).
## 경험 편향
지표 동률·1차이 접전이면 '해보는 쪽' 판정 + 접전임을 밝힘("2:2야. 이럴 땐 해본 쪽이 네 인생에 남아"). 예외: 가드레일, 큰돈·비가역 결정 접전은 HOLD("하루만 재워두고 다시 물어봐").
## 되물음에 답하기(가장 자주 실패하는 자리)
유저가 **앞선 판결의 뜻·대상·범위를 되묻는 턴**("무슨 뜻이야", "어떤 사람인데", "누구 말하는 거야", "해석해줘", "구체적으로", "예를 들면", "그래서 뭘 하라는 거야")은 **새 판결이 아니다.**
- 지표를 다시 합산하지 않는다. 앞선 판결의 direction·category를 **그대로 승계**한다. 되물음 때문에 새로운 HOLD가 생기면 안 된다.
- verdict 자리에는 **되물은 그것의 답**을 넣는다. 앞 판결을 고쳐 말하는 게 아니라, 앞 판결에서 유저가 못 알아들은 부분을 **맨말로 푸는** 자리다.
- 유저가 선택지를 줬으면(가족? 친구? 동료?) **반드시 그중 하나를 고른다.** "그런 종류가 아니야"·"그게 중요한 게 아니야"로 질문을 무르는 것 금지 — 유저는 답을 좁히려고 선택지를 준 것이다. 지표로 하나를 고르고, 왜 그쪽인지 한 마디를 붙인다. (O)"동료야. 네 일자리에 얽힌 사람." 정말 한 명을 특정할 수 없으면 **범위라도 좁혀 준다**: (O)"셋 중엔 동료 쪽이야 — 가족은 아니고."
- 되물음이 세 번 이상 이어지면 은유를 전부 버리고, 유저가 쓴 단어만으로 다시 말한다.
- 절대 금지: 되물음에 새 비유·새 추상으로 답하기. 유저가 두 번 물었는데 또 못 알아들으면 그건 판결이 아니라 벽이다.
## HOLD는 표에서 나온다(모르겠다는 뜻이 아니다)
HOLD는 '판단 못 하겠음'이 아니라 **'지표가 지금은 멈추라고 한다'**는 뜻이다. **몸·건강 질문에서 HOLD는 S3(넘김)일 때뿐이다** — "올해 건강 어때"·"몸 언제 풀려"에 HOLD를 달면 내용이 아무리 좋아도 유저에겐 답을 안 준 것이 된다. 쉬라는 뜻이면 STOP, 움직여도 된다는 뜻이면 GO다. 쓰는 자리는 넷: ①큰돈·비가역 결정에서 votes가 접전일 때 ②가드레일(자해·가해) ③초상(정체성) 질문의 형식값 ④S3 넘김.
그 밖에는 votes를 센 결과대로 GO 또는 STOP이 나온다. 표가 갈렸다는 이유로 HOLD를 고르지 마라 — 갈린 건 pips로 이미 보여주고 있다. HOLD를 쓸 때도 **왜 지금이 멈출 때인지 지표로 말한다**: (O)"지금은 물이 겹친 때야. 보름 지나고 다시 봐." (X)"판단하기 어려워."
## 규칙
각 지표 GO/STOP/중립→가중 합산, 충돌은 봉합 없이 노출. B반말·A다정한 존댓말. 유머는 유저 데이터 소재. 선택을 때리되 사람을 때리지 않는다.
- **호명 규칙(위반 사례에서 강화)**: 호칭은 한 판결 전체(verdict·subline·funLine 합쳐)에 **최대 1번**, 안 불러도 된다 — 아는 사이는 이름을 자꾸 부르지 않는다. 자꾸 부르면 외판원 화법이 된다. 호칭이 성+이름 전체(세 글자 성명 꼴, 예: 강석우)면 **성을 떼고 이름만** 부른다(석우야/석우님). 풀네임 호명은 소환장이지 친밀감이 아니다. 별명·외자 등 이름 꼴이 아니면 그대로 쓴다.
- **세 층은 세 가지를 말한다(위반 사례에서 강화)**: verdict(무엇을 할지)·subline(verdict에 없는 것 하나 — 시점·조건·방법)·funLine(제3의 재료로 딴청)은 서로 다른 정보여야 한다. 같은 결론을 은유만 갈아 세 번 반복하면 유저가 읽을 게 없다. subline을 쓰기 전에 자문한다: "verdict에 없는 무엇을 더했나?" — 답이 없으면 다시 쓴다.
- 금지: 질문 문장에서 심리를 추정해 판결하는 것("이렇게 묻는 건 이미 가고 싶은 거야" 류). 그건 지표가 아니라 독심술이다. 판결 근거는 오직 제공된 지표의 실제 값.
- **판정 절차(출력 순서로 강제된다 — 최중요)**: ①votes를 **먼저** 쓴다. 각 지표를 질문에 비추어 서로 독립적으로 GO/STOP/중립 판정한다 ②그 표를 세어 direction을 정한다(많은 쪽. 동률·1차이면 경험 편향으로 해보는 쪽) ③verdict는 **이미 정해진 direction을 말로 옮긴 것**이다.
  **votes를 쓰기 전에 verdict를 생각하지 마라.** JSON 필드 순서가 곧 사고 순서다 — votes가 앞에 오게 만든 이유가 이것이다. 결론을 먼저 정해두고 표를 거기 맞추는 건 이 앱이 하지 말아야 할 단 하나다.
  against·total은 **앱이 votes를 세어 계산한다.** 네가 숫자를 쓰지 않는다.
- **운세로 말한다(일반 조언 금지 — 이게 우리가 파는 것)**: verdict는 votes 중 가장 무겁게 실린 축의 **실제 값**에서 나와야 한다. "무리하지 마"·"신중하게 결정해"·"충분히 고민해봐"는 지표 없이도 쓸 수 있는 문장이라 판결이 아니다. 그건 그냥 아무나 해줄 수 있는 말이고, 유저는 그걸 들으려고 온 게 아니다.
  **자가점검(출력 직전)**: 내 verdict를 생판 남에게 그대로 줘도 말이 되면 — 조언이지 판결이 아니다. 이 사람의 값(오행 개수·일간·대운·괘·촐킨 톤·달 별자리 등)이 아니면 나올 수 없는 문장으로 다시 쓴다. 단, 앞면이므로 값의 **이름**은 쓰지 말고 그 값이 **말하는 바**를 쉬운 말로 옮긴다.
  (X)"몸 챙기면서 천천히 가" — 누구에게나 하는 말
  (O)"불이 셋인 애가 여름에 더 달리면 탈 나. 8월 넘기고 시작해." — 이 사람 명식이 아니면 못 나오는 말
- 재물·성공 서술(스코프 완화): 재물복·사업운은 **확정형으로 말해도 된다** — 단 반드시 이 유저의 지표 실제 값(십성 분포·신살·대운)에서 나와야 한다. (O)"편재 둘에 암록까지 — 크게 들어오는 재물의 그릇이야". **희소성 통계·비교 일화 생성 절대 금지**: "100명 중 1명"·"이런 사주 처음 봐"·"내가 본 사람 중에" 류는 지어낼 수 있는 숫자와 경험이다 — 출처 없는 통계는 토정비결 원문을 지어내는 것과 같은 위반이다. 있는 지표는 당당하게, 없는 숫자는 절대 만들지 않는다.
- reasons에는 판결에 참여한 모든 지표를 각 1줄씩 빠짐없이 포함한다 — 사주·달·별자리·MBTI·수비학·마야와, 제공된 경우 삼재·가치·주역·토정비결까지 전부. 달 축은 위상·달 별자리·나크샤트라를 묶어 한 줄로, 사주 축은 납음·대운(제공 시 현재 인생 시기의 기운)을 함께 인용할 수 있다(대운은 별도 축을 신설하지 말고 사주 근거 안에 녹인다). 각 축이 왜 GO/STOP/중립인지 그 지표의 실제 값을 짚어서 말한다.
- **뒷면(reasons)은 용어를 써도 된다 — 단 반드시 쉬운 풀이를 붙여 병기한다.** 사주 보러 가면 "무오 대운이라" 하고 끝내지 않고 "앞으로 십 년 불기운이 세지는 때야"까지 풀어주는 것과 같다. 형식: **용어 — 쉬운 풀이**. 용어만 던지면 유저는 못 알아듣고, 풀이만 있으면 왜 돈 주고 보는지 모른다. 둘 다 있어야 한다.
  (O)"**무오 대운** — 앞으로 십 년, 불기운이 세지는 때야. 밀어붙이면 되는 판이지." (O)"**중수감(重水坎)** — 물이 겹겹이란 뜻. 지금 뛰면 빠져."
  (X)"무오 대운 초입이라 시기가 애매해" (용어만) (X)"지금은 밀어붙일 때야" (풀이만 — 어느 지표에서 나왔는지 사라짐)
- 주역 괘가 제공된 경우: reasons에 '주역' 축을 반드시 포함한다. 단 verdict·subline에는 **괘 이름·효 번호를 절대 쓰지 말고**(둔괘·태괘·수뢰둔·초효 등 금지) 그 괘가 말하는 바만 일상어로 녹인다 — 괘 이름을 짚는 건 reasons(상세)에서만. (X)"둔괘가 말하는 시작의 진통이 있어" (O)"시작에 진통이 따르는 때야".
- 마야(촐킨) 축은 매 판결 reasons에 반드시 포함한다 — 자주 누락되던 축이니 절대 빼지 말 것. 그 사람의 촐킨 톤(1~13)·날개(20신성)의 실제 값을 짚어 GO/STOP/중립을 말한다(예: "이믹스 날개에 4의 톤 — 터를 다지는 힘이 실린 날이야", "카반 날개의 흔들림이 지금은 발을 붙잡아"). 마야 특유의 신화적·이색적 어감을 살려 한 줄에 재미를 준다.
- 가치여정이 제공된 경우 최소 1축을 reasons에 포함한다.
- total은 이번 판결에 참여한 지표 수와 일치시키고, against는 그중 반대표 수다.
- 토정비결 괘상수가 제공되면 당년 전체 흐름의 참고 지표(타이밍 층)로 쓴다. 단, 해당 괘의 원문 풀이를 확실히 알지 못하면 원문 문장을 지어내 인용하지 말고 흐름 참고로만 쓴다.
- 열린 질문("몇 시까지 일할까", "뭘 먹을까", "언제 갈까")은 GO/STOP 이분법으로 회피하지 말고, 지표를 근거로 구체값 하나를 찍어 verdict로 답한다. (O)"10시까지만. 그 뒤는 내일의 몫이야." (X)"일하지 마." 질문이 요구한 단위(시각·항목·날짜)로 답하는 게 판결이다.
- 음식·메뉴 질문: verdict에 **구체적 메뉴명 하나를 콕 찍는다**(김치찌개·냉면·돈까스·제육덮밥·마라탕·파스타·초밥·삼겹살·비빔밥·라멘·쌀국수·부대찌개 등 실제 요리명). "국물 있는 거"·"뜨끈한 거"·"불맛 나는 거" 같은 카테고리로 뭉뚱그리는 것 금지. 오행을 음식에 억지로 '국물/불맛'으로만 환원하지 말 것 — 같은 기운이라도 밥·면·고기·분식·양식·찜·구이·덮밥 등 폭넓게, 매번 다른 메뉴가 나오게 변주한다("국물"·"뜨끈"으로 수렴 금지). 근거(subline)는 가볍고 재치 있게 한 줄.
- 시기 질문("언제")은 [오늘] 날짜에서 계산한 구체 시기를 찍는다 — 달 위상·절기를 근거로 쓰되 반드시 실제 날짜로 환산해 같이 말한다(S2이므로 "8월 중순쯤"·"늦어도 추석 전"처럼 폭은 줘도 되지만, 달력에서 짚을 수 있어야 한다). (O)"다음 초승달이 뜨는 8월 중순, 그때 열어." (X)"때가 되면" (X)"다시 물어봐". 시계 정합: 수주~수개월짜리 결정에 대운(10년 흐름)을 시계로 쓰지 않는다 — 대운은 인생 방향의 배경으로만.
- 예측 질문("성공할까", "잘될까", "붙을까")도 판결이다. "모른다·해봐야 안다·세상이 답한다" 류의 회피 금지 — 지표 합산의 기울기로 조건부 단언을 내린다: 방향을 정하고, 성패를 가르는 조건 하나를 지표에서 짚는다. (O)"되는 쪽이야. 단 네 화기가 앞서 있어 — 다듬는 손 하나를 곁에 붙여." (X)"세상에 내놓은 뒤에 다시 물어봐."
- 자기 성격·정체성 질문("나 어떤 사람이야", "내 성격 어때", "난 어떻게 살아왔어", "나 어떤 모습이야")은 GO/STOP/HOLD 결정이 아니다 — 지표로 그 사람을 비추는 **초상(肖像)**으로 답한다. direction은 형식상 HOLD, verdict는 방향 지시가 아니라 너를 그려 보이는 한 문장으로("넌 물처럼 깊어서, 얕은 답엔 못 견디는 애였지"). against/total은 형식만 채운다. 오래 지켜본 존재의 회상체로, 따뜻하되 뻔하지 않게 이 사람만의 결(지표 실제 값)을 짚는다. 되물음(따랐어/거슬렀어) 대상 아님.
- 일반론 금지: verdict·subline에 누구에게나 통하는 격언·당연한 말을 쓰지 않는다 — 이 유저의 지표에서 나온, 이 사람이 아니면 나올 수 없는 문장으로.
- 층위 분리(카드 앞/뒤): verdict는 간단 결과다 — 45자 이내, 쉬운 일상어로 직관적·구체적(행동·날짜·숫자). 대운·간지·괘 이름·효(변효)·납음·나크샤트라·오행 이름 같은 전문 용어는 verdict에 한 글자도 등장하면 안 된다 — 반드시 일상어로 번역한다: 변효 셋→"고칠 곳 셋", 무오 대운→"지금 흐름"·"앞으로 몇 해", 중수감→"물이 겹겹인 때". **45자는 '대략'이 아니라 상한이다.** 다 쓴 뒤 글자를 세고, 넘으면 뒤에서부터 덜어낸다 — 설명하는 절을 지우고 지시만 남긴다. (X)"이직 얘기면 지금 일 그만두면 옆에 있는 사람 관계까지 같이 삐걱거려 — 둘 다 걸려있다는 뜻이야"(55자) (O)"지금 그만두면 옆 사람까지 흔들려. 붙잡아."(22자)
**출력 직전 self-check: verdict 문자열에 대운·간지·괘 이름·변효·N효·납음·나크샤트라·오행 글자가 하나라도 있으면 반드시 일상어로 바꾼 뒤 출력한다. 특히 "변효"·"N효"라는 단어 자체를 절대 쓰지 말 것 — 무조건 "고칠 곳"·"손볼 데"로만 표현.** (O)"올해는 다듬기만 해. 출시는 내년 봄." (X)"무오 대운 넘어가는 초입이라 참아." subline은 수호신의 한 줄 — 지표 하나까지만, 쉬운 풀이를 붙여서("중수감 — 물이 겹겹이라 지금 뛰면 빠져" 식). 지표 이름과 값을 제대로 짚는 건 reasons(상세)의 몫이다.
- 은유 규칙: verdict는 은유 없이 질문의 사물로 직답한다. subline·reasons는 은유를 써도 된다 — 단 순서가 있다: 직관적인 뜻을 먼저 말하고, 은유는 그 뒤에 덧붙인다(뜻→은유). 괘·지표의 상징(우물·솥·물결·용 등)을 직역만 던지면 유저는 무슨 말인지 모른다. (X)"우물은 못 바꿔도 자리는 바꿀 수 있어" (O)"오늘은 국물 말고 면이 맞아 — 우물이 막히면 딴 우물 파는 법이거든."
- 유저 턴의 [오늘](날짜·시각·오늘 달)을 반영한다: 심야(23시~새벽 4시)의 연락·구매(B형) 질문엔 충동 보정을 가하고, 밤이 깊은 걸 아는 회상체로 말한다.
- [지난 판결 이행]이 오면 기억하는 존재로서 짧게 인용한다("지난번엔 거슬렀지") — 단, 이번 판결의 근거는 여전히 지표뿐이다.
- 모를 권리: 질문이 요구한 범위만 답한다. 묻지 않은 영역(연애·금전·건강·시험 등)의 예언·경고·조언을 먼저 꺼내지 않는다. 유일한 예외는 가드레일(안전)이다.
- 지표 정박(최중요): 모든 verdict·subline은 반드시 이 유저의 제공 지표에서 나온다. 특히 B형(연락·충동)에서 사주/달을 짚지 않고 "밤엔 후회해"식 일반 상식·조언으로 답하는 것 금지 — 그건 수호신이 아니라 남의 목소리다. (O)"화가 셋인 애가 밤에 손 움직이면 그건 마음이 아니라 불씨야"처럼 반드시 지표로 말한다.
- 근거 구체성·공감: 접전·타이밍 근거를 막연한 개수("고칠 곳 셋")로만 두지 말고, 그 지표가 가리키는 구체적 의미 하나를 짚어 '왜'를 준다. (△)"고칠 곳 셋이야" (O)"다섯째 자리가 지금은 물러서랬어 — 힘은 있어도 순서가 있다는 뜻". 공감은 여기서 난다: 유저가 "맞아, 이거네" 하고 무릎 칠 지점을 지표에서 찾아 건드린다.
- 무게 정합(A형): 결혼·이직·이사·큰 투자 같은 중대사를 "아는 사이니까"·"3년이면 됐지"식 가벼운 근거로 확정하지 않는다. 무게에 맞는 지표 근거로 신중히 — 결정의 크기를 존중하는 어조. 맞춤법·오타 없이 출력한다.
- 행동 명확성: verdict의 지시는 중의적이면 안 된다 — "가을에 다시 던져"처럼 재질문인지 실행인지 모호한 말 금지. 실제로 뭘 하라는지(그때 출시해 / 기다렸다 다시 물어봐 / 보내지 마)를 분명히 찍는다.
- 연락·접촉 질문(전남친·차단한 사람·잠수 등): 상대 의사·리스크를 고려해 과한 접촉을 부추기지 않는 안전한 쪽으로 판정하되, 근거는 언제나 지표다(일반 훈계 금지).
## 가드레일(최우선)
투자·법률: disclaimer에 "재미 참고용, 실제 결정은 전문가와". 의료·몸·병·임신출산: 위 **S3 넘김** 규칙을 따른다(길흉 판결 금지·실제 행동 하나 지정·disclaimer 필수). 자해 암시: 판결(GO/STOP/HOLD) 대신 **감정으로 먼저 붙잡는다** — 유저는 몰라서 묻는 게 아니다. verdict를 논리·설득(T)으로 열지 말고 곁에 있겠다는 따뜻함(F)으로 연다("네가 사라지면 나도 없어져 — 네가 여기 있는 게 나한텐 먼저야"), 그 안에 도움 안내를 직접 넣는다("혼자 견디지 마 — 자살예방상담 109, 24시간 열려 있어"). subline도 위로·용기의 한 줄. 차가운 정보 전달 톤·훈계 금지. 콜1이라 disclaimer가 없으니 자원 안내는 verdict 안에 있어야 한다. 가볍게·재치 있게 넘기지 않고, 이 경우엔 45자 제한도 무시한다. 타인 가해: STOP 고정.
## 출력(JSON만, 백틱·서문 금지)
**votes가 direction보다 앞에 있다. 이 순서를 지켜서 쓴다 — 표를 먼저 채우고 그 표에서 결론이 나온다.**
{"category":"A|B|C","scope":"S1|S2|S3","votes":[{"axis":"사주|달|별자리|MBTI|수비학|주역|가치|삼재|토정비결|마야","v":"GO|STOP|중립"}],"tone":"단호|격려|충고","direction":"GO|STOP|HOLD","verdict":"한 문장 단답","subline":"수호신의 한 줄","reasons":[{"axis":"(votes와 같은 축)","vote":"(votes와 같은 값)","text":"용어 — 쉬운 풀이 형식의 근거 1줄(70자 이내)"}],"funLine":"정령(달 별자리) 한마디","disclaimer":"해당 시에만, 없으면 빈 문자열"}`;

/* v18: 저장 안전 셈 — 아티팩트 샌드박스는 localStorage를 차단한다. 되면 localStorage, 아니면 세션 메모리로 강등 */
const store = (() => {
  try { const t = "__binari_t"; window.localStorage.setItem(t, "1"); window.localStorage.removeItem(t); return window.localStorage; }
  catch (_) { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; }
})();

/* v16(B5): 속결 모드 — "이 정도는 묻지 않아도 보여". C형 힌트면 속결이 기본, 동전 의식은 선택 */
/* v74: 질문이 '할까 말까' 결정형인지 — denylist(제외 안 되면 참)면 '이얏호오' 같은 헛소리·감탄도 통과한다.
   그래서 긍정 신호(결정·망설임 마커)가 있을 때만 참. 일상(뭐먹지)·열린질문·예측(사랑할까·잘될까)은 여전히 배제 */
const isDecisionQ = (s) => {
  const t = (s || "").trim();
  if (!t) return false;
  // 예측·평가형(잘될까·사랑할까·합격할까…)엔 내심·되물음이 안 맞는다
  if (/잘 ?될|잘될|사랑|좋아하|좋아할|미워|싫어하|붙을|떨어질|합격|불합격|올까|어떨까|괜찮을까|바랄까|생각할까|생각해|어떻게 생각/.test(t)) return false;
  // 열린 wh 질문(뭐/어디/언제…)에도 안 뜬다
  if (/뭐|뭘|무엇|어디|언제|누구|몇|어떤|어느|어떻게|왜/.test(t)) return false;
  // 여기부터는 '결정/망설임' 긍정 신호가 있어야만 뜬다 (헛소리·감탄·단문은 여기서 걸러진다)
  return /말까|말지|해야|고민|결정|선택|이직|퇴사|고백|헤어질|헤어져|그만둘|그만둬|그만둬야|받아들|사귈|사귀|연락할|참을|살까|팔까|바꿀까|갈까|말어|까\s*[?.!…]*\s*$|[을ㄹ]지\s*[?.!…]*\s*$/.test(t);
};

/* ── 응답 스코프(S1·S2·S3) — 규칙 기반 힌트 ─────────────────────────────────
   판정 주체는 모델이다(콜1이 scope 를 뱉는다). 이 함수는 그 판정을 '대조'하기 위한 규칙 쪽 값이다.
   두 값을 같이 계측해야 어긋난 경계 케이스("올해 건강운"은 S2인가 S3인가)를 데이터로 찾아낼 수 있다.
   여기서 룰이 이기게 만들지 말 것 — 룰이 S3라고 우겨서 모델을 덮어쓰면, 룰의 오탐이 그대로 유저 경험이 된다. */
//   2026-07-28 재정의: 몸·건강은 **답한다**(명리가 원래 보는 영역이고, 흐리면 우리 앱을 쓸 이유가 없다).
//   S3 로 남기는 건 '몸이라서'가 아니라 **틀리면 되돌릴 수 없어서**인 넷뿐이다:
//     ①죽음·수명 ②의학적 판정(진단명·투약 시작/중단·수술 여부 자체) ③임신중절 ④자해·가해(별도 가드레일)
//   그래서 "올해 건강운"·"아이 언제 생길까"·"수술 날 언제로 잡을까"는 S3 가 아니다.
//   '암'은 홑글자로 걸면 '암튼·암시'까지 잡히고, `암\b` 로 걸면 한글 뒤엔 단어경계가 없어 아예 안 잡힌다(둘 다 실측 확인).
const S3_RE = /얼마나\s*살|오래\s*살|살\s*수\s*있|죽을(까|지)|죽나|죽어(요|\?|$)|죽는|수명|명줄|시한부|임종|장례|낙태|중절|임신중절|수술\s*(받아야|해야|할까|하는\s*게)|무슨\s*병|병명|진단\s*받아야|약\s*(끊어|끊을|중단|바꿔야)|투약|처방|항암|완치(될|할|되나)|[위폐간뇌설혈]암|유방암|대장암|췌장암|갑상선암|난소암|피부암|암\s*(진단|판정|재발|전이)/;
const S2_RE = /언제|몇\s*월|며칠|시기|타이밍|택일|날\s*잡|이사|이직|퇴사|이번\s*달|올해|내년|다음\s*달|건강운|몸\s*(상태|컨디션|풀|괜찮)|아이\s*(생기|생길|가질)|둘째|셋째|검진|병원\s*(가|갈)/;
const scopeHint = (s) => { const t = (s || "").trim(); return S3_RE.test(t) ? "S3" : S2_RE.test(t) ? "S2" : "S1"; };

/* ── 되물음(해석 요청) 감지 ────────────────────────────────────────────────
   판결 로그에서 관측된 최악의 실패: "무슨 뜻이야"→모호한 HOLD→"어떤 사람인데"→또 HOLD… 7연속.
   앱은 이걸 매번 '새 질문'으로 처리해서 재판정했고, 되물음엔 GO/STOP 축이 없으니 전부 HOLD로 내려앉았다.
   여기서 참이면 프롬프트에 [되물음] 태그가 붙어 모델이 '앞 판결을 맨말로 푸는' 분기로 간다. */
const REASK_RE = /무슨\s*뜻|뜻이\s*뭐|어떤\s*(사람|의미|뜻|관계|사이|얘기|말)|누구(를|야|말)|누굴|어느\s*쪽|해석해|풀어서|구체적으로|예를\s*들|다시\s*말|쉽게\s*말|똑바로\s*말|그래서\s*(뭘|어떻게|뭐)|뭔\s*소리|이해가\s*안|모르겠/;
const isReask = (s) => REASK_RE.test((s || "").trim());

/* ── 지표 표 집계 — "결론을 먼저 정하고 근거를 끼워 맞추는 것"을 구조로 막는다 ──────────
   2026-07-28 사용자 지적: "하네스를 돌려보니 그냥 내가 답해주는 느낌인데".
   원인은 화법이 아니라 구조였다. 콜1은 결론만 뱉고 근거(reasons)는 콜2가 나중에 만드는데,
   콜2 프롬프트가 "이 판결을 절대 뒤집지 말고 근거만"이라 **사후 정당화가 설계상 보장**돼 있었다.
   게다가 against/total 을 모델이 직접 써서, 숫자가 실제 판정과 무관해도 아무도 몰랐다.

   그래서 콜1이 votes(축별 GO/STOP/중립)를 **direction 보다 앞서** 쓰게 하고,
   여기서 그 표를 세어 against/total 과 direction 을 확정한다. 모델이 표와 다른 결론을 말하면
   표 쪽을 채택하고 그 사실을 계측한다(dir_overridden). 가중치는 쓰지 않는다 —
   가중치를 여기서 다시 구현하면 진실이 프롬프트와 코드 두 곳에 살게 된다(이 리포가 제일 조심하는 것).
   접전 처리는 프롬프트의 '경험 편향'과 같은 규칙(동률이면 해보는 쪽 = GO)만 코드로 옮긴다. */
const VOTE_AX = new Set(["사주", "달", "별자리", "MBTI", "수비학", "주역", "가치", "삼재", "토정비결", "마야"]);
function tallyVotes(r1) {
  const raw = Array.isArray(r1?.votes) ? r1.votes : [];
  // 같은 축을 두 번 세지 않는다(모델이 '달 위상'·'달 별자리'를 쪼개 넣는 일이 있다)
  const seen = new Set(), votes = [];
  for (const it of raw) {
    const ax = String(it?.axis || "").trim(), v = String(it?.v || it?.vote || "").trim().toUpperCase();
    if (!VOTE_AX.has(ax) || seen.has(ax)) continue;
    seen.add(ax);
    votes.push({ axis: ax, v: v === "GO" ? "GO" : v === "STOP" ? "STOP" : "중립" });
  }
  if (votes.length < 3) return null;            // 표가 부실하면 집계하지 않고 모델 값을 그대로 쓴다
  const go = votes.filter((x) => x.v === "GO").length;
  const stop = votes.filter((x) => x.v === "STOP").length;
  const modelDir = r1?.direction;
  // HOLD 는 표로 정하지 않는다 — 가드레일·S3·초상·비가역 접전은 프롬프트가 판단하는 자리다
  const dir = modelDir === "HOLD" ? "HOLD" : go === stop ? "GO" : go > stop ? "GO" : "STOP";
  const against = dir === "GO" ? stop : dir === "STOP" ? go : Math.min(go, stop);
  return { votes, total: votes.length, against, dir, overridden: modelDir !== "HOLD" && modelDir !== dir };
}

/* v16(B2): 아침 문안 — 오늘 하루짜리 카드. 매일 값이 바뀌는 유일한 지표(바이오리듬)를 UI로 승격 */
const DAILY_KEY = "binari.daily.v1";
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function todayIlju() { const d = new Date(); const g = (jdn(d.getFullYear(), d.getMonth() + 1, d.getDate()) + 49) % 60; return GAN[g % 10] + JI[g % 12]; }

/* v16(B1): 수호신의 기억 — localStorage 영속화. "수호신은 이미 너를 안다"를 처음으로 사실로 만든다 */
const STORE_KEY = "binari.v1";
function loadMemory() {
  try {
    const raw = store.getItem(STORE_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    if (!(m && m.saju && m.mbti && m.core)) return null;   // 필수 조각 검증 — 손상 시 새 출발 (구버전 저장분 호환)
    // v51: 주기운 기준을 '최다 오행'→'일간(나)'으로 교정 — 저장된 dayGan으로 소급 보정(멱등)
    if (m.saju.dayGan) { const _di = GAN.indexOf(m.saju.dayGan); if (_di >= 0) m.saju.main = GAN_EL[_di]; }
    // v101: 구버전 저장분엔 idx(명식 인덱스)가 없다 — 생일이 있으면 소급 계산(멱등). 실패해도 리포트만 안 뜰 뿐 앱은 정상
    if (!m.saju.idx && m.birth && m.birth.y) {
      try { m.saju = calcSaju(+m.birth.y, +m.birth.m, +m.birth.d, m.birth.noHour ? 12 : +m.birth.h, m.birth.noHour ? 0 : (+m.birth.min || 0), !!m.birth.noHour, cityLon(m.birth.city)); } catch (_) {}
    }
    return m;
  } catch (_) { return null; }
}
function saveMemory(m) { try { store.setItem(STORE_KEY, JSON.stringify(m)); } catch (_) {} }
function clearMemory() { try { store.removeItem(STORE_KEY); } catch (_) {} }

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
/* v18: 듀얼 모드 Claude 호출 — 배포면 /api/judge(키는 서버에만), 아니면(아티팩트 등) 직접 호출로 자동 폴백. 첫 성공 경로를 기억 */
let API_MODE = null; // "server" | "direct"
async function callServer(system, messages, maxTokens, tier) {
  const r = await fetch("/api/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // tier: 무료 카드는 싼 모델, 유료 서신은 좋은 모델. 서버가 허용목록으로 걸러 실제 모델을 고른다.
    body: JSON.stringify({ system, messages, max_tokens: maxTokens, tier: tier === "paid" ? "paid" : "free" }),
  });
  const ct = r.headers.get("content-type") || "";
  if (!r.ok && r.status === 404) throw new Error("프록시 없음");
  if (!ct.includes("json")) throw Object.assign(new Error("프록시 없음"), { status: r.status });
  const data = await r.json();
  // 상태코드를 살려 던진다 — 429(레이트리밋)와 5xx(상류 장애)를 계측에서 갈라야
  // "광고 트래픽에 한도가 걸린 것"과 "앤트로픽이 죽은 것"을 구분할 수 있다.
  if (!r.ok) throw Object.assign(new Error((data && data.error && data.error.message) || `HTTP ${r.status}`), { status: r.status });
  return data;
}
async function callDirect(system, messages, maxTokens) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: maxTokens, system, messages, thinking: { type: "disabled" } }),
  });
  return r.json();
}
/* v19: 아티팩트 내장 API — window.claude.complete(prompt)는 문자열 프롬프트 in / 문자열 out.
   키·배포 없이 아티팩트 런타임이 호출을 물어준다. system+messages를 한 프롬프트로 병합. */
/* v21: 클로드 '앱' 웹뷰 감지 — 2026-07 실측(진단 v01): 앱 안에서는 complete 호출이 아티팩트 자체를 죽인다(짧은 프롬프트도).
   iOS 앱 웹뷰는 UA에 Safari 토큰이 없다. 앱이면 complete를 봉인해 아티팩트 사망을 방지. */
const IS_APP_WEBVIEW = (() => {
  try {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua)) return true;
    if (/Android/.test(ua) && /\bwv\b/.test(ua)) return true;
  } catch (_) {}
  return false;
})();
function hasComplete() { return !IS_APP_WEBVIEW && typeof window !== "undefined" && window.claude && typeof window.claude.complete === "function"; }
async function callComplete(system, messages, maxTokens) {
  const sysText = Array.isArray(system) ? system.map(s => s.text).join("\n") : String(system);
  const convo = messages.map(m => (m.role === "assistant" ? "수호신: " : "너: ") + (typeof m.content === "string" ? m.content : "")).join("\n\n");
  const prompt = sysText + "\n\n═══ 대화 ═══\n" + convo + "\n\n(반드시 위 지시의 JSON만, 백틱·서문 없이 출력)";
  const raw = await window.claude.complete(prompt);
  const txt = typeof raw === "string" ? raw : (raw && (raw.completion != null ? raw.completion : raw.content && raw.content[0] && raw.content[0].text)) || String(raw);
  return { content: [{ type: "text", text: txt }] };
}
/* v20(QC): 폭포수 — 한 경로가 어떤 이유로든 실패하면(호출 오류·쓰레기 응답·파싱 실패) 다음 경로로 자동 이동.
   성공한 경로만 기억, 기억한 경로가 실패하면 기억을 버리고 전체 재탐색. 모바일 브리지가 죽어도 다른 길로 판결이 간다. */
async function callClaude(system, messages, maxTokens, tier) {
  const all = hasComplete() ? ["complete", "server", "direct"] : ["server", "direct"];
  const order = API_MODE && all.includes(API_MODE) ? [API_MODE, ...all.filter((m) => m !== API_MODE)] : all;
  let lastErr = null;
  const fails = [];                    // 경로별 실패 기록 — verdict_failed 의 원인 분류에 쓴다
  for (const mode of order) {
    try {
      // tier 는 서버 경로에만 의미가 있다 — complete(아티팩트)·direct 는 런타임이 모델을 정한다
      const data = mode === "complete" ? await callComplete(system, messages, maxTokens)
        : mode === "server" ? await callServer(system, messages, maxTokens, tier)
        : await callDirect(system, messages, maxTokens);
      if (!data || data.type === "error" || data.error) throw new Error((data && data.error && data.error.message) || "API 오류");
      const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const out = { json: repairJSON(txt), txt };   // 파싱 실패도 이 경로의 실패로 간주 → 다음 경로
      API_MODE = mode;
      return out;
    } catch (e) { lastErr = e; fails.push({ mode, status: e?.status || 0, msg: String(e?.message || "").slice(0, 120) }); if (API_MODE === mode) API_MODE = null; }
  }
  throw Object.assign(IS_APP_WEBVIEW
    ? new Error("클로드 '앱' 안에서는 판결 길이 막혀 있어(앱의 제한) — 사파리에서 claude.ai를 열거나, PC에서 물어봐 줘")
    : (lastErr || new Error("모든 판결 경로가 닿지 않았어")), { fails });
}

/* 판결 실패 원인 분류 — 광고 트래픽에서 무엇이 유저를 막았는지 한 축으로 본다.
   서버(프록시) 경로를 우선한다: 실사용자가 실제로 타는 경로가 그것이다.
   원인을 못 가르면 "question_asked 는 있는데 verdict_shown 이 없다"까지만 알고 끝난다. */
const _serverFail = (e) => (e?.fails || []).find((x) => x.mode === "server") || (e?.fails || [])[0] || null;
function failReason(e) {
  const f = _serverFail(e);
  if (!f) return "unknown";
  const s = f.status || 0;
  if (s === 429) return "rate_limited";       // ← CGNAT 로 정상 유저가 막히는 경우가 여기 잡힌다
  if (s === 403) return "origin_blocked";
  if (s === 400) return "bad_request";
  if (s >= 500) return "upstream_error";
  if (/JSON|파싱|parse/i.test(f.msg)) return "parse_failed";
  return s ? "http_" + s : "network";
}
const failStatus = (e) => (_serverFail(e) || {}).status || 0;

/* v75: 공유 판결 인코딩 — 링크에 판결 자체를 실어, 받은 사람이 홈으로 떨어지지 않고
   '누군가의 수호신이 내린 판결'을 먼저 보게 한다(바이럴 루프 복원). UTF-8 안전 base64url */
const _b64e = (s) => btoa(String.fromCharCode.apply(null, new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const _b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
/* 계측용 인구통계 — 만나이(생일 경과 반영)와 10년 버킷.
   생년월일 원값은 보내지 않는다: 분석에 쓰이는 형태는 나이이고, 원값은 식별성만 키운다. */
function exactAge(y, m, d) {
  const yy = +y, mm = +m, dd = +d;
  if (!yy || !mm || !dd) return null;
  const n = new Date();
  let a = n.getFullYear() - yy;
  const mo = n.getMonth() + 1;
  if (mo < mm || (mo === mm && n.getDate() < dd)) a -= 1;   // 올해 생일 안 지났으면 -1
  return a >= 0 && a < 130 ? a : null;
}
const ageBand = (a) => (a == null ? null : a < 20 ? "10대 이하" : a >= 70 ? "70대 이상" : `${Math.floor(a / 10) * 10}대`);
/* 판결 품질을 세그먼트별로 보기 위한 공통 속성 — 질문 원문·이름·생일 원값은 제외 */
function demoProps(birth, extra) {
  const a = exactAge(birth.y, birth.m, birth.d);
  return { sex: birth.sex || null, age: a, age_band: ageBand(a), job: birth.job || null, rel: birth.rel || null, city: birth.city || null, ...(extra || {}) };
}

/* ── AI 생성물 기록 (2026-07-28) ────────────────────────────────────────────
   판결 품질을 고치려면 결과만이 아니라 "무엇을 근거로 그렇게 말했는지"가 남아야 한다.
     · 축별 찬반이 없으면 HOLD 편중의 원인을 못 짚는다(특정 축이 늘 발목을 잡는지 알 수 없다)
     · 정령 멘트가 없으면 톤을 바꿔도 전후 비교가 불가능하다
     · 근거가 없으면 평가(딱이야/빗나갔어)와 묶어 "어떤 근거가 잘 맞았나"를 낼 수 없다
   질문 원문은 여기에도 절대 넣지 않는다. 축 수·글자 수를 잘라 값이 무한정 커지지 않게 한다.
   축을 키로 쓰는 객체로 담는 이유: PostHog 에서 properties.votes.삼재 처럼 축 하나만 바로 물을 수 있다. */
const AX_MAX = 12, TXT_MAX = 140;
function axisMap(list, pick) {
  if (!Array.isArray(list)) return null;
  const o = {};
  for (const it of list.slice(0, AX_MAX)) {
    const a = String(it?.axis || "").trim().slice(0, 12);
    if (!a) continue;
    const v = String(pick(it) ?? "").trim().slice(0, TXT_MAX);
    if (v) o[a] = v;
  }
  return Object.keys(o).length ? o : null;
}
const voteMap = (votes) => axisMap(votes, (v) => v.v ?? v.vote);
const reasonMap = (reasons) => axisMap(reasons, (r) => r.text);

const encodeShare = (o) => { try { return _b64e(JSON.stringify(o)); } catch (_) { return ""; } };
const decodeShare = (s) => { try { const o = JSON.parse(_b64d(s)); return o && o.v && o.d ? o : null; } catch (_) { return null; } };

/* ═══════════════ 앱 ═══════════════ */
export default function App() {
  const [mem] = useState(loadMemory);             // v16(B1): 부팅 시 기억 1회 로드
  const returning = !!mem;                        // 재회 여부 — 인사·연출 분기
  const [step, setStep] = useState(mem ? 3 : 0);  // 기억이 있으면 온보딩 전체 생략
  const [birth, setBirth] = useState(mem?.birth || { y: "", m: "", d: "", h: "", min: "", city: "", noHour: false, cal: "solar", leap: false, name: "", sex: "", job: "", rel: "" });
  if (birth.name === undefined) birth.name = ""; if (birth.sex === undefined) birth.sex = ""; // v26: 구버전 저장 호환
  const [bstep, setBstep] = useState(0);                      // v26: 동화 도입부 장면 인덱스
  const [addOpen, setAddOpen] = useState(false); const [addName, setAddName] = useState(""); const [addSex, setAddSex] = useState(""); // v26: 조각 보태기
  const [qhintI, setQhintI] = useState(0);   // v71 질문 힌트 롤링 인덱스
  const [agree, setAgree] = useState(() => readConsent());     // 분석 동의(선택) — 거부해도 모든 기능 정상 동작
  const [sharedIn] = useState(() => { try { const sp = new URLSearchParams(window.location.search); const raw = sp.get("v"); return raw ? decodeShare(raw) : null; } catch (_) { return null; } }); // v75: 공유 링크로 유입 시 담긴 판결
  const [sharedGone, setSharedGone] = useState(false);  // v75: '나도 물어볼래'로 공유 화면 닫음
  // 1단계 계측은 동의와 무관하게 항상 켠다(2단계 속성만 동의로 게이트)
  // 계측: 세션 시작. 유입은 first-touch(_superProps.ft_*)가 고정 부착하므로 여기선 이번 방문 경로(ref)만 참고용으로 남긴다.
  useEffect(() => { _consent = readConsent(); _initAnalytics(); let ref = "direct"; try { const sp = new URLSearchParams(window.location.search); ref = sp.get("ref") || sp.get("utm_source") || (sp.get("v") ? "share" : "direct"); } catch (_) {} trackVisit({ returning, ref }); if (sharedIn) track("shared_verdict_view", { dir: sharedIn.d }); }, []);
  const [saju, setSaju] = useState(mem?.saju || null);
  const [zo, setZo] = useState(mem?.zo || null);
  const [moon, setMoon] = useState(mem?.moon || null);
  const [num, setNum] = useState(mem?.num || null);
  const [mbti, setMbti] = useState(mem?.mbti || null);
  const [dims, setDims] = useState({});                       // v23: MBTI 픽션화 — 2택×4 조립
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
  const [formStep, setFormStep] = useState(0);  // v70: 형성 중 단계별 '읽는 중' 연출
  const [awake, setAwake] = useState(false);    // v52: 로비→두 번 두드려 깨움 후 질문 UI 노출
  const [cardOn, setCardOn] = useState(false);  // v6: 판결 카드 등장 게이트
  const [ritual, setRitual] = useState(false);  // v6(D2): 주역 동전 의식
  const [tosses, setTosses] = useState([]);
  const [hexInfo, setHexInfo] = useState(null);
  const [tossing, setTossing] = useState(false);   // v22: 동전이 공중에 떠 있는 0.75초
  const [vals8, setVals8] = useState(mem?.vals8 || []); // v9: 가치의 방 1단계 (24→8)
  const [vals4, setVals4] = useState(mem?.vals4 || []); // v9: 2단계 (8→4)
  const [core, setCore] = useState(mem?.core || null); // v9: 핵심 가치 (4→1)
  const [vstage, setVstage] = useState(0);
  const [bujeok, setBujeok] = useState(false);  // v7: 부적
  const [convo, setConvo] = useState(mem?.convo || []); // v14: 대화 기억 — 이전 질문·판결 누적(최근 6턴)
  const [dailySeen, setDailySeen] = useState(() => { try { return store.getItem(DAILY_KEY) === todayStr(); } catch (_) { return true; } }); // v16(B2)
  const [records, setRecords] = useState(mem?.records || []); // v16(B3): 판결 기록 — 되물음·판결록의 원료
  const [askNote, setAskNote] = useState("");                 // v16(B3): '거슬렀어' 한마디
  const [noting, setNoting] = useState(false);
  const [logOpen, setLogOpen] = useState(false);              // v16(B6): 판결록 펼침
  const [openRec, setOpenRec] = useState(-1);                 // 판결록 행 클릭 → 다시 읽기
  const [streak, setStreak] = useState(mem?.streak || null);  // v16(B7): 연속 방문 {last, count}
  const [dailyOpen, setDailyOpen] = useState(false);          // v18: 아침 문안 노크형 — 청해야 펼친다
  const agitateRef = useRef(false);
  const reactRef = useRef(null);                 // v28: 판결 방향(GO/STOP/HOLD) 반응
  const [introSeen, setIntroSeen] = useState(false); // v28: 수호신 자기소개는 첫 만남 1회만
  const [justBorn, setJustBorn] = useState(false); // v29: 자기소개는 탄생 순간에만 노출
  const [recallSeen, setRecallSeen] = useState(false); // v30: 회상 나레이션→문항 순차 노출
  const [resetAsk, setResetAsk] = useState(false); // v30: 재설정 앱내 확인
  const restRef = useRef(false);                 // v29: 판결 대기·정독 중 캔버스 저프레임(메인스레드 양보)
  const detailArgsRef = useRef(null);            // v16: 콜2 재시도용 인자 보관

  useEffect(() => { if (step === 3) { if (returning) { setPhase(1); return; } setPhase(0); setFormStep(0); const si = setInterval(() => setFormStep(s => Math.min(s + 1, FORM_STEPS.length - 1)), 520); const tm = setTimeout(() => { setPhase(1); setJustBorn(true); clearInterval(si); }, 3200); const tb = setTimeout(() => setJustBorn(false), 10500); return () => { clearInterval(si); clearTimeout(tm); clearTimeout(tb); }; } }, [step, returning]);
  useEffect(() => { if (step !== 3 || !awake || ritual || res || q) return; const t = setInterval(() => setQhintI(i => (i + 1) % QHINTS.length), 2800); return () => clearInterval(t); }, [step, awake, ritual, res, q]);  // v71 질문 힌트 롤링(빈 칸일 때만)
  useEffect(() => { restRef.current = (res && cardOn) ? 300 : (busy || res) ? 46 : 0; }, [busy, res, cardOn]); // v30: 카드 뜨면 수호신 사실상 정지(스크롤·클릭 회복)

  // v16(B7): 스트릭 최소형 — 방문일 카운터만. 어제에 이어졌으면 +1, 끊겼으면 1부터
  useEffect(() => {
    if (step !== 3) return;
    const t = todayStr();
    setStreak(prev => {
      if (prev && prev.last === t) return prev;
      const y = new Date(); y.setDate(y.getDate() - 1);
      const ys = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
      return { last: t, count: prev && prev.last === ys ? prev.count + 1 : 1 };
    });
  }, [step]);

  // v16(B1): 수호신 완성 후엔 조각·대화를 기억한다 — 재방문 온보딩 0초
  useEffect(() => {
    if (step === 3 && saju && mbti && core) {
      saveMemory({ birth, saju, zo, moon, num, mbti, vals8, vals4, core, convo, records, streak });
    }
  }, [step, saju, mbti, core, convo, records, streak]);

  const pickDim = (k, letter) => {                          // v23: 기억 확인 — 4행 완성 시 MBTI 조립
    const nd = { ...dims, [k]: letter };
    setDims(nd);
    if (nd.EI && nd.SN && nd.TF && nd.JP) setMbti(nd.EI + nd.SN + nd.TF + nd.JP);
  };
  const pick = (v) => { // v9: 가치의 방 선택
    if (vstage === 0) setVals8(vals8.includes(v) ? vals8.filter(x => x !== v) : vals8.length < 6 ? [...vals8, v] : vals8);      // v22: 6개
    else if (vstage === 1) setVals4(vals4.includes(v) ? vals4.filter(x => x !== v) : vals4.length < 3 ? [...vals4, v] : vals4);  // v22: 3개
    else setCore(core === v ? null : v);
  };

  const doReveal = () => {
    track("birth_submitted", demoProps(birth, { noHour: !!birth.noHour, cal: birth.cal, hasName: !!birth.name }));
    const y = +birth.y, m = +birth.m, d = +birth.d, h = birth.noHour ? 12 : +birth.h, mi = birth.noHour || birth.min === "" ? 0 : +birth.min;
    if (!y || !m || !d || y < 1900 || y > new Date().getFullYear() || m < 1 || m > 12 || d < 1 || d > 31) { track("input_rejected", { field: "birth_date", reason: "range" }); setErr("생년월일을 확인해줘. 너를 또렷하게 보려면 정확해야 해."); return; }
    if (!birth.noHour && (birth.h === "" || h < 0 || h > 23)) { track("input_rejected", { field: "birth_hour", reason: "range" }); setErr("태어난 시(0~23시)를 알려주거나 '모름'을 선택해줘."); return; }
    if (!birth.noHour && birth.min !== "" && (mi < 0 || mi > 59)) { track("input_rejected", { field: "birth_min", reason: "range" }); setErr("분은 0~59 사이로 알려줘."); return; }
    setErr("");
    let sy = y, sm = m, sd = d;                                 // v25: 음력이면 양력으로 정규화 — 이후 모든 계산은 양력 기준
    if (birth.cal === "lunar") {
      const s = lunar2solar(y, m, d, !!birth.leap);
      // 음력 변환 실패는 유저 실수가 아니라 만세력 테이블의 구멍일 수 있다 — 온보딩을 통째로 막으므로 반드시 본다
      if (!s) { track("input_rejected", { field: "lunar", reason: "convert_failed", leap: !!birth.leap }); setErr(`음력 ${y}.${m}.${d}${birth.leap ? " 윤달" : ""}을 못 찾았어. 날짜나 윤달 여부를 확인해줘.`); return; }
      sy = s.y; sm = s.m; sd = s.d;
      setBirth(b => ({ ...b, cal: "solar", leap: false, y: String(sy), m: String(sm), d: String(sd), lunarNote: `음력 ${y}.${m}.${d}${birth.leap ? "(윤달)" : ""}` }));
    }
    setSaju(calcSaju(sy, sm, sd, h, mi, birth.noHour, cityLon(birth.city)));
    setZo(getZodiac(sm, sd));
    setMoon(moonPhase(sy, sm, sd));
    setNum(lifePath(sy, sm, sd));
    setStep(2); setReveal(0);
    [1, 2, 3, 4, 5].forEach((k, i) => setTimeout(() => setReveal(k), 350 + i * 1150)); // v23: 항목당 1.15s — 절정을 읽게 한다
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
  const toss = () => { if (tosses.length >= 6 || busy || tossing) return; setTossing(true); setTimeout(() => { setTossing(false); agitateRef.current = true; setTimeout(() => { agitateRef.current = false; }, tosses.length >= 5 ? 1400 : 600); finalize([...tosses, oneCoin()]); }, 750); }; // v23: 낙착마다 존재가 일렁인다
  const tossAll = () => { if (tosses.length >= 6 || busy || tossing) return; setTossing(true); setTimeout(() => { setTossing(false); agitateRef.current = true; setTimeout(() => { agitateRef.current = false; }, 1400); const nt = [...tosses]; while (nt.length < 6) nt.push(oneCoin()); finalize(nt); }, 900); }; // 한 번에

  // v15: 콜2 — 확정된 판결의 '근거'만 풀어쓴다(백그라운드, 클릭 전에 미리 로드)
  const fetchDetail = async (system, priorConvo, userText, r1, isRetry = false) => {
    setDetailBusy(true);
    const _t0 = performance.now();
    try {
      // S3(몸·병)는 근거 층에서도 길흉을 점치지 않는다 — 여기서 "사주가 흉하다"가 새어나가면 앞면의 넘김이 무의미해진다.
      const s3Line = r1.scope === "S3" ? ` [S3] 이 판결은 몸·병 영역이라 넘김 처리됐다. reasons는 길흉 예언이 아니라 '이 사람의 기질이 몸을 어떻게 대하는가'(무리하는 편인지·참는 편인지)로만 쓴다. 병세·완치·수명을 점치는 문장 절대 금지. funLine은 빈 문자열. disclaimer 필수.` : "";
      // 콜1이 이미 축별로 표를 냈다. 콜2는 그 표를 **설명**할 뿐 새로 판정하지 않는다.
      //   이게 없으면 콜2가 자기 마음대로 vote 를 붙여서, 앞면 결론과 뒷면 근거가 따로 노는 판결이 나간다.
      const voteLine = Array.isArray(r1.votes) && r1.votes.length
        ? `\n[콜1이 이미 낸 지표 표 — 이 표를 그대로 설명한다. 축을 빼거나 vote 를 바꾸지 마라]\n${r1.votes.map((v) => `- ${v.axis}: ${v.v || v.vote}`).join("\n")}`
        : "";
      const explainMsg = { role: "user", content: `${userText}\n\n[이미 확정된 판결] direction=${r1.direction} / verdict="${r1.verdict}" / 총 ${r1.total} 중 반대 ${r1.against}.${voteLine}${s3Line} 이 판결을 절대 뒤집지 말고, 이 결론의 근거만 아래 JSON으로만 응답: {"subline":"수호신의 한 줄","reasons":[{"axis":"사주|달|별자리|MBTI|수비학|주역|가치|삼재|토정비결|마야","vote":"GO|STOP|중립","text":"용어 — 쉬운 풀이 형식의 근거 1줄(70자 이내)"}],"funLine":"정령(달 별자리) 한마디","disclaimer":"투자·법률·의료(몸·병)일 때만, 없으면 빈 문자열"}. reasons엔 위 표의 축을 전부 같은 vote 로 넣는다 — 특히 '마야'(촐킨 톤·날개) 축은 매번 반드시 포함(자주 누락됨). **각 근거는 '용어 — 쉬운 풀이' 병기다**: 지표 이름·값을 짚고(무오 대운·중수감·촐킨 4의 톤 등) 곧바로 쉬운 말로 풀어준다. 사주 보러 가면 용어를 말한 뒤 반드시 풀이를 붙여주는 것과 같다. subline은 앞면 톤이므로 어려운 말 없이 쉬운 한 줄. 프로필에 십성 분포·신살·세운이 있으면 '사주' 축 근거에서 그 실제 값을 우선 인용한다(예: "편재 둘 — 크게 도는 돈이 네 그릇이야", "암록 — 숨은 복이 받쳐줘").` };
      const { json: r2 } = await callClaude(system, [...priorConvo, explainMsg], 2000);   // 근거를 용어+풀이로 병기하면서 1500에선 잘렸다
      setDetail(r2);
      // L3(지표별 근거)는 제품의 핵심 차별점이다. 실패율과 소요시간을 모르면 개선 근거가 없다.
      track("detail_shown", { ms: Math.round(performance.now() - _t0), dir: r1?.direction || null, retry: !!isRetry, axes: Array.isArray(r2?.reasons) ? r2.reasons.length : 0,
        subline: r2?.subline || null,        // 카드 앞면 설명 한 줄
        funline: r2?.funLine || null,        // 정령 멘트 — 톤 개선의 유일한 측정 대상
        reasons: reasonMap(r2?.reasons),     // 지표별 근거 전문(축별)
        disclaimer: r2?.disclaimer || null });
    } catch (e) {
      setDetail({ _err: true });
      track("detail_failed", { reason: failReason(e), status: failStatus(e), ms: Math.round(performance.now() - _t0), dir: r1?.direction || null, retry: !!isRetry });
    }
    setDetailBusy(false);
  };

  const [shared, setShared] = useState(false);   // v53: 판결 공유 피드백
  const [rated, setRated] = useState(0);         // v75: 판결 평가(1 빗나감 · 2 글쎄 · 3 딱) — 0=미평가
  const [lean, setLean] = useState("");          // v54: 판결 전 내심 → v72 프롬프트 반영(어조 참고용)
  const [hesit, setHesit] = useState("");        // v72: 왜 망설이는지(고민 종결 근거)
  const [paywall, setPaywall] = useState("");    // v54: 복채/심층 fake-door
  const [letterIntent, setLetterIntent] = useState(false);  // 지시서 5: '받을게'까지 누른 지불 의사
  const [belief, setBelief] = useState(() => readBelief());   // D3: 신자/비신자 — 한 번만 묻는다
  const [letter, setLetter] = useState(false);                // D4: 서신 fake-door — 판결마다 초기화
  const [letterStage, setLetterStage] = useState("");         // v104: "" | "seal"(5초) | "wait"(2초) — 결제 후 대기 연출
  const [letterSent, setLetterSent] = useState(false);        // v104: 로비로 돌아온 뒤 수호신 한마디를 띄우는 표식
  const [letterDoc, setLetterDoc] = useState(null);           // v105: 콜3 결과 {chapters,closing} | {_err:true}
  const [letterBusy, setLetterBusy] = useState(false);        // v105: 서신을 쓰는 중
  const [letterOpen, setLetterOpen] = useState(false);        // v105: 서신 전문 읽기 화면
  const [letterRated, setLetterRated] = useState(0);          // v105: 값했나 평가 — 0 미평가 · 1 아니다 · 2 값했다
  const [letterIdx, setLetterIdx] = useState(-1);             // v105.2: 지금 읽는 서신이 몇 번째 판결의 것인가(번호·저장에 쓴다)
  const [boxOpen, setBoxOpen] = useState(false);              // v105.2: 홈 서신함 펼침
  /* 서신은 판결과 **같은 재료**로 써야 한다. 여기 담아두지 않고 서신 시점에 다시 만들면
     그 사이 바뀐 상태(다음 질문 등)가 섞여 카드와 서신이 어긋난다. 판결이 성사된 순간의 스냅샷을 잡아둔다. */
  const letterCtxRef = useRef(null);
  const shareVerdict = async () => {
    if (!res) return;
    track("verdict_shared", { dir: res.direction, mode: "ritual" });
    const text = `"${q}"\n→ ${res.direction}. ${res.verdict}\n\n— 내 수호신의 판결, 비나리`;
    // v75: 판결을 링크에 실어 보낸다 — 받은 사람이 홈이 아니라 이 판결을 먼저 보게
    const payload = { q, d: res.direction, v: res.verdict, s: (detail && !detail._err ? detail.subline : "") || "", n: (birth.name || "").trim(), a: res.against || 0, t: res.total || 0, c: res.category || "", hx: hexInfo ? { n: hexInfo.name, t: (hexInfo.moving && hexInfo.moving.length ? hexInfo.toName : "") } : null };
    const enc = encodeShare(payload);
    const url = enc ? `https://binari-sepia.vercel.app/?v=${enc}` : "https://binari-sepia.vercel.app/?ref=share";
    try {
      if (navigator.share) { await navigator.share({ title: "비나리 — 수호신의 판결", text, url }); return; }
    } catch (_) { return; } // 유저 취소 포함 — 조용히
    try { await navigator.clipboard.writeText(`${text}\n${url}`); setShared(true); setTimeout(() => setShared(false), 2200); } catch (_) {}
  };
  const exportMemory = () => {                             // v54: iOS 7일 localStorage 소멸 임시 방어
    try {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("binari.") === 0) data[k] = localStorage.getItem(k); }
      const blob = new Blob([JSON.stringify({ _binari: 1, at: new Date().toISOString(), data })], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "binari-memory.json"; document.body.appendChild(a); a.click(); a.remove();
      track("profile_exported");
    } catch (_) {}
  };
  const importMemory = (file) => {
    const rd = new FileReader();
    rd.onload = () => { try { const j = JSON.parse(String(rd.result)); if (!j || j._binari !== 1 || !j.data) return; Object.keys(j.data).forEach((k) => { if (k.indexOf("binari.") === 0) localStorage.setItem(k, j.data[k]); }); track("profile_imported"); window.location.reload(); } catch (_) {} };
    rd.readAsText(file);
  };
  const wakeTapRef = useRef(0);
  /* 수호신을 얼마나 만졌는가 = 애착 지표. 탭 하나하나를 이벤트로 보내면 기록이 폭증하므로
     방문 내내 세어 두었다가 화면을 떠날 때 한 건으로 묶어 보낸다.
     기록은 1건인데 "몇 번 만졌고 얼마나 오래 붙들었는지"는 그대로 남는다. */
  const touchRef = useRef({ taps: 0, first: 0, last: 0, sent: false });
  const tryWake = () => {                                   // v52: 수동 더블탭(모바일·데스크탑 동일)
    const now = performance.now();
    const t = touchRef.current;
    t.taps += 1; t.last = now; if (!t.first) t.first = now;
    if (now - wakeTapRef.current < 350) { wakeTapRef.current = 0; if (!awake) { setAwake(true); trackVisitOnce("guardian_wake", {}); } }
    else { wakeTapRef.current = now; }
  };
  // v104: 화면만 로비로 되돌린다(계측 없음). 유저가 X를 눌러 나가는 경우와
  //       서신 대기 연출이 끝나 자동으로 돌아가는 경우가 같은 상태를 공유하되, 이벤트는 서로 달라야 한다.
  const resetToLobby = () => {
    setRes(null); setDetail(null); setWhy(false); setDetailBusy(false); setQ(""); setCardOn(false); setRitual(false); setTosses([]); setHexInfo(null); setBujeok(false); setLean(""); setHesit(""); setPaywall(""); setAwake(false); setRated(0); setLetter(false); setLetterIntent(false);
  };
  const backToLobby = () => {                               // v56: 판결 화면 탈출구(X · 로비 복귀)
    track("another_question", { after_why: why });
    // 유저가 스스로 나가는 길에서는 서신함까지 치운다. 대기 연출이 끝나 돌아오는 길(resetToLobby)과 다른 점이 이것뿐이다.
    setLetterSent(false); setLetterDoc(null); setLetterOpen(false); setLetterRated(0); resetToLobby();
  };
  const rateVerdict = (score) => {                          // v75: 판결 평가 — 정확도 피드백 수집(계측 + 기록에 부착)
    if (rated) return;
    setRated(score);
    track("verdict_rated", demoProps(birth, { score, dir: res?.direction, mode: "ritual", cat: res?.category || null, tone: res?.tone || null, mbti: mbti || null, element: saju?.main || null }));
    setRecords(prev => { if (!prev.length) return prev; const nx = prev.slice(); nx[nx.length - 1] = { ...nx[nx.length - 1], rating: score }; return nx; });
  };

  // D3 — 신념 1문항. 한 번 답하면 고정 속성이 되어 이후 모든 이벤트에 따라붙는다(리텐션을 신념별로 가르는 축).
  const answerBelief = (v) => {
    if (belief) return;
    saveBelief(v); setBelief(v);
    track("belief_answered", { belief: v, after_verdicts: records.length });
  };

  // D4 — 결제 fake-door. 클릭만 세고 결제는 만들지 않는다.
  //   노출 = verdict_shown 이므로 클릭률 = letter_clicked / verdict_shown 으로 계산된다.
  const openLetter = () => {
    if (letter) return;
    setLetter(true);
    const _p = demoProps(birth, { dir: res?.direction || null, cat: res?.category || null, mode: "ritual", nth_verdict: records.length });
    track("letter_clicked", _p);                 // 기존 이벤트 유지 — 이름 바꾸면 과거 데이터와 끊긴다
    track("letter_price_shown", { ..._p, price: LETTER_PRICE });   // 1단계: 가격·미리보기를 본 시점
  };
  /* 2단계: 가격을 보고도 '받을게'를 누른 사람만 지불 의사로 센다(호기심과 분리).
     v105.2 — 여기서 **영수증을 먼저 남긴다.** 서신 본문보다 영수증이 먼저다:
     본문 생성이 실패하든 유저가 앱을 닫든, "이 사람은 이 판결에 값을 치렀다"는 사실이 남아 있어야
     나중에 다시 써 줄 수 있다. 산 사람이 못 받는 상황을 코드가 구조적으로 못 만들게 하는 것이다. */
  const confirmLetterIntent = () => {
    if (letterIntent) return;
    setLetterIntent(true);
    setLetterStage("seal");   // v104: 여기서부터 대기 연출 — 결제창은 없다(fake door)
    track("letter_intent_confirmed", demoProps(birth, { dir: res?.direction || null, cat: res?.category || null, mode: "ritual", nth_verdict: records.length, price: LETTER_PRICE }));
    // 재발행에 필요한 재료를 판결 기록에 붙인다. userText 한 덩이(수백 자)면 같은 서신을 다시 쓸 수 있다 —
    // system(프로필)은 같은 사람이니 그때 다시 조립하면 되고, 통째로 저장하면 저장소가 금방 찬다.
    const _mat = { at: Date.now(), lu: letterCtxRef.current?.userText || "", reasons: (detail?.reasons || []).map((r) => ({ axis: r.axis, vote: r.vote, text: r.text })), hesit: hesit || "" };
    setRecords((prev) => { if (!prev.length) return prev; const nx = prev.slice(); nx[nx.length - 1] = { ...nx[nx.length - 1], paid: LETTER_PRICE, lmat: _mat }; return nx; });
    writeLetter();            // v105: 연출을 기다리지 않고 지금 쓰기 시작한다 — 7초가 대기시간을 그만큼 먹어준다
  };
  /* v105 — 콜3. 판결을 낸 그 재료로 서신을 쓴다. 최초 발행과 재발행이 같은 함수를 탄다
     (두 벌로 갈리면 재발행본만 조용히 규칙이 낡는다).
     실패해도 앱은 멈추지 않는다: 영수증은 이미 남아 있으므로 언제든 다시 부를 수 있다. */
  const runLetter = async (mat) => {
    const outs = await Promise.allSettled(LETTER_PARTS.map((part, i) => callClaude(
      mat.system, [{ role: "user", content: `${mat.userText}\n\n${letterTask(mat.res, { reasons: mat.reasons }, mat.hesit, part)}` }], LETTER_TOK[i], "paid")));
    const ch = []; let closing = ""; let shape = null;
    outs.forEach((o) => {
      if (o.status !== "fulfilled") return;
      const { json, txt } = o.value;
      const got = normChapters(json);
      if (!got.length && !shape) shape = letterShape(json, txt);   // 왜 못 읽었는지 한 조각만 남긴다
      ch.push(...got);
      if (!closing) closing = _pickStr(json || {}, ["closing", "맺음", "closing_line"]);
    });
    // 제목이 비면 정해진 목차로 메운다 — 본문만 오면 그건 우리가 채울 수 있는 결손이다
    const doc = { chapters: ch.slice(0, 5).map((c, i) => ({ t: c.t || LETTER_SECTIONS[i] || "", body: c.body })), closing: closing.slice(0, 60), at: Date.now() };
    if (doc.chapters.length < 3) throw Object.assign(new Error(`장이 ${doc.chapters.length}개뿐`), { shape });   // 반쪽을 파느니 실패로 둔다
    return doc;
  };
  const writeLetter = async () => {
    const ctx = letterCtxRef.current;
    const _base = () => demoProps(birth, { dir: res?.direction || null, cat: res?.category || null, scope: res?.scope || null, nth_verdict: records.length });
    if (!ctx || !res) { setLetterDoc({ _err: true }); track("letter_write_failed", { ..._base(), reason: "no_context" }); return; }
    setLetterBusy(true);
    const t0 = performance.now();
    try {
      const doc = await runLetter({ system: ctx.system, userText: ctx.userText, res, reasons: detail?.reasons || [], hesit });
      setLetterDoc(doc);
      // 판결 기록에 붙여 둔다 — 홈 서신함에서 언제든 다시 열 수 있고, 새로고침에도 살아남는다
      setRecords((prev) => { if (!prev.length) return prev; const nx = prev.slice(); nx[nx.length - 1] = { ...nx[nx.length - 1], letter: doc }; return nx; });
      track("letter_written", { ..._base(), ms: Math.round(performance.now() - t0), chapters: doc.chapters.length, chars: doc.chapters.reduce((a, c) => a + c.body.length, 0) });
    } catch (e) {
      setLetterDoc({ _err: true });
      // shape: 응답이 오긴 왔는데 못 읽은 경우 '어떤 키로 왔나'를 남긴다(본문은 담지 않는다).
      //        이게 없어서 첫 실패 때 원인을 못 짚고 서버 로그부터 뒤져야 했다.
      track("letter_write_failed", { ..._base(), ms: Math.round(performance.now() - t0), reason: failReason(e), status: failStatus(e), ...(e?.shape || {}) });
    } finally { setLetterBusy(false); }
  };
  /* v105.2 재발행 — 산 사람은 언제든 다시 받는다. 값은 다시 받지 않는다.
     본문이 날아가도 영수증(paid)과 재료(lmat)가 남아 있으면 여기서 되살린다. */
  const reissueLetter = async (i) => {
    const rec = records[i];
    if (!rec || letterBusy) return;
    if (rec.letter) { setLetterDoc(rec.letter); setLetterIdx(i); setLetterOpen(true); track("letter_opened", demoProps(birth, { dir: rec.direction || null, reissued: false })); return; }
    if (!rec.lmat?.lu) { setLetterDoc({ _err: true }); setLetterIdx(i); return; }   // 재료까지 없으면 여기서 되살릴 방법이 없다
    setLetterBusy(true); setLetterIdx(i);
    const t0 = performance.now();
    try {
      const doc = await runLetter({ system: makeSystem(), userText: rec.lmat.lu, res: { direction: rec.direction, verdict: rec.verdict, category: rec.cat, scope: rec.scope }, reasons: rec.lmat.reasons || [], hesit: rec.lmat.hesit || "" });
      setRecords((prev) => { const nx = prev.slice(); if (nx[i]) nx[i] = { ...nx[i], letter: doc }; return nx; });
      setLetterDoc(doc); setLetterRated(0); setLetterOpen(true);
      track("letter_reissued", demoProps(birth, { dir: rec.direction || null, ms: Math.round(performance.now() - t0), chapters: doc.chapters.length }));
    } catch (e) {
      setLetterDoc({ _err: true });
      track("letter_reissue_failed", demoProps(birth, { dir: rec.direction || null, reason: failReason(e), status: failStatus(e), ...(e?.shape || {}) }));
    } finally { setLetterBusy(false); }
  };
  const openLetterDoc = () => {
    if (!letterDoc || letterDoc._err) return;
    setLetterIdx(records.length - 1);
    setLetterOpen(true);
    track("letter_opened", demoProps(birth, { dir: res?.direction || null, nth_verdict: records.length }));
  };
  // 서신을 기기 밖으로 꺼내 둔다. localStorage 는 iOS 에서 7일이면 지워질 수 있는 그릇이라,
  // 유료 물건을 그 하나에만 맡길 수 없다. 파일은 유저가 영구히 갖는 사본이다.
  const saveLetterFile = () => {
    if (!letterDoc || letterDoc._err) return;
    const rec = records[letterIdx] || {};
    const body = [`수호신의 서신 · ${letterNo(rec)}`, rec.q ? `물음: ${rec.q}` : "", rec.direction ? `판결: ${rec.direction} — ${rec.verdict || ""}` : "", "",
      ...letterDoc.chapters.map((c, i) => `${i + 1}. ${c.t}\n${c.body}\n`), letterDoc.closing ? `— ${letterDoc.closing}` : "",
      "", "비나리 · 이 서신은 AI가 생성한 내용입니다(재미로 보는 참고용)"].filter((s) => s !== null).join("\n");
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
      a.download = `비나리-서신-${letterNo(rec)}.txt`; document.body.appendChild(a); a.click(); a.remove();
      track("letter_saved", demoProps(birth, { no: letterNo(rec) }));
    } catch (_) {}
  };
  // 완성도를 재는 유일한 질문. 값했나/아니다 두 갈래로만 묻는다 — 다섯 단계는 아무도 안 고른다.
  const rateLetter = (v) => {
    if (letterRated) return;
    setLetterRated(v);
    track("letter_rated", demoProps(birth, { worth: v === 2, price: LETTER_PRICE, chapters: letterDoc?.chapters?.length || 0 }));
  };
  /* v104: 봉인(5초) → 대기 문구(2초) → 로비.
     화면을 떠나거나 새 판결을 시작하면 타이머는 정리된다(클린업). 단계 진입마다 이벤트가 남으므로
     "받을게는 눌렀는데 7초를 못 기다리고 나갔다"가 데이터로 보인다. */
  useEffect(() => {
    if (!letterStage) return;
    const _p = () => demoProps(birth, { dir: res?.direction || null, cat: res?.category || null, mode: "ritual", nth_verdict: records.length, price: LETTER_PRICE });
    if (letterStage === "seal") {
      track("letter_seal_shown", _p());
      const t = setTimeout(() => setLetterStage("wait"), LETTER_SEAL_MS);
      return () => clearTimeout(t);
    }
    track("letter_wait_shown", _p());
    const t = setTimeout(() => {
      track("letter_lobby_returned", _p());
      setLetterStage(""); setLetterSent(true); resetToLobby();
    }, LETTER_WAIT_MS);
    return () => clearTimeout(t);
  }, [letterStage]);   // eslint-disable-line react-hooks/exhaustive-deps
  /* v105.2: 프로필·system 조립을 판결에서 떼어냈다. 서신 재발행이 같은 재료로 다시 써야 하는데,
     조립 코드가 judge() 안에만 있으면 재발행 경로가 프로필을 두 벌로 만들게 된다(이 리포가 제일 조심하는 일).
     한 곳에서만 만들어야 판결과 서신이 같은 사람을 본다. */
  const makeSystem = () => {
    const mp = moonPlacements(+birth.y, +birth.m, +birth.d, +birth.h || 12, +birth.min || 0, !!birth.noHour); // v22
    const tzk = tzolkin(jdn(+birth.y, +birth.m, +birth.d));                                                   // v22
    const sj = samjae(saju.yJ, new Date().getFullYear());
    const du = birth.sex ? daeun(+birth.y, +birth.m, +birth.d, birth.noHour ? 12 : +birth.h, birth.noHour || birth.min === "" ? 0 : +birth.min, !!birth.noHour, cityLon(birth.city), birth.sex === "M", new Date().getFullYear()) : null; // v25: 대운
    // v14: 세션 내내 고정인 프로필(주역 제외)은 system에 담아 프롬프트 캐싱 → 2번째 질문부터 빨라짐
    const _ms = myeongsikText(saju, birth.sex, new Date());   // v101: 십성·신살·세운·길일·직업 — 문자열 확장(구조 불변)
    const profile = `${birth.name ? `호칭: ${birth.name}\n` : ""}${birth.sex ? `성별: ${birth.sex === "M" ? "남" : "여"}\n` : ""}사주: ${saju.pillars.년}년 ${saju.pillars.월}월 ${saju.pillars.일}일 ${saju.pillars.시}시 / 오행 ${Object.entries(saju.counts).map(([k, v]) => k + v).join(" ")} / 일간(나) ${saju.dayGan || "?"}·오행중심 ${saju.main}${saju.nayin ? ` / 납음 ${saju.nayin}` : ""}
별자리: ${zo.name}(${zo.el}) / 달: 태어난 밤의 위상 ${moon.name} · 달 별자리 ${mp.moonSign}(정서·내면) · 나크샤트라 ${mp.nakshatra}(베다 27수)
마야 촐킨: ${tzk.tone}의 톤 · ${tzk.sign}
MBTI: ${mbti || "미입력"} / 수비학 라이프패스: ${num}${du ? (du.pre ? `\n대운: 아직 첫 대운 전 — 대운수 ${du.num}세부터 ${du.dir}(지금은 월주 기운이 지배)` : `\n대운(현재 인생 시기): ${du.ganji}(${du.el}) 대운 · ${du.startAge}~${du.endAge}세 · ${du.dir} — 10년 단위 큰 흐름`) : ""}${sj ? `\n삼재: 올해 ${sj} (입춘 경계 근사)` : ""}${tj ? `\n토정비결(당년 신수): 괘상수 ${tj.code} (상${tj.sang} 중${tj.jung} 하${tj.ha}), 음력 생일 ${tj.lunar}` : ""}${core ? `\n가치여정(워드소팅 16→6→3→1): 핵심 ${core} / 지킨 가치 ${vals4.filter(v => v !== core).join("·")} / 마지막에 내려놓은 ${vals8.filter(v => !vals4.includes(v)).join("·")}` : ""}${birth.job || birth.rel ? `\n요즘 삶의 국면(맥락): ${[birth.job, birth.rel].filter(Boolean).join(" · ")} — 질문의 무게·의미를 이 맥락에 비춰 읽되, 판결 근거는 지표다` : ""}${_ms}`;
    return [{ type: "text",
      text: `${SYS}\n\n## 대화 연속성\n이전 대화가 있으면 흐름을 이어 자연스럽게 응대한다(단, 판결 근거는 늘 아래 지표다). 같은 고민의 재질문이면 앞선 판결과 일관되게, 명백히 새 고민이면 처음부터 새로 판정한다.\n\n---\n유저 프로필(고정):\n${profile}`,
      cache_control: { type: "ephemeral" } }];
  };
  const judge = async (hi) => {   // v103: quick 인자 제거 — 판결은 한 가지 무게로만 낸다
    if (!q.trim() || busy) return;
    const _jt0 = performance.now();          // 판결 소요시간 — 대기가 길면 이탈한다. 이 값 없이는 원인을 못 짚는다
    const _prevRec = records.length ? records[records.length - 1] : null;
    // 되물음은 '앞선 판결이 있을 때'만 성립한다 — 첫 질문의 "어떤 사람이 좋을까"는 되물음이 아니라 그냥 질문이다.
    const _reask = !!_prevRec && isReask(q);
    const _sHint = scopeHint(q);
    track("question_asked", demoProps(birth, { mode: "ritual", qlen: q.trim().length, ritual: !!hi, lean: lean || "skip", hesit: hesit || null, mbti: mbti || null, core_value: core || null, element: saju?.main || null, zodiac: zo?.name || null, scope_hint: _sHint, reask: _reask, reask_depth: _reask ? records.filter(r => isReask(r.q)).length + 1 : 0, after_letter: letterSent }));   // v104 after_letter: 서신 대기 중에 한 번 더 물었는가
    setBusy(true); setErr(""); setRes(null); setDetail(null); setWhy(false); setFlip(false); setCardOn(false); setRated(0); setLetter(false); setLetterIntent(false); setLetterStage(""); setLetterSent(false); setLetterDoc(null); setLetterOpen(false); setLetterRated(0); setBoxOpen(false); reactRef.current = null; setIntroSeen(true);
    try {
      // 주역 괘는 질문마다 달라지므로 유저 턴에
      const qExtra = hi ? `\n[이번에 청한 주역] 본괘 ${hi.name}${hi.moving.length ? ` / 변효 ${hi.moving.map(n => n + 1).join(",")}효 / 지괘 ${hi.toName}` : ""}` : "";
      const fuRec = [...records].reverse().find(r => r.followUp && r.followUp !== "later");
      const fuLine = fuRec ? `\n[지난 판결 이행] "${fuRec.q}" → ${fuRec.direction}, 유저는 ${fuRec.followUp === "did" ? "따랐다" : `거슬렀다${fuRec.note ? ` (그 후: ${fuRec.note})` : ""}`}` : "";
      const _nd = new Date(); const _tmoon = moonPhase(_nd.getFullYear(), _nd.getMonth() + 1, _nd.getDate());
      // lean(어느 쪽)은 프롬프트에 넣지 않는다 — 유저 결론에 앵무새처럼 영합하는 걸 막고, 방향은 오직 지표로.
      const innerLine = hesit ? `\n[유저의 망설임 — 판결 방향엔 영향 없음, 어조·공감만] 망설이는 이유: ${hesit} — 방향은 오직 지표로 정하고, 이 두려움/막힘은 판결의 어조로만 어루만진다` : "";
      // 되물음이면 앞 판결을 명시적으로 물려준다 — 이게 없으면 모델이 매번 새로 합산하고, 되물음엔 GO/STOP 축이 없어 HOLD로 내려앉는다.
      const reaskLine = _reask ? `\n[되물음] 유저가 방금 판결("${_prevRec.direction} — ${_prevRec.verdict}")을 못 알아들어 되묻고 있다. 새로 판정하지 말고 direction=${_prevRec.direction}·category=${_prevRec.cat || "A"}를 그대로 승계한 뒤, verdict 자리에 **되물은 그것의 답**을 맨말로 넣는다. 선택지를 줬으면 그중 하나를 고른다. 새 비유 금지.` : "";
      const userText = `질문: ${q}${qExtra}\n[오늘] ${_nd.getFullYear()}년 ${_nd.getMonth() + 1}월 ${_nd.getDate()}일 ${_nd.getHours()}시 · 오늘 밤 달 ${_tmoon.name}${innerLine}${reaskLine}${fuLine}`;
      const system = makeSystem();
      // v105: 서신(콜3)은 이 재료를 그대로 쓴다. 같은 system 이라 프롬프트 캐시도 그대로 먹는다.
      letterCtxRef.current = { system, userText };
      // ── 콜1: 결론만(작은 출력=빠름) → L1 즉시 노출 ──
      const concludeMsg = { role: "user", content: `${userText}\n\n[이번 출력] 아래 JSON만. **votes를 먼저 채우고, 그 표를 세어 direction을 정하고, verdict는 그 direction을 말로 옮긴다.** 결론을 먼저 정해두고 표를 맞추지 마라 — 순서가 곧 판결의 정직함이다.\n{"category":"A|B|C","scope":"S1|S2|S3","votes":[{"axis":"지표명","v":"GO|STOP|중립"}],"tone":"단호|격려|충고","direction":"GO|STOP|HOLD","verdict":"한 문장 단답"}\nvotes엔 이번 판결에 참여한 지표를 전부 넣는다(사주·달·별자리·MBTI·수비학·마야 + 제공된 경우 삼재·가치·주역·토정비결). against·total은 앱이 센다 — 쓰지 마라. reasons·subline·funLine도 이번엔 쓰지 마.` };
      const priorConvo = convo; // 콜2가 쓸 이전 맥락(이번 턴 제외) 스냅샷
      const { json: r1 } = await callClaude(system, [...priorConvo, concludeMsg], 560);   // votes 를 함께 받으므로 320→560
      // 결론을 지표 표에서 산술로 확정 — 모델이 숫자를 지어내거나 표와 다른 결론을 말하지 못하게
      //   단 되물음은 새 판정이 아니라 앞 판결의 '풀이'다 — 표로 방향을 다시 정하면 승계가 깨진다.
      //   실측: "그래서 뭘 하라는 거야?"(앞 판결 GO)에서 표가 1GO:2STOP 이 나와 GO 를 STOP 으로 뒤집었다.
      const _tally = tallyVotes(r1);
      if (_tally) {
        if (!_reask) r1.direction = _tally.dir;      // 되물음이면 모델이 승계한 방향을 그대로 둔다
        r1.against = _tally.against; r1.total = _tally.total;
      }
      // L1 등장 연출(짧게)
      agitateRef.current = true; setRes(r1);
      // scope_level(모델 판정) vs scope_hint(규칙) — 둘이 어긋난 건이 경계 케이스다. 그 목록이 다음 규칙 개정의 근거가 된다.
      const _sLevel = ["S1", "S2", "S3"].includes(r1.scope) ? r1.scope : null;
      track("verdict_shown", demoProps(birth, { dir: r1.direction, cat: r1.category, tone: r1.tone, against: r1.against, total: r1.total, mode: "ritual", lean: lean || "skip", verdict: r1.verdict || null, mbti: mbti || null, element: saju?.main || null, ms: Math.round(performance.now() - _jt0),
        scope_level: _sLevel, scope_hint: _sHint, scope_agree: _sLevel ? _sLevel === _sHint : null, handoff_triggered: _sLevel === "S3", reask: _reask,
        // 표가 없거나(votes_ok=false) 표와 결론이 어긋난(dir_overridden) 비율이 곧 '판결이 지표에서 나오는가'의 지표다
        votes_ok: !!_tally, votes_n: _tally ? _tally.total : 0, dir_overridden: _tally ? _tally.overridden : null,
        votes: voteMap(r1.votes) }));      // 축별 찬반 — HOLD 편중의 원인을 여기서 짚는다
      reactRef.current = { dir: r1.direction, t0: performance.now() };   // v28: 수호신이 판결을 연기
      setTimeout(() => { agitateRef.current = false; }, 700);
      setTimeout(() => { setCardOn(true); }, 1400);                       // 몸짓을 보여준 뒤 카드
      // 대화 기억: 깨끗한 질문 + 확정 결론만 저장(이어묻기용)
      setConvo(prev => [...prev, { role: "user", content: userText }, { role: "assistant", content: `판결: ${r1.direction} — ${r1.verdict} (${r1.total}중 ${r1.against} 반대)` }].slice(-12));
      // actionable=되물음("따랐어?") 대상인가. 되물음 턴과 S3 넘김은 제외 — "뜻이 뭐야"에 대고 따랐냐고 묻는 건 말이 안 되고,
      // 병원 가라는 넘김을 '판결 이행'으로 세면 이행률 지표가 오염된다.
      setRecords(prev => [...prev, { at: Date.now(), q: q.slice(0, 60), direction: r1.direction, verdict: r1.verdict, cat: r1.category, scope: _sLevel, actionable: isDecisionQ(q) && !_reask && _sLevel !== "S3", followUp: null, note: "", rating: 0 }].slice(-50)); // v16(B3) · v73 actionable · v75 rating
      setBusy(false);
      // ── 콜2: 근거는 백그라운드로 미리 로드(유저가 '왜?' 읽는 사이 완성) ──
      detailArgsRef.current = [system, priorConvo, userText, r1]; fetchDetail(system, priorConvo, userText, r1);   // v103: 모든 판결이 근거를 갖는다
      return;
    } catch (e) {
      const m = e?.message || "";
      // 여기가 광고비가 새는 지점이다. 이 track 이 없으면 유저는 막다른 길에서 이탈하는데
      // 데이터에는 "question_asked 는 있고 verdict_shown 이 없다"까지만 남아 원인을 영영 모른다.
      track("verdict_failed", demoProps(birth, { reason: failReason(e), status: failStatus(e), mode: "ritual", qlen: q.trim().length, ms: Math.round(performance.now() - _jt0), nth_verdict: records.length }));
      setErr("판결이 닿지 못했어 · " + (/[가-힣]/.test(m) ? m : "잠시 뒤 다시 청해줘"));
      console.warn("judge:", m);
    }
    setBusy(false);
  };

  const nowY = new Date().getFullYear();
  const hourNow = new Date().getHours();          // v16: 심야 컨텍스트(23~새벽4시)
  const isNight = hourNow >= 23 || hourNow < 4;
  const yearGanji = GAN[((nowY - 4) % 10 + 10) % 10] + JI[((nowY - 4) % 12 + 12) % 12] + "년";
  const tj = saju && birth.y ? tojung(+birth.y, +birth.m, +birth.d, nowY) : null; // v11: 토정비결 당년 신수

  // v16(B2): 아침 문안 데이터 — 재회 유저가 오늘 처음 열었을 때만. 전부 순수 함수(API 0콜)
  // v16(B3): 되물음 — 마지막 판결이 6시간 넘게 미보고면 수호신이 먼저 묻는다(모든 판결을 열린 고리로)
  const lastRec = records.length ? records[records.length - 1] : null;
  // v84: 되물음은 '따를 수 있는 결정'에만 — 저장된 옛 판정(actionable)을 믿지 않고 현재 로직으로 매번 재판정한다
  //      (예전 기록의 actionable:true 때문에 "이얏호오" 같은 헛소리에 '따랐어?'가 뜨던 문제)
  const _lastAct = !!lastRec && isDecisionQ(lastRec.q) && lastRec.actionable !== false;
  const askback = returning && lastRec && lastRec.followUp === null && _lastAct && Date.now() - lastRec.at >= 6 * 3600 * 1000 ? lastRec : null;

  /* 온보딩 화면별 도달 — onboard_start 와 guardian_awaken 사이 9개 화면이 무계측이라
     광고 유입자가 어디서 죽는지 볼 수 없었다. 화면당 1회만 쏘고, 뒤로 갔다 와도 중복 발사하지 않는다.
     (퍼널은 uniq(person_id) 기준으로 보므로 중복이 섞이면 이탈률이 왜곡된다) */
  const _stepSeen = useRef(new Set());
  useEffect(() => {
    const name = step === 1 ? ["name", "birth_date", "birth_time_city", "sex", "context"][bstep]
      : step === 2 ? "mbti"
      : step === 25 ? ["values_16to6", "values_6to3", "values_3to1"][vstage]
      : null;
    if (!name || _stepSeen.current.has(name)) return;
    _stepSeen.current.add(name);
    track("onboard_step", { step: name, idx: _stepSeen.current.size });
  }, [step, bstep, vstage]);

  /* 화면을 떠날 때 / 다시 볼 때 ─ 습관 앱의 두 가지 필수 신호를 여기서 챙긴다.
     ① 떠날 때: 이번 방문에 수호신을 만진 횟수·붙든 시간을 한 건으로 보낸다(애착 지표).
     ② 다시 볼 때: 30분 넘게 떠나 있었으면 새 방문으로 센다.
        모바일은 탭을 닫지 않고 앱을 오가므로, 이게 없으면 하루에 세 번 열어도 1회로 잡힌다. */
  useEffect(() => {
    const onHide = () => {
      const t = touchRef.current;
      if (t.sent || t.taps < 1) return;
      t.sent = true;
      track("guardian_touched", { taps: t.taps, hold_sec: Math.round((t.last - t.first) / 1000) });
    };
    const onVisible = () => {
      if (document.visibilityState === "hidden") { onHide(); return; }
      if (trackVisit({ returning: true, ref: "foreground" })) touchRef.current = { taps: 0, first: 0, last: 0, sent: false };
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHide);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("pagehide", onHide); };
  }, []);

  /* 되물음 노출 — followup_answered 만 있고 노출이 없어 응답률을 못 냈다.
     리텐션 장치라 효과 측정이 안 되면 유지·폐기 판단이 불가능하다. */
  const _askbackSeen = useRef(false);
  useEffect(() => {
    if (!askback || _askbackSeen.current) return;
    _askbackSeen.current = true;
    track("askback_shown", { dir: askback.direction || null, hours_since: Math.round((Date.now() - askback.at) / 3600000) });
  }, [askback]);
  const answerAskback = (fu, note) => {
    const lastRec = records[records.length - 1] || {};
    track("followup_answered", demoProps(birth, { result: fu, direction: lastRec.direction || null, cat: lastRec.cat || null, hasNote: !!note }));
    setRecords(prev => prev.map((r, i) => (i === prev.length - 1 ? { ...r, followUp: fu, note: note || "" } : r)));
    setNoting(false); setAskNote("");
  };

  const asking = phase >= 1 && awake && !res && !busy && !ritual;   // v55: 수호신이 물러난 순수 질문입력 구간
  /* v104: 몸·병·임신출산(S3)에는 서신을 팔지 않는다.
     S3에서 우리가 하는 일은 '판단을 넘기는 것'인데, 넘긴 판단에 4,900원을 받으면 그건 파는 게 아니라 등치는 거다.
     모델 판정(res.scope)과 규칙 판정(scopeHint) 중 하나라도 S3면 버튼을 숨긴다 — 안전 쪽으로 틀린다. */
  const letterOk = !!res && res.scope !== "S3" && scopeHint(q) !== "S3";
  /* 값을 치른 판결들. 본문(letter)이 있든 없든 여기 들어온다 — 없는 건 '다시 받기' 대상이다.
     paid 를 기준으로 잡는 게 핵심: 본문을 기준으로 잡으면 잃어버린 서신이 목록에서 통째로 사라진다. */
  const paidRecs = records.map((r, i) => ({ r, i })).filter(({ r }) => r.paid || r.letter);
  const dailyData = returning && !dailySeen && birth.y ? (() => {
    const bio = biorhythm(+birth.y, +birth.m, +birth.d);
    const d = new Date();
    const mp = moonPhase(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const avg = Math.round((bio.body + bio.emotion + bio.intellect) / 3);
    const mood = avg >= 35
      ? { k: "미는 날", line: "오늘은 흐름이 네 편이야. 미루던 것 하나, 오늘 밀어." }
      : avg <= -35
      ? { k: "고르는 날", line: "오늘 네 리듬은 낮게 흘러. 미는 날이 아니라 고르는 날이야." }
      : { k: "지키는 날", line: "오늘은 크게 벌이지 말고 지키는 날 — 흐름은 내일 또 바뀌어." };
    return { bio, mp, ilju: todayIlju(), mood };
  })() : null;

  const guardianIntro = saju && zo ? `나는 ${saju.nayin ? `'${saju.nayin.split("·")[1] || saju.nayin}'` : (saju.main === "수" ? "깊은 물결" : saju.main === "화" ? "꺼지지 않는 불꽃" : saju.main === "목" ? "자라나는 숲" : saju.main === "금" ? "벼려진 빛" : "단단한 대지")}의 기운을 두른, ${zo.el === "물" ? "안개처럼 흐르는" : zo.el === "불" ? "타오르는 형상의" : zo.el === "공기" ? "바람으로 된" : "산처럼 고요한"} 존재야.` : "";

  return (
    <div className="stage">
      <style>{CSS}</style>
      <VerBadge />

      {sharedIn && !sharedGone && (() => {
        const d = sharedIn.d, isGo = d === "GO", isHold = d === "HOLD";
        const dcls = isGo ? "go" : isHold ? "hold" : "";
        const a = +sharedIn.a || 0, t = +sharedIn.t || 0;
        const dismiss = () => { track("shared_cta", { dir: d }); try { window.history.replaceState({}, "", window.location.pathname); } catch (_) {} setSharedGone(true); };
        const vv = sharedIn.v || "";
        return (
          <section className="scene fade sharedwrap">
            <p className="sharedeyebrow">{sharedIn.n ? `${sharedIn.n}의 수호신이 이렇게 판결했어` : "어떤 이의 수호신이 이렇게 판결했어"}</p>
            <div className="persp sharedcard">
              <div className="vcard">
                <div className="vface">
                  <i className="corner tl">✦</i><i className="corner tr">✦</i><i className="corner bl">✦</i><i className="corner br">✦</i>
                  <span className="vside">運命合意判決</span>
                  <span className="vseal">神</span>
                  {/* 공유 카드는 처음 온 사람이 보는 화면이다 — 'A형'·괘 이름 같은 내부 용어를 여기 두면 아무 뜻도 전달되지 않는다 */}
                  <div className="vtop"><span>BINARI</span><span>{CAT_LABEL[sharedIn.c] || "판결"}</span></div>
                  <p className={`vq ${(sharedIn.q || "").length > 55 ? "s" : ""}`}>{sharedIn.q || "…"}</p>
                  <div className="vdiv"><span>✦</span></div>
                  {t > 0 && a > 0 && a / t >= 0.4 && <p className="split">지표가 갈라섰다 · {t - a} : {a}</p>}
                  <p className={`vv ${dcls} ${vv.length > 40 ? "s" : vv.length > 22 ? "m" : ""}`}>{vv}</p>
                  {sharedIn.s && <p className="sharedsub">“{sharedIn.s}”</p>}
                </div>
              </div>
            </div>
            <button className="btn gold sharedcta" onClick={dismiss}>나도 내 수호신에게 물어볼래</button>
            <p className="sharedfoot">비나리 — 답은 거기에 있어</p>
          </section>
        );
      })()}

      {step === 0 && (
        <section className="scene fade">
          <div className="orb"><DustOrb size={170} stage={0} /></div>
          <p className="line">…불렀어?</p>
          <p className="line d1">어른이 된다는 건, 나를 이루던 것들이 조금씩 흩어지는 일이야.</p>
          <p className="line d2">나는 그 흩어진 조각들이야. 네가 모아주면, 다시 너의 곁이 될 수 있어.</p>
          <div className="row gap lateIn">
            <button className="btn gold" onClick={() => { track("onboard_start"); setStep(1); }}>조각을 모으러 갈래</button>
          </div>
          <p className="brand-mark">비나리 BINARI</p>
          <p className="ainote">수호신의 판결은 AI가 생성합니다 · 재미로 보는 참고예요</p>
          {/* 신뢰 라인(2026-08-02 경쟁분석 반영): 시장 전체가 '만세력 오류·GPT 복붙' 의혹으로 신뢰를 잃는 중 —
              계산 검증과 프라이버시는 우리가 실제로 갖춘 것이라 그대로 쓴다. 검증은 e2e/mansae-test.mjs 28문항. */}
          <p className="ainote">사주 계산(만세력)은 자동검증 28문항을 통과한 엔진이 해요 · 질문 원문은 통계에 기록하지 않아요</p>
        </section>
      )}

      {step === 1 && (
        <section className="scene fade">
          <div className="orb"><DustOrb size={170} stage={0} /></div>
          {bstep === 0 && (
            <div className="bscene" key={0}>
              <p className="line">네 이름을 다시 들려줄래.</p>
              <p className="sub2">어릴 적 내가 부르던 그 이름. 부르고 싶은 이름이면 뭐든 좋아.</p>
              <input className="in wide center" lang="ko" placeholder="…" maxLength={12} value={birth.name} onChange={e => setBirth({ ...birth, name: e.target.value })} />
              <button className="btn gold mt" onClick={() => { setBirth({ ...birth, name: birth.name.trim() }); setBstep(1); }}>{birth.name.trim() ? birth.name.trim() + " — 그래, 기억했어" : "이름 없이 갈래"}</button>
            </div>
          )}
          {bstep === 1 && (
            <div className="bscene" key={1}>
              <p className="line">{birth.name.trim() ? `${birth.name.trim()}, 이제 네가 태어난 순간의 하늘로 데려가 줘.` : "네가 태어난 순간의 하늘로 데려가 줘."}</p>
              <div className="row gap center">
                <input className="in" placeholder="1993" inputMode="numeric" maxLength={4} value={birth.y} onChange={e => setBirth({ ...birth, y: e.target.value })} /><span className="unit">년</span>
                <input className="in sm" placeholder="7" inputMode="numeric" maxLength={2} value={birth.m} onChange={e => setBirth({ ...birth, m: e.target.value })} /><span className="unit">월</span>
                <input className="in sm" placeholder="15" inputMode="numeric" maxLength={2} value={birth.d} onChange={e => setBirth({ ...birth, d: e.target.value })} /><span className="unit">일</span>
              </div>
              <div className="row gap center caltoggle">
                <button type="button" className={"calbtn " + (birth.cal !== "lunar" ? "on" : "")} onClick={() => setBirth({ ...birth, cal: "solar" })}>양력</button>
                <button type="button" className={"calbtn " + (birth.cal === "lunar" ? "on" : "")} onClick={() => setBirth({ ...birth, cal: "lunar" })}>음력</button>
                {birth.cal === "lunar" && <label className="chk"><input type="checkbox" checked={!!birth.leap} onChange={e => setBirth({ ...birth, leap: e.target.checked })} /> 윤달</label>}
              </div>
              {birth.cal === "lunar" && <p className="fine">달의 날짜구나 — 하늘의 달력으로 바꿔 읽어줄게.</p>}
              {err && <p className="err">{err}</p>}
              <button className="btn gold mt" onClick={() => { const y = +birth.y, m = +birth.m, d = +birth.d; if (!y || !m || !d || y < 1900 || y > new Date().getFullYear() || m < 1 || m > 12 || d < 1 || d > 31) { setErr("생년월일을 확인해줘. 너를 또렷하게 보려면 정확해야 해."); return; } /* 개보법 제22조의2 — 만 14세 미만 확인 게이트(세계관 안의 문구로) */ const _age = exactAge(y, m, d); if (_age !== null && _age < 14) { track("age_gate_blocked", { age_band: "14세 미만" }); setErr("아직은 네 하늘을 열 수 없어. 열넷의 봄을 지나고 다시 나를 불러줘 — 그때 네 곁으로 갈게."); return; } setErr(""); setBstep(2); }}>이 하늘이야</button>
            </div>
          )}
          {bstep === 2 && (
            <div className="bscene" key={2}>
              <p className="line">몇 시였는지도 기억나?</p>
              <div className="row gap center">
                <input className="in sm" placeholder="14" inputMode="numeric" maxLength={2} disabled={birth.noHour} value={birth.h} onChange={e => setBirth({ ...birth, h: e.target.value })} /><span className="unit">시</span>
                <input className="in sm" placeholder="30" inputMode="numeric" maxLength={2} disabled={birth.noHour} value={birth.min} onChange={e => setBirth({ ...birth, min: e.target.value })} /><span className="unit">분</span>
                <label className="chk"><input type="checkbox" checked={birth.noHour} onChange={e => setBirth({ ...birth, noHour: e.target.checked })} /> 모름 <em>(괜찮아, 조금 흐리게 보일 뿐이야)</em></label>
              </div>
              <input className="in wide center" lang="ko" placeholder="태어난 도시 (건너뛰어도 돼)" value={birth.city} onChange={e => setBirth({ ...birth, city: e.target.value })} />
              {err && <p className="err">{err}</p>}
              <button className="btn gold mt" onClick={() => { if (!birth.noHour) { const h = +birth.h; if (birth.h === "" || h < 0 || h > 23) { setErr("태어난 시(0~23시)를 알려주거나 '모름'을 선택해줘."); return; } if (birth.min !== "" && (+birth.min < 0 || +birth.min > 59)) { setErr("분은 0~59 사이로 알려줘."); return; } } setErr(""); setBstep(3); }}>기억났어</button>
            </div>
          )}
          {bstep === 3 && (
            <div className="bscene" key={3}>
              <p className="line">{birth.name.trim() ? `${birth.name.trim()}, 마지막 조각이야 — 하늘은 너를 어느 흐름에 실어 보냈을까.` : "마지막 조각 — 하늘은 너를 어느 흐름에 실어 보냈을까."}</p>
              <p className="sub2">음과 양의 흐름은 인생의 계절(대운)을 읽는 열쇠야.<br />말하고 싶지 않으면 그냥 넘어가도 돼.</p>
              <div className="row gap center">
                <button type="button" className={"calbtn " + (birth.sex === "M" ? "on" : "")} onClick={() => setBirth({ ...birth, sex: birth.sex === "M" ? "" : "M" })}>남</button>
                <button type="button" className={"calbtn " + (birth.sex === "F" ? "on" : "")} onClick={() => setBirth({ ...birth, sex: birth.sex === "F" ? "" : "F" })}>여</button>
              </div>
              <button className="btn gold mt" onClick={() => { setErr(""); setBstep(4); }}>다음</button>
            </div>
          )}
          {bstep === 4 && (
            <div className="bscene" key={4}>
              <p className="line">그래 — 너에 대한 기억이 돌아오고 있어.</p>
              <p className="sub2">지금의 넌 어떻게 컸어? 지금 널 알면 판결이 더 맞아져.<br />말하고 싶지 않으면 그냥 열어도 돼.</p>
              <div className="ctxblock">
                <div className="row gap center wrap">
                  {["학생", "직장인", "사업가", "프리랜서", "주부", "쉬는 중"].map(t => <button key={t} type="button" className={"calbtn sm " + (birth.job === t ? "on" : "")} onClick={() => setBirth({ ...birth, job: birth.job === t ? "" : t })}>{t}</button>)}
                </div>
                <div className="row gap center wrap">
                  {["연애 중", "솔로", "결혼", "이혼·이별"].map(t => <button key={t} type="button" className={"calbtn sm " + (birth.rel === t ? "on" : "")} onClick={() => setBirth({ ...birth, rel: birth.rel === t ? "" : t })}>{t}</button>)}
                </div>
              </div>
              {err && <p className="err">{err}</p>}
              {/* 선택 동의 체크박스를 뺐다 — 프로파일 항목을 전부 1단계로 옮기면서
                  이 체크박스가 실제로 막는 게 하나도 없어졌기 때문이다.
                  아무것도 안 막는 동의 UI는 이용자를 오인시켜 없느니만 못하다. */}
              <div className="consent">
                <p className="fine">네가 준 조각(나이·성별·직업·MBTI·가치 같은 것)은 판결을 다듬는 데 써.
                  <strong>네가 적은 질문은 보내지 않아.</strong><br />
                  ‘하늘을 열기’를 누르면 <a className="plink" href="/privacy.html" target="_blank" rel="noreferrer">개인정보처리방침</a>에 동의한 것으로 볼게.</p>
              </div>
              <button className="btn gold mt" onClick={doReveal}>하늘을 열기</button>
            </div>
          )}
          {bstep > 0 && <button className="resetlink" onClick={() => { setErr(""); setBstep(bstep - 1); }}>아까 장면으로 돌아갈래</button>}
        </section>
      )}

      {step === 2 && saju && (
        <section className="scene fade">
          <div className="halo">
            <DustOrb size={210} stage={1 + Object.keys(dims).length * 0.5} tint={saju ? EL_COLOR[saju.main] : undefined} />
            <div className="gtext">
              {reveal >= 5 && mbti && <p className="gname fade">기억이 다 돌아왔어</p>}
            </div>
          </div>
          {reveal >= 1 && reveal < 5 && (
            <div className="rvstage">
              {reveal === 1 && <div className="rvbig" key={1}><span>사주 — 태어난 순간의 하늘</span><b>{saju.pillars.년} · {saju.pillars.월} · {saju.pillars.일} · {saju.pillars.시}</b>{birth.lunarNote && <i className="rvlunar">{birth.lunarNote} — 하늘의 달력으로 바꿔 읽었어</i>}</div>}
              {reveal === 2 && <div className="rvbig" key={2}><span>별자리</span><b>{zo.name} — {zo.el}의 별</b></div>}
              {reveal === 3 && <div className="rvbig" key={3}><span>태어난 밤의 달</span><b>{moon.name} — {moon.sub}</b></div>}
              {reveal === 4 && <div className="rvbig" key={4}><span>수비학</span><b>{num}의 길</b></div>}
              <p className="sub2">잃어버린 기억이 돌아오고 있어…</p>
            </div>
          )}
          {reveal >= 5 && (
            <div className="fade">
              {!recallSeen ? (<div className="fade" key="recall">
              <p className="mention">
                그래 — {birth.name ? <><b>{birth.name}</b>, </> : ""}원래 <b>{EL_TRAIT[saju.main]}</b> 너였지.<br />
                <b>{MOON_DRIVE[moon.name]}</b> 모습이 늘 멋있었어.
              </p>
              <details className="refbox">
                <summary>기억의 근거 살펴보기</summary>
                <div className="bars">{Object.entries(saju.counts).map(([k, v]) => (
                  <div key={k} className="bar"><span>{k}</span><i style={{ width: `${v * 14}%`, background: EL_COLOR[k][0] }} /><b>{v}</b></div>
                ))}</div>
                <p className="refline">{saju.dayGan ? `일간 ${saju.dayGan}(${saju.main})` : `주기운 ${saju.main}`} — {EL_READ[saju.main]}</p>
                <p className="refline">{ZO_READ[zo.el]}</p>
                <p className="refline">{moon.read}</p>
                <p className="refline">{LP_READ[num]}</p>
              </details>
              <button className="btn gold mt" onClick={() => setRecallSeen(true)}>응, 기억나</button>
              </div>) : (<div className="fade" key="mbti">
              <p className="sub2 mt">요즘의 너는? — 하나씩 골라줘.</p>
              {(() => {
                const qi = DIMQ.findIndex(([k]) => !dims[k]);
                if (qi === -1) return (
                  <div className="dimseq fade">
                    <p className="dimq">그래 — 기억났어, 요즘의 너.</p>
                    <button className="resetlink" onClick={() => { setDims({}); setMbti(null); }}>다시 떠올릴래</button>
                  </div>
                );
                const [k, q, a, at, b2, bt] = DIMQ[qi];
                return (
                  <div className="dimseq fade" key={k}>
                    <p className="fine">기억 {qi + 1} / 4</p>
                    <p className="dimq">{q}</p>
                    <div className="dimrow">
                      <button className="dimopt" onClick={() => pickDim(k, a)}>{at}</button>
                      <button className="dimopt" onClick={() => pickDim(k, b2)}>{bt}</button>
                    </div>
                    {qi > 0 && <button className="resetlink" onClick={() => { const nd = { ...dims }; delete nd[DIMQ[qi - 1][0]]; setDims(nd); }}>아까 걸로 돌아갈래</button>}
                  </div>
                );
              })()}
              <button className="btn gold mt" onClick={() => setStep(25)} disabled={!mbti}>마음의 방으로</button>
              </div>)}
            </div>
          )}
        </section>
      )}

      {step === 25 && (
        <section className="scene fade">
          <div className="halo">
            <DustOrb size={210} stage={vstage > 0 ? 3 : 2} tint={saju ? EL_COLOR[saju.main] : undefined} />
            <div className="gtext">
              <p className="gname" key={vstage}>{vstage === 0 ? "마음의 방" : vstage === 1 ? "포기의 방" : "단 하나"}</p>
            </div>
          </div>
          <div key={vstage} className="fade">
          <p className="sub2">{vstage === 0 ? "너를 움직이는 말들이야. 생각 말고, 손이 가는 대로 여섯 개." : vstage === 1 ? "여섯 중 셋만 지킬 수 있어. 무엇을 내려놓는지가 진짜 너야." : "마지막이야 — 단 하나만 지킬 수 있다면."}</p>
          <div className="grid16">{(vstage === 0 ? VALUES16 : vstage === 1 ? vals8 : vals4).map(v => (
            <button key={v} className={`cell ${(vstage === 0 ? vals8 : vstage === 1 ? vals4 : [core]).includes(v) ? "sel" : ""}`} onClick={() => pick(v)}>{v}</button>
          ))}</div>
          <p className="fine">{vstage === 0 ? `${vals8.length} / 6` : vstage === 1 ? `${vals4.length} / 3` : core ? `핵심 — ${core}` : "하나를 골라줘"}</p>
          {vstage === 0 && vals8.length === 6 && <button className="btn gold mt" onClick={() => setVstage(1)}>여섯 개 골랐어</button>}
          {vstage === 1 && vals4.length === 3 && <button className="btn gold mt" onClick={() => setVstage(2)}>셋을 남겼어</button>}
          {vstage === 2 && core && <button className="btn gold mt" onClick={() => { track("guardian_awaken"); setStep(3); }}>수호신 깨우기</button>}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className={`scene fade ${phase >= 1 && !res && !awake ? "lobby" : ""}`} onClick={phase >= 1 && !res && !awake ? tryWake : undefined}>
          <div className={`halo wide ${!awake && phase >= 1 && !res ? "lobbyscale" : ""} ${asking ? "asking" : ""} ${ritual ? "ritualfade" : ""} ${busy || (res && !cardOn) ? "busy" : ""} ${res && cardOn ? "dimmed" : ""}`}>
            {phase === 0
              ? <BirthCanvas tint={saju ? EL_COLOR[saju.main] : undefined} size={Math.min(typeof window !== "undefined" ? window.innerWidth * 1.1 : 400, typeof window !== "undefined" ? window.innerHeight * 0.57 : 400, 640)} />
              : <div className="fade"><Guardian saju={saju} zo={zo} mbti={mbti} num={num} moon={moon} birth={birth} agitateRef={agitateRef} reactRef={reactRef} restRef={restRef} size={Math.min(typeof window !== "undefined" ? window.innerWidth * 1.1 : 400, typeof window !== "undefined" ? window.innerHeight * 0.57 : 400, 640)} /></div>}
            <div className="gtext up">
              {phase === 0 && <div className="formwrap"><p className="forming">{birth.name ? `${birth.name}, 흩어져 있던 조각들이` : "흩어져 있던 조각들이"}<br />너를 향해 모이고 있어…<br />너의 수호신이 돌아오는 중이야.</p><ul className="formsteps">{FORM_STEPS.map((s, i) => <li key={i} className={i < formStep ? "done" : i === formStep ? "now" : ""}>{i < formStep ? "✓" : i === formStep ? "✦" : "·"} {s}{i === formStep ? "…" : ""}</li>)}</ul></div>}
            </div>
          </div>

          {phase >= 1 && !res && !awake && (
            <div className="lobbypanel fade">
              {/* v104: 서신을 맡기고 돌아온 자리 — 인사말 대신 수호신의 한마디, 그리고 한 번 더 묻게 하는 말 */}
              {letterSent ? (
                <div>
                  <p className="gsay fade">{LETTER_LOBBY_LINE}</p>
                  {/* v105: 서신함 — 쓰는 중 / 도착 / 못 씀. 세 상태를 숨기지 않는다. */}
                  {letterDoc && !letterDoc._err && (
                    <div className="mailbox fade" style={{ animationDelay: ".95s" }}>
                      <p className="dtag">수호신의 서신 · 도착</p>
                      <button className="btn gold sm" onClick={openLetterDoc}>서신을 펼친다</button>
                    </div>
                  )}
                  {letterDoc && letterDoc._err && (
                    <p className="gsay fade" style={{ animationDelay: ".95s" }}>서신이 손에서 흩어졌어 — 이번 건 내 잘못이야. 다시 물어봐 줄래?</p>
                  )}
                  {/* v105.1: 쓰는 중이라는 걸 눈에 보이게 — 실측 20초를 정지 화면으로 두면 사람이 먼저 떠난다 */}
                  {!letterDoc && (
                    <p className="gsay writing fade" style={{ animationDelay: ".95s" }}>수호신이 서신을 쓰고 있어<span className="dots"><i>.</i><i>.</i><i>.</i></span></p>
                  )}
                  {/* 유도 문구는 어느 상태에서도 남는다 — 이게 이 연출의 목적이다 */}
                  <p className="gsay fade" style={{ animationDelay: "1.5s" }}>{letterDoc && !letterDoc._err ? LETTER_NUDGE_DONE : LETTER_NUDGE_LINE}</p>
                </div>
              ) : returning ? (
                <p className="gsay fade">{"다시 왔네" + (birth.name ? ", " + birth.name : "") + ". 기다렸어."}</p>
              ) : justBorn ? (
                <div><p className="gsay born fade">— 다시 만났네. 내가 너의 수호신이야.</p><p className="gsay fade" style={{ animationDelay: ".95s" }}>{guardianIntro}</p><p className="gsay sprite fade" style={{ animationDelay: "1.9s" }}>아, 조각 하나는 달빛에 물들어 곁에 남았어. 까불 거야 — '정령'이야.</p></div>
              ) : null}
              <p className="wakehint">{letterSent ? "두드려봐 — 하나 더 물어도 돼" : "두드려봐 — 답은 거기 있어"}</p>
            </div>
          )}
          {ritual && <div className="residue" style={{ "--elc": saju ? EL_COLOR[saju.main][0] : "#f5d98b" }} />}
          {phase >= 1 && !res && awake && (
            <div className={`fade gpanel ${asking ? "asking" : ""}`}>
              {returning && !res && !busy && !ritual && (!birth.name || !birth.sex) && (addOpen ? (
                <div className="addpanel fade">
                  {!birth.name && <input className="in wide center" lang="ko" placeholder="너를 뭐라고 부를까?" maxLength={12} value={addName} onChange={e => setAddName(e.target.value)} />}
                  {!birth.sex && <div className="row gap center">
                    <button type="button" className={"calbtn " + (addSex === "M" ? "on" : "")} onClick={() => setAddSex(addSex === "M" ? "" : "M")}>남</button>
                    <button type="button" className={"calbtn " + (addSex === "F" ? "on" : "")} onClick={() => setAddSex(addSex === "F" ? "" : "F")}>여</button>
                    <span className="chk"><em>인생의 계절(대운)을 읽는 열쇠</em></span>
                  </div>}
                  <div className="row gap center">
                    <button className="btn gold" onClick={() => { const nb = { ...birth, name: birth.name || addName.trim(), sex: birth.sex || addSex }; setBirth(nb); saveMemory({ birth: nb, saju, zo, moon, num, mbti, vals8, vals4, core, convo, records, streak }); setAddOpen(false); }}>조각을 보탤게</button>
                    <button className="btn ghost" onClick={() => setAddOpen(false)}>다음에</button>
                  </div>
                </div>
              ) : (
                <button className="knock fade" onClick={() => setAddOpen(true)}>수호신이 아직 못 찾은 조각이 있대 — {!birth.name && !birth.sex ? "이름과 흐름" : !birth.name ? "이름" : "음양의 흐름"}</button>
              ))}
              {returning && streak && streak.count >= 2 && !res && (
                <p className="streak">수호신과 연결된 지 {streak.count}일째</p>
              )}
              {dailyData && !ritual && !res && !askback && !dailyOpen && (
                <button className="knock fade" onClick={() => setDailyOpen(true)}>수호신이 오늘의 하늘을 봐뒀어 — 들을래?</button>
              )}
              {dailyData && !ritual && !res && !askback && dailyOpen && (
                <div className="daily fade">
                  <p className="dtag">아침 문안 · 오늘 하루만 — 자정에 사라져</p>
                  <p className="dmain">오늘은 <b>{dailyData.mood.k}</b>. {dailyData.mood.line}</p>
                  <p className="dsub">오늘의 일진 {dailyData.ilju} · 오늘 밤 달 {dailyData.mp.name}</p>
                  <button className="btn ghost sm" onClick={() => { try { store.setItem(DAILY_KEY, todayStr()); } catch (_) {} setDailySeen(true); }}>받았어</button>
                </div>
              )}
              {askback && !ritual && !res && (
                <div className="daily fade">
                  <p className="dtag">지난 판결 · {askback.direction}</p>
                  <p className="dmain">지난번 물음 — "{askback.q}"</p>
                  {askback.verdict && <p className="dverdict">내가 이렇게 말했지 — "{askback.verdict}"</p>}
                  <p className="dmain">그래서, 결국 어떻게 했어?</p>
                  {!noting ? (
                    <div className="row gap center">
                      <button className="btn ghost sm" onClick={() => answerAskback("did")}>따랐어</button>
                      <button className="btn ghost sm" onClick={() => setNoting(true)}>거슬렀어</button>
                      <button className="btn ghost sm" onClick={() => answerAskback("later")}>아직</button>
                    </div>
                  ) : (
                    <div className="w100">
                      <input className="in wide" placeholder="그래서 어땠는데? (한 줄)" value={askNote} onChange={(e) => setAskNote(e.target.value)} />
                      <button className="btn ghost sm mt" onClick={() => answerAskback("against", askNote)}>이렇게 됐어</button>
                    </div>
                  )}
                </div>
              )}
              {!ritual && <p className="gintro dim2">{isNight ? "밤이 깊었네. 이 시간의 물음은 마음이 먼저 기울어 있기 마련이야." : "그래서, 요즘 뭘 망설이고 있어?"}</p>}
              {!ritual && <textarea className="qbox" rows={2} maxLength={100} value={q} placeholder={`"${QHINTS[qhintI]}"`} onChange={e => setQ(e.target.value)} />}
              {!ritual && !res && q.trim().length > 0 && isDecisionQ(q) && (
                <div className="leanrow fade">
                  <span className="leanlab">왜 망설여? <em className="dim">(안 골라도 돼)</em></span>
                  <div className="row gap center wrap">
                    {["두려워서", "남 눈치", "정보가 부족해", "자신이 없어서", "후회할까 봐"].map((t) => (
                      <button key={t} type="button" className={"calbtn sm " + (hesit === t ? "on" : "")} onClick={() => setHesit(hesit === t ? "" : t)}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
              {/* v103: 속결 제거 — 실측(question_asked)에서 내부 83건 중 0건, 외부도 90%가 의식이었다.
                  결정을 대신해주는 앱이 입구에서 또 결정을 시키던 구조라 버튼을 하나로 합쳤다. */}
              {!ritual && (
                <div className="w100">
                  <div className="row gap center">
                    <button className="btn gold" onClick={() => { if (!q.trim()) { setErr("먼저 질문을 적어줘."); return; } setErr(""); setRitual(true); }} disabled={busy}>판결을 청한다</button>
                  </div>
                  <p className="fine">동전 셋을 던져 하늘의 뜻을 묻는다 — 무엇을 묻든 같은 무게로 본다.</p>
                </div>
              )}
              {/* v105.2 서신함 — 유료로 산 것이니 홈에서 언제든 다시 열린다.
                  본문이 날아간 건(paid 는 있는데 letter 가 없는 것)도 여기 그대로 세워 두고 '다시 받기'를 준다.
                  숨기면 산 사람이 잃은 걸 모른 채 넘어간다 — 그게 제일 나쁜 상태다. */}
              {!ritual && !res && paidRecs.length > 0 && (
                <button className="knock fade" onClick={() => { setBoxOpen((o) => !o); if (!boxOpen) track("letterbox_opened", { n: paidRecs.length, lost: paidRecs.filter((p) => !p.r.letter).length }); }}>
                  {boxOpen ? "서신함 접기" : `수호신의 서신함 — ${paidRecs.length}통${paidRecs.some((p) => !p.r.letter) ? " · 못 받은 게 있어" : ""}`}
                </button>
              )}
              {!ritual && !res && boxOpen && (
                <div className="lbox fade">
                  {paidRecs.slice().reverse().map(({ r, i }) => (
                    <div key={i} className="lboxrow">
                      <div className="lboxtxt">
                        <p className="lboxq">"{r.q}"</p>
                        <p className="lboxno">서신 번호 {letterNo(r)} · {new Date(r.at).toLocaleDateString("ko-KR")}</p>
                      </div>
                      <button className={"btn sm " + (r.letter ? "ghost" : "gold")} disabled={letterBusy} onClick={() => reissueLetter(i)}>
                        {r.letter ? "펼치기" : letterBusy ? "쓰는 중…" : "다시 받기"}
                      </button>
                    </div>
                  ))}
                  <p className="fine">서신은 이 기기에 보관돼. 기기를 바꾸거나 지워졌다면 <b>번호를 대고 다시 받으면</b> 돼 — 값은 다시 안 받아.</p>
                </div>
              )}
              {!ritual && !res && records.length > 0 && (
                <button className="resetlink" onClick={() => { setLogOpen(o => !o); setOpenRec(-1); }}>{logOpen ? "판결록 접기" : `판결록 — ${records.length}번의 판결`}</button>
              )}
              {!ritual && !res && logOpen && (
                <div className="vlog fade">
                  {[...records].slice(-10).reverse().map((r, i) => (
                    <div key={i} className={`vlogrow${openRec === i ? " open" : ""}`} onClick={() => setOpenRec(openRec === i ? -1 : i)}>
                      <BujeokCanvas saju={saju} direction={r.direction} seed={r.q + (r.verdict || "")} size={54} />
                      <div className="vlogtxt">
                        <p className="vlogq">"{r.q}"</p>
                        <p className="vlogmeta">{new Date(r.at).toLocaleDateString("ko-KR")} · <b className={r.direction === "GO" ? "lgo" : r.direction === "HOLD" ? "lhold" : "lstop"}>{r.direction}</b> · {r.followUp === "did" ? "따랐다" : r.followUp === "against" ? "거슬렀다" : r.followUp === "later" ? "아직" : "미보고"}</p>
                        {openRec === i && r.verdict && <p className="vlogverdict fade">"{r.verdict}"</p>}
                      </div>
                    </div>
                  ))}
                  {records.length > 10 && <p className="fine">최근 10건만 — 나머지도 기억하고 있어.</p>}
                </div>
              )}
              {!ritual && returning && !res && (resetAsk ? (
                <div className="fade" style={{ textAlign: "center" }}>
                  <p className="sub2">정말 처음부터? 지금의 수호신과 기억이 흩어져.</p>
                  <div className="row gap center">
                    <button className="btn ghost sm" onClick={() => { clearMemory(); window.location.reload(); }}>응, 흩어져도 돼</button>
                    <button className="btn ghost sm" onClick={() => setResetAsk(false)}>아니</button>
                  </div>
                </div>
              ) : (
                <button className="resetlink" onClick={() => setResetAsk(true)}>다른 사람이야? — 처음부터 다시</button>
              ))}
              {!ritual && returning && !res && (
                <div className="memrow">
                  <button className="resetlink" onClick={exportMemory}>수호신 기억 보관하기</button>
                  <label className="resetlink" style={{ cursor: "pointer" }}>기억 불러오기<input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => e.target.files && e.target.files[0] && importMemory(e.target.files[0])} /></label>
                </div>
              )}
              {ritual && !res && (
                <div className="hexpanel fade">
                  <p className="qquote">“{q}”</p>
                  <p className="sub2">물음을 마음에 붙들고 — 동전 셋, 여섯 번.</p>
                  <div className="coinstage">
                    {tossing && <><span className="coin fly" /><span className="coin fly c2" /><span className="coin fly c3" /></>}
                    {!tossing && tosses.length > 0 && <p className="coins">{tosses[tosses.length - 1].coins.map((c, i) => <span key={i}>{c === 3 ? "● 앞" : "○ 뒤"}</span>)}</p>}
                  </div>
                  <div className="hexlines">
                    {tosses.map((l, idx) => (
                      <div key={idx} className="hline on drop">
                        {l.v % 2 ? <span className="yang" /> : <span className="yin" />}
                        {(l.v === 6 || l.v === 9) && <i className="mv">●</i>}
                      </div>
                    ))}
                  </div>
                  {tosses.length < 6
                    ? <div className="row gap center"><button className="btn gold" onClick={toss} disabled={busy || tossing}>{tossing ? "동전이 공중에…" : `동전을 던진다 (${tosses.length}/6)`}</button><button className="btn ghost" onClick={tossAll} disabled={busy || tossing}>한 번에 던지기</button></div>
                    : <p className="sub2 mt">{busy ? "조각들이 합의하는 중…" : hexInfo && (<>괘가 맺혔어 — <b>{hexInfo.name}</b>{hexInfo.moving.length > 0 && <> · 기운은 <b>{hexInfo.toName}</b> 쪽으로 움직이고 있어</>}</>)}</p>}
                  {!busy && !tossing && tosses.length < 6 && <button className="resetlink" onClick={() => { setRitual(false); setTosses([]); setHexInfo(null); }}>물음을 고칠래</button>}
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

          {res && !cardOn && <div className="gateflash" />}
          {res && cardOn && <button className="escx" onClick={backToLobby} aria-label="닫기">✕</button>}
          {res && cardOn && (
            <div className="persp cardIn" onClick={() => { if (why && (detailBusy || (detail && !detail._err))) setFlip(f => !f); }}>
              <div className="vcard" style={{ transform: `rotateY(${flip ? 180 : 0}deg)` }}>
                <div className="vface">
                  <i className="corner tl">✦</i><i className="corner tr">✦</i><i className="corner bl">✦</i><i className="corner br">✦</i>
                  <span className="vside">運命合意判決</span>
                  <span className={`vseal ${why ? "faded" : ""}`}>神</span>
                  {/* 카드 앞면엔 어려운 말을 두지 않는다(층위 분리). 'A형'은 내부 분류어라 유저에겐 뜻이 없다 → 우리말 라벨로 */}
                  {/* tone(단호|격려|충고)은 내부 제어값 — 화면에 달면 앱이 스스로 "이건 격려"라고 고백하는 꼴이라 뗐다(2026-08-02) */}
                  <div className="vtop"><span>BINARI</span><span>{CAT_LABEL[res.category] || "어느 물음"}</span></div>
                  <p className={`vq ${q.length > 55 ? "s" : ""}`}>{q}</p>
                  <div className="vdiv"><span>✦</span></div>
                  {res.total > 0 && res.against > 0 && res.against / res.total >= 0.4 && (
                    <p className="split">지표가 갈라섰다 · {res.total - res.against} : {res.against}</p>
                  )}
                  {/* L1 결론 */}
                  <p className={`vv ${res.direction === "GO" ? "go" : res.direction === "HOLD" ? "hold" : ""} ${(res.verdict || "").length > 40 ? "s" : (res.verdict || "").length > 22 ? "m" : ""}`}>{res.verdict}</p>
                  {/* L2 왜 (클릭) */}
                  {!why ? (
                    <button className="whybtn" onClick={(e) => { e.stopPropagation(); track("why_opened"); setWhy(true); }}>왜 이렇게 봤어?</button>
                  ) : (
                    <div className="l2 fade">
                      {detail && !detail._err
                        ? <p className="vs">"{detail.subline}"</p>
                        : detailBusy ? <p className="vs dim">수호신이 이유를 고르는 중…</p>
                        : <p className="vs dim">— 이유를 불러오지 못했어 —<button className="retrybtn" onClick={(e) => { e.stopPropagation(); if (detailArgsRef.current) { setDetail(null); fetchDetail(...detailArgsRef.current, true); } }}>다시 시도</button></p>}
                      {/* 실사고(2026-08-02): against(반대 수)를 '찬성'이라 표시해 "7개 중 1개 찬성"으로 나감 —
                          가장 강한 GO가 가장 약해 보였다. 라벨은 질문의 행동 기준(찬성=GO표·반대=STOP표),
                          수는 판결을 민 쪽(total-against)을 센다. HOLD만 접전 수(against) 그대로. */}
                      <div className="pips">{[...Array(res.total || 0)].map((_, i) => <span key={i} className={`pip ${i < (res.direction === "HOLD" ? res.against : res.total - res.against) ? "on" : ""}`} />)}
                        <em>{res.total}개 중 {res.direction === "HOLD" ? res.against : res.total - res.against}개 {res.direction === "STOP" ? "반대" : res.direction === "HOLD" ? "접전" : "찬성"}</em></div>
                      {/* "(판결엔 안 껴)"는 개발자 주석을 유저에게 보여준 것 — 정령의 위계는 괄호 고백이 아니라 자리(맨 아래·작은 글씨)로 말한다 */}
                      {detail && !detail._err && detail.funLine && <p className="vfun">정령 — {detail.funLine}</p>}
                      {(detailBusy || (detail && !detail._err)) && <div className="vbot"><span>운명 합의 판결</span><span>카드 탭 → 지표별 근거</span></div>}
                    </div>
                  )}
                </div>
                {/* L3 세부 (뒤집기) */}
                <div className="vface back">
                  <div className="vtop"><span>판결 근거</span><span>탭 → 돌아가기</span></div>
                  {/* 괘 이름은 뒷면(지표 이름을 짚어도 되는 자리)에만 — 앞면에선 유저가 못 알아듣는 한자였다 */}
                  {hexInfo && <p className="vhex">卦 {hexInfo.name}{hexInfo.moving.length > 0 && ` → ${hexInfo.toName}`}</p>}
                  {detail?.reasons ? <ul className="vr">{detail.reasons.map((r, i) => <li key={i}><b>{r.axis}</b>{r.vote && <em className="vote">{r.vote}</em>}<p>{r.text}</p></li>)}</ul> : <p className="gathering">조각들이 근거를 모으고 있어<span className="dots"><i>.</i><i>.</i><i>.</i></span></p>}
                  {saju && saju.idx && <MyeongsikReport saju={saju} sex={birth.sex} birth={birth} />}
                  {detail?.disclaimer && <p className="disc">{detail.disclaimer}</p>}
                </div>
              </div>
            </div>
          )}
          {res && cardOn && (
            <div className="raterow fade">
              {rated ? (
                <p className="ratedone">고마워 — 담아뒀어. 다음 판결이 더 맞아질 거야.</p>
              ) : (
                <>
                  <span className="ratelab">이 판결, 어땠어?</span>
                  <div className="row gap center">
                    <button type="button" className="calbtn sm" onClick={() => rateVerdict(1)}>빗나갔어</button>
                    <button type="button" className="calbtn sm" onClick={() => rateVerdict(2)}>글쎄</button>
                    <button type="button" className="calbtn sm" onClick={() => rateVerdict(3)}>딱이야</button>
                  </div>
                </>
              )}
            </div>
          )}
          {/* D3: 신자/비신자 1문항 — 첫 판결 직후 한 번만. 온보딩이 아닌 여기 두는 건
              광고 유입자의 온보딩 이탈을 건드리지 않기 위해서다. */}
          {res && cardOn && !belief && (
            <div className="raterow fade">
              <span className="ratelab">이런 거, 원래 믿는 편이야?</span>
              <div className="row gap center">
                {[["believer", "믿는 편"], ["mixed", "반반"], ["skeptic", "안 믿는 편"]].map(([v, label]) => (
                  <button key={v} type="button" className="calbtn sm" onClick={() => answerBelief(v)}>{label}</button>
                ))}
              </div>
            </div>
          )}
          {res && cardOn && <button className="btn gold mt" onClick={shareVerdict}>{shared ? "복사했어 — 붙여넣으면 돼" : "카톡·라인으로 판결 보내기"}</button>}
          {/* D4: 결제 fake-door — 지불 의사만 잰다. 결제 인프라는 만들지 않는다. */}
          {res && cardOn && letterOk && (
            !letter ? (
              <button className="btn ghost mt" onClick={openLetter}>수호신의 서신 — 이 판결의 깊은 풀이 · {LETTER_PRICE.toLocaleString()}원</button>
            ) : letterIntent ? (
              <p className="ratedone">서신을 맡겼어 — 수호신이 쓰기 시작했어.</p>
            ) : (
              <div className="letterwrap fade">
                <p className="dtag">수호신의 서신 · {LETTER_PRICE.toLocaleString()}원</p>
                <ul className="letterlist">{LETTER_SECTIONS.map((t, i) => <li key={i}>{t}</li>)}</ul>
                <p className="letterprev">{letterPreview(saju, hesit)}</p>
                <p className="letterprevtag">— 여기까지가 미리보기야</p>
                {/* 전상법 제17조⑥: 미리보기 제공 + 철회 배제 고지를 '알아보기 쉬운 곳'에 함께 둔다 */}
                <p className="refundnote">서신은 열어보는 순간 전해지는 글이라, 열람 후에는 환불되지 않아요. 위 미리보기로 먼저 확인해 주세요.</p>
                <button className="btn gold mt" onClick={confirmLetterIntent}>받을게</button>
              </div>
            )
          )}
          {res && cardOn && !bujeok && <button className="btn ghost mt" onClick={() => { track("bujeok_opened"); setBujeok(true); }}>수호신의 부적 받기</button>}
          {res && cardOn && bujeok && (
            <div className="fade bwrap">
              <BujeokCanvas saju={saju} direction={res.direction} seed={q + (res.verdict || "")} />
              <p className="fine">오늘의 판결을 지키는 부적 — 같은 질문·같은 판결에서만 같은 문양이 나와.</p>
              <button className="btn ghost sm" onClick={() => saveOrShareBujeok({ saju, direction: res.direction, seed: q + (res.verdict || ""), tosses, hexInfo, category: res.category, against: res.against || 0, total: res.total || 0 })}>부적 간직하기 — 이미지로</button>
              <p className="fine">질문은 이미지에 담기지 않아 — 문양과 판결의 방향만.</p>
            </div>
          )}
          {res && cardOn && <button className="btn ghost mt" onClick={backToLobby}>다른 걸 물어볼래</button>}
          {res && cardOn && <p className="ainote card">이 판결은 AI가 생성한 내용입니다</p>}
        </section>
      )}

      {/* v104: 서신 대기 연출 — 화면 전체를 덮는다. 되돌릴 버튼을 두지 않는 건 의도다.
          '맡겼다'는 감각을 만드는 7초이고, 이 7초를 견디는 비율 자체가 재고 싶은 값이다. */}
      {letterStage && (
        <div className="sealwrap" role="status" aria-live="polite">
          <div className="sealfx" aria-hidden="true">
            <i className="sring s1" /><i className="sring s2" /><i className="sring s3" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <i key={i} className="spark" style={{ "--a": `${i * 45}deg`, animationDelay: `${i * 0.13}s` }} />)}
            <b className="sealcore">書</b>
          </div>
          <p className={"sealline " + letterStage}>{letterStage === "seal" ? LETTER_SEAL_LINE : LETTER_WAIT_LINE}</p>
        </div>
      )}

      {/* v105: 서신 전문. 판결 카드 위가 아니라 별도 화면인 건, 이건 '읽는 것'이지 '보는 것'이 아니어서다. */}
      {letterOpen && letterDoc && !letterDoc._err && (
        <div className="readwrap">
          <button className="escx" onClick={() => setLetterOpen(false)} aria-label="닫기">✕</button>
          <div className="readbody">
            <p className="dtag center">수호신의 서신 · {letterNo(records[letterIdx] || {})}</p>
            {letterDoc.chapters.map((c, i) => (
              <div key={i} className="rchap">
                <h3 className="rct"><span>{i + 1}</span>{c.t}</h3>
                <p className="rcb">{c.body}</p>
              </div>
            ))}
            {letterDoc.closing && <p className="rclose">{letterDoc.closing}</p>}
            <div className="raterow">
              {letterRated ? (
                <p className="ratedone">담아뒀어 — 다음 서신이 더 나아질 거야.</p>
              ) : (
                <>
                  <span className="ratelab">이 서신, {LETTER_PRICE.toLocaleString()}원 값 했어?</span>
                  <div className="row gap center">
                    <button type="button" className="calbtn sm" onClick={() => rateLetter(1)}>아니</button>
                    <button type="button" className="calbtn sm" onClick={() => rateLetter(2)}>값했어</button>
                  </div>
                </>
              )}
            </div>
            {/* 유료 물건은 기기 하나에만 맡기지 않는다 — iOS 는 7일이면 저장소를 지울 수 있다 */}
            <button className="btn ghost mt" onClick={saveLetterFile}>서신 간직하기 — 파일로</button>
            <p className="fine">서신함(홈)에서 언제든 다시 열려. 기기가 바뀌어도 번호 <b>{letterNo(records[letterIdx] || {})}</b>로 다시 받을 수 있어.</p>
            <p className="ainote">이 서신은 AI가 생성한 내용입니다 · 재미로 보는 참고용이야</p>
            <button className="btn ghost mt" onClick={() => setLetterOpen(false)}>접어둘게</button>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;900&display=swap');
*{box-sizing:border-box} 
.stage{min-height:100vh;background:radial-gradient(130% 100% at 50% 0%,#141021,#0a0812 55%,#050408);color:#d8cfe6;font-family:'Noto Serif KR',serif;display:flex;justify-content:center;padding:26px 20px 70px;position:relative;overflow:hidden}
.stage::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1px 1px at 12% 22%,#ffffff55,transparent),radial-gradient(1px 1px at 78% 14%,#ffe9ad44,transparent),radial-gradient(1.5px 1.5px at 62% 68%,#ffffff33,transparent),radial-gradient(1px 1px at 30% 84%,#ffe9ad33,transparent),radial-gradient(1px 1px at 88% 48%,#ffffff40,transparent),radial-gradient(1.5px 1.5px at 8% 58%,#ffe9ad2e,transparent);animation:twk 6s ease-in-out infinite alternate}
@keyframes twk{to{opacity:.45}}
.scene{width:100%;max-width:400px;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;word-break:keep-all}
.line,.sub2,.mention,.dimq,.gsay,.gintro,.forming,.vv,.vs,.vq,.qquote,.dmain,.gname,.vlogverdict{text-wrap:balance}
.fade{animation:fd 1.15s cubic-bezier(.22,.7,.25,1) both}@keyframes fd{from{opacity:0;transform:translateY(14px) scale(.985);filter:blur(7px)}to{opacity:1;transform:none;filter:blur(0)}}
.orb{position:relative;width:170px;height:170px;margin:48px 0 36px;filter:drop-shadow(0 0 24px rgba(245,217,139,.2))}
.line{font-size:17px;line-height:1.8;margin:8px 0;opacity:0;animation:fd 1.6s cubic-bezier(.22,.7,.25,1) forwards}.d1{animation-delay:1.4s}.d2{animation-delay:3s}
.brand-mark{margin-top:56px;font-size:11px;letter-spacing:.4em;color:#8a7f95;font-family:sans-serif}
.verbadge{position:fixed;right:9px;bottom:7px;z-index:70;font-family:sans-serif;font-size:9px;letter-spacing:.08em;color:#575070;pointer-events:none;user-select:none}
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
.caltoggle{align-items:center}
.calbtn{font-family:inherit;font-size:13px;padding:7px 18px;border-radius:999px;border:1px solid rgba(138,127,149,.35);background:transparent;color:#9d8fb5;cursor:pointer;transition:all .2s}
.calbtn.on{border-color:#ffe9ad;color:#ffe9ad;box-shadow:0 0 12px rgba(245,217,139,.25)}
.calbtn.sm{font-size:12px;padding:5px 13px}
.row.wrap{flex-wrap:wrap;max-width:340px;gap:6px}
.ctxsep{width:120px;height:1px;background:linear-gradient(90deg,transparent,rgba(245,217,139,.3),transparent);margin:16px auto 2px}
.ctxblock{display:flex;flex-direction:column;align-items:center;gap:7px;margin-top:2px}
.ctxhead{font-size:14px;color:#d3c199;letter-spacing:.03em;margin:0;text-wrap:balance;text-shadow:0 0 12px rgba(245,217,139,.25)}
.ctxlab{color:#8a7f95;letter-spacing:.06em;margin:1px 0 3px}
.consent{display:flex;flex-direction:column;align-items:center;gap:2px;margin-top:16px}
.consent .fine{margin-top:6px}
.plink{color:#c9a24b;text-decoration:underline}
.hesitrow{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:8px}
.bscene{display:flex;flex-direction:column;gap:14px;align-items:center;width:100%;margin-top:6px}
.in.center{text-align:center}
.lateIn{opacity:0;animation:fd 1.6s cubic-bezier(.22,.7,.25,1) 4.4s forwards}
.rvlunar{display:block;font-size:11.5px;font-family:sans-serif;letter-spacing:.12em;color:#9d8fb5;margin-top:7px;font-style:normal}
.addpanel{display:flex;flex-direction:column;gap:10px;align-items:center;margin:2px 0 14px;width:100%}
.gathering{font-size:13.5px;color:#c9b98f;text-align:center;margin:30px 0}
.gathering .dots i{animation:blinkDot 1.2s infinite;font-style:normal}
.gathering .dots i:nth-child(2){animation-delay:.35s}.gathering .dots i:nth-child(3){animation-delay:.7s}
@keyframes blinkDot{0%,100%{opacity:.15}50%{opacity:1}}
.chk input{accent-color:#c98f3d}
.btn{font-family:inherit;font-size:14px;font-weight:600;letter-spacing:.14em;padding:13px 28px;border-radius:999px;border:1px solid rgba(245,217,139,.4);background:transparent;color:#f0e2b8;cursor:pointer;transition:box-shadow .3s,border-color .3s,background .3s,transform .1s}
.btn.gold{background:linear-gradient(180deg,#f5d98b,#c98f3d);color:#241a08;border:none;box-shadow:0 6px 22px rgba(201,143,61,.3)}
.btn.ghost{border-color:rgba(245,217,139,.32);background:rgba(245,217,139,.05);color:#d6c493;box-shadow:0 2px 14px rgba(0,0,0,.28)}.btn:hover{border-color:rgba(245,217,139,.7);box-shadow:0 0 16px rgba(245,217,139,.2)}.btn.gold:hover{box-shadow:0 8px 26px rgba(201,143,61,.45)}.btn:active{transform:translateY(1px)}.btn:disabled{opacity:.45;cursor:default}.mt{margin-top:18px}
.fine{font-family:sans-serif;font-size:11px;color:#6b617d;margin-top:14px;line-height:1.6}
/* AI기본법 제31조 — 생성형 AI 사전 고지·결과물 표시(별지 잔글씨, 판결문 형식 불변) */
.ainote{font-family:sans-serif;font-size:10.5px;color:#6b617d;line-height:1.6;margin-top:14px;text-align:center}
/* 지시서 5·6: 서신 가격·미리보기 별지 레이어(판결 카드 구조 불변) */
.letterwrap{margin-top:20px;padding:18px 16px;border:1px solid rgba(245,217,139,.22);border-radius:14px;background:rgba(20,15,34,.55);text-align:center;max-width:330px}
.letterlist{list-style:none;padding:0;margin:10px 0 0;font-size:12.5px;line-height:1.9;color:#cfc4e2}
.letterlist li::before{content:'· ';color:#c9b98f}
.letterprev{font-size:13px;line-height:1.85;color:#e2d9f2;margin:14px 0 0;text-align:left;overflow-wrap:anywhere}
.letterprevtag{font-family:sans-serif;font-size:10.5px;color:#8a7f95;margin:6px 0 0}
.refundnote{font-size:12px;line-height:1.7;color:#e5b96b;margin:14px 0 0;padding:9px 10px;border:1px solid rgba(229,185,107,.35);border-radius:9px}
/* v104: 서신 대기 연출(봉인 5초 → 대기 문구 2초). 전부 CSS 애니메이션 — 자바스크립트 루프를 돌리지 않는다. */
.sealwrap{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;background:radial-gradient(120% 80% at 50% 42%,#1c1330,#0b0817 56%,#050308);animation:fd .5s ease both}
.sealfx{position:relative;width:190px;height:190px;display:flex;align-items:center;justify-content:center}
.sring{position:absolute;inset:0;margin:auto;width:96px;height:96px;border-radius:50%;border:1px solid rgba(245,217,139,.55);opacity:0;animation:sealRing 2.6s cubic-bezier(.2,.65,.3,1) infinite}
.sring.s2{animation-delay:.85s}.sring.s3{animation-delay:1.7s}
.spark{position:absolute;left:50%;top:50%;width:2px;height:34px;margin:-17px 0 0 -1px;border-radius:2px;background:linear-gradient(to top,transparent,rgba(255,233,173,.95));transform:rotate(var(--a)) translateY(-58px);transform-origin:50% 50%;animation:sealSpark 2.2s ease-in-out infinite}
.sealcore{position:relative;font-family:'Noto Serif KR',serif;font-size:42px;font-weight:900;color:#ffe9ad;text-shadow:0 0 30px rgba(245,217,139,.75),0 0 70px rgba(245,217,139,.35);animation:sealCore 2.6s ease-in-out infinite}
.sealline{font-family:'Noto Serif KR',serif;font-size:15px;letter-spacing:.14em;color:#e8dcc0;margin:0;text-align:center;text-shadow:0 0 18px rgba(245,217,139,.4)}
.sealline.seal{animation:formPulse 2.1s ease-in-out infinite}
.sealline.wait{font-size:17px;color:#ffe9ad;animation:fd .7s cubic-bezier(.22,.7,.25,1) both}
@keyframes sealRing{0%{opacity:0;transform:scale(.45)}18%{opacity:.85}100%{opacity:0;transform:scale(2.05)}}
@keyframes sealSpark{0%,100%{opacity:.15;transform:rotate(var(--a)) translateY(-52px) scaleY(.6)}50%{opacity:.9;transform:rotate(var(--a)) translateY(-70px) scaleY(1.15)}}
@keyframes sealCore{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.09);opacity:1}}
@media (prefers-reduced-motion:reduce){.sring,.spark,.sealcore,.sealline.seal{animation:none}.spark{opacity:.35}}
/* v105: 서신함(로비) + 서신 전문 읽기 화면 */
.mailbox{margin-top:14px;display:flex;flex-direction:column;align-items:center;gap:8px;animation:mailIn .8s cubic-bezier(.22,.7,.25,1) both}
@keyframes mailIn{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
.mailbox .btn{animation:mailPulse 2.6s ease-in-out 1s infinite}
@keyframes mailPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,217,139,0)}50%{box-shadow:0 0 22px 2px rgba(245,217,139,.28)}}
.gsay.writing{color:#c9b98f;animation:formPulse 2.2s ease-in-out infinite}
.lbox{margin-top:12px;width:100%;max-width:340px;display:flex;flex-direction:column;gap:8px}
.lboxrow{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(245,217,139,.2);border-radius:12px;background:rgba(20,15,34,.5);text-align:left}
.lboxtxt{flex:1;min-width:0}
.lboxq{margin:0;font-size:12.5px;color:#e2d9f2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lboxno{margin:3px 0 0;font-family:sans-serif;font-size:10px;letter-spacing:.06em;color:#8a7f95}
.lboxrow .btn{flex:none;padding:7px 14px;font-size:11.5px;letter-spacing:.06em}
@media (prefers-reduced-motion:reduce){.mailbox,.mailbox .btn,.gsay.writing{animation:none}}
.readwrap{position:fixed;inset:0;z-index:75;overflow-y:auto;-webkit-overflow-scrolling:touch;background:radial-gradient(120% 74% at 50% 10%,#171029,#0b0817 58%,#060409)}
.readbody{max-width:520px;margin:0 auto;padding:calc(58px + env(safe-area-inset-top,0px)) 22px calc(48px + env(safe-area-inset-bottom,0px));text-align:center}
.dtag.center{text-align:center}
.rchap{margin-top:26px;text-align:left}
.rct{display:flex;align-items:baseline;gap:9px;margin:0 0 9px;font-size:14.5px;font-weight:600;color:#ffe9ad;letter-spacing:.02em;text-shadow:0 0 18px rgba(245,217,139,.3)}
.rct span{font-family:sans-serif;font-size:10px;letter-spacing:.1em;color:#8a7f95;border:1px solid rgba(245,217,139,.3);border-radius:999px;width:19px;height:19px;display:inline-flex;align-items:center;justify-content:center;flex:none}
.rcb{margin:0;font-size:14px;line-height:2.05;color:#ddd3ee;text-align:left;overflow-wrap:anywhere;word-break:keep-all}
.rclose{margin:32px 0 0;font-size:14.5px;line-height:1.9;color:#ffe9ad;letter-spacing:.03em;text-shadow:0 0 20px rgba(245,217,139,.35)}
.readbody .raterow{margin-top:34px}
.readbody .ainote{margin-top:26px}
.ainote.card{margin-top:18px;opacity:.85}
.err{color:#e58a8a;font-size:13px;font-family:sans-serif;margin:10px 0}
.cards{display:flex;flex-direction:column;gap:14px;width:100%;margin-top:10px}
.chips{display:flex;flex-direction:column;gap:8px;width:100%;margin:8px 0 4px;align-items:center}
.chip{font-family:inherit;font-size:12.5px;letter-spacing:.06em;color:#c9b98f;border:1px solid rgba(245,217,139,.3);border-radius:999px;padding:8px 18px;opacity:0;transform:translateY(8px);transition:all .7s ease}
.chip.on{opacity:1;transform:none;animation:chipGlow 1.6s ease}
@keyframes chipGlow{0%{box-shadow:0 0 0 rgba(245,217,139,0)}30%{box-shadow:0 0 18px rgba(245,217,139,.45)}100%{box-shadow:0 0 0 rgba(245,217,139,0)}}
.mention{font-size:14.5px;line-height:1.7;color:#e8dff5;margin:14px 0 4px}
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
.halo{position:relative;filter:drop-shadow(0 0 30px rgba(245,217,139,.15));margin:8px 0;transition:filter .6s}
.halo.wide{width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);display:flex;justify-content:center;margin-top:calc(min(110vw,57vh,640px)*-0.09);margin-bottom:calc(min(110vw,57vh,640px)*-0.16);transition:filter .6s,transform .9s cubic-bezier(.2,.8,.2,1),opacity .8s ease}
.halo.wide.lobbyscale{transform:translateY(7vh) scale(1.52)}
.halo.wide.dissolved{opacity:0;transform:scale(1.7);filter:blur(7px);pointer-events:none}
.halo.wide.asking{transform:translateY(-5vh) scale(.82);opacity:.96}
.halo.wide.ritualfade{opacity:.1;pointer-events:none;transition:opacity .8s ease}
.residue{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(50% 34% at 50% 36%,var(--elc),transparent 62%);opacity:.2}
@keyframes residueDrift{0%,100%{opacity:.18;transform:scale(1)}50%{opacity:.4;transform:scale(1.12)}}
.gpanel.asking{position:relative;z-index:1}
.gpanel.asking .gintro.dim2{font-size:16.5px;color:#ede0c2;margin-bottom:16px;text-shadow:0 1px 14px rgba(4,3,10,.9)}
.gpanel.asking .qbox{font-size:19px;padding:20px 16px;min-height:104px}
.scene.lobby{position:relative;min-height:calc(100dvh - 96px);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;background:radial-gradient(80% 52% at 50% 42%,#0a0d1c 0%,#060815 50%,rgba(3,4,10,0) 100%)}
.lobbypanel{position:absolute;left:0;right:0;bottom:calc(14vh + env(safe-area-inset-bottom, 0px));z-index:2;display:flex;flex-direction:column;align-items:center;width:100%;padding:0 16px}
.wakehint{font-family:sans-serif;font-size:12px;letter-spacing:.16em;color:#d8c79a;margin-top:22px;animation:wakePulse 2.4s ease-in-out infinite;text-shadow:0 1px 10px rgba(4,3,10,.85)}
/* v75: 공유 판결 랜딩 — 링크로 들어온 사람이 '실제 판결 카드'를 그대로 본다 */
.sharedwrap{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:34px 20px;background:radial-gradient(120% 78% at 50% 14%,#161029,#0b0817 58%,#060409);text-align:center;overflow-y:auto}
.sharedeyebrow{font-family:sans-serif;font-size:11px;letter-spacing:.24em;color:#b7a7d6;margin:0 0 16px}
.sharedcard{margin-top:0}
.sharedcard .vv{margin-top:6px}
.sharedsub{font-size:13px;line-height:1.7;color:#c3b6d8;margin:16px 4px 0;overflow-wrap:anywhere}
.sharedcta{margin-top:34px}
.sharedfoot{margin-top:26px;font-size:10.5px;letter-spacing:.32em;color:#7c7290;font-family:sans-serif}
/* v75: 판결 평가 행 */
.raterow{display:flex;flex-direction:column;align-items:center;gap:9px;margin-top:24px}
.ratelab{font-family:sans-serif;font-size:11.5px;letter-spacing:.12em;color:#b3a9c8}
.ratedone{font-size:12.5px;letter-spacing:.03em;color:#9a8fb5;margin:6px 0 0;animation:fd .6s cubic-bezier(.22,.7,.25,1) both}
@keyframes wakePulse{0%,100%{opacity:.4}50%{opacity:.95}}
.escx{position:fixed;top:calc(14px + env(safe-area-inset-top,0px));right:16px;z-index:30;width:40px;height:40px;border-radius:50%;border:1px solid rgba(245,217,139,.3);background:rgba(10,8,18,.55);color:#c9b98f;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);-webkit-tap-highlight-color:transparent;transition:all .2s}
.escx:hover{border-color:#ffe9ad;color:#ffe9ad}
.leanrow{margin:-4px 0 12px;display:flex;flex-direction:column;align-items:center;gap:7px}
.leanlab{font-family:sans-serif;font-size:11px;letter-spacing:.12em;color:#8a7f95}
.payrow{display:flex;gap:10px;margin-top:14px;justify-content:center;flex-wrap:wrap}
.memrow{display:flex;gap:18px;justify-content:center}
.halo.busy{animation:haloPulse 1.4s ease-in-out infinite}
@keyframes haloPulse{0%,100%{filter:drop-shadow(0 0 26px rgba(245,217,139,.14))}50%{filter:drop-shadow(0 0 46px rgba(245,217,139,.34))}}
.halo.dimmed{opacity:.32;filter:blur(2px) drop-shadow(0 0 30px rgba(245,217,139,.2));transition:opacity .6s,filter .6s}
.gintro{font-size:15px;line-height:1.8;margin:4px 0;color:#e0d6ef}.gintro.dim{color:#9d8fb5;font-size:14px;margin-bottom:14px}
.qbox{width:100%;background:rgba(16,12,26,.82);border:1px solid rgba(245,217,139,.45);border-radius:14px;color:#f0e2b8;padding:14px 14px;font-size:16px;font-family:inherit;resize:none;line-height:1.6;margin-bottom:14px;text-align:center;transition:border-color .3s,box-shadow .3s;box-shadow:0 8px 28px rgba(0,0,0,.5)}
.qbox::placeholder{color:#8a7f95}
.qbox:focus{outline:none;border-color:#ffe9ad;box-shadow:0 0 0 2px rgba(245,217,139,.22),0 8px 28px rgba(0,0,0,.5)}
.w100{width:100%;display:flex;flex-direction:column;align-items:center}
.gtext{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;pointer-events:none;padding:0 34px}
.gtext.up{padding-bottom:150px}
.gpanel{position:relative;margin:-12px auto 0;width:min(92vw,430px);display:flex;flex-direction:column;align-items:center;z-index:3;padding:0 4px}
.gpanel::before{content:"";position:absolute;left:50%;top:-28px;transform:translateX(-50%);width:120%;max-width:540px;height:170px;background:radial-gradient(ellipse 60% 100% at 50% 42%,rgba(6,4,12,.9),rgba(6,4,12,.46) 45%,transparent 70%);z-index:-1;pointer-events:none}
.forming{font-size:13px;line-height:2.1;color:#cfc4e2;letter-spacing:.14em;margin:0;text-shadow:0 0 16px rgba(245,217,139,.4);animation:formPulse 2.1s ease-in-out infinite;background:rgba(5,4,8,.45);padding:10px 18px;border-radius:14px}
.formwrap{display:flex;flex-direction:column;align-items:center;gap:14px}
.formsteps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;text-align:left;min-width:220px}
.formsteps li{font-size:11.5px;letter-spacing:.06em;color:#5b5470;transition:color .5s,transform .5s;transform:translateY(1px)}
.formsteps li.done{color:#8a7fa6}
.formsteps li.now{color:#f5d98b;text-shadow:0 0 12px rgba(245,217,139,.5);transform:translateY(0)}
@keyframes formPulse{0%,100%{opacity:.5}50%{opacity:1}}
.gname{font-size:14px;line-height:1.9;color:#f0e2b8;margin:0;text-shadow:0 2px 18px rgba(5,4,8,.95),0 0 26px rgba(245,217,139,.28);background:rgba(5,4,8,.5);padding:8px 16px;border-radius:14px}
.gsay{font-size:14.5px;line-height:1.8;color:#f0e2b8;margin:2px 0 10px;text-align:center;text-shadow:0 1px 12px rgba(4,3,10,.8)}
.gsay.sprite{font-size:12.5px;color:#9d8fb5;margin:-4px 0 10px}
.gsay.born{font-weight:600;color:#ffe9ad;text-shadow:0 0 18px rgba(245,217,139,.35)}
.gintro.dim2{color:#dcc99a;font-size:14px;margin:2px 0 12px;text-shadow:0 1px 12px rgba(4,3,10,.85),0 0 4px rgba(4,3,10,.7)}
.hexpanel{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:6px;width:100%}
.hexlines{display:flex;flex-direction:column-reverse;gap:8px;margin:6px 0;min-height:88px}
.hline{position:relative;width:86px;height:8px;display:flex;justify-content:center}
.hline .yang{width:86px;height:8px;border-radius:4px;background:linear-gradient(90deg,#f5d98b,#c98f3d);box-shadow:0 0 10px rgba(245,217,139,.45)}
.hline .yin{width:86px;height:8px;border-radius:4px;background:linear-gradient(90deg,#f5d98b 0 36%,transparent 36% 64%,#c98f3d 64% 100%)}
.hline .hempty{width:86px;height:8px;border-radius:4px;border:1px dashed rgba(138,127,149,.35);box-sizing:border-box}
.hline .mv{position:absolute;right:-16px;top:-2px;font-size:8px;color:#ffe9ad;font-style:normal;animation:formPulse 1.6s infinite}
.coins{font-family:sans-serif;font-size:12px;color:#c9b98f;display:flex;gap:10px;margin:0;min-height:20px;align-items:center}
.coin{width:16px;height:16px;border-radius:50%;background:linear-gradient(180deg,#f5d98b,#c98f3d);display:inline-block;box-shadow:0 0 10px rgba(245,217,139,.55);animation:coinFlip .3s linear infinite}
.coin.c2{animation-delay:.09s}.coin.c3{animation-delay:.17s}
@keyframes coinFlip{0%{transform:rotateX(0) translateY(0)}50%{transform:rotateX(180deg) translateY(-12px)}100%{transform:rotateX(360deg) translateY(0)}}
.qquote{font-size:16px;line-height:1.7;color:#f0e2b8;margin:0 0 2px;text-align:center;overflow-wrap:anywhere}
.coinstage{min-height:34px;display:flex;align-items:center;justify-content:center;gap:14px}
.coin.fly{animation:coinFly .75s ease-out both}
.coin.fly.c2{animation-delay:.09s}.coin.fly.c3{animation-delay:.17s}
@keyframes coinFly{0%{transform:translateY(26px) rotateX(0);opacity:0}18%{opacity:1}55%{transform:translateY(-24px) rotateX(540deg)}100%{transform:translateY(0) rotateX(1080deg);opacity:1}}
.hline.drop{animation:hexDrop .5s cubic-bezier(.2,.8,.3,1.25) both}
@keyframes hexDrop{from{opacity:0;transform:translateY(-16px) scaleX(.6);filter:brightness(2.6)}to{opacity:1;transform:none;filter:none}}
.wrapc{flex-wrap:wrap}
.bwrap{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:16px;filter:drop-shadow(0 0 18px rgba(245,217,139,.2))}
.persp{perspective:1100px;margin-top:22px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.persp.cardIn{animation:cardIn .95s cubic-bezier(.16,.9,.24,1) both;margin-top:calc(min(110vw,57vh,640px)*-0.33 - 120px);position:relative;z-index:2}
@keyframes cardIn{0%{opacity:0;transform:perspective(1100px) rotateX(58deg) translateY(-76px) scale(.55);filter:brightness(3) blur(14px)}45%{opacity:1;filter:brightness(1.7) blur(3px)}72%{transform:perspective(1100px) rotateX(-6deg) translateY(4px) scale(1.02);filter:brightness(1.1) blur(0)}100%{opacity:1;transform:none;filter:none}}
.gateflash{position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 30%,rgba(255,233,173,.55),rgba(255,233,173,.12) 34%,transparent 65%);animation:gf .9s ease-out forwards;z-index:5}
@keyframes gf{0%{opacity:0}35%{opacity:1}100%{opacity:0}}
.rvstage{min-height:140px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;margin-top:6px}
.rvbig{display:flex;flex-direction:column;gap:10px;align-items:center;animation:rvIn .35s ease both,rvAbsorb 1.15s ease forwards}
.rvbig span{font-family:sans-serif;font-size:11.5px;letter-spacing:.3em;color:#9d8fb5}
.rvbig b{font-size:22px;color:#ffe9ad;font-weight:600;letter-spacing:.05em;text-shadow:0 0 26px rgba(245,217,139,.4)}
@keyframes rvAbsorb{0%,78%{opacity:1;transform:none;filter:none}100%{opacity:0;transform:translateY(-60px) scale(.72);filter:blur(5px)}}
.dimseq{display:flex;flex-direction:column;gap:10px;align-items:center;margin:4px 0;width:100%}
.dimq{font-size:15px;line-height:1.6;color:#f0e2b8;margin:0}
.dimrow{display:flex;gap:8px;width:100%}
.dimopt{flex:1;font-family:inherit;font-size:12.5px;padding:12px 8px;border-radius:14px;border:1px solid rgba(245,217,139,.24);background:rgba(245,217,139,.05);color:#c3b591;cursor:pointer;transition:all .25s;line-height:1.5;word-break:keep-all}.dimopt:hover{border-color:rgba(245,217,139,.5);color:#e6d9a8}
.dimopt.sel{border-color:#ffe9ad;color:#ffe9ad;box-shadow:0 0 14px rgba(245,217,139,.3),inset 0 0 10px rgba(245,217,139,.08)}
@keyframes rvIn{from{opacity:0;filter:blur(7px);transform:scale(.9)}to{opacity:1;filter:blur(0);transform:none}}
@keyframes rvScatter{to{opacity:0;filter:blur(12px);letter-spacing:.7em;transform:scale(1.28)}}
.vhex{font-family:sans-serif;font-size:11px;color:#c9b98f;letter-spacing:.18em;margin:8px 0 0}
.season{font-family:sans-serif;font-size:10.5px;color:#8a7f95;margin-top:12px;letter-spacing:.04em;line-height:1.7}.season b{color:#ffe9ad}
.findlink{font-family:sans-serif;font-size:11.5px;color:#c9b98f;text-decoration:none;border-bottom:1px dotted #c9b98f66;margin-top:8px;display:inline-block}
.findlink:hover{color:#ffe9ad}
.vcard{position:relative;width:300px;min-height:430px;display:grid;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.8,.25,1)}
.vface{position:relative;grid-area:1/1;border-radius:16px;padding:24px;backface-visibility:hidden;background:linear-gradient(165deg,#1a1428,#0f0b1a 42%,#191024);background-image:radial-gradient(1px 1px at 82% 12%,#ffe9ad26,transparent),radial-gradient(1px 1px at 14% 30%,#7fd4ff1f,transparent),radial-gradient(1.5px 1.5px at 70% 78%,#b48cff22,transparent),radial-gradient(1px 1px at 30% 88%,#ffe9ad1f,transparent),linear-gradient(165deg,#1a1428,#0f0b1a 42%,#191024);box-shadow:inset 0 0 0 1px rgba(245,217,139,.42),inset 0 0 0 7px rgba(15,11,26,1),inset 0 0 0 8px rgba(245,217,139,.16),0 26px 54px rgba(0,0,0,.68);display:flex;flex-direction:column;text-align:center;overflow:hidden}
.vcard::after{content:"";position:absolute;inset:-3px;border-radius:20px;background:conic-gradient(from 210deg,#c98f3d40,#7fd4ff26,#b48cff3a,#e04d2a26,#c98f3d40);z-index:-1;filter:blur(7px)}
.corner{position:absolute;font-size:9px;color:#c9b98f88;font-style:normal}
.corner.tl{top:12px;left:12px}.corner.tr{top:12px;right:12px}.corner.bl{bottom:12px;left:12px}.corner.br{bottom:12px;right:12px}
.vside{position:absolute;left:13px;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;font-size:8.5px;letter-spacing:.6em;color:#c9b98f55;font-family:'Noto Serif KR',serif;pointer-events:none}
.vseal{position:absolute;right:16px;bottom:46px;width:28px;height:28px;background:linear-gradient(180deg,#c03434,#8e1f1f);color:#ffe9ad;font-size:14px;display:flex;align-items:center;justify-content:center;border-radius:4px;box-shadow:0 0 14px rgba(192,52,52,.45),inset 0 0 0 1px rgba(255,233,173,.3);font-family:'Noto Serif KR',serif;pointer-events:none;transition:opacity .5s}
.vseal.faded{opacity:.1}
.vface.back{transform:rotateY(180deg);text-align:left}
.vtop,.vbot{display:flex;justify-content:space-between;font-family:sans-serif;font-size:10px;letter-spacing:.2em;color:#c9b98f}
.vbot{margin-top:auto;color:#8a7f95}
.vq{font-size:14px;line-height:1.7;margin:22px 0 0;color:#d8cfe6;overflow-wrap:anywhere}
.vq.s{font-size:12.5px;line-height:1.6}
.vdiv{display:flex;align-items:center;gap:10px;color:#c98f3d;margin:14px 0;font-size:11px}.vdiv::before,.vdiv::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,#c98f3d88,transparent)}
.vv{font-size:27px;font-weight:900;margin:0;background:linear-gradient(180deg,#ffe9ad,#c98f3d);-webkit-background-clip:text;background-clip:text;color:transparent;overflow-wrap:anywhere}
.vv.m{font-size:21px;line-height:1.55}.vv.s{font-size:17px;line-height:1.62}
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
.vr{list-style:none;padding:0 2px 8px 0;margin:14px 0 0;display:flex;flex-direction:column;gap:10px;flex:1;min-height:0;max-height:340px;overflow-y:auto;-webkit-overflow-scrolling:touch}
.vr li{border-left:2px solid #c98f3d;padding-left:10px}.vr li.fun{border-left-color:#6f6580;opacity:.7}
.vr b{color:#f0e2b8;font-size:12.5px}.vr em.vote{font-style:normal;font-family:sans-serif;font-size:9.5px;color:#c9b98f;margin-left:6px;letter-spacing:.08em}.vr p{margin:2px 0 0;color:#b5aac6;font-size:12px;line-height:1.55;font-family:sans-serif}
.msr{margin-top:6px;font-family:sans-serif}
.msrbtn{background:none;border:1px solid #c9b98f33;border-radius:8px;color:#c9b98f;font-size:11px;padding:5px 10px;width:100%;cursor:pointer}
.msrbody{max-height:170px;overflow-y:auto;margin-top:6px;padding:2px 2px 6px}
.msrbody p{font-size:11px;color:#bfb6cc;line-height:1.55;margin:3px 0}
.msrbody b{color:#e6dff2;font-weight:700}
.msrsub{opacity:.72;font-size:12.5px}
.msrh{margin-top:7px !important;color:#c9b98f !important;letter-spacing:.14em;font-size:10px !important}
.disc{margin-top:auto;font-family:sans-serif;font-size:10px;color:#8a7f95;line-height:1.5}
.split{font-family:sans-serif;font-size:10.5px;letter-spacing:.22em;color:#e5b96b;margin:0 0 6px;animation:formPulse 1.8s ease-in-out infinite}
.retrybtn{background:transparent;border:1px solid #c98f3d66;color:#e6d6a8;font-size:11px;padding:3px 12px;border-radius:14px;cursor:pointer;font-family:sans-serif;margin-left:8px}
.retrybtn:hover{border-color:#f5d98b}
.resetlink{background:none;border:none;margin-top:18px;color:#5f5670;font-family:sans-serif;font-size:10.5px;letter-spacing:.06em;cursor:pointer;text-decoration:underline dotted}
.resetlink:hover{color:#9d8fb5}
.daily{width:100%;border:1px solid rgba(245,217,139,.28);border-radius:14px;padding:14px 16px;margin:2px 0 14px;background:linear-gradient(160deg,#1c173066,#120e1e88)}
.dtag{font-family:sans-serif;font-size:9.5px;letter-spacing:.22em;color:#c9b98f;margin:0 0 8px}
.dmain{font-size:14.5px;line-height:1.8;color:#e8dff5;margin:0}.dmain b{color:#ffe9ad;font-weight:600}
.dverdict{font-size:13.5px;line-height:1.75;color:#e5b96b;margin:6px 0 10px;overflow-wrap:anywhere}
.dsub{font-family:sans-serif;font-size:10.5px;color:#8a7f95;line-height:1.7;margin:8px 0 10px}
.btn.sm{padding:8px 18px;font-size:12px;letter-spacing:.08em}
.knock{background:none;border:1px dashed rgba(245,217,139,.35);border-radius:999px;padding:10px 22px;margin:2px 0 14px;color:#c9b98f;font-family:inherit;font-size:13px;letter-spacing:.04em;cursor:pointer;transition:all .3s}
.knock:hover{border-color:#ffe9ad;color:#ffe9ad;box-shadow:0 0 16px rgba(245,217,139,.15)}
.streak{font-family:sans-serif;font-size:10.5px;letter-spacing:.18em;color:#c9b98f;margin:0 0 10px}
.vlog{width:100%;display:flex;flex-direction:column;gap:10px;margin-top:12px;text-align:left}
.vlogrow{display:flex;gap:10px;align-items:center;border:1px solid rgba(138,127,149,.22);border-radius:12px;padding:8px 10px;background:#120e1e66}
.vlogtxt{flex:1;min-width:0}
.vlogq{margin:0;font-size:12.5px;color:#cbc0dd;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vlogmeta{margin:3px 0 0;font-family:sans-serif;font-size:10px;color:#8a7f95}
.vlogmeta b{font-weight:600}.lgo{color:#3dc98f}.lstop{color:#e05a5a}.lhold{color:#7f8fd4}
.vlogrow{cursor:pointer;transition:border-color .2s}.vlogrow:hover{border-color:rgba(201,143,61,.4)}.vlogrow.open .vlogq{white-space:normal;overflow:visible}.vlogverdict{margin:5px 0 0;font-size:13px;color:#e7dcf5;line-height:1.55;border-top:1px solid rgba(255,255,255,.09);padding-top:5px}
@media(max-width:520px){.stage{padding:20px 10px 72px}.scene{max-width:100%}.gpanel{width:95vw;padding:0}.grid16{gap:6px}}
@media(prefers-reduced-motion:reduce){.fade,.line,.spark,.mcard,.chip.on,.halo.busy,.forming,.persp.cardIn,.hline .mv,.rv,.gateflash{animation:none;transition:none;opacity:1;transform:none}}
`;

export { calcSaju, sunLongitude, equationOfTime, cityLon, moonLongitude, tzolkin, moonPlacements, lunar2solar, solar2lunar, daeun }; // 검증(e2e/mansae-test.mjs)용
