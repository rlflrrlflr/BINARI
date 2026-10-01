/* three.js 수호신 시험판 v2 (2026-10-01)
 *
 * v1 은 몸을 새로 그렸다가 창업자에게 바로 걸렸다 — *"기존 느낌이 너무 없어졌는데?
 * 3D를 하더라도 기존 느낌은 살려야지."* 맞다. 몸을 새 셰이더로 바꾸는 건 3D 가 아니라
 * **수호신 비주얼 교체**다(헌장 금지 항목이기도 하다).
 *
 * 그래서 v2 는 **몸을 다시 그리지 않는다.** 앱의 색장 셰이더(FIELD_FRAG)를 App.jsx 에서
 * 글자 그대로 뽑아 같은 유니폼으로 돌리고, 그 결과를 3D 공간 안의 판(카메라를 늘 바라봄)에 얹는다.
 * three 가 맡는 건 셋뿐이다:
 *   ① 얼굴 — 몸 코어 크기의 **진짜 구** 앞면에 붙는다. 고개(yaw·pitch·roll)가 몸의 u_look 과 **같은 값**
 *   ② 곁 — 카메라가 물러나 위에서 내려다보고, 손가락으로 공간을 돌린다
 *   ③ 친구 — 앱의 반딧불(오행색 후광 + 흰 심)을 그대로 그려 **3D 궤도**에 띄운다. 몸 뒤로 지나가면 가려진다
 *
 * ⚠ 셰이더를 여기 베끼지 않는다 — 보드가 두 벌로 갈려 거짓말한 사고(v143)를 되풀이하지 않는다.
 * ⚠ 치는 글은 어디에도 안 보낸다. 표정은 기기 안 낱말 표로만 판단한다.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import APP from "../App.jsx?raw";
import AURA from "../lib/aura-spec.json";
import { drawEyes, drawMouth, drawBlush } from "../lib/face.js";

/* ── 앱에서 그대로 뽑는다 ──────────────────────────────────────────── */
function sliceConst(src, name) {
  const head = "const " + name + " = `"; const i = src.indexOf(head);
  if (i < 0) throw new Error(name + " 없음");
  const s = i + head.length; let body = src.slice(s, src.indexOf("`;", s));
  if (body.includes("${")) {
    const ti = src.indexOf("const TUNE = {");
    const TUNE = new Function(src.slice(ti, src.indexOf("};", ti) + 2) + "\nreturn TUNE;")();
    body = body.replace(/\$\{TUNE\.(\w+)\}/g, (m, k) => (TUNE[k] === undefined ? m : String(TUNE[k])));
  }
  return body;
}
const FIELD_FRAG = sliceConst(APP, "FIELD_FRAG");
const FIELD_VERT = sliceConst(APP, "FIELD_VERT");
const holoPal = new Function(
  APP.match(/const EL_COLOR = \{[\s\S]*?\};/)[0] + "\n" +
  APP.slice(APP.indexOf("const HOLO_FIX"), APP.indexOf("const HOLO_BG")) + "\nreturn holoPal;")();
const HOLO_BG = [0.851, 0.835, 0.792];
const EL_COLOR = new Function("return " + APP.match(/const EL_COLOR = (\{[\s\S]*?\});/)[1])();
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

const ME = "화";
const AGX = ({ 화: 1.26, 수: 0.94, 목: 1.18, 금: 1.08, 토: 0.98 })[ME];
const NAR = 1.08 / AGX;                                    // 앱과 같은 얼굴 폭 보정
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── 색장 — 앱과 같은 셰이더·같은 유니폼, 따로 띄운 캔버스에서 돈다 ─────── */
const FS = 640;
const fcv = document.createElement("canvas"); fcv.width = fcv.height = FS;
/* ⚠ 앱은 이 셰이더를 스트레이트 알파로 블렌딩해 premultiplied 캔버스에 찍고, 브라우저가 그걸 바탕 위에 얹는다.
   결과는 「색×a + 바탕×(1−a²)」다. 텍스처로 옮기면서 색 공간·곱셈이 한 번씩 더 끼면 미색 헤일로가
   **회녹색으로 탁해진다**(v2 첫 화면이 그랬다). 그래서 여기서는 블렌딩 없이 셰이더 출력 (색, a) 을
   날것으로 받고, 아래 판 재질이 앱과 같은 식으로 다시 얹는다. */
