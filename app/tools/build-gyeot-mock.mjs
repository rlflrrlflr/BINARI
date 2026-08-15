/* ─────────────────────────────────────────────────────────────────────
 * "곁" 시안 생성기 — 친구의 기운이 수호신에 들어오는 표현을 판단하기 위한 시안
 *
 * 무엇을 판단하려고 만들었나
 *   ① 어노잉하지 않은가 (계속 보고 있어도 거슬리지 않는가)
 *   ② v27·v68에서 제거된 "옆에 둥둥 뜨는 하얀 점"과 확실히 다른가
 *
 * 규칙(설계 헌장·관계표현인계서 §3)
 *   - 본체(오행 형상)는 한 줄도 안 건드린다. GL_VERT/GL_FRAG 를 App.jsx 에서
 *     그대로 뽑아 쓴다 — 베끼지 않는다(보드와 같은 방식).
 *   - 곁은 본체와 합성되지 않는다. 궤도를 도는 빛이고, 관계는 흐름의 방향으로만 그린다.
 *   - 숫자·게이지·빈 슬롯·진행바 없음. 혼자여도(곁 0) 화면이 완결된다.
 *
 * 실행: node app/tools/build-gyeot-mock.mjs  → app/public/gyeot-mock.html
 * ───────────────────────────────────────────────────────────────────── */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sliceConst } from "./lib/extract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP = readFileSync(resolve(ROOT, "app/src/App.jsx"), "utf8");

/* 본체 렌더 코드 — 원본에서 뽑아 쓰되, '응축(행성)' 구간만 끼워 넣는다.
   ⚠ 베껴서 새로 쓰지 않는다. 앵커 세 곳이 원본에 그대로 있어야 하고, 없으면 여기서 터진다 —
      App.jsx 가 바뀌었는데 시안만 옛 코드로 도는 상황을 막는 유일한 방법이다. */
const GL_VERT_RAW = sliceConst(APP, "GL_VERT");
const GL_FRAG = sliceConst(APP, "GL_FRAG");

/* ── 응축 = 행성 ───────────────────────────────────────────────────────
   창업자 지시(2026-08-15): "탭을 변경하면 수호신이 응축되어 구체로 보이게 하자. 행성처럼.
   수금지화목토천해명이 다 다르게 생겼잖아 — 같은 구체더라도 운세의 특성을 반영해 다 다르게."

   설계: **오행이 종(種)을 정하고, 명식 값이 개체를 정한다.**
     종  ← u_form (화·수·목·금·토 다섯 과)
     개체← u_strands(띠 개수) · u_chaos(폭풍) · u_nayF/u_nayA(대적점 위치·크기) ·
           u_zodiac(자전축 기울기) · u_focal(자전 속도·극지)
   전부 **이미 명식에서 계산돼 셰이더에 들어와 있는 값**이다. 새 입력을 안 받는다.
   고리는 헤일로(step(0.84,a_r1.y), 입자 16%)를 재배정해 만든다 — 입자 추가 0. */
