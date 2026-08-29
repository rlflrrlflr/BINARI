/* ─────────────────────────────────────────────────────────────────────
 * 얼굴 시안 — 캘시퍼처럼 **눈과 입만**
 *
 * 창업자 제안(2026-08-28): "하울의 움직이는 성의 캘시퍼처럼 눈과 입도 추가해볼까?
 *   우선 적용하기 전에 보드에 붙여서 보여줘. 여러 눈, 입을 만들어두고
 *   각 사주가 마음에 들어할만한 조합으로 만들어주면 어떨까 싶어."
 *
 * ⚠ **이 보드는 제안이다. 앱에는 아직 안 넣었다.**
 * ⚠ 설계 헌장의 금지선을 지킨다 — 얼굴 윤곽·머리카락·몸·팔다리는 그리지 않는다.
 *    캘시퍼도 불꽃에 **눈과 입만** 있다. 그 선을 넘으면 "정령 시각요소 부활"이 된다.
 *
 * 실행: cd app && node tools/build-face-mock.mjs → app/public/face-mock.html
 * ───────────────────────────────────────────────────────────────────── */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const APPDIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(resolve(APPDIR, "src/App.jsx"), "utf8");
const { sliceConst } = await import("./lib/extract.mjs");
const FIELD_FRAG = sliceConst(SRC, "FIELD_FRAG");
const EL_COLOR = new Function("return " + SRC.match(/const EL_COLOR = (\{[\s\S]*?\});/)[1])();

/* 밝은 판 보정·헤일로 색은 앱과 같은 규칙(HOLO_FIX·HOLO_SAENG·mixHex) */
const FIX = { 금: ["#5b76b8", "#8fb0e6", "#1d2436"] };
const SAENG = { 화: "목", 토: "화", 금: "토", 수: "금", 목: "수" };
const mixHex = (a, b, w) => { const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const A = h(a), B = h(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * w).toString(16).padStart(2, "0")).join(""); };
const pal = (k) => { const b = FIX[k] || EL_COLOR[k]; const s = FIX[SAENG[k]] || EL_COLOR[SAENG[k]];
  return [b[0], b[1], mixHex(s[0], s[1], 0.42)]; };

/* ── 눈 여덟 · 입 여섯 ────────────────────────────────────────────────
   전부 **선과 점만**이다. 흰자·눈동자·속눈썹을 그리는 순간 사람 얼굴이 된다. */
const EYES = [
  ["calci", "캘시퍼 눈",  "큰 흰자 + 작은 동공. 원본이 이 구조다"],
  ["wide",  "더 크게",    "흰자를 더 키우면 어리고 순해진다"],
  ["small", "작은 동공",  "동공이 작을수록 놀란·멍한 인상"],
  ["side",  "곁눈",       "동공이 한쪽으로 — 삐딱하게 보는 중"],
  ["half",  "반쯤 감김",  "위에서 눈꺼풀이 덮인다. 나른"],
  ["arc",   "웃는 눈",    "흰자를 접고 호만 남긴다"],
  ["slit",  "세로 동공",  "고양이 눈. 예리하게 재는 중"],
  ["three", "세 눈",      "인간이 아니라는 표시"],
];
const MOUTHS = [
  ["squig", "구불선",   "캘시퍼의 그 입. 얇고 비대칭"],
  ["flat",  "일자",     "단정하고 무표정"],
  ["smile", "미소",     "호 하나 — 온화"],
  ["frown", "삐죽",     "한쪽이 내려간다. 시무룩"],
  ["o",     "오",       "놀람·감탄"],
  ["wave",  "물결",     "말하는 중"],
];
/* 오행별 추천 조합 — **근거는 오행의 성질**이다. 임의로 고른 게 아니다 */
const PICK = [
  ["화", "wide",  "squig", "타오른다 — 크게 뜨고 입은 구불구불"],
  ["수", "half",  "wave",  "흐른다 — 나른하고 말이 물결친다"],
  ["목", "arc",   "smile", "자란다 — 웃는 눈에 온화한 입"],
  ["금", "slit",  "flat",  "벼린다 — 재는 눈에 단정한 입"],
  ["토", "small", "frown", "품는다 — 멍하고 시무룩. 말이 적다"],
];
/* 오늘 상태는 **입만** 바꾼다 — 눈은 사주(타고난 것), 입은 오늘(변하는 것) */
const MOOD_MOUTH = [
  ["손대는 게 잘 풀려", "smile"], ["말이 잘 나와", "wave"], ["계산이 잘 서", "flat"],
  ["괜히 마음이 급해져", "squig"], ["버텨야 하는 날이야", "frown"], ["누가 받쳐 주는 느낌이야", "smile"],
];