const gl = fcv.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false });
const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
const pg = gl.createProgram();
gl.attachShader(pg, mk(gl.VERTEX_SHADER, FIELD_VERT)); gl.attachShader(pg, mk(gl.FRAGMENT_SHADER, FIELD_FRAG));
gl.linkProgram(pg); gl.useProgram(pg);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const la = gl.getAttribLocation(pg, "a"); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
const U = (n) => gl.getUniformLocation(pg, n);
{
  const pal = holoPal(ME).map(hex2rgb);
  gl.uniform2f(U("u_res"), FS, FS); gl.uniform2f(U("u_off"), 0, 0);
  gl.uniform3fv(U("u_c1"), pal[0]); gl.uniform3fv(U("u_c2"), pal[1]); gl.uniform3fv(U("u_c3"), pal[2]);
  gl.uniform3fv(U("u_bg"), HOLO_BG); gl.uniform1f(U("u_form"), 0);
  const AB = AURA.base, AR = AURA.forms.ray, AP = AURA.forms.puff, AF = AURA.forms.flicker;
  gl.uniform1f(U("u_grain"), AB.grain); gl.uniform1f(U("u_warm"), 0); gl.uniform1f(U("u_speed"), 1.35);
  gl.uniform1f(U("u_lum"), 1); gl.uniform1f(U("u_sink"), 0);
  gl.uniform3f(U("u_wt"), 0.3, 0.6, 0.1);
  gl.uniform3f(U("u_bite"), AR.edgeBite, AP.edgeBite, AF.edgeBite);
  gl.uniform4f(U("u_rayP"), AR.spokes, AR.sharp, AR.reach, AR.amp);
  gl.uniform4f(U("u_puffP"), AP.lobes, AP.freq, AP.amp, AP.drift);
  gl.uniform4f(U("u_flkP"), AF.rate, AF.depth, AF.dropout, AF.amp);
  gl.uniform4f(U("u_baseP"), AB.edgeSoft["펼침"], AB.edgeSoft["응축"], AB.rimWidth, AB.rimLift);
  gl.uniform1f(U("u_born"), 1); gl.uniform1f(U("u_touchAmt"), 0); gl.uniform2f(U("u_touch"), 0, 0);
  gl.uniform2f(U("u_wisp"), 0, 0); gl.uniform1f(U("u_ex"), 0); gl.uniform1f(U("u_squash"), 0);
  gl.uniform1f(U("u_tailK"), 0); gl.uniform2fv(U("u_trail"), new Float32Array(12));
  gl.uniform3f(U("u_press"), 0, 0, 0);
  gl.viewport(0, 0, FS, FS); gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);
}

/* ── 장면 ─────────────────────────────────────────────────────────── */
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(new THREE.Color().setRGB(...HOLO_BG, THREE.SRGBColorSpace), 1);
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0, 6.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 5; controls.maxDistance = 14; controls.enabled = false;
controls.minPolarAngle = 0.45; controls.maxPolarAngle = Math.PI / 2 + 0.25;

/* 몸 — 카메라를 늘 바라보는 판. 판 위의 그림은 앱과 한 글자도 안 다르다 */
const B = 3.4;                                             // 판 한 변(월드 단위)
const rig = new THREE.Group(); scene.add(rig);             // 카메라를 바라보는 축
const fieldTex = new THREE.CanvasTexture(fcv);
fieldTex.premultiplyAlpha = false; fieldTex.generateMipmaps = false; fieldTex.minFilter = THREE.LinearFilter;
const fieldMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: fieldTex } }, transparent: true, depthWrite: false, premultipliedAlpha: true,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  /* 앱 화면과 같은 식: 색×a + 바탕×(1−a²) — 색 공간 변환 없이 날값 그대로 */
  fragmentShader: "uniform sampler2D map; varying vec2 vUv; void main(){ vec4 c=texture2D(map,vUv); gl_FragColor=vec4(c.rgb*c.a, c.a*c.a); }",
});
const plane = new THREE.Mesh(new THREE.PlaneGeometry(B, B), fieldMat);
rig.add(plane);

/* 얼굴 — 코어 크기의 구 앞면 조각. 판 바로 앞, 같은 축 안에 있다 */
const FACE_W = 2.0, FACE_H = 1.8;
const faceCv = document.createElement("canvas"); faceCv.width = faceCv.height = 512;
const faceTex = new THREE.CanvasTexture(faceCv); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 4;
const head = new THREE.Group(); rig.add(head);
const facePatch = new THREE.Mesh(
  new THREE.SphereGeometry(1, 48, 40, Math.PI / 2 - FACE_W / 2, FACE_W, Math.PI / 2 - FACE_H / 2, FACE_H),
  new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false, depthTest: false }));
facePatch.renderOrder = 5;
head.add(facePatch);

