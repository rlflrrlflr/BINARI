/* 얼굴 — 눈·입·볼터치·눈썹을 2D 로 그린다. **오라 위에 얹는 층**이고 셰이더가 아니다.
 *
 * ⚠ 이 파일은 **앱과 시안 보드가 함께 쓴다**(tools/build-face-mock.mjs 가 그대로 읽어 간다).
 *    두 벌로 갈리면 보드가 앱과 다른 그림을 보여 준다 — v143·v150 에서 셰이더로 두 번 겪었다.
 *
 * ⚠ 설계 헌장 §페르소나 톤: 얼굴 윤곽·머리카락·몸·팔다리는 그리지 않는다.
 *    캘시퍼도 불꽃에 눈과 입만 있다. 그 선을 넘으면 "정령 시각요소 부활"이 된다.
 *
 * 좌표는 전부 **캔버스 한 변 S 에 대한 비율**이다. 크기가 바뀌어도 얼굴 비례가 안 흔들린다.
 */

/* ── 눈 ─────────────────────────────────────────────────────────────────
   ⚠ **눈썹 없이 눈만으로 표정을 낸다**(창업자 2026-08-29).
      인스타툰 9건에서 눈썹은 3/9 로 소수파였고, 상위 넷 중 셋이 눈썹이 없다.
      그럼 감정은 어디서 나오나 — **눈 모양 자체가 바뀐다.** 아래가 그 어휘다. */
export const EYE_KINDS = [
  ["dot",    "평온",   "점 둘. 아무 일 없다"],
  ["smile",  "기쁨",   "위로 굽은 호 — 웃으면 눈이 접힌다"],
  ["droop",  "시무룩", "바깥쪽이 처진다"],
  ["wide",   "놀람",   "점이 커지고 위로 붙는다"],
  ["sleepy", "졸림",   "위에서 눈꺼풀이 반쯤 덮는다"],
  ["stern",  "굳음",   "위가 눌린 반달. 눈썹 없이도 단호하다"],
  ["side",   "곁눈",   "점이 한쪽으로 — 딴 데 본다"],
  ["shine",  "들뜸",   "점 안에 반짝임. 기대하는 눈"],
  ["closed", "감음",   "선 하나. 쉬거나 참는 중"],
  ["teary",  "울먹",   "아래에 물기 한 방울"],
];

export function drawEyes(x, kind, cx, cy, gap, sz, ink) {
  x.save();
  x.strokeStyle = ink; x.fillStyle = ink; x.lineCap = "round"; x.lineJoin = "round";
  const eye = (ex, dir) => {
    x.beginPath();
    if (kind === "dot") { x.ellipse(ex, cy, sz, sz * 1.16, 0, 0, 7); x.fill(); }
    else if (kind === "wide") { x.ellipse(ex, cy - sz * 0.22, sz * 1.5, sz * 1.62, 0, 0, 7); x.fill(); }
    else if (kind === "smile") { x.lineWidth = sz * 0.78;
      x.arc(ex, cy + sz * 0.62, sz * 1.22, Math.PI * 1.18, Math.PI * 1.82); x.stroke(); }
    else if (kind === "closed") { x.lineWidth = sz * 0.72;
      x.arc(ex, cy - sz * 0.55, sz * 1.15, Math.PI * 0.24, Math.PI * 0.76); x.stroke(); }
    else if (kind === "droop") { x.ellipse(ex + dir * sz * 0.10, cy + sz * 0.30, sz * 0.92, sz * 0.98, 0, 0, 7); x.fill();
      x.lineWidth = sz * 0.42; x.beginPath();
      x.moveTo(ex - dir * sz * 1.30, cy - sz * 1.10); x.lineTo(ex + dir * sz * 1.05, cy - sz * 0.42); x.stroke(); }
    else if (kind === "sleepy") { x.ellipse(ex, cy + sz * 0.34, sz, sz * 0.86, 0, 0, 7); x.fill();
      x.lineWidth = sz * 0.46; x.beginPath();
      x.moveTo(ex - sz * 1.20, cy - sz * 0.46); x.lineTo(ex + sz * 1.20, cy - sz * 0.46); x.stroke(); }
    else if (kind === "stern") { x.ellipse(ex, cy + sz * 0.16, sz * 1.05, sz * 0.72, 0, 0, 7); x.fill();
      x.lineWidth = sz * 0.52; x.beginPath();
      x.moveTo(ex - sz * 1.25, cy - sz * 0.72); x.lineTo(ex + sz * 1.25, cy - sz * 0.60); x.stroke(); }
    else if (kind === "side") { x.ellipse(ex + sz * 0.62, cy, sz * 0.95, sz * 1.10, 0, 0, 7); x.fill(); }
    else if (kind === "shine") { x.ellipse(ex, cy, sz * 1.20, sz * 1.34, 0, 0, 7); x.fill();
      x.fillStyle = "rgba(255,255,255,.92)"; x.beginPath();
      x.arc(ex - sz * 0.36, cy - sz * 0.44, sz * 0.40, 0, 7); x.fill(); x.fillStyle = ink; }
    else if (kind === "teary") { x.ellipse(ex, cy, sz, sz * 1.16, 0, 0, 7); x.fill();
      x.fillStyle = "rgba(120,180,225,.78)"; x.beginPath();
      x.ellipse(ex + dir * sz * 0.95, cy + sz * 1.15, sz * 0.42, sz * 0.55, 0, 0, 7); x.fill(); x.fillStyle = ink; }
  };
  eye(cx - gap, -1); eye(cx + gap, 1);
  x.restore();
}

