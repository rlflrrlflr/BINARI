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
/* 흰자 눈 — 비교자 그림(캘시퍼 계열)의 구조. **동공이 시선을 말한다** —
   점눈은 눈 전체가 움직여야 하지만 흰자는 동공만 굴리면 된다. */
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
  ["ball",   "흰자",   "큰 흰자 + 작은 동공. 동공이 시선을 향한다"],
];

export function drawEyes(x, kind, cx, cy, gap, sz, ink, gaze) {
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
    else if (kind === "ball") {
      x.fillStyle = "#fbf7ef"; x.ellipse(ex, cy, sz, sz * 1.12, 0, 0, 7); x.fill();
      x.strokeStyle = "rgba(30,22,12,.28)"; x.lineWidth = sz * 0.07; x.stroke();
      x.fillStyle = ink; x.beginPath();
      /* 동공은 흰자 안에서 **시선 쪽으로** 굴러간다. 밖으로 안 나가게 0.42 로 묶는다. */
      x.arc(ex + (gaze ? gaze.x : 0) * sz * 0.42, cy + (gaze ? gaze.y : 0) * sz * 0.42, sz * 0.34, 0, 7); x.fill();
    }
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
  /* E — 창업자 지정(2026-08-29): 비교자 그림 기준, **눈 크기 11% · 간격 35%**.
     그 그림은 얼굴이 칸을 꽉 채운 비율이라 앱 오라(코어가 작다)에는 그대로 못 쓴다 —
     A~D 와 같은 환산(÷2.6)을 적용했다. 흰자 눈이라 **동공이 시선을 향한다.** */
  e: { name: "E · 흰자 (지정 11%/35%)", eye: "ball", eyeSz: 0.021, gap: 0.067, cy: 0.433,
       blush: false, mouth: "squig", mSz: 0.050, mCy: 0.493 },
};

/* 오늘 상태(십성) → 눈 모양. **눈만으로 감정을 낸다** — 눈썹을 안 쓰는 대가로
   눈이 일을 더 한다. 입은 기존 MOOD 표가 이미 맡고 있다. */
export const MOOD_EYE = {
  비견: "dot",   겁재: "wide",  식신: "smile", 상관: "shine", 정재: "stern",
  편재: "side",  정관: "closed", 편관: "droop", 정인: "smile", 편인: "sleepy",
};

/* ── 카툰 원근 (창업자 2026-08-29: "카툰 렌더링 보면 2d인데 각도에 따라 원근감도
   생기고 그렇잖아 / 지금은 그냥 이미지가 냅다 붙은 거 같아서 단조로워") ────────
   맞다. 지금까지는 눈·입을 **평면에 고정 좌표로** 찍었다. 그래서 오라가 아무리 움직여도
   얼굴은 스티커였다.
   고치는 법은 카툰이 늘 쓰던 것 — **얼굴 요소를 구 표면에 놓고 각도로 돌린 뒤 정사영**한다.
   그러면 옆을 볼 때 ①먼 쪽 눈이 작아지고 ②두 눈 간격이 좁아지고 ③가로로 눌린다.
   셋이 같이 일어나야 "돌았다"로 보인다 — 하나만 하면 미끄러진 것으로 보인다. */
export function project(u, v, yaw, pitch) {
  const su = Math.sin(u), cu = Math.cos(u), sv = Math.sin(v), cv = Math.cos(v);
  const x = su * cv, y = sv, z = cu * cv;
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const y1 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
  return { x: x1, y: y1, z: z2 };
}

/* 한 번에 그린다 — 앱과 보드가 같은 진입점을 쓴다 */
export function drawFace(x, S, opt) {
  const P = Object.assign({ eye: "dot", mouth: "smile", cy: 0.50, gap: 0.115,
    eyeSz: 0.022, mSz: 0.055, mCy: 0.565, blush: true, ink: "#191308",
    yaw: 0, pitch: 0 }, opt);
  const { yaw, pitch } = P;
  /* 얼굴이 놓인 구의 반지름(화면 단위). 이 값이 곧 **원근의 세기**다 —
     크면 조금만 돌려도 크게 미끄러지고, 작으면 거의 평면이 된다. */
  const RAD = S * 0.30;
  const cx = S * 0.5, cyPx = S * P.cy;
  /* 눈이 구 위에서 벌어진 각도 — 화면상 간격(gap)에서 역산한다 */
  const eu = Math.asin(Math.min(0.95, (S * P.gap) / RAD));
  /* ⚠ 투영값을 그대로 쓰면 **얼굴 전체가 회전 방향으로 밀려난다** — 구가 도니 앞면도 옮겨간다.
     실기에서 얼굴이 오라 중심을 벗어나 가장자리에 붙었다. 카툰의 머리는 **제자리에서 돌기만** 한다.
     그래서 얼굴 정중앙(u=v=0)의 이동량을 빼서 중심을 고정하고, 회전은 요소 배치에만 남긴다. */
  const c0 = project(0, 0, yaw, pitch);
  const put = (u, v) => { const q = project(u, v, yaw, pitch);
    return { px: cx + (q.x - c0.x) * RAD, py: cyPx + (q.y - c0.y) * RAD, z: q.z }; };

  drawBlush(x, P.blush, cx, cyPx, S * P.gap, S * P.eyeSz);

  /* 눈 둘을 따로 투영한다 — **각자 다른 z 를 갖는 게 원근의 전부다** */
  [[-eu, -1], [eu, 1]].forEach(([u, side]) => {
    const e = put(u, 0);
    if (e.z < -0.15) return;                       // 완전히 뒤로 넘어간 눈은 안 그린다
    const near = 0.55 + 0.45 * Math.max(0, e.z);   // 가까울수록 크다
    x.save();
    x.translate(e.px, e.py);
    /* 가로로 눌린다 — 구 표면이 기울어질수록 정면 투영이 좁아진다 */
    x.scale(Math.max(0.28, Math.abs(e.z)) * 1.0 + 0.0, 1);
    x.translate(-e.px, -e.py);
    drawEyes(x, P.eye, e.px, e.py, 0, S * P.eyeSz * near, P.ink,
      { x: yaw * 1.6, y: pitch * 1.6 });
    x.restore();
  });

  /* 입도 같은 구 위에 있다 — 안 그러면 얼굴이 돌 때 입만 제자리에 남는다 */
  const mv = Math.asin(Math.min(0.95, (S * (P.mCy - P.cy)) / RAD));
  const m = put(0, mv);
  if (m.z > -0.15) {
    const near = 0.55 + 0.45 * Math.max(0, m.z);
    x.save(); x.translate(m.px, m.py); x.scale(Math.max(0.30, Math.abs(m.z)), 1); x.translate(-m.px, -m.py);
    drawMouth(x, P.mouth, m.px, m.py, S * P.mSz * near, P.ink);
    x.restore();
  }
}
