/* three.js 수호신 시험판 (2026-10-01, 창업자: "three.js로 하고 싶어 … 곁 탭을 3D 가상공간으로,
   친구를 초대할 때마다 오브젝트가 추가되는 느낌").
 *
 * 무엇을 판별하려는 판인가 — 둘이다.
 *   ① 판결: 몸과 얼굴이 **한 입체**인가. 지금 앱은 평면 셰이더(몸) 위에 2D 얼굴을 겹치고
 *      계산으로 맞춰 붙인다 — 「얼굴만 돌고 몸은 안 돈다」가 거기서 나왔다. 여기서는 얼굴이
 *      **몸 구의 자식 메시**라 돌리면 같이 돈다. 맞춤 계산이 필요 없다.
 *   ② 곁: 초대 응답마다 구슬이 공간에 하나씩 쌓이는 그림이 되는가.
 *
 * ⚠ 헌장(새 캐릭터·새 부위 금지): 얼굴은 face.js 의 눈·입을 **그대로** 쓴다. 친구는 사람 모양이
 *    아니라 빛 구슬이다. 이름표도 없다 — 곁의 이름은 기기 밖으로 안 나가고 이 판엔 필요도 없다.
 * ⚠ 치는 글은 **어디에도 안 보낸다.** 표정 판단은 아래 낱말 표로 기기 안에서 끝난다.
 *    보내기 전 글이 서버로 가면 「유저가 무엇이 나가는지 보고 있는가」에 정면으로 걸린다.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { drawEyes, drawMouth, drawBlush } from "../lib/face.js";

const EL = { 수: ["#2a6bd4", "#7fd4ff"], 화: ["#e04d2a", "#ffb36b"], 목: ["#2ab06b", "#a8f0c0"],
             금: ["#8fb0e6", "#e8f2ff"], 토: ["#c98f3d", "#ffe9ad"] };
const EL_KEYS = Object.keys(EL);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── 장면 ─────────────────────────────────────────────────────────── */
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0xf3efe8, 1);
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0, 6.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 4.5; controls.maxDistance = 14; controls.enabled = false;
controls.minPolarAngle = 0.35; controls.maxPolarAngle = Math.PI - 0.55;

/* ── 불꽃 몸 재질 — 구 위의 3D 잡음. 빛은 **세계에 고정**이라 몸이 돌면 명암이 따라 옮겨 간다.
      이게 「입체감이 없다」(창업자 2026-08-30)의 뿌리 해법이다 — 지금 앱은 명암을 흉내 낸다. */
const NOISE = /* glsl */`
vec3 h3(vec3 p){ p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));
  return -1.0+2.0*fract(sin(p)*43758.5453); }
float n3(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*(3.0-2.0*f);
  return mix(mix(mix(dot(h3(i),f),dot(h3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),
                 mix(dot(h3(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(h3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
             mix(mix(dot(h3(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(h3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),
                 mix(dot(h3(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(h3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z); }
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*n3(p); p*=2.03; a*=0.5; } return s; }`;

function bodyMaterial(el, flame) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { t: { value: 0 }, cA: { value: new THREE.Color(EL[el][0]) },
                cB: { value: new THREE.Color(EL[el][1]) }, flame: { value: flame }, squash: { value: 0 } },
    vertexShader: /* glsl */`
      uniform float t, flame, squash; varying vec3 vN, vV, vO, vW;
      ${NOISE}
      void main(){
        vec3 p = position;
        /* 불꽃 혀 — 위쪽만 잡음으로 늘린다. 아래는 둥근 채 둔다(몸이 땅에 앉은 무게) */
        float up = max(0.0, p.y);
        float lick = fbm(p*1.7 + vec3(0.0, -t*0.9, t*0.2));
        p += normal * lick * 0.10 * flame;
        p.y += up*up * (0.22 + 0.30*max(0.0, lick)) * flame;
        p.xz *= 1.0 + squash*0.18; p.y *= 1.0 - squash*0.16;
        vO = position;
        vec4 w = modelMatrix * vec4(p,1.0); vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float t; uniform vec3 cA, cB; varying vec3 vN, vV, vO, vW;
      ${NOISE}
      void main(){
        float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);   // 1=정면 0=가장자리
        float n = fbm(vO*2.2 + vec3(0.0, -t*0.7, 0.0));
        vec3 col = mix(cA, cB, clamp(pow(f,1.6)*0.85 + n*0.35, 0.0, 1.0));
        vec3 L = normalize(vec3(-0.45, 0.65, 0.6));                     // 세계 고정 빛
        float lam = dot(normalize(vN), L)*0.5 + 0.5;
        col *= mix(0.72, 1.10, smoothstep(0.1, 0.95, lam));
        float a = smoothstep(0.02, 0.55, f) * (0.88 + 0.12*n);
        gl_FragColor = vec4(col, a);
      }`,
  });
}

