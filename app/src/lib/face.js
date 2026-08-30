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
  ["droop",  "시무룩", "바깥쪽이 처진 눈 — 선을 안 긋는다"],
  ["wide",   "놀람",   "점이 커지고 위로 붙는다"],
  ["sleepy", "졸림",   "아래쪽만 남은 눈 — 위를 잘라낸다"],
  ["stern",  "굳음",   "위가 평평하게 잘린 눈 — 째려봄은 절단면이다"],
  ["side",   "곁눈",   "점이 한쪽으로 — 딴 데 본다"],
  ["shine",  "들뜸",   "점 안에 반짝임. 기대하는 눈"],
  ["wince", "질끈(아픔)", "안쪽으로 꺾인 선 둘 — 아기 볼 눌린 눈"],
  ["closed", "감음",   "선 하나. 쉬거나 참는 중"],
  ["teary",  "울먹",   "아래에 물기 한 방울"],
  ["angry",  "화남",   "안쪽이 올라간다 — 굳음과 반대로 기울인 절단면"],
  ["ball",   "흰자",   "큰 흰자 + 작은 동공. 동공이 시선을 향한다"],
];

/* ⚠ `only` 를 주면 **그 한쪽만** 그린다(-1 왼눈 / +1 오른눈).
   없으면 예전처럼 둘 다 그린다(보드의 옛 그림이 그 경로를 쓴다).
   왜 필요한가: drawFace 는 눈을 **하나씩 따로 투영**해서 gap 0 으로 부른다.
   그런데 drawEyes 는 그 자리에 좌우 눈을 **겹쳐** 그렸다 — 점처럼 좌우대칭인 모양은
   티가 안 났지만 시무룩·화남·질끈처럼 **비대칭인 눈은 제 거울상과 겹쳐 X 자국**이 됐다.
   실기에서 질끈(><)이 전부 ✗ 로 보인 게 이것 때문이다. */