/* ── 표정 — 낱말 표(기기 안에서만) ─────────────────────────────────────
   우선순위: 무거움 > 엉뚱 > 설렘 > 진지 > 먹는 고민. ⚠ 무거운 말엔 놀라지 않는다. */
const MOODS = [
  { k: "heavy",   eye: "droop", mouth: "flat",  blush: false, w: ["죽고","자살","이혼","아프","병원","우울","힘들","장례","사고","무서","불안"] },
  { k: "shock",   eye: "wide",  mouth: "o",     blush: false, w: ["외계인","복권","로또","ufo","귀신","좀비","세계정복","대통령","재벌","100억","순간이동","투명인간","타임머신","전생"] },
  { k: "love",    eye: "shine", mouth: "smile", blush: true,  w: ["고백","썸","좋아해","연애","결혼","데이트","전남친","전여친","사귀","카톡"] },
  { k: "serious", eye: "dot",   mouth: "flat",  blush: false, w: ["퇴사","이직","사업","투자","계약","대출","시험","면접","주식","코인","이사"] },
  { k: "food",    eye: "smile", mouth: "smile", blush: false, w: ["뭐 먹","뭐먹","저녁","점심","아침","치킨","라면","야식","배고"] },
];
const NAMES = { heavy: "조용히 진지", shock: "경악", love: "설렘", serious: "진지", food: "신남", idle: "평온", read: "읽는 중" };
const moodOf = (s) => { const q = s.toLowerCase(); return MOODS.find((m) => m.w.some((w) => q.includes(w))) || null; };

const st = { yaw: 0, pitch: 0, roll: 0, vy: 0, vp: 0, tYaw: 0, tPitch: 0, lastKey: -1e9, mood: null,
  pop: 0, popV: 0, blink: 0, nextBlink: 1.5, tab: "pan", tabAt: -1e9, orb: 0, fold: 0,
  look: { x: 0, y: 0, px: 0.5, py: 0.5, had: false } };

/* 얼굴 텍스처 — 앱과 같은 비율(구 기준 눈 자리 0.56·눈 0.155·입 0.36·0.30, 오행 폭 보정 NAR) */
function drawFaceTex(now) {
  const x = faceCv.getContext("2d"); const S = 512; x.clearRect(0, 0, S, S);
  const m = st.mood, typing = now - st.lastKey < 1.4;
  const px = (a) => S / 2 + (a / FACE_W) * S, py = (a) => S / 2 - (a / FACE_H) * S;
  const ea = Math.asin(0.56 * NAR), ma = Math.asin(0.36 * NAR);
  const eSz = (0.155 * NAR / FACE_W) * S * (m && m.k === "shock" ? 1.35 : 1);
  const mSz = (0.30 * NAR / FACE_W) * S * (m && m.k === "shock" ? 1.3 : 1);
  const ink = "#191308";
  x.save();
  if (st.blink > 0.01) { x.translate(0, py(0)); x.scale(1, Math.max(0.08, 1 - st.blink)); x.translate(0, -py(0)); }
  drawEyes(x, m ? m.eye : "dot", px(0), py(0), px(ea) - px(0), eSz, ink, 0);
  x.restore();
  drawMouth(x, m ? m.mouth : (typing ? "flat" : "smile"), px(0), py(-ma), mSz, ink);
  drawBlush(x, !!(m && m.blush), px(0), py(-ma * 0.55), px(ea) - px(0), eSz * 0.8);
  faceTex.needsUpdate = true;
}

/* ── 입력 ─────────────────────────────────────────────────────────── */
const qEl = document.getElementById("q"), moodEl = document.getElementById("mood");
function onType() {
  const now = performance.now() / 1000, v = qEl.value, i = qEl.selectionStart ?? v.length;
  const col = i - (v.lastIndexOf("\n", i - 1) + 1), PER = 18;
  st.tYaw = -0.30 + ((col % PER) / PER) * 0.60;            // 앱의 고개 한계(±0.30)를 넘지 않는다
  st.tPitch = -0.19;                                       // 질문 칸은 아래 — 내려다본다(앱 한계 0.19)
  st.lastKey = now;
  if (!reduce) st.popV += 0.5;
  const m = moodOf(v);
  if ((m && m.k) !== (st.mood && st.mood.k)) {
    st.mood = m;
    if (m && m.k === "shock" && !reduce) st.popV += 6;
    if (m && m.k === "love" && !reduce) st.popV += 2;
  }
}
["input", "keyup", "click"].forEach((e) => qEl.addEventListener(e, onType));