/* 은은한 빛무리 — 밝은 바탕에서 몸 둘레를 감싼다 */
function glowTex() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d"); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const GLOW = glowTex();
function glow(color, scale, op) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true,
    opacity: op, depthWrite: false }));
  s.scale.setScalar(scale); return s;
}

/* ── 수호신 ───────────────────────────────────────────────────────── */
const ME = "화";
const guardian = new THREE.Group(); scene.add(guardian);
const head = new THREE.Group(); guardian.add(head);         // 고개 — 얼굴과 몸이 **같이** 돈다
const bodyMat = bodyMaterial(ME, 1);
const body = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), bodyMat);
head.add(body);
const halo = glow(new THREE.Color(EL[ME][1]), 4.2, 0.55); halo.renderOrder = -1; guardian.add(halo);

/* 얼굴 — 몸 구 앞면 조각에 캔버스를 입힌다. 몸의 **자식**이라 돌리면 같이 돈다 */
const FACE_W = 1.5, FACE_H = 1.3;                           // 조각이 덮는 각도(라디안)
const faceCv = document.createElement("canvas"); faceCv.width = faceCv.height = 512;
const faceTex = new THREE.CanvasTexture(faceCv); faceTex.anisotropy = 4;
faceTex.colorSpace = THREE.SRGBColorSpace;   // 없으면 먹색 눈이 갈색으로 뜬다(첫 시험 화면)
const facePatch = new THREE.Mesh(
  new THREE.SphereGeometry(1.012, 48, 40, Math.PI / 2 - FACE_W / 2, FACE_W, Math.PI / 2 - FACE_H / 2, FACE_H),
  new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false }));
facePatch.rotation.y = -Math.PI / 2 + Math.PI / 2;          // +z 가 정면(정렬은 phiStart 가 맡는다)
head.add(facePatch);
/* 그림자 — 땅에 앉아 있다는 단서. 공간감의 절반이 이것이다 */
const shadow = glow(new THREE.Color(0x3a2a1a), 2.0, 0.16);
shadow.scale.set(2.2, 0.5, 1); shadow.position.y = -1.55; scene.add(shadow);

/* ── 표정 — 낱말 표(기기 안에서만 판단) ───────────────────────────────
   우선순위: 무거움 > 엉뚱 > 설렘 > 진지 > 먹는 고민.
   ⚠ **무거운 말에는 놀라지 않는다.** 「죽고 싶다」에 경악하면 비웃음으로 읽힌다 —
      표정을 키우지 않고 조용히 눈을 내린다. 이 목록은 팀이 실제 질문으로 다듬을 초안이다. */
const MOODS = [
  { k: "heavy",    eye: "droop",  mouth: "flat",  blush: false, w: ["죽고","자살","이혼","아프","병원","우울","힘들","장례","사고","무서","불안"] },
  { k: "shock",    eye: "wide",   mouth: "o",     blush: false, w: ["외계인","복권","로또","ufo","귀신","좀비","세계정복","대통령","재벌","100억","순간이동","투명인간","타임머신","전생"] },
  { k: "love",     eye: "shine",  mouth: "smile", blush: true,  w: ["고백","썸","좋아해","연애","결혼","데이트","전남친","전여친","사귀","카톡"] },
  { k: "serious",  eye: "dot",    mouth: "flat",  blush: false, w: ["퇴사","이직","사업","투자","계약","대출","시험","면접","주식","코인","이사"] },
  { k: "food",     eye: "smile",  mouth: "smile", blush: false, w: ["뭐 먹","뭐먹","저녁","점심","아침","치킨","라면","야식","배고"] },
];
const NAMES = { heavy: "조용히 진지", shock: "경악", love: "설렘", serious: "진지", food: "신남", idle: "평온", read: "읽는 중" };
function moodOf(s) {
  const q = s.toLowerCase();
  for (const m of MOODS) if (m.w.some((w) => q.includes(w))) return m;
  return null;
}

