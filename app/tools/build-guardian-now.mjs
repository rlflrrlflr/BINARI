/* ─────────────────────────────────────────────────────────────────────
 * 수호신 디자인 보드 — **지금(현행) 한 판**
 *
 * 기존 `guardian-board.html` 은 git 히스토리 28개 변종을 늘어놓는 계보 보드다.
 * 이건 다른 물건이다 — **오늘 유저가 실제로 보는 것**만 한 장에 담는다.
 *   가로: 판결(펼침) · 곁(응축=행성) · 곁+곁 셋
 *   세로: 오행 다섯
 *
 * ⚠ 셰이더를 손으로 베끼지 않는다. App.jsx 에서 뽑아 쓴다 —
 *   베끼는 순간 보드가 앱보다 예뻐지고, 그때부터 보드는 거짓말을 한다.
 *
 * 실행: cd app && node tools/build-guardian-now.mjs → app/public/guardian-now.html
 * ───────────────────────────────────────────────────────────────────── */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sliceConst } from "./lib/extract.mjs";

const APPDIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(resolve(APPDIR, "src/App.jsx"), "utf8");
const GL_VERT = sliceConst(SRC, "GL_VERT");
const GL_FRAG = sliceConst(SRC, "GL_FRAG");
const EL_COLOR = new Function("return " + SRC.match(/const EL_COLOR = (\{[\s\S]*?\});/)[1])();
const VER = (SRC.match(/const APP_VER = "([^"]+)"/) || [, "?"])[1];
/* TUNE 은 두 렌더러의 단일 진실 원천 — 입자 수도 여기서 읽는다 */
const TUNE = new Function(SRC.slice(SRC.indexOf("const TUNE = {"), SRC.indexOf("};", SRC.indexOf("const TUNE = {")) + 2) + "\nreturn TUNE;")();

const ELS = [
  { key: "화", form: 0, name: "화 — 리본 기둥" },
  { key: "수", form: 1, name: "수 — 물결 층" },
  { key: "목", form: 2, name: "목 — 가지 흐름" },
  { key: "금", form: 3, name: "금 — 용융 금속" },
  { key: "토", form: 4, name: "토 — 난류 융기" },
];
/* 곁 셋 — 생·극·동. 색은 상대 오행 색이라 실제 앱과 같은 규칙으로 만든다 */
const SAENG = { 화: "목", 토: "화", 금: "토", 수: "금", 목: "수" };
const GEUK  = { 화: "수", 금: "화", 목: "금", 토: "목", 수: "토" };
const COLS = [
  { key: "judge", title: "판결 탭", sub: "펼친 형상 · 곁 없음", orb: 0, gy: 0 },
  { key: "orb",   title: "곁 탭",   sub: "응축 — 행성",        orb: 1, gy: 0 },
  { key: "gyeot", title: "곁 탭 + 곁 셋", sub: "생 · 극 · 동", orb: 1, gy: 3 },
];
const DATA = { els: ELS.map((e) => ({ ...e, colors: EL_COLOR[e.key],
  gc: [EL_COLOR[SAENG[e.key]][1], EL_COLOR[GEUK[e.key]][1], EL_COLOR[e.key][1]] })), cols: COLS, ver: VER, n: TUNE.nI };