const ORB_BLOCK = `
  float orbK=1.0, orbPS=1.0;
  if(u_orb>0.0005){
    float spin = u_t*(0.05+0.06*u_focal);
    float tilt = 0.28+0.55*fract(u_zodiac*0.083+u_nayF);          // 자전축 ← 띠·납음
    float th   = a_r1.x*6.2832 + spin;
    float ph   = acos(clamp(2.0*a_r0.z-1.0,-1.0,1.0));
    vec3  sp   = vec3(sin(ph)*cos(th), cos(ph), sin(ph)*sin(th));  // 고른 구면 분포
    float lat  = sp.y;
    float bandN= 3.0+u_strands;                                    // 띠 개수 ← 갈래 수
    float tex;
    if(u_form<0.5)      tex=0.50+0.50*sin(lat*bandN*1.7+0.7*sin(th*2.0+u_t*0.25));         // 화 — 가로 폭풍대
    else if(u_form<1.5) tex=0.58+0.42*sin(lat*bandN*0.8);                                   // 수 — 넓고 매끈한 띠
    else if(u_form<2.5) tex=0.52+0.48*sin(th*(2.0+u_strands)+lat*2.2);                      // 목 — 세로 맥
    else if(u_form<3.5) tex=0.44+1.00*pow(max(0.0,dot(sp,normalize(vec3(0.30,0.48,0.82)))),2.2); // 금 — 금속 반사(광원을 보는 쪽으로)
    else                tex=0.46+0.54*sin(lat*bandN*2.3+u_chaos*3.2*sin(th*3.0));           // 토 — 거친 대기
    vec3  spot = normalize(vec3(sin(u_nayF*9.0), 0.42*sin(u_zodiac), cos(u_nayF*7.0)));
    tex += pow(max(0.0,dot(sp,spot)), 42.0-26.0*u_chaos)*1.6*u_nayA;                        // 대적점 — 명식마다 다른 자리
    float R = 0.42*(1.0+0.03*u_breath);
    vec3  q = sp*R;
    q.yz = mat2(cos(tilt),-sin(tilt),sin(tilt),cos(tilt))*q.yz;
    /* 공으로 읽히게 하는 두 가지. ①앞면만 밝힌다(뒷면은 거의 끈다) ②가장자리를 죽인다 —
       구면 위 균일 분포를 정사영하면 **테두리에 밀도가 몰려** 그냥 링으로 보인다(첫 시도가 그랬다).
       앞을 향할수록 밝게 주면 그 밀도 편중이 상쇄되고 비로소 '면'이 생긴다. */
    float front = smoothstep(-0.25*R, R, q.z);
    tex *= 0.10+1.15*pow(front,0.75);
    float dc=2.4, psc=dc/(dc+q.z);
    vec2 ppos = q.xy*psc*0.96;
    if(halo>0.5){                                                                            // 고리 — 헤일로 재배정
      float rr = 0.66+0.34*a_r0.z, ra = a_r0.x*6.2832 + u_t*0.045;
      vec3 rq = vec3(cos(ra)*rr, 0.0, sin(ra)*rr)*R*1.7;
      rq.yz = mat2(cos(tilt),-sin(tilt),sin(tilt),cos(tilt))*rq.yz;
      float rpsc=dc/(dc+rq.z);
      ppos = rq.xy*rpsc*0.96;
      tex  = (0.22+0.40*abs(sin(rr*23.0)))*(0.45+0.55*smoothstep(-R,R,rq.z))*(0.30+0.75*u_nayA)*0.62; // 간극 있는 고리(본체보다 어둡게)
    }
    spos  = mix(spos, ppos, u_orb);
    orbK  = mix(1.0, tex*2.1, u_orb);         // 응축분 보정 — 첫 시도(0.62)는 행성이 아니라 비눗방울이 됐다
    orbPS = mix(1.0, 1.02, u_orb);
  }
`;
const inj = (src, anchor, add, where = "before") => {
  if (!src.includes(anchor)) throw new Error("앵커를 못 찾음 — App.jsx 가 바뀌었다: " + anchor.slice(0, 40));
  return src.replace(anchor, where === "before" ? add + anchor : anchor + add);
};
let GL_VERT = GL_VERT_RAW;
GL_VERT = inj(GL_VERT, "uniform vec2 u_touch,u_touchVel;", "\nuniform float u_orb;", "after");
GL_VERT = inj(GL_VERT, "  gl_Position=vec4(spos,0.0,1.0);", ORB_BLOCK);
GL_VERT = inj(GL_VERT, "  v_pick=a_r1.z;", "\n  v_a*=orbK; gl_PointSize*=orbPS;", "before");

/* 오행 색도 원본에서 뽑는다(EL_COLOR 한 줄) */
const elLine = APP.match(/const EL_COLOR = (\{[\s\S]*?\});/);
if (!elLine) throw new Error("EL_COLOR 를 못 찾음");
const EL_COLOR = new Function("return " + elLine[1])();

/* 형태 인덱스는 App.jsx 의 u_form 규약과 같다: 화0 수1 목2 금3 토4 */
const ELS = [
  { key: "화", form: 0 }, { key: "수", form: 1 }, { key: "목", form: 2 },
  { key: "금", form: 3 }, { key: "토", form: 4 },
];

/* ── 곁 셰이더 — 새로 쓰는 유일한 코드 ──────────────────────────────
   본체 프로그램과 분리했다. 실제 앱에 넣을 땐 헤일로(step(0.84,a_r1.y), 입자 16%)
   전례대로 본체 입자에서 떼어 재배정하면 추가 렌더 비용이 0이다. 시안에서는
   따로 그려야 밝기·반경·속도를 독립적으로 만져 볼 수 있어 분리했다. */