/* ── 상태 ─────────────────────────────────────────────────────────── */
const st = { yaw: 0, pitch: 0, vy: 0, vp: 0, tYaw: 0, tPitch: 0, lastKey: -1e9, mood: null,
             moodAt: -1e9, pop: 0, popV: 0, blink: 0, nextBlink: 1.5, drag: null, dragYaw: 0, dragPitch: 0,
             tab: "pan", camZ: 6.2, scale: 1 };

function drawFaceTex(now) {
  const x = faceCv.getContext("2d"); const S = 512;
  x.clearRect(0, 0, S, S);
  const m = st.mood;
  const typing = now - st.lastKey < 1.4;
  const eye = m ? m.eye : "dot";
  const mouth = m ? m.mouth : (typing ? "flat" : "smile");
  /* 각도 → 텍스처 픽셀. 눈은 구의 ±0.30 라디안, 입은 아래 0.22 */
  const px = (a) => S / 2 + (a / FACE_W) * S, py = (a) => S / 2 - (a / FACE_H) * S;
  const ink = "#191308";
  const eSz = (m && m.k === "shock" ? 30 : 22);
  const ex = 0.30, ey = 0.06;
  x.save();
  if (st.blink > 0.01) {                                   // 깜빡임 — 눈 높이만 접는다
    x.translate(0, py(ey)); x.scale(1, Math.max(0.08, 1 - st.blink)); x.translate(0, -py(ey));
  }
  drawEyes(x, eye, px(0), py(ey), px(ex) - px(0), eSz, ink, 0);
  x.restore();
  drawMouth(x, mouth, px(0), py(-0.20), m && m.k === "shock" ? 44 : 34, ink);
  drawBlush(x, m ? m.blush : false, px(0), py(-0.10), px(ex) - px(0), 18);
  faceTex.needsUpdate = true;
}

/* ── 입력: 글자 → 시선 + 표정 ─────────────────────────────────────── */
const qEl = document.getElementById("q");
const moodEl = document.getElementById("mood");
function onType() {
  const now = performance.now() / 1000;
  const v = qEl.value; const i = qEl.selectionStart ?? v.length;
  /* 커서가 놓인 줄의 몇 번째 글자인가 → 좌우 시선. 줄이 바뀌면 왼쪽으로 돌아온다 */
  const lineStart = v.lastIndexOf("\n", i - 1) + 1;
  const col = i - lineStart;
  const PER_LINE = 18;                                     // 폰 폭에서 한 줄 글자 수(대략)
  const frac = ((col % PER_LINE) / PER_LINE);
  st.tYaw = -0.42 + frac * 0.84;
  st.tPitch = -0.30 - 0.08 * Math.floor(col / PER_LINE);   // 질문 칸은 수호신 아래 — 내려다본다
  st.lastKey = now;
  if (!reduce) st.popV += 0.6;                              // 글자마다 아주 작게 끄덕
  const m = moodOf(v);
  if ((m && m.k) !== (st.mood && st.mood.k)) {
    st.mood = m; st.moodAt = now;
    if (m && m.k === "shock" && !reduce) st.popV += 6.5;   // 경악 — 한 번 크게 튄다
    if (m && m.k === "love" && !reduce) st.popV += 2.5;
  }
}
qEl.addEventListener("input", onType);
qEl.addEventListener("keyup", onType);
qEl.addEventListener("click", onType);

/* ── 끌어서 돌리기(판결) — 놓으면 제자리로 돌아온다 ───────────────── */
const cvs = renderer.domElement;
cvs.addEventListener("pointerdown", (e) => { if (st.tab !== "pan") return;
  st.drag = { x: e.clientX, y: e.clientY, yaw: st.dragYaw, pitch: st.dragPitch }; cvs.setPointerCapture(e.pointerId); });