const HTML = `<!doctype html><meta charset="utf-8">
<title>수호신 — 지금 이렇게 생겼다 (${VER})</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{--line:#241f36;--dim:#8a7f95}
  *{box-sizing:border-box}
  body{margin:0;background:#08070e;color:#e8e6f2;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
  .wrap{max-width:1060px;margin:0 auto;padding:24px 18px 40px}
  h1{font-size:20px;margin:0 0 3px;letter-spacing:-.02em}
  .sub{color:var(--dim);font-size:12px;margin:0 0 16px}
  .sub b{color:#cfc9ff}
  .board{display:grid;grid-template-columns:92px repeat(3,212px);justify-content:center;border:1px solid var(--line);border-radius:14px;overflow:hidden}
  .hd{padding:10px 8px;border-bottom:1px solid var(--line);background:#0d0b16}
  .hd b{display:block;font-size:12.5px}
  .hd span{font-size:10.5px;color:var(--dim)}
  .rl{display:flex;align-items:center;justify-content:center;text-align:center;font-size:11.5px;
     color:#cfc4e2;border-right:1px solid var(--line);background:#0d0b16;padding:6px;word-break:keep-all}
  /* 형상은 캔버스 안에서 약 40%만 차지한다(u_R·0.48). 앱이 CSS 확대율 1.85/1.72 로 키우는 것과
     같은 이유로 여기서도 키운다 — backing 은 그대로라 렌더 비용이 안 는다. */
  .cell{position:relative;height:212px;background:#04040a;overflow:hidden;border-top:1px solid #16121f}
  canvas{position:absolute;left:50%;top:50%;width:212px;height:212px;display:block;
    transform:translate(-50%,-50%) scale(1.42)}
  .fail{display:none;padding:16px;color:#fc9}
  .note{color:var(--dim);font-size:12px;line-height:1.85;margin-top:20px;border-top:1px solid var(--line);padding-top:14px}
  .note code{color:#cfc9ff;font-size:11px}
  .note b{color:#cfc4e2}
</style>
<div class="wrap">
  <h1>수호신 — 지금 이렇게 생겼다</h1>
  <p class="sub"><b>${VER}</b> · 실물 입자 ${DATA.n.toLocaleString()}개 · 셰이더를 <code>App.jsx</code>에서 그대로 뽑아 돌린다(베끼지 않음)</p>
  <div class="board" id="board"></div>
  <div class="fail" id="fail">이 브라우저에서 WebGL을 못 얻었다.</div>
  <div class="note">
    <p><b>세로</b>는 일간 오행 다섯 — 형태 축(<code>u_form</code>)이 여기서 갈린다.
    <b>가로</b>는 같은 수호신의 세 국면이고, 셋 사이에서 <b>형태·색은 안 바뀐다.</b>
    바뀌는 건 <code>u_orb</code>(응축)와 곁 유무뿐 — 탭을 오갈 땐 1.25초에 걸쳐 이어서 넘어간다.</p>
    <p><b>응축(가운데)</b>은 오행이 종(種)을, 명식이 개체를 정한다 — 띠 수·폭풍·대적점 자리·자전축이
    사람마다 다르다. 이 판은 오행마다 같은 값을 써서 <b>오행 차이만</b> 보이게 했다.</p>
    <p><b>곁(오른쪽)</b>은 입자를 새로 안 만든다 — 헤일로 16%에서 떼어 쓴다. 색은 그 사람 오행이고
    생·극·동이 흐름의 방향으로만 갈린다. 숫자·게이지 0개.</p>
    <p style="margin-top:14px">⚠ 칸이 15개라 칸당 입자를 <b>13,000</b>으로 낮췄다(실물은 ${DATA.n.toLocaleString()}).
    형태·색·무늬는 같고 <b>밀도만 옅다</b> — 실물은 이보다 촘촘하다.</p>
    <p style="margin-top:10px">생성: <code>cd app &amp;&amp; node tools/build-guardian-now.mjs</code></p>
  </div>
</div>
<script>
const DATA=${JSON.stringify(DATA)};
const GL_VERT=${JSON.stringify(GL_VERT)}, GL_FRAG=${JSON.stringify(GL_FRAG)};
const hex2rgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
const srnd=s=>{let h=s>>>0;return()=>((h=(h*1664525+1013904223)>>>0)/2**32)};
const F_AL={"화":0.36,"수":0.31,"목":0.32,"금":0.29,"토":0.26}, F_PS={"금":0.82,"토":0.9};

const bd=document.getElementById("board");
bd.insertAdjacentHTML("beforeend",'<div class="hd"></div>'+DATA.cols.map(c=>
  '<div class="hd"><b>'+c.title+'</b><span>'+c.sub+'</span></div>').join(""));
DATA.els.forEach((e,r)=>{
  bd.insertAdjacentHTML("beforeend",'<div class="rl">'+e.name+'</div>'+
    DATA.cols.map((c,i)=>'<div class="cell"><canvas data-r="'+r+'" data-c="'+i+'"></canvas></div>').join(""));
});

function init(){
  const dpr=Math.min(devicePixelRatio||1,2);
  document.querySelectorAll("canvas").forEach(cv=>{
    const el=DATA.els[+cv.dataset.r], col=DATA.cols[+cv.dataset.c];
    const S=Math.round(212*dpr); cv.width=S; cv.height=S;
    const gl=cv.getContext("webgl",{alpha:false,antialias:false,depth:false});
    if(!gl){ document.getElementById("fail").style.display="block"; return; }
    const mk=(t,s)=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh};
    const p=gl.createProgram();
    gl.attachShader(p,mk(gl.VERTEX_SHADER,GL_VERT)); gl.attachShader(p,mk(gl.FRAGMENT_SHADER,GL_FRAG));
    gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    /* 칸이 15개다 — 칸마다 27,000을 쓰면 브라우저가 죽는다. 형태·무늬가 읽히는 선까지만 낮춘다. */
    const n=13000, r0=new Float32Array(n*4), r1=new Float32Array(n*4), rnd=srnd(20260826);
    for(let i=0;i<n*4;i++){ r0[i]=rnd(); r1[i]=rnd(); }
    const buf=(nm,a)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
      gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);const l=gl.getAttribLocation(p,nm);
      if(l>=0){gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,4,gl.FLOAT,false,0,0);}};
    buf("a_r0",r0); buf("a_r1",r1);
    const L={}; ["u_hold","u_beat","u_t","u_form","u_R","u_arms","u_strands","u_twist","u_speed","u_chaos",
      "u_nayF","u_nayA","u_expand","u_agi","u_k","u_ps","u_lum","u_twk","u_psMul","u_focal","u_touch",
      "u_touchVel","u_touchAmt","u_breath","u_trailLive","u_zodiac","u_sink","u_orb","u_gyN","u_gyTake",
      "u_gyLum","u_gyBack","u_gc0","u_gc1","u_gc2","u_gr0","u_gr1","u_gr2","u_ga0","u_ga1","u_ga2",
      "u_c1","u_c2","u_acc","u_wispCol","u_bright","u_alpha"].forEach(k=>L[k]=gl.getUniformLocation(p,k));
    L.u_trail=gl.getUniformLocation(p,"u_trail[0]");
    const f1=(k,v)=>{ if(L[k]) gl.uniform1f(L[k],v) };
    f1("u_R",0.8); f1("u_arms",5); f1("u_strands",5); f1("u_twist",2.1); f1("u_speed",0.30);
    f1("u_chaos",0.9); f1("u_focal",0.55); f1("u_nayF",0.58); f1("u_nayA",0.45);
    f1("u_lum",0.92); f1("u_twk",1); f1("u_beat",3); f1("u_k",1); f1("u_zodiac",4);
    f1("u_hold",0); f1("u_agi",0); f1("u_expand",0); f1("u_trailLive",0); f1("u_touchAmt",0); f1("u_sink",0);
    if(L.u_touchVel) gl.uniform2f(L.u_touchVel,0,0);
    if(L.u_touch) gl.uniform2f(L.u_touch,0,0);
    if(L.u_trail) gl.uniform4fv(L.u_trail,new Float32Array(40));
    const c1=hex2rgb(el.colors[0]), c2=hex2rgb(el.colors[1]);
    gl.uniform3fv(L.u_c1,c1); gl.uniform3fv(L.u_c2,c2); gl.uniform3fv(L.u_acc,hex2rgb(el.colors[2]));
    gl.uniform3fv(L.u_wispCol,[0.5+c1[0]*0.28,0.55+c1[1]*0.26,0.66+c1[2]*0.2]);
    f1("u_form",el.form); f1("u_ps",1.8*dpr*(F_PS[el.key]||1)); f1("u_orb",col.orb);
    f1("u_gyN",col.gy); f1("u_gyTake",col.gy?Math.min(0.72,0.24*col.gy):0); f1("u_gyLum",0.26);   /* 보드 전용 — 칸이 작아 실물값(0.10)이면 안 보인다 */ f1("u_gyBack",0);
    [1,-1,0].forEach((rel,i)=>{ f1("u_gr"+i,rel); f1("u_ga"+i,[0.5,2.6,4.5][i]);
      if(L["u_gc"+i]) gl.uniform3fv(L["u_gc"+i],hex2rgb(el.gc[i])); });
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE);
    gl.clearColor(0.016,0.016,0.031,1); gl.viewport(0,0,S,S);
    const A=(F_AL[el.key]||0.31), T0=performance.now();
    (function loop(){
      requestAnimationFrame(loop);
      const t=(performance.now()-T0)/1000;
      gl.clear(gl.COLOR_BUFFER_BIT);
      const bph=t*Math.PI*2/9; f1("u_breath",Math.sin(bph-0.35*Math.sin(bph)));
      f1("u_t",t); f1("u_bright",1);
      f1("u_psMul",3.6); f1("u_alpha",0.05*A); gl.drawArrays(gl.POINTS,0,n);
      f1("u_psMul",1.8); f1("u_alpha",0.22*A); gl.drawArrays(gl.POINTS,0,n);
      f1("u_psMul",1);   f1("u_alpha",0.72*A); gl.drawArrays(gl.POINTS,0,n);
    })();
  });
}
try{ init(); }catch(e){ document.getElementById("fail").style.display="block"; console.error(e); }
</script>
`;
const OUT=resolve(APPDIR,"public/guardian-now.html");
writeFileSync(OUT,HTML);
console.log("생성:",OUT);