/* ── 곁: 친구 = 앱의 반딧불을 3D 궤도에 ─────────────────────────────── */
function fireflyTex(col) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${col},.85)`); g.addColorStop(0.4, `rgba(${col},.40)`); g.addColorStop(1, `rgba(${col},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const w = x.createRadialGradient(64, 64, 0, 64, 64, 20);
  w.addColorStop(0, "rgba(255,253,246,.95)"); w.addColorStop(0.55, "rgba(255,252,240,.43)"); w.addColorStop(1, "rgba(255,252,240,0)");
  x.fillStyle = w; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const satCol = (hex) => { const c = hex2rgb(hex); const mx = Math.max(...c) || 1;
  return c.map((v) => Math.round(255 * Math.max(0, Math.min(1, 0.18 + 0.82 * (v / mx) * 0.92)))).join(","); };
const EL_KEYS = ["수", "화", "목", "금", "토"];
const friends = [];
function addFriend() {
  const el = EL_KEYS[Math.floor(Math.random() * 5)], n = friends.length;
  const tex = fireflyTex(satCol(EL_COLOR[el][0]));
  const tail = [0, 1, 2].map((k) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false,
      opacity: k === 0 ? 1 : 0.30 - k * 0.08 }));
    scene.add(s); return s;
  });
  friends.push({ tail, r: 1.2 + (n % 4) * 0.24 + Math.random() * 0.08, inc: (Math.random() - 0.5) * 0.7,
    node: Math.random() * 6.28, ang: Math.random() * 6.28, spd: 0.22 + Math.random() * 0.12,
    size: n < 1 ? 0.42 : 0.34, born: performance.now() / 1000 });
  st.popV += 3;
}
document.getElementById("add").onclick = addFriend;
document.getElementById("clear").onclick = () => friends.splice(0).forEach((f) => f.tail.forEach((s) => scene.remove(s)));

function setTab(t) {
  st.tab = t; st.tabAt = performance.now() / 1000; st.mood = null;
  document.getElementById("tPan").classList.toggle("on", t === "pan");
  document.getElementById("tGy").classList.toggle("on", t === "gy");
  document.getElementById("dPan").hidden = t !== "pan";
  document.getElementById("dGy").hidden = t !== "gy";
  controls.enabled = t === "gy";
  if (t === "gy" && !friends.length) { addFriend(); addFriend(); addFriend(); }
}
document.getElementById("tPan").onclick = () => setTab("pan");
document.getElementById("tGy").onclick = () => setTab("gy");