const DATA = { els: ["화","수","목","금","토"].map((k) => ({ k, c: pal(k) })), EYES, MOUTHS, PICK, MOOD_MOUTH };

const HTML = `<!doctype html><meta charset="utf-8">
<title>얼굴 시안 — 눈과 입만</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;background:#d9d5ca;color:#262218;
    font:13px/1.75 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
  .wrap{max-width:1080px;margin:0 auto;padding:26px 18px 70px}
  h1{font-size:20px;margin:0 0 6px;letter-spacing:-.02em}
  h2{font-size:14px;margin:34px 0 10px;letter-spacing:-.01em;border-top:1px solid #c2bcaa;padding-top:14px}
  .lead{color:#6b6252;font-size:12.5px;margin:0 0 6px}
  .lead b{color:#262218}
  .warn{color:#8c4a12;font-size:12px;margin:10px 0 0;padding:9px 13px;border:1px dashed rgba(140,74,18,.35);border-radius:9px;background:rgba(255,253,246,.55)}
  .row{display:flex;flex-wrap:wrap;gap:14px}
  .cell{width:150px;text-align:center}
  .cell canvas{display:block;border-radius:12px;background:#d3cfc4}
  .nm{font-size:12px;margin:6px 0 1px;font-weight:600}
  .ds{font-size:11px;color:#7a7261;line-height:1.5}
  .pickrow{display:flex;flex-wrap:wrap;gap:16px}
  .pick{width:186px;text-align:center}
  .pick .why{font-size:11.5px;color:#6b6252;margin-top:4px}
  .pick .el{font-size:13px;font-weight:600;margin-top:6px}
  code{font-size:11.5px;color:#5d5544}
</style>
<div class="wrap">
  <h1>얼굴 시안 — 눈과 입만</h1>
  <p class="lead">캘시퍼처럼 <b>불꽃에 눈과 입만</b> 얹는다. 얼굴 윤곽·머리카락·몸·팔다리는 그리지 않는다 —
  그 선을 넘으면 설계 헌장이 막은 <b>정령 시각요소 부활</b>이 된다. 오라는 앱과 <b>같은 셰이더</b>로 그렸고,
  얼굴만 그 위에 2D 로 얹었다.</p>
  <p class="warn">⚠ 이 판은 <b>제안이고 앱에는 안 들어가 있다.</b> 고를 것 셋 — ①눈·입 종류 ②오행별 조합 ③오늘 상태를 입으로 비출지.</p>

  <h2>눈 여덟</h2>
  <div class="row" id="eyes"></div>

  <h2>입 여섯</h2>
  <div class="row" id="mouths"></div>

  <h2>오행별 추천 조합 — 근거는 오행의 성질</h2>
  <div class="pickrow" id="picks"></div>

  <h2>오늘 상태는 <b>입만</b> 바꾼다</h2>
  <p class="lead">눈은 <b>사주</b>(타고난 것), 입은 <b>오늘</b>(변하는 것). 같은 사람인데 오늘이 다르다는 걸
  얼굴 하나로 말할 수 있다. 아래는 목(木)의 웃는 눈에 오늘 입만 갈아 끼운 것.</p>
  <div class="row" id="moods"></div>

  <p class="lead" style="margin-top:26px">생성: <code>cd app &amp;&amp; node tools/build-face-mock.mjs</code></p>
</div>
<script>
const DATA=${JSON.stringify(DATA)};
const FRAG=${JSON.stringify(FIELD_FRAG)};
const VERT="attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
const hex2rgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];

/* ── 얼굴 그리기 — 전부 선과 점만. 흰자·눈동자·속눈썹은 없다 ───────────── */
function drawEyes(x, S, kind, cx, cy, gap, sz, ink){
  /* ⚠ **캘시퍼 눈의 핵심은 흰자다.** 처음엔 검은 점·선만 그렸는데 그건 이모티콘이지
     캘시퍼가 아니다(창업자가 원본을 보내 줘서 알았다). 큰 흰 타원 + 작은 검은 동공,
     그리고 두 눈 사이가 넓다. 흰자가 있어야 **시선**이 생기고 표정이 산다. */
  const WHITE="#fbf7ef";
  /* ⚠ ball 이 y 를 클로저로만 쓰다가 **세 번째 눈을 위에 못 놓아** 모양이 깨졌다.
     y 를 인자로 받는다 — 눈이 셋인 배치는 이게 없으면 성립하지 않는다. */
  const ball=(ex, ey, rw, rh, px, py, pr, lid)=>{
    x.fillStyle=WHITE; x.beginPath(); x.ellipse(ex,ey,rw,rh,0,0,7); x.fill();
    x.strokeStyle="rgba(30,22,12,.30)"; x.lineWidth=sz*0.06; x.stroke();
    x.fillStyle=ink; x.beginPath(); x.ellipse(ex+px,ey+py,pr,pr*(kind==="slit"?2.6:1),0,0,7); x.fill();
    if(lid){ x.fillStyle=lid; x.beginPath();
      x.ellipse(ex,ey-rh*0.75,rw*1.06,rh*0.78,0,0,7); x.fill(); }
  };
  const R1=sz*1.05, R2=sz*1.15;                       // 흰자 반지름(가로·세로)
  if(kind==="calci"){ ball(cx-gap,cy,R1,R2,0,0,sz*0.30); ball(cx+gap,cy,R1,R2,0,0,sz*0.30); }
  else if(kind==="wide"){ ball(cx-gap*1.06,cy,R1*1.24,R2*1.24,0,0,sz*0.32); ball(cx+gap*1.06,cy,R1*1.24,R2*1.24,0,0,sz*0.32); }
  else if(kind==="small"){ ball(cx-gap,cy,R1,R2,0,0,sz*0.17); ball(cx+gap,cy,R1,R2,0,0,sz*0.17); }
  else if(kind==="side"){ ball(cx-gap,cy,R1,R2,sz*0.42,0,sz*0.28); ball(cx+gap,cy,R1,R2,sz*0.42,0,sz*0.28); }
  else if(kind==="half"){ ball(cx-gap,cy,R1,R2,0,sz*0.16,sz*0.28); ball(cx+gap,cy,R1,R2,0,sz*0.16,sz*0.28);
    x.strokeStyle=ink; x.lineWidth=sz*0.20; x.lineCap="round";
    [cx-gap,cx+gap].forEach(ex=>{ x.beginPath(); x.moveTo(ex-R1,cy-R2*0.34); x.lineTo(ex+R1,cy-R2*0.34); x.stroke(); }); }
  else if(kind==="slit"){ ball(cx-gap,cy,R1,R2,0,0,sz*0.155); ball(cx+gap,cy,R1,R2,0,0,sz*0.155); }
  else if(kind==="arc"){ x.strokeStyle=ink; x.lineWidth=sz*0.26; x.lineCap="round";
    [cx-gap,cx+gap].forEach(ex=>{ x.beginPath(); x.arc(ex,cy+sz*0.42,sz*0.92,Math.PI*1.16,Math.PI*1.84); x.stroke(); }); }
  else if(kind==="three"){ ball(cx-gap*1.12,cy+sz*0.24,R1*0.82,R2*0.82,0,0,sz*0.24); ball(cx+gap*1.12,cy+sz*0.24,R1*0.82,R2*0.82,0,0,sz*0.24);
    ball(cx,cy-sz*0.86,R1*0.66,R2*0.66,0,0,sz*0.20); }
}
function drawMouth(x, kind, cx, cy, sz, ink){
  /* ⚠ 입은 **눈보다 훨씬 작고 얇다.** 원본의 입은 지그재그가 아니라
     가늘게 구불거리는 선이고, 한쪽이 내려가 비대칭이다. */
  x.strokeStyle=ink; x.fillStyle=ink; x.lineCap="round"; x.lineJoin="round";
  x.lineWidth=sz*0.16; x.beginPath();
  const w=sz*1.05;
  if(kind==="squig"){ x.moveTo(cx-w/2,cy);
    for(let i=0;i<=24;i++){ const t=i/24;
      x.lineTo(cx-w/2+w*t, cy+Math.sin(t*Math.PI*2.6)*sz*0.16 + t*sz*0.13); } x.stroke(); }
  else if(kind==="flat"){ x.moveTo(cx-w*0.42,cy); x.lineTo(cx+w*0.42,cy); x.stroke(); }
  else if(kind==="smile"){ x.arc(cx,cy-sz*0.26,sz*0.58,Math.PI*0.22,Math.PI*0.78); x.stroke(); }
  else if(kind==="frown"){ x.moveTo(cx-w*0.42,cy-sz*0.10);
    x.quadraticCurveTo(cx, cy+sz*0.20, cx+w*0.42, cy+sz*0.16); x.stroke(); }
  else if(kind==="o"){ x.ellipse(cx,cy,sz*0.28,sz*0.34,0,0,7); x.stroke(); }
  else if(kind==="wave"){ x.moveTo(cx-w/2,cy);
    for(let i=0;i<=24;i++){ const t=i/24; x.lineTo(cx-w/2+w*t, cy+Math.sin(t*Math.PI*2)*sz*0.18); } x.stroke(); }
}

/* ── 오라 한 칸 = 작은 WebGL 캔버스 + 그 위 2D 얼굴 ───────────────────── */
const CELL=150;
function makeCell(elIdx, eye, mouth, noAura){
  const box=document.createElement("div"); box.style.position="relative";
  const gcv=document.createElement("canvas"); gcv.width=gcv.height=CELL*2;
  gcv.style.width=gcv.style.height=CELL+"px"; gcv.style.display="block"; gcv.style.borderRadius="12px";
  gcv.style.background="#d3cfc4";
  const fcv=document.createElement("canvas"); fcv.width=fcv.height=CELL*2;
  fcv.style.cssText="position:absolute;left:0;top:0;width:"+CELL+"px;height:"+CELL+"px;pointer-events:none";
  box.appendChild(gcv); box.appendChild(fcv);
  /* 오라 */
  /* ⚠ 칸마다 WebGL 컨텍스트를 열면 **브라우저 상한(≈16)** 에 걸려 앞쪽 칸이 통째로 빈다
     (v141 에서 같은 걸 겪었다). 눈·입 카탈로그는 얼굴만 보면 되므로 오라를 안 켠다 —
     오라가 필요한 건 조합을 보는 두 섹션뿐이고, 그러면 컨텍스트가 11개로 상한 안에 든다. */
  if(noAura){ const b2=gcv.getContext("2d"); const S2=CELL*2;
    b2.fillStyle="rgba(255,253,246,.55)"; b2.beginPath(); b2.arc(S2/2,S2/2,S2*0.34,0,7); b2.fill(); }
  const gl=noAura?null:gcv.getContext("webgl",{alpha:true,premultipliedAlpha:true,antialias:false});
  if(gl){
    const mk=(t,s)=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);return sh};
    const pg=gl.createProgram(); gl.attachShader(pg,mk(gl.VERTEX_SHADER,VERT));
    gl.attachShader(pg,mk(gl.FRAGMENT_SHADER,FRAG)); gl.linkProgram(pg); gl.useProgram(pg);
    const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const la=gl.getAttribLocation(pg,"a"); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la,2,gl.FLOAT,false,0,0);
    const U=n=>gl.getUniformLocation(pg,n);
    const el=DATA.els[elIdx];
    gl.uniform2f(U("u_res"),CELL*2,CELL*2); gl.uniform2f(U("u_off"),0,0);
    gl.uniform3fv(U("u_c1"),hex2rgb(el.c[0])); gl.uniform3fv(U("u_c2"),hex2rgb(el.c[1])); gl.uniform3fv(U("u_c3"),hex2rgb(el.c[2]));
    gl.uniform3fv(U("u_bg"),hex2rgb("#d3cfc4"));
    gl.uniform1f(U("u_form"),elIdx===0?0:elIdx===1?1:elIdx===2?2:elIdx===3?3:4);
    gl.uniform1f(U("u_grain"),0.034); gl.uniform1f(U("u_speed"),1.0); gl.uniform1f(U("u_lum"),1);
    gl.uniform1f(U("u_orb"),0); gl.uniform1f(U("u_warm"),0); gl.uniform1f(U("u_sink"),0);
    gl.uniform1f(U("u_born"),1); gl.uniform1f(U("u_touchAmt"),0); gl.uniform2f(U("u_touch"),0,0);
    gl.uniform2f(U("u_wisp"),0,0); gl.uniform1f(U("u_ex"),0); gl.uniform1f(U("u_squash"),0);
    gl.uniform1f(U("u_tailK"),0); gl.uniform2fv(U("u_trail"),new Float32Array(12));
    gl.uniform3f(U("u_wt"),0.15,0.35,0); gl.uniform3f(U("u_bite"),0.03,0.05,0.14);
    gl.uniform4f(U("u_rayP"),9,7.5,1.95,0.42); gl.uniform4f(U("u_puffP"),3,0.62,0.38,0.22);
    gl.uniform4f(U("u_flkP"),11,0.36,0.10,0.16); gl.uniform4f(U("u_baseP"),0.30,0.18,0.13,0.42);
    gl.viewport(0,0,CELL*2,CELL*2);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0,0,0,0);
    const T0=performance.now();
    (function loop(){ requestAnimationFrame(loop);
      gl.uniform1f(U("u_t"),(performance.now()-T0)/1000);
      gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES,0,3); })();
  }
  /* 얼굴 — 오라 중심에 얹는다. 잉크는 코어색보다 진하게(읽혀야 한다) */
  const x=fcv.getContext("2d"); const S=CELL*2;
  x.clearRect(0,0,S,S);
  drawEyes(x,S,eye, S*0.5, S*0.455, S*0.135, S*0.072, "#191308");
  drawMouth(x,mouth, S*0.5, S*0.575, S*0.085, "#2a2013");
  return box;
}
function cellWith(parent, elIdx, eye, mouth, nm, ds, noAura){
  const d=document.createElement("div"); d.className="cell";
  d.appendChild(makeCell(elIdx,eye,mouth,noAura));
  d.insertAdjacentHTML("beforeend",'<p class="nm">'+nm+'</p><p class="ds">'+(ds||"")+'</p>');
  parent.appendChild(d);
}
DATA.EYES.forEach(([k,nm,ds])=>cellWith(eyes,2,k,"flat",nm,ds,true));
DATA.MOUTHS.forEach(([k,nm,ds])=>cellWith(mouths,2,"arc",k,nm,ds,true));
DATA.PICK.forEach(([el,e,m,why],i)=>{
  const d=document.createElement("div"); d.className="pick";
  d.appendChild(makeCell(i,e,m));
  d.insertAdjacentHTML("beforeend",'<p class="el">'+el+'</p><p class="why">'+why+'</p>');
  picks.appendChild(d);
});
DATA.MOOD_MOUTH.forEach(([nm,m])=>cellWith(moods,2,"arc",m,nm,"",true));
</script>`;
writeFileSync(resolve(APPDIR, "public/face-mock.html"), HTML);
console.log("생성: app/public/face-mock.html");