/* ── 입 — 눈보다 훨씬 작고 얇다(캘시퍼 원본·인스타툰 공통) ───────────── */
export const MOUTH_KINDS = [
  ["squig", "구불선"], ["flat", "일자"], ["smile", "미소"],
  ["frown", "삐죽"], ["o", "오"], ["wave", "물결"], ["none", "없음"],
];
export function drawMouth(x, kind, cx, cy, sz, ink) {
  if (kind === "none") return;
  x.save();
  x.strokeStyle = ink; x.fillStyle = ink; x.lineCap = "round"; x.lineJoin = "round";
  x.lineWidth = sz * 0.16; x.beginPath();
  const w = sz * 1.05;
  if (kind === "squig") { x.moveTo(cx - w / 2, cy);
    for (let i = 0; i <= 24; i++) { const t = i / 24;
      x.lineTo(cx - w / 2 + w * t, cy + Math.sin(t * Math.PI * 2.6) * sz * 0.16 + t * sz * 0.13); } x.stroke(); }
  else if (kind === "flat") { x.moveTo(cx - w * 0.42, cy); x.lineTo(cx + w * 0.42, cy); x.stroke(); }
  else if (kind === "smile") { x.arc(cx, cy - sz * 0.26, sz * 0.58, Math.PI * 0.22, Math.PI * 0.78); x.stroke(); }
  else if (kind === "frown") { x.moveTo(cx - w * 0.42, cy - sz * 0.10);
    x.quadraticCurveTo(cx, cy + sz * 0.20, cx + w * 0.42, cy + sz * 0.16); x.stroke(); }
  else if (kind === "o") { x.ellipse(cx, cy, sz * 0.28, sz * 0.34, 0, 0, 7); x.stroke(); }
  else if (kind === "wave") { x.moveTo(cx - w / 2, cy);
    for (let i = 0; i <= 24; i++) { const t = i / 24; x.lineTo(cx - w / 2 + w * t, cy + Math.sin(t * Math.PI * 2) * sz * 0.18); } x.stroke(); }
  x.restore();
}

/* 볼터치 — 인스타툰 9건 중 5건이 쓴다(눈썹 3건보다 흔하다) */
export function drawBlush(x, on, cx, cy, gap, sz) {
  if (!on) return;
  x.save(); x.fillStyle = "rgba(238,132,132,.34)";
  [cx - gap * 1.55, cx + gap * 1.55].forEach((ex) => {
    x.beginPath(); x.ellipse(ex, cy + sz * 1.5, sz * 1.5, sz, 0, 0, 7); x.fill(); });
  x.restore();
}

/* ── 프리셋 — **인기 상위 넷의 값을 그대로 옮긴 것**(육안 추정) ──────────
   전부 칸 한 변 대비 비율. `?face=a|b|c|d` 로 앱에서 갈아 끼운다. */
export const FACE_PRESETS = {
  /* ⚠ 간격을 인스타툰 값(얼굴 폭의 40~50%)으로 그대로 옮겼더니 **눈이 코어 밖으로 나갔다.**
     인스타툰의 "얼굴 폭"은 캐릭터 몸통이고, 우리 오라는 **코어가 작고 헤일로가 크다** —
     같은 비율을 쓰면 눈이 헤일로에 떠 있게 된다. 코어 폭 기준으로 다시 잡았다. */
  /* ⚠ cy 를 0.50(캔버스 중앙)으로 두면 **눈이 코어보다 0.07 아래**에 온다(실측).
     오라의 밝은 중심은 캔버스 정중앙이 아니다 — 반사광 층(c0)이 위로 치우쳐 있고
     불꽃 형태가 위로 뻗기 때문이다. 그만큼 올려 잡는다. */
  a: { name: "A · 아주 작은 점 (22.9만형)", eyeSz: 0.019, gap: 0.072, cy: 0.433, blush: true,
       mouth: "smile", mSz: 0.050, mCy: 0.493 },
  b: { name: "B · 작은 점 (8.8만형)",        eyeSz: 0.027, gap: 0.066, cy: 0.431, blush: true,
       mouth: "wave",  mSz: 0.060, mCy: 0.491 },
  c: { name: "C · 굳은 눈 (5.8만형)",        eyeSz: 0.025, gap: 0.062, cy: 0.429, blush: false,
       mouth: "flat",  mSz: 0.056, mCy: 0.489 },
  d: { name: "D · 반짝임 (3.8만형)",         eyeSz: 0.021, gap: 0.078, cy: 0.435, blush: true,
       mouth: "squig", mSz: 0.052, mCy: 0.497 },
};

/* 오늘 상태(십성) → 눈 모양. **눈만으로 감정을 낸다** — 눈썹을 안 쓰는 대가로
   눈이 일을 더 한다. 입은 기존 MOOD 표가 이미 맡고 있다. */
export const MOOD_EYE = {
  비견: "dot",   겁재: "wide",  식신: "smile", 상관: "shine", 정재: "stern",
  편재: "side",  정관: "closed", 편관: "droop", 정인: "smile", 편인: "sleepy",
};

/* 한 번에 그린다 — 앱과 보드가 같은 진입점을 쓴다 */
export function drawFace(x, S, opt) {
  const P = Object.assign({ eye: "dot", mouth: "smile", cy: 0.50, gap: 0.115,
    eyeSz: 0.022, mSz: 0.055, mCy: 0.565, blush: true, ink: "#191308" }, opt);
  drawBlush(x, P.blush, S * 0.5, S * P.cy, S * P.gap, S * P.eyeSz);
  drawEyes(x, P.eye, S * 0.5, S * P.cy, S * P.gap, S * P.eyeSz, P.ink);
  drawMouth(x, P.mouth, S * 0.5, S * P.mCy, S * P.mSz, P.ink);
}