const CO_VERT = `
precision highp float;
attribute vec4 a_p;                 // x:꼬리위치 y,z:흩어짐 w:역할추첨
uniform float u_t,u_ang,u_rel,u_rad,u_spd,u_tail,u_lum,u_ps,u_close;
uniform vec2 u_ctr;                                  // 본체가 부유하는 만큼 궤도도 같이 따라간다
varying float v_a;
void main(){
  float dir = u_rel<-0.5 ? -1.0 : 1.0;              // 극이면 반대로 돈다
  float base = u_ang + dir*u_t*u_spd*0.55;
  float tail = a_p.x;                                // 꼬리를 따라 고르게(머리가 덩어리지지 않게)
  float ang  = base - dir*tail*u_tail;

  // 궤도면: 생·동은 본체와 같은 결(눕힌 타원), 극은 가로지르는 결(세운 타원)
  vec2 orb = u_rel<-0.5
    ? vec2(cos(ang)*0.60, sin(ang)) * u_rad
    : vec2(cos(ang), sin(ang)*0.60) * u_rad;

  float ja = a_p.y*6.2832, jr = pow(a_p.z,1.6)*(0.085+0.095*tail); // 둥근 빛덩이(막대가 되지 않게)
  vec2 p = orb + vec2(cos(ja),sin(ja))*jr;
  float a = (1.0-tail)*(1.0-tail)*0.9+0.06;          // 꼬리 감쇠(머리만 살짝 밝다)

  // 생 — 곁에서 떨어져 나온 알갱이가 본체 쪽으로 흘러든다
  if(u_rel>0.5){
    float feed = step(0.55, a_p.w);
    float fk   = fract(a_p.z*7.31 + u_t*0.22 + a_p.w*3.1);
    vec2  into = mix(p, p*0.12, fk*fk);
    p = mix(p, into, feed);
    a = mix(a, a*(1.0-fk)*1.15, feed);
  }
  // 극 — 궤도가 본체를 가로지르고, 스치는 지점에 밝은 마디 하나
  float node = 0.0;
  if(u_rel<-0.5){
    node = pow(max(0.0, cos(base)), 14.0);
    a *= 1.0 + node*1.6;
  }
  // 동일 — 나란히 돌다 겹치는 구간에서 함께 밝아진다
  if(abs(u_rel)<0.5) a *= 1.0 + 0.55*pow(max(0.0,cos(base*1.0)), 4.0);

  gl_Position = vec4(p*0.384 + u_ctr, 0.0, 1.0);     // 본체와 같은 스케일(u_R 0.8 × 0.48)
  gl_PointSize = u_ps*(0.6+0.7*(1.0-tail))*(1.0+node*0.7);
  v_a = a*u_lum*u_close;
}`;
const CO_FRAG = `
precision mediump float;
uniform vec3 u_col; uniform float u_alpha;
varying float v_a;
void main(){
  float m=smoothstep(0.5,0.10,length(gl_PointCoord-0.5));
  float a=m*v_a*u_alpha;
  gl_FragColor=vec4(u_col*a,a);
}`;

/* 오행 관계 — 생: 목→화→토→금→수→목 / 극: 목→토→수→화→금→목 */
const SAENG_PREV = { 화: "목", 토: "화", 금: "토", 수: "금", 목: "수" };  // 나를 생해 주는 오행
const GEUK_BY = { 화: "수", 금: "화", 목: "금", 토: "목", 수: "토" };      // 나를 극하는 오행

/* 여섯 판 — 판단은 이 여섯을 나란히 놓고 한다.
   ⑤⑥ 은 "사람이 많아지면 어떻게 되나"에 답하려고 붙였다. 규칙 없이 그냥 늘리면
   반드시 벌레떼가 된다(⑤). 그래서 규칙을 둔다(⑥) — 아래 CAP/예산 참조. */
const many = (n) => Array.from({ length: n }, (_, i) => ({
  rel: [1, -1, 0, 1, 1, 0, -1, 1, 0, 1][i % 10],
  ang: (i * 2.399) % 6.2832,                       // 황금각 — 뭉치지 않게 고르게 흩는다
  rank: i,                                          // 최근 주고받은 순서(앞 3만 앞줄에 선다)
}));
const PANELS = [
  { key: "none", title: "① 곁 없음", sub: "지금 앱 그대로", co: [] },
  { key: "saeng", title: "② 곁 하나 · 생", sub: "나를 받쳐 주는 사람", co: [{ rel: 1, ang: 0.4 }] },
  { key: "geuk", title: "③ 곁 하나 · 극", sub: "부딪히는 사람", co: [{ rel: -1, ang: 1.9 }] },
  { key: "three", title: "④ 곁 셋", sub: "생 · 극 · 동", co: [{ rel: 1, ang: 0.3 }, { rel: -1, ang: 2.4 }, { rel: 0, ang: 4.3 }] },
  { key: "raw10", title: "⑤ 곁 열 · 규칙 없음", sub: "나쁜 예 — 그냥 늘린 것", co: many(10), rule: false },
  { key: "cap10", title: "⑥ 곁 열 · 규칙 적용", sub: "앞줄 셋 + 나머지는 배경으로", co: many(10), rule: true },
];