export function drawEyes(x, kind, cx, cy, gap, sz, ink, gaze, only) {
  /* ⚠ **선을 얹지 않는다**(창업자 2026-08-29: "진짜 눈썹이 눈에 붙어있는 게 아냐.
     눈 모양으로 그냥 표정이 읽히는 거야"). 앞 판에서 시무룩·졸림·굳음을 만들 때
     눈 위에 선을 하나씩 그었는데, 눈에서 떨어진 선은 **눈꺼풀이 아니라 눈썹으로 읽힌다.**
     인스타툰이 하는 건 그게 아니라 **눈의 실루엣 자체를 깎는 것**이다 —
     위를 자르면 째려보고, 아래만 남기면 졸리고, 기울이면 처진다. 도형 하나로 끝낸다. */
  x.save();
  x.strokeStyle = ink; x.fillStyle = ink; x.lineCap = "round"; x.lineJoin = "round";

  /* 눈 하나를 그린다. dir 은 바깥 방향(-1 왼눈 / +1 오른눈) */
  const eye = (ex, dir) => {
    /* 타원을 그리되 위/아래를 잘라 쓰는 헬퍼 — 자르는 게 이 어휘의 핵심이다 */
    /* dy 는 **바깥쪽을 올리거나 내리는 양**이다. 기울기만으로는 시무룩과 화남이
       비슷해 보였다 — 눈 하나의 높이까지 어긋나야 확실히 갈린다. */
    const cut = (topFrac, rw, rh, tilt, dy) => {
      const oy = cy + (dy || 0) * dir * rh;
      x.save();
      x.beginPath();
      x.rect(ex - rw * 2.2, oy - rh + rh * 2 * topFrac, rw * 4.4, rh * 4);
      x.clip();
      x.beginPath();
      x.ellipse(ex, oy, rw, rh, (tilt || 0) * dir, 0, 7);
      x.fill();
      x.restore();
    };
    if (kind === "dot") { x.beginPath(); x.ellipse(ex, cy, sz, sz * 1.16, 0, 0, 7); x.fill(); }
    else if (kind === "wide") { x.beginPath(); x.ellipse(ex, cy - sz * 0.22, sz * 1.5, sz * 1.62, 0, 0, 7); x.fill(); }
    else if (kind === "smile") { x.lineWidth = sz * 0.78; x.beginPath();
      x.arc(ex, cy + sz * 0.62, sz * 1.22, Math.PI * 1.18, Math.PI * 1.82); x.stroke(); }
    else if (kind === "closed") { x.lineWidth = sz * 0.72; x.beginPath();
      x.arc(ex, cy - sz * 0.55, sz * 1.15, Math.PI * 0.24, Math.PI * 0.76); x.stroke(); }
    /* 시무룩 — **바깥쪽이 처진 눈.** 타원을 바깥 아래로 기울이고 위를 살짝 자른다 */
    else if (kind === "droop") { cut(0.20, sz * 1.16, sz * 1.30, 0.62, 0.26); }   // 바깥이 처진다
    /* 졸림 — **아래쪽만 남은 눈.** 위를 절반 넘게 자르면 눈꺼풀이 덮인 것으로 읽힌다 */
    else if (kind === "sleepy") { cut(0.64, sz * 1.28, sz * 1.44, 0, 0); }        // 가늘게 남는다
    /* 굳음 — **위가 평평하게 잘린 눈.** 째려보는 눈은 선이 아니라 이 절단면이다 */
    else if (kind === "stern") { cut(0.36, sz * 1.20, sz * 1.58, 0, 0); }         // 두껍게 남는다
    /* 화남 — 안쪽이 올라간다. 굳음과 같은 절단에 **반대로** 기울인다 */
    else if (kind === "angry") { cut(0.34, sz * 1.18, sz * 1.42, -0.58, -0.22); } // 안쪽이 올라간다
    /* 질끈 — **아래로 휜 호(⌣)는 안 아파 보인다**(창업자 2026-08-29). 그건 흐뭇하게 감은 눈이다.
       아픈 눈은 **안쪽으로 꺾인다** — >< 가 그 뜻이고, 선 두 개로 끝난다.
       눈썹을 그리는 게 아니다. **눈 자체가 꺾인 것**이다. */
    else if (kind === "wince") {
      /* ⚠ 획을 좁고 두껍게 그렸더니 **X 자국**으로 뭉쳤다(실기 확인). >< 는 **가로로 길어야** 읽힌다. */
      x.lineWidth = sz * 0.26; x.lineCap = "round";
      const ww = sz * 1.55, hh = sz * 0.92;
      x.beginPath();
      x.moveTo(ex + dir * ww, cy - hh);         // 바깥 위
      x.lineTo(ex - dir * ww * 0.55, cy);       // 안쪽 꼭짓점
      x.lineTo(ex + dir * ww, cy + hh);         // 바깥 아래
      x.stroke();
    }
    else if (kind === "side") { x.beginPath(); x.ellipse(ex + sz * 0.62, cy, sz * 0.95, sz * 1.10, 0, 0, 7); x.fill(); }
    else if (kind === "shine") { x.beginPath(); x.ellipse(ex, cy, sz * 1.20, sz * 1.34, 0, 0, 7); x.fill();
      x.fillStyle = "rgba(255,255,255,.92)"; x.beginPath();
      x.arc(ex - sz * 0.36, cy - sz * 0.44, sz * 0.40, 0, 7); x.fill(); x.fillStyle = ink; }
    else if (kind === "ball") {
      x.fillStyle = "#fbf7ef"; x.beginPath(); x.ellipse(ex, cy, sz, sz * 1.12, 0, 0, 7); x.fill();
      x.strokeStyle = "rgba(30,22,12,.28)"; x.lineWidth = sz * 0.07; x.stroke();
      x.fillStyle = ink; x.beginPath();
      x.arc(ex + (gaze ? gaze.x : 0) * sz * 0.42, cy + (gaze ? gaze.y : 0) * sz * 0.42, sz * 0.34, 0, 7); x.fill();
    }
    else if (kind === "teary") { x.beginPath(); x.ellipse(ex, cy, sz, sz * 1.16, 0, 0, 7); x.fill();
      x.fillStyle = "rgba(120,180,225,.78)"; x.beginPath();
      x.ellipse(ex + dir * sz * 0.95, cy + sz * 1.15, sz * 0.42, sz * 0.55, 0, 0, 7); x.fill(); x.fillStyle = ink; }
  };
  if (only === -1) eye(cx, -1);
  else if (only === 1) eye(cx, 1);
  else { eye(cx - gap, -1); eye(cx + gap, 1); }
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
  x.lineWidth = sz * 0.22; x.beginPath();
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
/* pts 를 주면 **그 자리에** 찍는다 — 얼굴이 돌 때 홍조만 제자리에 남으면 붙여 놓은 표가 난다.
   안 주면 예전처럼 gap 으로 계산한다(보드의 옛 그림이 그 경로를 쓴다). */
export function drawBlush(x, on, cx, cy, gap, sz, pts) {
  if (!on) return;
  x.save(); x.fillStyle = "rgba(238,132,132,.34)";
  const P = pts || [{ px: cx - gap * 1.55, py: cy + sz * 1.5, s: 1 },
                    { px: cx + gap * 1.55, py: cy + sz * 1.5, s: 1 }];
  P.forEach((q) => { x.beginPath();
    x.ellipse(q.px, q.py, sz * 1.5 * (q.s == null ? 1 : q.s), sz, 0, 0, 7); x.fill(); });
  x.restore();
}

/* ── 프리셋 — **인기 상위 넷의 값을 그대로 옮긴 것**(육안 추정) ──────────
   전부 칸 한 변 대비 비율. `?face=a|b|c|d` 로 앱에서 갈아 끼운다. */
export const FACE_PRESETS = {
  /* ⚠ 간격을 인스타툰 값(얼굴 폭의 40~50%)으로 그대로 옮겼더니 **눈이 코어 밖으로 나갔다.**
     인스타툰의 "얼굴 폭"은 캐릭터 몸통이고, 우리 오라는 **코어가 작고 헤일로가 크다** —
     같은 비율을 쓰면 눈이 헤일로에 떠 있게 된다. 코어 폭 기준으로 다시 잡았다. */
  /* ⚠ **cy 는 다시 0.50 이다**(2026-08-29). 예전에 0.433 으로 올려 잡았던 건
     "캔버스 중앙 ≠ 코어"를 **상수로 때운** 것이었다 — 코어는 시간에 따라 움직이므로
     상수로는 못 따라간다(실측 어긋남 x 28px·y 22px). 이제 App.jsx 가 셰이더와 같은 식으로
     코어 좌표를 매 프레임 풀어서 넘긴다. 여기 cy 는 **그 코어 안에서의 눈 높이**다. */
  /* ⚠ 눈 크기·간격은 **넷이 같다**(창업자 2026-08-29 보드에서 직접 고름: "눈크기 3%, 간격 26%").
     프리셋이 가르는 건 이제 **눈 모양·입·홍조**뿐이다 — 기하는 고정값이다.
     eyeSz 는 보드의 「점 지름」의 절반이다(0.030/2 = 0.015). gap 도 같은 관계(0.260/2). */
  a: { name: "A · 아주 작은 점 (22.9만형)", eyeSz: 0.015, gap: 0.130, cy: 0.500, blush: true,
       mouth: "smile", mSz: 0.050, mCy: 0.560 },
  b: { name: "B · 작은 점 (8.8만형)",        eyeSz: 0.015, gap: 0.130, cy: 0.500, blush: true,
       mouth: "wave",  mSz: 0.060, mCy: 0.560 },
  c: { name: "C · 굳은 눈 (5.8만형)",        eyeSz: 0.015, gap: 0.130, cy: 0.500, blush: false,
       mouth: "flat",  mSz: 0.056, mCy: 0.560 },
  d: { name: "D · 반짝임 (3.8만형)",         eyeSz: 0.015, gap: 0.130, cy: 0.500, blush: true,
       mouth: "squig", mSz: 0.052, mCy: 0.560 },
  /* ⚠ E(흰자)는 **뺐다**(창업자 2026-08-29: "흰자 있으니까 이상하다 e 제외하자").
     밝은 미색 오라 위에서 흰자는 배경과 붙어 눈이 뜬 것처럼 보인다 —
     인스타툰 9건에서도 흰자 둘은 **흰 배경**을 쓰는 그림이었다. 우리 판은 그 조건이 아니다.
     `ball` 눈 모양 자체는 남겨 둔다(보드에서 계열 비교용). */
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
    yaw: 0, pitch: 0, roll: 0, blink: 0, squish: 0, sqx: 1, sqy: 0, eyeScale: 1 }, opt);
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
  /* ── 아기 볼 누르기 ────────────────────────────────────────────────
     창업자 2026-08-29: "얼굴 터치하면 아기 얼굴 누른 거처럼 느껴지면 좋겠어."
     아기 볼은 **밀리기만 하지 않는다** — 누른 축으로 납작해지고 직각으로 부푼다.
     부피가 보존되는 것처럼 보여야 「살」로 읽힌다. 좌표계를 누른 방향으로 돌려서
     그 축으로만 눌렀다가 되돌린다. */
  if (P.squish > 0.01) {
    const a = Math.atan2(P.sqy, P.sqx);
    x.save(); x.translate(cx, cyPx); x.rotate(a);
    x.scale(1 - 0.30 * P.squish, 1 + 0.20 * P.squish);
    x.rotate(-a); x.translate(-cx, -cyPx);
  }
  /* ── 고개 기울임(roll) ─────────────────────────────────────────────
     yaw·pitch 만으로는 **좌우·상하 왕복**이라 기계처럼 보인다. 살아 있는 머리는 기운다.
     회전은 얼굴 중심을 축으로 걸고, 배치는 그대로 두어 원근 계산과 섞이지 않게 한다. */
  if (P.roll) { x.save(); x.translate(cx, cyPx); x.rotate(P.roll); x.translate(-cx, -cyPx); }
  const c0 = project(0, 0, yaw, pitch);
  const put = (u, v) => { const q = project(u, v, yaw, pitch);
    return { px: cx + (q.x - c0.x) * RAD, py: cyPx + (q.y - c0.y) * RAD, z: q.z }; };

  /* 홍조도 같은 구 위에 있다. 눈보다 조금 바깥·조금 아래. */
  drawBlush(x, P.blush, cx, cyPx, S * P.gap, S * P.eyeSz,
    [-1, 1].map((sd) => { const q = put(sd * eu * 1.32, 0.42 * eu);
      return { px: q.px, py: q.py, s: Math.max(0.30, Math.abs(q.z)) }; }));

  /* 눈 둘을 따로 투영한다 — **각자 다른 z 를 갖는 게 원근의 전부다** */
  [[-eu, -1], [eu, 1]].forEach(([u, side]) => {
    const e = put(u, 0);
    if (e.z < -0.15) return;                       // 완전히 뒤로 넘어간 눈은 안 그린다
    const near = 0.55 + 0.45 * Math.max(0, e.z);   // 가까울수록 크다
    x.save();
    x.translate(e.px, e.py);
    /* 가로로 눌린다 — 구 표면이 기울어질수록 정면 투영이 좁아진다 */
    /* 세로는 **깜빡임**이 먹는다 — 감으면 점이 납작한 선이 된다.
       눈 종류를 갈아끼우지 않고 눌러서 감기므로 어떤 모양에도 그대로 붙는다. */
    /* ⚠ 바닥이 0.28 이면 옆으로 돌았을 때 표정 획이 **세로 지그재그**로 뭉친다. 0.48 로 올린다. */
    x.scale(Math.max(0.48, Math.abs(e.z)), Math.max(0.06, 1 - P.blink));
    x.translate(-e.px, -e.py);
    drawEyes(x, P.eye, e.px, e.py, 0, S * P.eyeSz * near * P.eyeScale, P.ink,
      { x: yaw * 1.6, y: pitch * 1.6 }, side);
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
  if (P.roll) x.restore();
  if (P.squish > 0.01) x.restore();
}