cvs.addEventListener("pointermove", (e) => { if (!st.drag) return;
  st.dragYaw = st.drag.yaw + (e.clientX - st.drag.x) * 0.008;
  st.dragPitch = Math.max(-0.7, Math.min(0.7, st.drag.pitch + (e.clientY - st.drag.y) * 0.006)); });
const endDrag = () => { st.drag = null; };
cvs.addEventListener("pointerup", endDrag); cvs.addEventListener("pointercancel", endDrag);

/* ── 곁: 친구 구슬 ─────────────────────────────────────────────────── */
const friends = [];
const orbitMat = new THREE.LineBasicMaterial({ color: 0x191308, transparent: true, opacity: 0.08 });
function addFriend() {
  const el = EL_KEYS[Math.floor(Math.random() * EL_KEYS.length)];
  const n = friends.length;
  /* ⚠ 폰은 세로로 길다 — 가로 반폭이 공간의 한계다. 궤도 반지름을 그 안에 묶는다 */
  const r = 1.25 + (n % 4) * 0.33 + Math.random() * 0.12;   // 사람이 늘수록 바깥 궤도로
  const inc = (Math.random() - 0.5) * 0.9, node = Math.random() * Math.PI * 2;
  const g = new THREE.Group();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), bodyMaterial(el, 0.35));
  orb.scale.setScalar(0.24); g.add(orb);
  const gl = glow(new THREE.Color(EL[el][1]), 1.1, 0.6); g.add(gl);
  scene.add(g);
  /* 궤도선 — 「어디를 도는가」가 보여야 공간이 읽힌다 */
  const pts = []; for (let k = 0; k <= 96; k++) { const a = (k / 96) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), orbitMat);
  const tilt = new THREE.Group(); tilt.rotation.set(inc, node, 0); tilt.add(ring); scene.add(tilt);
  friends.push({ g, orb, mat: orb.material, r, inc, node, tilt, ang: Math.random() * Math.PI * 2,
                 spd: 0.25 + Math.random() * 0.2, born: performance.now() / 1000 });
  st.popV += 3;                                            // 수호신이 반긴다
}
function clearFriends() {
  friends.splice(0).forEach((f) => { scene.remove(f.g); scene.remove(f.tilt); });
}
document.getElementById("add").onclick = addFriend;
document.getElementById("clear").onclick = clearFriends;

/* ── 탭 ───────────────────────────────────────────────────────────── */
function setTab(t) {
  st.tab = t;
  document.getElementById("tPan").classList.toggle("on", t === "pan");
  document.getElementById("tGy").classList.toggle("on", t === "gy");
  document.getElementById("dPan").hidden = t !== "pan";
  document.getElementById("dGy").hidden = t !== "gy";
  controls.enabled = t === "gy";
  if (t === "pan") { camera.position.set(0, 0, camera.position.length()); }
  if (t === "gy" && friends.length === 0) { addFriend(); addFriend(); }
  st.mood = null; st.tabAt = performance.now() / 1000;      // 판결의 표정을 곁으로 끌고 가지 않는다
  st.popV += 4;
}
document.getElementById("tPan").onclick = () => setTab("pan");
document.getElementById("tGy").onclick = () => setTab("gy");

/* ── 크기 ─────────────────────────────────────────────────────────── */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