const DATA = { els: ELS.map(e => ({ ...e, colors: EL_COLOR[e.key] })), panels: PANELS, saeng: SAENG_PREV, geuk: GEUK_BY, elColor: EL_COLOR };

const HTML = `<!doctype html><meta charset="utf-8">
<title>곁 — 수호신 관계 표현 시안</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{ --bg:#07070f; --ink:#e8e6f2; --dim:#9a97ad; --line:#23233a; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
  .wrap{max-width:1360px;margin:0 auto;padding:28px 20px 80px}
  h1{font-size:22px;margin:0 0 6px;letter-spacing:-.02em}
  .lead{color:var(--dim);margin:0 0 22px;font-size:13px}
  .lead b{color:#cfc9ff;font-weight:600}
  .bar{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:#0c0c18;margin-bottom:18px}
  .fld{display:flex;flex-direction:column;gap:5px;min-width:132px}
  .fld label{font-size:11px;color:var(--dim);letter-spacing:.02em}
  .fld output{font-variant-numeric:tabular-nums;color:#cfc9ff}
  input[type=range]{width:150px;accent-color:#8f86ff}
  .els{display:flex;gap:6px}
  .els button{background:#12121f;color:var(--dim);border:1px solid var(--line);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px}
  .els button.on{background:#1e1b3a;color:#fff;border-color:#4a4380}
  .hint{color:#6f6a82;font-size:10px}
  .panels{position:relative}
  canvas#gl{width:100%;display:block;border-radius:14px;background:#04040a}
  .heads{display:grid;grid-template-columns:repeat(6,1fr);gap:0;margin-bottom:8px}
  .heads div{padding:0 8px}
  .heads b{display:block;font-size:13px}
  .heads span{font-size:11px;color:var(--dim)}
  .caps{display:grid;grid-template-columns:repeat(6,1fr);margin-top:10px}
  .caps div{padding:0 8px;font-size:11px;color:var(--dim);min-height:34px}
  .note{color:var(--dim);font-size:12px;margin-top:26px;border-top:1px solid var(--line);padding-top:16px}
  .note h3{color:var(--ink);font-size:13px;margin:0 0 8px}
  .note li{margin:4px 0}
  .fail{display:none;padding:20px;border:1px solid #663;border-radius:10px;color:#fc9}
  @media(max-width:1100px){ .heads,.caps{grid-template-columns:repeat(3,1fr)} }
</style>
<div class="wrap">
  <h1>곁 — 친구의 기운이 수호신에 들어오는 표현 (시안)</h1>
  <p class="lead">본체는 <b>한 줄도 바꾸지 않았다</b>. App.jsx 의 셰이더를 그대로 뽑아 돌린다. 새로 그린 건 <b>궤도를 도는 빛</b> 하나뿐이다.<br>
  볼 것 두 가지 — ① 계속 보고 있어도 <b>거슬리지 않는가</b> ② v68에서 뺀 <b>둥둥 뜨는 하얀 점</b>과 확실히 다른가.</p>

  <div class="bar">
    <div class="fld"><label>본체 오행</label><div class="els" id="els"></div></div>
    <div class="fld"><label>자세 <span class="hint">— 오가며 보라</span></label><div class="els" id="pose"></div></div>
    <div class="fld"><label>곁 밝기 <output id="oLum"></output></label><input type="range" id="lum" min="0" max="1.4" step="0.02" value="0.45"></div>
    <div class="fld"><label>궤도 반경 <output id="oRad"></output></label><input type="range" id="rad" min="0.5" max="2" step="0.02" value="1.05"></div>
    <div class="fld"><label>공전 속도 <output id="oSpd"></output></label><input type="range" id="spd" min="0" max="1.6" step="0.02" value="0.42"></div>
    <div class="fld"><label>꼬리 길이 <output id="oTail"></output></label><input type="range" id="tail" min="0" max="1.6" step="0.02" value="0.5"></div>
    <div class="fld"><label>친밀도 <output id="oClose"></output></label><input type="range" id="close" min="0.25" max="1" step="0.01" value="1"></div>
    <div class="fld"><label>응축(행성) <output id="oOrb"></output></label><input type="range" id="orb" min="0" max="1" step="0.02" value="0"></div>
  </div>

  <div class="heads" id="heads"></div>
  <div class="panels"><canvas id="gl"></canvas></div>
  <div class="caps" id="caps"></div>
  <div class="fail" id="fail">이 브라우저에서 WebGL을 못 얻었다.</div>

  <div class="note">
    <h3>이 시안이 지키고 있는 것</h3>
    <ul>
      <li><b>본체 불변</b> — 형상·색·움직임은 원본 셰이더 그대로다. 곁은 본체에 손대지 않는다(합성 금지 — 관계표현인계서 §3 원칙 1).</li>
      <li><b>관계는 방향으로만</b> — 생이면 곁에서 본체로 알갱이가 흘러들고, 극이면 궤도가 <b>반대로 돌며 본체를 가로지르고</b> 스치는 지점에 마디 하나가 밝아진다. 동일이면 나란히 돌다 겹치는 구간에서 같이 밝아진다.</li>
      <li><b>숫자 없음</b> — 개수·점수·진행바를 쓰지 않는다. 곁이 0이어도 ①번 판처럼 화면이 완결된다(빈 슬롯 금지).</li>
      <li><b>친밀도</b>는 밝기와 거리로만 나타난다. 소원해져도 사라지지 않고 멀어질 뿐이다 — 슬라이더를 왼쪽 끝까지 내려 확인.</li>
      <li><b>자세는 바뀌고 형태는 안 바뀐다</b> — 위 <b>자세</b> 토글을 오가며 보라. 달라지는 건 <b>이미 있는 uniform 넷</b>뿐이다:
        구심점(<code>u_focal</code> 0.55→0.16 · 안으로 모임 ↔ 열려 있음) · 자전(0.30→0.42) · 아주 살짝 폄(<code>u_expand</code> 0→0.05) · 호흡 깊이.
        <b>형태 축(<code>u_form</code>)과 색은 한 톨도 안 건드린다.</b> 실제 앱에선 이 값을 탭 전환 때 ~1초에 걸쳐 보간한다 —
        <b>끊기면 '교체'로 읽히고, 이어지면 '자세'로 읽힌다.</b> 그게 이 변경이 헌장(수호신 비주얼 교체 금지)을 안 어기는 조건이다.</li>
      <li><b>많아져도 안 늘어난다</b> — 사람이 늘어도 곁이 쓰는 <b>입자 총량은 고정</b>이고, 궤도에 서는 건 <b>최근에 주고받은 셋까지</b>다. 나머지는 바깥으로 물러나 배경 성운이 된다 — 세어지지 않고, 사라지지도 않는다. ⑤(규칙 없음)와 ⑥(규칙 적용)을 나란히 보면 이 규칙이 왜 있어야 하는지가 보인다.</li>
      <li><b>비용</b> — 실제 앱에 넣을 땐 헤일로(<code>step(0.84,a_r1.y)</code>, 본체 입자의 16%) 전례대로 <b>기존 입자에서 떼어 재배정</b>한다. 렌더 비용 추가 0. 시안에서만 따로 그린다(슬라이더로 만져 보려고).</li>
    </ul>
    <h3>왜 v68에서 뺀 그 점과 다른가</h3>
    <ul>
      <li>그때 뺀 위스프는 <b>아무 뜻이 없는 장식</b>이었고 색도 흰색이라 본체와 따로 놀았다.</li>
      <li>여기서 빛 하나는 <b>사람 하나</b>다. 색은 그 사람 일간의 오행 색이고, 움직임은 그 사람과 나의 생극이 정한다. 궤도로 본체에 묶여 있어 따로 떠다니지 않는다.</li>
      <li>그래도 거슬린다면 그건 이 안이 틀렸다는 뜻이다. 밝기·속도 슬라이더로 <b>어디까지가 견딜 만한지</b> 값을 잡아 알려 주시면 그 값으로 못 박는다.</li>
    </ul>
    <p>생성: <code>node app/tools/build-gyeot-mock.mjs</code> · 근거: <code>app/src/App.jsx</code>(GL_VERT/GL_FRAG/EL_COLOR), <code>03_비주얼프로토타입/비나리_비주얼프로토타입_관계표현인계서_v01.md</code></p>
  </div>
</div>

<script>
const DATA = ${JSON.stringify(DATA)};
const GL_VERT = ${JSON.stringify(GL_VERT)};
const GL_FRAG = ${JSON.stringify(GL_FRAG)};
const CO_VERT = ${JSON.stringify(CO_VERT)};
const CO_FRAG = ${JSON.stringify(CO_FRAG)};

const hex2rgb = h => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
const srnd = (seed) => { let h = seed >>> 0; return () => ((h = (h*1664525+1013904223) >>> 0) / 2**32); };
const F_AL = { "화":0.36, "수":0.31, "목":0.32, "금":0.29, "토":0.26 };
const F_PS = { "금":0.82, "토":0.9 };

let elIdx = 0, pose = "gyeot";
/* 자세 — **형태 축(u_form)은 손대지 않는다.** 이미 있는 uniform 만 다르게 준다.
   판결: 안으로 모인다(u_focal 높음 = 코어 발광·구심), 느리게, 팽창 없음.
   곁  : 열려 있다(u_focal 낮음 = 중심 없이 벌어짐), 조금 더 돌고, 아주 살짝 편다.
   실제 앱에서는 탭 전환 때 이 값들을 ~1초에 걸쳐 보간한다 — 그래야 '교체'가 아니라 '자세'로 읽힌다. */
const POSE = {
  judge: { focal:0.55, R:0.80, speed:0.30, expand:0.00, breathAmp:1.0 },
  gyeot: { focal:0.16, R:0.87, speed:0.42, expand:0.05, breathAmp:1.6 },
};
const S = { lum:0.45, rad:1.05, spd:0.42, tail:0.5, close:1, orb:0 };
const relName = { "1":"생", "0":"동", "-1":"극" };
function partnerEl(myKey, rel){
  return rel > 0 ? DATA.saeng[myKey] : rel < 0 ? DATA.geuk[myKey] : myKey;
}

/* 머리·설명 */
document.getElementById("heads").innerHTML = DATA.panels
  .map(p => '<div><b>'+p.title+'</b><span>'+p.sub+'</span></div>').join("");
function paintCaps(){
  const my = DATA.els[elIdx].key;
  document.getElementById("caps").innerHTML = DATA.panels.map(p => {
    if(!p.co.length) return '<div>혼자여도 완결된다 — 빈자리를 만들지 않는다.</div>';
    if(p.co.length > 4) return '<div>'+(p.rule
      ? '앞줄 셋만 궤도에 서고 나머지 일곱은 배경으로 물러난다. 입자 총량은 ②③④와 같다.'
      : '열 명이 그대로 열 개. 밝기도 입자도 열 배 — 이 판이 어노잉의 정체다.')+'</div>';
    const t = p.co.map(c => partnerEl(my, c.rel)+'('+relName[String(c.rel)]+')').join(' · ');
    return '<div>'+t+'</div>';
  }).join("");
}
document.getElementById("els").innerHTML = DATA.els
  .map((e,i) => '<button data-i="'+i+'" class="'+(i?"":"on")+'">'+e.key+'</button>').join("");
document.getElementById("pose").innerHTML =
  '<button data-p="judge">판결 자세</button><button data-p="gyeot" class="on">곁 자세</button><button data-p="orb">행성(응축)</button>';
document.querySelectorAll("#pose button").forEach(b => b.onclick = () => {
  pose = b.dataset.p === "orb" ? "gyeot" : b.dataset.p;
  const o = document.getElementById("orb"); o.value = b.dataset.p === "orb" ? 1 : 0; o.dispatchEvent(new Event("input"));
  document.querySelectorAll("#pose button").forEach(x => x.classList.toggle("on", x===b));
});
document.querySelectorAll("#els button").forEach(b => b.onclick = () => {
  elIdx = +b.dataset.i;
  document.querySelectorAll("#els button").forEach(x => x.classList.toggle("on", x===b));
  paintCaps();
});
["lum","rad","spd","tail","close","orb"].forEach(k => {
  const el = document.getElementById(k), out = document.getElementById("o"+k[0].toUpperCase()+k.slice(1));
  const sync = () => { S[k] = +el.value; out.textContent = (+el.value).toFixed(2); };
  el.oninput = sync; sync();
});
paintCaps();

const COLS = DATA.panels.length, CELL = 330;

function init(){
  const cv = document.getElementById("gl");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.aspectRatio = (COLS*CELL) + " / " + CELL;
  cv.width = COLS*CELL*dpr; cv.height = CELL*dpr;
  const gl = cv.getContext("webgl", { alpha:false, antialias:false, depth:false, preserveDrawingBuffer:true });
  if(!gl){ document.getElementById("fail").style.display="block"; return; }
  const mk = (ty,s) => { const sh=gl.createShader(ty); gl.shaderSource(sh,s); gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const link = (v,f) => { const p=gl.createProgram(); gl.attachShader(p,mk(gl.VERTEX_SHADER,v));
    gl.attachShader(p,mk(gl.FRAGMENT_SHADER,f)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };

  /* ── 본체 ── */
  const bodyP = link(GL_VERT, GL_FRAG);
  gl.useProgram(bodyP);
  const n = 11000, r0 = new Float32Array(n*4), r1 = new Float32Array(n*4), rnd = srnd(20260815);
  for(let i=0;i<n*4;i++){ r0[i]=rnd(); r1[i]=rnd(); }
  const mkbuf = arr => { const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b);
    gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW); return b; };
  const b0 = mkbuf(r0), b1 = mkbuf(r1);
  const A0 = gl.getAttribLocation(bodyP,"a_r0"), A1 = gl.getAttribLocation(bodyP,"a_r1");
  const L = {};
  ["u_hold","u_beat","u_t","u_form","u_R","u_arms","u_strands","u_twist","u_speed","u_chaos","u_nayF","u_nayA",
   "u_expand","u_agi","u_k","u_ps","u_lum","u_twk","u_psMul","u_focal","u_touch","u_touchVel","u_touchAmt",
   "u_breath","u_trailLive","u_zodiac","u_c1","u_c2","u_acc","u_wispCol","u_bright","u_alpha","u_orb"]
   .forEach(k => L[k]=gl.getUniformLocation(bodyP,k));
  L.u_trail = gl.getUniformLocation(bodyP,"u_trail[0]");
  const trail = new Float32Array(40);

  /* ── 곁 ── */
  const coP = link(CO_VERT, CO_FRAG);
  const cn = 1400, cp = new Float32Array(cn*4), rnd2 = srnd(777);
  for(let i=0;i<cn;i++){ cp[i*4]=i/cn; cp[i*4+1]=rnd2(); cp[i*4+2]=rnd2(); cp[i*4+3]=rnd2(); }
  const cb = mkbuf(cp);
  const CA = gl.getAttribLocation(coP,"a_p");
  const CL = {};
  ["u_t","u_ang","u_rel","u_rad","u_spd","u_tail","u_lum","u_ps","u_close","u_col","u_alpha","u_ctr"]
   .forEach(k => CL[k]=gl.getUniformLocation(coP,k));

  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(0.016,0.016,0.031,1);

  function drawBody(el,t){
    gl.useProgram(bodyP);
    gl.bindBuffer(gl.ARRAY_BUFFER,b0); gl.enableVertexAttribArray(A0); gl.vertexAttribPointer(A0,4,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,b1); gl.enableVertexAttribArray(A1); gl.vertexAttribPointer(A1,4,gl.FLOAT,false,0,0);
    const P = POSE[pose];
    gl.uniform1f(L.u_R,P.R); gl.uniform1f(L.u_arms,5); gl.uniform1f(L.u_strands,5);
    gl.uniform1f(L.u_twist,2.1); gl.uniform1f(L.u_speed,P.speed); gl.uniform1f(L.u_chaos,0.9);
    gl.uniform1f(L.u_focal,P.focal); gl.uniform1f(L.u_nayF,0.58); gl.uniform1f(L.u_nayA,0.45);
    gl.uniform1f(L.u_lum,0.92); gl.uniform1f(L.u_twk,1); gl.uniform1f(L.u_beat,3);
    gl.uniform1f(L.u_k,1); gl.uniform1f(L.u_zodiac,4); gl.uniform2f(L.u_touchVel,0,0);
    gl.uniform2f(L.u_touch,0,0); gl.uniform1f(L.u_touchAmt,0); gl.uniform1f(L.u_hold,0);
    gl.uniform1f(L.u_trailLive,0); gl.uniform1f(L.u_expand,P.expand); gl.uniform1f(L.u_bright,1); gl.uniform1f(L.u_agi,0);
    gl.uniform4fv(L.u_trail,trail);
    const c1=hex2rgb(el.colors[0]), c2=hex2rgb(el.colors[1]);
    gl.uniform3fv(L.u_c1,c1); gl.uniform3fv(L.u_c2,c2); gl.uniform3fv(L.u_acc,hex2rgb(el.colors[2]));
    gl.uniform3fv(L.u_wispCol,[0.5+c1[0]*0.28,0.55+c1[1]*0.26,0.66+c1[2]*0.2]);
    gl.uniform1f(L.u_form,el.form); gl.uniform1f(L.u_orb,S.orb);
    gl.uniform1f(L.u_ps,1.8*dpr*(F_PS[el.key]||1));
    const bph=t*Math.PI*2/9; gl.uniform1f(L.u_breath, Math.sin(bph-0.35*Math.sin(bph))*P.breathAmp);
    const A=(F_AL[el.key]||0.31);
    gl.uniform1f(L.u_t,t);
    gl.uniform1f(L.u_psMul,3.6); gl.uniform1f(L.u_alpha,0.05*A); gl.drawArrays(gl.POINTS,0,n);
    gl.uniform1f(L.u_psMul,1.8); gl.uniform1f(L.u_alpha,0.22*A); gl.drawArrays(gl.POINTS,0,n);
    gl.uniform1f(L.u_psMul,1);   gl.uniform1f(L.u_alpha,0.72*A); gl.drawArrays(gl.POINTS,0,n);
    gl.disableVertexAttribArray(A0); gl.disableVertexAttribArray(A1);
  }

  /* 본체는 가만히 있지 않는다 — 원본 셰이더의 부유 항을 그대로 계산해
     궤도 중심을 같이 옮긴다. 안 그러면 곁만 따로 떠 있는 그 점이 된다. */
  function bodyCenter(t){
    const tt = t*0.30, sm = Math.min(1, Math.max(0, t/3.5));
    const bph = t*Math.PI*2/9, breath = Math.sin(bph-0.35*Math.sin(bph));
    const ex = 0.45*0.2*sm*Math.sin(tt*0.24+1.7)*0.8*0.48;
    const ey = 0.45*0.2*sm*Math.sin(tt*0.19+0.3)*0.8*0.48;
    return new Float32Array([
      ex + Math.sin(tt*0.11+1.3)*0.11*sm,
      ey + (Math.sin(tt*0.17)*0.07 + 0.012*breath)*sm,
    ]);
  }

  function drawCo(myKey,c,t,budget,lumK,radK){
    gl.useProgram(coP);
    gl.bindBuffer(gl.ARRAY_BUFFER,cb); gl.enableVertexAttribArray(CA); gl.vertexAttribPointer(CA,4,gl.FLOAT,false,0,0);
    const pk = partnerEl(myKey,c.rel);
    const col = hex2rgb(DATA.elColor[pk][1]);
    gl.uniform3fv(CL.u_col,col);
    gl.uniform1f(CL.u_t,t); gl.uniform1f(CL.u_ang,c.ang); gl.uniform1f(CL.u_rel,c.rel);
    /* 친밀도가 낮을수록 멀어지고 어두워진다 — 사라지지는 않는다.
       자세로 본체가 펴지면 궤도도 같이 벌어져야 한다. 안 그러면 곁이 본체 안에 파묻힌다. */
    const PZ = POSE[pose], poseK = ((PZ.R/0.80)*(1+PZ.expand))*(1-S.orb) + 1.28*S.orb;
    gl.uniform1f(CL.u_rad,S.rad*(1+(1-S.close)*0.5)*radK*poseK); gl.uniform1f(CL.u_spd,S.spd); gl.uniform1f(CL.u_tail,S.tail);
    gl.uniform1f(CL.u_lum,S.lum*lumK); gl.uniform1f(CL.u_close,S.close);
    gl.uniform2fv(CL.u_ctr, bodyCenter(t));
    gl.uniform1f(CL.u_ps,1.7*dpr); gl.uniform1f(CL.u_alpha,0.10); gl.drawArrays(gl.POINTS,0,budget);
    gl.uniform1f(CL.u_ps,4.2*dpr); gl.uniform1f(CL.u_alpha,0.028); gl.drawArrays(gl.POINTS,0,budget);
    gl.disableVertexAttribArray(CA);
  }

  const T0 = performance.now(); window.__T0 = T0;
  const loop = () => {
    requestAnimationFrame(loop);
    const t = (performance.now()-T0)/1000;
    const el = DATA.els[elIdx];
    gl.disable(gl.SCISSOR_TEST); gl.clear(gl.COLOR_BUFFER_BIT);
    for(let i=0;i<COLS;i++){
      const px=i*CELL*dpr, w=CELL*dpr;
      gl.viewport(px,0,w,w); gl.enable(gl.SCISSOR_TEST); gl.scissor(px,0,w,w);
      drawBody(el,t);
      const P = DATA.panels[i], N = P.co.length;
      if(!P.rule){
        /* 규칙 없음 — 사람 수만큼 그대로 곱해진다. 10명이면 밝기도 입자도 10배 */
        P.co.forEach(c => drawCo(el.key,c,t,cn,1,1));
      } else {
        /* 규칙 ① 입자 예산 고정 — 몇 명이 오든 곁이 쓰는 총량은 그대로다(본체 입자의 16%).
           규칙 ② 앞줄은 셋까지 — 최근에 주고받은 셋만 궤도에 서고,
                  나머지는 바깥으로 물러나 배경 성운이 된다(숫자로 세지 않는다). */
        const CAP = 3;
        const front = P.co.filter(c => c.rank < CAP), back = P.co.filter(c => c.rank >= CAP);
        const fb = Math.floor(cn*0.72/Math.max(1,front.length));
        const bb = Math.floor(cn*0.28/Math.max(1,back.length));
        front.forEach(c => drawCo(el.key,c,t,fb,1,1));
        back.forEach(c => drawCo(el.key,c,t,bb,0.30,1.42));
      }
    }
  };
  loop();
}
try { init(); } catch(e){ document.getElementById("fail").style.display="block"; console.error(e); }
</script>
`;

const OUT = resolve(ROOT, "app/public/gyeot-mock.html");
writeFileSync(OUT, HTML);
console.log("생성:", OUT);