function resize() { const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

/* ── 돌리기 ───────────────────────────────────────────────────────── */
const fpsEl = document.getElementById("fps");
const T0 = performance.now(); let last = T0 / 1000, frames = 0, fpsT = last;
const tmp = new THREE.Vector3();
function tick() {
  const now = performance.now() / 1000, dtRaw = now - last, dt = Math.min(0.05, dtRaw); last = now;
  const tS = (now - T0 / 1000) * 1.35;
  const typing = now - st.lastKey < 1.4;

  /* 탭 크기 — 앱처럼 곁에서 응축(u_orb·u_fold) */
  const goal = st.tab === "gy" ? 1 : 0;
  st.orb += (goal - st.orb) * (1 - Math.exp(-dt * (goal > st.orb ? 9 : 4)));
  st.fold += (st.orb - st.fold) * (1 - Math.exp(-dt / 0.075));

  /* 코어 자리 — 앱과 같은 식(드리프트 + 들어올림) */
  const zc = 0.5 + 0.5 * Math.sin(tS * 0.38);
  const Rj = (0.320 + (0.208 - 0.320) * st.orb) * (0.90 + 0.22 * zc) * (1 + 0.020 * Math.sin(tS * 0.85));
  const lift = 0.068 * (Rj / 0.323) * (1 - 0.55 * st.fold);
  const dfx = Math.sin(tS * 0.55) * 0.075 + Math.sin(tS * 0.93 + 1.3) * 0.030;
  const dfy = Math.cos(tS * 0.47) * 0.088 + Math.sin(tS * 0.81 + 0.6) * 0.034;
  const baseX = 0.5 + dfx, baseY = 0.5 - dfy;
  const L = st.look;
  if (L.had && dtRaw > 1e-4) { const k = 1 - Math.exp(-dtRaw / 0.22), cl = (v) => Math.max(-0.16, Math.min(0.16, v));
    L.x += (cl((baseX - L.px) / dtRaw) - L.x) * k; L.y += (cl((baseY - L.py) / dtRaw) - L.y) * k; }
  L.px = baseX; L.py = baseY; L.had = true;

  /* 고개 — 평소엔 앱과 같은 「몸이 가는 쪽」, 타이핑 중엔 커서 쪽 */
  const lim = (v, m) => Math.max(-m, Math.min(m, v));
  let ty = lim(L.x * 5.2, 0.30) + Math.sin(tS * 0.31) * 0.075;
  let tp = lim(L.y * 4.0, 0.19) + Math.sin(tS * 0.24 + 0.9) * 0.045;
  if (typing && st.tab === "pan") { ty = st.tYaw; tp = st.tPitch; }
  for (let rem = dt; rem > 1e-6;) { const h = Math.min(1 / 120, rem); rem -= h;
    st.vy += ((ty - st.yaw) * 60 - st.vy * 11) * h; st.yaw += st.vy * h;
    st.vp += ((tp - st.pitch) * 60 - st.vp * 11) * h; st.pitch += st.vp * h;
    st.popV += (-st.pop * 180 - st.popV * 9) * h; st.pop += st.popV * h; }
  st.roll = lim(-L.x * 1.6, 0.17) + Math.sin(tS * 0.19 + 2.2) * 0.022;

  /* 색장 한 장 — 몸도 같은 고개값으로 돈다(u_look) */
  gl.uniform1f(U("u_t"), tS / 1.35);
  gl.uniform1f(U("u_orb"), st.orb - Math.max(0, st.pop) * 0.06);
  gl.uniform1f(U("u_fold"), Math.min(1, Math.max(0, st.fold)));
  gl.uniform3f(U("u_look"), st.yaw, st.pitch, st.roll);
  gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
  fieldTex.needsUpdate = true;

  /* 판은 카메라를 바라본다. 얼굴은 코어 자리에, 코어 크기의 구로 */
  rig.quaternion.copy(camera.quaternion);
  const fwd = (0.320 + (0.208 - 0.320) * st.fold) * 0.34 * (1 - st.fold * 0.82) / 2.35;
  const cx = baseX + st.yaw * fwd, cy = 0.5 - dfy - lift + st.pitch * fwd;
  head.position.set((cx - 0.5) * B, (0.5 - cy) * B, 0.02);
  const RAD = B * (Rj / 2.35) * (1 + 0.35 * st.fold) * (1 + st.pop * 0.04);
  head.scale.setScalar(RAD);
  head.rotation.set(-st.pitch, st.yaw, -st.roll, "YXZ");

  st.nextBlink -= dt; if (st.nextBlink < 0) { st.blink = 1; st.nextBlink = 2.2 + Math.random() * 3; }
  st.blink = Math.max(0, st.blink - dt * 7);
  drawFaceTex(now);

  /* 카메라 — 판결은 정면 그대로(앱과 같은 화면), 곁은 물러나 비스듬히 내려다본다 */
  if (st.tab === "pan") { camera.position.lerp(tmp.set(0, 0, 6.2), 1 - Math.exp(-dt * 4)); camera.lookAt(0, 0, 0); }
  else { if (now - st.tabAt < 1.4) camera.position.lerp(tmp.set(0, 2.6, 8.6), 1 - Math.exp(-dt * 4)); controls.update(); }

  /* 친구 — 날아와 궤도에 앉는다. 꼬리 셋(앱과 같은 수) */
  const show = st.orb > 0.5;
  friends.forEach((f) => {
    f.ang += f.spd * dt;
    const age = Math.min(1, (now - f.born) / 1.2), e = 1 - Math.pow(1 - age, 3);
    f.tail.forEach((s, k) => {
      const a = f.ang - k * 0.075;
      tmp.set(Math.cos(a) * f.r, 0, Math.sin(a) * f.r).applyEuler(new THREE.Euler(f.inc, f.node, 0));
      if (age < 1) tmp.lerp(new THREE.Vector3(tmp.x * 2.5, 5, tmp.z * 2.5), 1 - e);
      s.position.copy(tmp);
      s.scale.setScalar(f.size * (1 - k * 0.22));
      s.visible = show;
      s.renderOrder = tmp.clone().applyMatrix4(camera.matrixWorldInverse).z > -camera.position.length() ? 6 : 0;
    });
  });

  moodEl.textContent = "표정: " + (st.mood ? NAMES[st.mood.k] : (typing ? NAMES.read : NAMES.idle));
  renderer.render(scene, camera);
  frames++; if (now - fpsT > 1) { fpsEl.textContent = frames + " fps"; frames = 0; fpsT = now; }
  requestAnimationFrame(tick);
}
window.__PROTO = { st, friends, addFriend, setTab };
requestAnimationFrame(tick);