/* ── 돌리기 ───────────────────────────────────────────────────────── */
const fpsEl = document.getElementById("fps");
let last = performance.now() / 1000, frames = 0, fpsT = last;
function tick() {
  const now = performance.now() / 1000;
  const dt = Math.min(0.05, now - last); last = now;
  const typing = now - st.lastKey < 1.4;

  /* 시선 목표 — 타이핑 중이면 커서, 아니면 천천히 둘러본다 */
  let ty = 0, tp = 0;
  if (st.tab === "pan") {
    if (typing) { ty = st.tYaw; tp = st.tPitch; }
    else { ty = Math.sin(now * 0.31) * 0.12; tp = Math.sin(now * 0.24 + 0.9) * 0.06; }
    ty += st.dragYaw; tp += st.dragPitch;
    if (!st.drag) { st.dragYaw *= Math.exp(-dt * 2.2); st.dragPitch *= Math.exp(-dt * 2.2); }
  } else { ty = Math.sin(now * 0.4) * 0.5; tp = 0.05; }
  /* 스프링 — 1/120 초로 잘게 돌려 저사양에서도 안 튄다(앱에서 10fps 발산을 겪었다) */
  for (let rem = dt; rem > 1e-6;) { const h = Math.min(1 / 120, rem); rem -= h;
    st.vy += ((ty - st.yaw) * 60 - st.vy * 11) * h; st.yaw += st.vy * h;
    st.vp += ((tp - st.pitch) * 60 - st.vp * 11) * h; st.pitch += st.vp * h;
    st.popV += (-st.pop * 180 - st.popV * 9) * h; st.pop += st.popV * h; }
  head.rotation.set(-st.pitch, st.yaw, Math.sin(now * 0.19) * 0.04 - st.vy * 0.03);

  /* 깜빡임 */
  st.nextBlink -= dt;
  if (st.nextBlink < 0) { st.blink = 1; st.nextBlink = 2.2 + Math.random() * 3; }
  st.blink = Math.max(0, st.blink - dt * 7);

  /* 크기·카메라 — 곁에선 수호신이 작아지고 공간이 열린다 */
  const goalS = st.tab === "pan" ? 1 : 0.5;
  st.scale += (goalS - st.scale) * (1 - Math.exp(-dt * 5));
  const s = st.scale * (1 + st.pop * 0.05);
  guardian.scale.set(s, s, s);
  halo.material.opacity = 0.45 + 0.1 * Math.sin(now * 1.3);
  if (st.tab === "pan") {
    const d = camera.position.length(); const nd = d + (6.2 - d) * (1 - Math.exp(-dt * 4));
    camera.position.setLength(nd); camera.lookAt(0, 0, 0);
  } else {
    /* 들어온 뒤 1.4초만 카메라를 물리고 위로 올린다 — 그다음은 손가락이 쥔다.
       (⚠ controls.state 로 판별하면 안 된다: 쉬는 상태가 -1 이라 참으로 읽힌다) */
    if (now - (st.tabAt || 0) < 1.4) {
      const k = 1 - Math.exp(-dt * 4);
      const goal = new THREE.Vector3(0, 4.2, 11.3);
      camera.position.lerp(goal, k);
    }
    controls.update();
  }
  shadow.scale.set(2.2 * st.scale, 0.5 * st.scale, 1); shadow.position.y = -1.55 * st.scale;

  bodyMat.uniforms.t.value = now;
  bodyMat.uniforms.squash.value = Math.max(-0.3, Math.min(0.6, st.pop * 0.25));

  /* 친구 — 날아와서(1.2초) 제 궤도에 앉는다 */
  const v = new THREE.Vector3();
  friends.forEach((f) => {
    f.ang += f.spd * dt; f.mat.uniforms.t.value = now;
    v.set(Math.cos(f.ang) * f.r, 0, Math.sin(f.ang) * f.r).applyEuler(f.tilt.rotation);
    const age = (now - f.born) / 1.2;
    if (age < 1) { const e = 1 - Math.pow(1 - age, 3);
      const from = new THREE.Vector3(v.x * 3, 6, v.z * 3);
      f.g.position.lerpVectors(from, v, e); f.g.scale.setScalar(0.3 + 0.7 * e + Math.sin(age * Math.PI) * 0.4);
      f.tilt.children[0].material.opacity = 0.08;
    } else { f.g.position.copy(v); f.g.scale.setScalar(1); }
    f.g.visible = st.tab === "gy"; f.tilt.visible = st.tab === "gy";
  });

  moodEl.textContent = "표정: " + (st.mood ? NAMES[st.mood.k] : (typing ? NAMES.read : NAMES.idle));
  drawFaceTex(now);
  renderer.render(scene, camera);
  frames++; if (now - fpsT > 1) { fpsEl.textContent = frames + " fps"; frames = 0; fpsT = now; }
  requestAnimationFrame(tick);
}
/* e2e 용 — 지금 상태를 들여다본다 */
window.__PROTO = { st, friends, addFriend, setTab };
requestAnimationFrame(tick);
