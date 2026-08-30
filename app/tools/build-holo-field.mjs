/* ─────────────────────────────────────────────────────────────────────
 * 홀로그램 색장(color field) 시제품 — **입자를 안 쓴다**
 *
 * 창업자 지적(2026-08-27): "뿌리부터 바꿔야지. 홀로그램은 아예 레퍼런스 그대로."
 * v140 은 입자 엔진에 필터를 씌운 것이라 레퍼런스가 아니었다. 레퍼런스의 조건 셋:
 *   ① 밝은 배경  ② 가산 발광이 아니라 **바탕 위에 얹히는 색**  ③ 낱알이 아예 없는 **연속 장**
 * 그래서 파티클을 버리고 **전면 사각형 + 프래그먼트 셰이더**로 다시 짠다.
 *   - 도메인 워핑 fbm = 유기적으로 흘러다니는 결
 *   - 마스크의 가장자리를 노이즈로 흔들어 **원이 아닌 오라 형태**
 *   - 오행은 색이 아니라 **비등방(형태)** 으로도 갈린다 — 화는 솟고, 수는 눕고, 토는 넓다
 *
 * 실행: cd app && node tools/build-holo-field.mjs → app/public/holo-field.html
 * ───────────────────────────────────────────────────────────────────── */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const APPDIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(resolve(APPDIR, "src/App.jsx"), "utf8");
const EL_COLOR = new Function("return " + SRC.match(/const EL_COLOR = (\{[\s\S]*?\});/)[1])();

/* ⚠ 셰이더를 여기 베껴 두면 **보드가 앱과 어긋나 거짓말을 한다**(실제로 v143 에서 두 벌이 갈렸다).
   App.jsx 에서 그대로 뽑고, 형태 값은 aura-spec.json 에서 읽는다 — 진실 원천이 각각 하나씩이다. */
const { sliceConst } = await import("./lib/extract.mjs");
const FIELD_FRAG = sliceConst(SRC, "FIELD_FRAG");
const AURA = JSON.parse(readFileSync(resolve(APPDIR, "src/lib/aura-spec.json"), "utf8"));


const ELS = [
  { key: "화", form: 0 }, { key: "수", form: 1 }, { key: "목", form: 2 },
  { key: "금", form: 3 }, { key: "토", form: 4 },
];
const COLS = [
  { t: "기본 · 판결", orb: 0, w: [0.15, 0.35, 0.0] },
  { t: "쐐기 · 예민함", orb: 0, w: [0.85, 0.15, 0.0], warm: 0.10 },
  { t: "뭉게 · 기분좋음", orb: 0, w: [0.10, 0.90, 0.0], warm: 0.34 },
  { t: "지지직 · 힘든 날", orb: 0, w: [0.14, 0.18, 0.70], warm: -0.24, sink: 0.42, lum: 0.84 },
  { t: "응축 · 곁", orb: 1, w: [0.20, 0.70, 0.05] },
];
/* ⚠ 밝은 바탕용 보정 — **원색(EL_COLOR)은 안 건드린다.** 금의 c2(#e8f2ff)는 거의 흰색이라
   밝은 회색 바탕에서 통째로 사라진다(첫 판에서 금 줄이 안 보였다). 이 화면에서만 한 칸 낮춘다. */
const LIGHT_FIX = { 금: ["#5b76b8", "#8fb0e6", "#1d2436"] };
/* ⚠ 오행 세 색은 **같은 계열**이라 셋을 섞어도 단색으로 보인다(첫 판이 그랬다).
   레퍼런스는 대비되는 색 두세 개가 만난다. 그래서 셋째 색을 **나를 생하는 오행의 밝은 색**으로 바꾼다 —
   임의의 예쁜 색이 아니라 근거가 있는 색이다(목생화·화생토…). */
const SAENG = { 화: "목", 토: "화", 금: "토", 수: "금", 목: "수" };
const pal = (k) => {
  const base = LIGHT_FIX[k] || EL_COLOR[k];
  const acc = (LIGHT_FIX[SAENG[k]] || EL_COLOR[SAENG[k]])[1];
  return [base[0], base[1], acc];
};
const DATA = { els: ELS.map(e => ({ ...e, c: pal(e.key) })), cols: COLS, aura: AURA };

const HTML = `<!doctype html><meta charset="utf-8">
<title>홀로그램 색장 — 입자 없음</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;background:#d9d5ca;color:#2a2419;
    font:13px/1.7 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
  .wrap{max-width:1120px;margin:0 auto;padding:26px 18px 60px}
  h1{font-size:19px;margin:0 0 4px;letter-spacing:-.02em}
  .lead{color:#6b6678;font-size:12px;margin:0 0 18px}
  .lead b{color:#2a2733}
  .board{display:grid;grid-template-columns:auto auto;gap:8px;align-items:start;justify-content:start}
  .hd{font-size:11.5px;color:#6b6678;text-align:center;padding-bottom:4px}
  .rl{font-size:12px;color:#4a4557;text-align:center}
  .cell{position:relative;border-radius:14px;overflow:hidden;background:#d3cfc4}
  .hd span{display:block;text-align:center}
  canvas{display:block}
  .note{color:#6b6678;font-size:12px;line-height:1.85;margin-top:22px;border-top:1px solid #cfcdd8;padding-top:14px}
  .note b{color:#2a2733} .note code{font-size:11px;color:#3d3a4d}
</style>
<div class="wrap">
  <h1>오라 — 불꽃의 일렁임</h1>
  <p class="lead">전면 사각형 하나 + 프래그먼트 셰이더. <b>경계선·림·표면 무늬가 없다</b> —
  그 셋이 세포막과 세포질을 만든다. 대신 <b>중심이 저마다 어긋난 색 층 다섯</b>을 <b>over 합성</b>으로 얹고,
  아래는 뭉치고 위로 흐르는 <b>불꽃의 혀</b>를 준다. 값은 전부 <code>src/lib/aura-spec.json</code> 에 있다.</p>
  <div class="board" id="b"></div>
  <div class="note">
    <p><b>오행은 색만이 아니라 형태로 갈린다</b> — 화는 가장 높이 솟고(1.26×0.76), 수는 낮게 눕고(0.94×1.04),
    목은 위로 뻗고, 금은 고르고, 토는 넓고 낮다. <b>응축(곁)하면 일렁임이 42%로 잦아들고 다섯이 다 둥글어진다</b> —
    그게 판결→곁 전이의 시각적 의미다.</p>
    <p><b>빛의 형태가 오늘을 말한다</b> — 쐐기(예민함)·뭉게(기분 좋음)·지지직(힘든 날). 셋 다 <b>발광층만</b> 건드리고
    몸의 반경은 감정과 무관하게 확정된다. 오늘 상태(오늘 일진 × 내 일간의 십성) 10종마다 셋의 가중치가 정해져 있다.</p>
    <p><b>왜 세포로 보였나</b> — ①경계선·림·표면결(v146 에서 제거) ②완전한 동심원 ③짧은 색 여정
    ④가중평균 합성 ⑤칸을 덮는 크기. 다섯을 다 고치고 나서야 불꽃이 됐다.</p>
    <p style="margin-top:12px">생성: <code>cd app &amp;&amp; node tools/build-holo-field.mjs</code></p>
  </div>
</div>
<script>
const DATA=${JSON.stringify(DATA)};
const FRAG=${JSON.stringify(FIELD_FRAG)};
const VERT="attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
const hex2rgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
const BG=hex2rgb("#d9d5ca");
const CELL=190, NC=DATA.cols.length, NR=DATA.els.length;
b.insertAdjacentHTML("beforeend",'<div class="hd"></div><div style="display:flex">'
  +DATA.cols.map(c=>'<div class="hd" style="width:'+CELL+'px">'+c.t+'</div>').join("")+'</div>');
b.insertAdjacentHTML("beforeend",'<div style="display:flex;flex-direction:column">'
  +DATA.els.map(e=>'<div class="rl" style="height:'+CELL+'px;display:grid;place-items:center">'+e.key+'</div>').join("")+'</div>'
  +'<div class="cell" style="width:'+(NC*CELL)+'px;height:'+(NR*CELL)+'px"><canvas id="one" style="width:'+(NC*CELL)+'px;height:'+(NR*CELL)+'px"></canvas></div>');

/* ⚠ 칸마다 컨텍스트를 열면 **브라우저 상한(≈16)** 에 걸린다 — 20칸을 열었더니 첫 줄이 통째로
   렌더 실패했다. 캔버스 하나에 scissor 로 칸을 나눈다(보드 생성기가 쓰는 것과 같은 수법). */
const cv=document.getElementById("one"), dpr=Math.min(devicePixelRatio||1,2);
const W=NC*CELL*dpr, H=NR*CELL*dpr; cv.width=W; cv.height=H;
const gl=cv.getContext("webgl",{alpha:true,premultipliedAlpha:true,antialias:false});
const mk=(t,s)=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh};
const pg=gl.createProgram();
gl.attachShader(pg,mk(gl.VERTEX_SHADER,VERT)); gl.attachShader(pg,mk(gl.FRAGMENT_SHADER,FRAG));
gl.linkProgram(pg); if(!gl.getProgramParameter(pg,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pg));
gl.useProgram(pg);
const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const la=gl.getAttribLocation(pg,"a"); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la,2,gl.FLOAT,false,0,0);
const U=n=>gl.getUniformLocation(pg,n);
gl.uniform3fv(U("u_bg"),BG); gl.uniform1f(U("u_speed"),1.2);
const AB=DATA.aura.base, AR=DATA.aura.forms.ray, AP=DATA.aura.forms.puff, AF=DATA.aura.forms.flicker;
gl.uniform1f(U("u_grain"),AB.grain);
gl.uniform3f(U("u_bite"),AR.edgeBite,AP.edgeBite,AF.edgeBite);
gl.uniform4f(U("u_rayP"),AR.spokes,AR.sharp,AR.reach,AR.amp);
gl.uniform4f(U("u_puffP"),AP.lobes,AP.freq,AP.amp,AP.drift);
gl.uniform4f(U("u_flkP"),AF.rate,AF.depth,AF.dropout,AF.amp);
gl.uniform4f(U("u_baseP"),AB.edgeSoft["펼침"],AB.edgeSoft["응축"],AB.rimWidth,AB.rimLift);
/* ⚠ v150 에서 셰이더에 u_born·u_touch 가 생겼다. 보드가 이 값을 안 주면 born=0 이라
   조각이 흩어진 채 거의 안 보인다 — 보드는 **다 태어난 상태**를 보여야 한다. */
gl.uniform1f(U("u_born"),1); gl.uniform1f(U("u_touchAmt"),0); gl.uniform2f(U("u_touch"),0,0);
/* v158 위습 — 보드는 정지 상태를 보여주므로 제자리·들뜸 0·꼬리도 제자리 */
gl.uniform2f(U("u_wisp"),0,0); gl.uniform1f(U("u_ex"),0); gl.uniform1f(U("u_squash"),0); gl.uniform1f(U("u_tailK"),0); gl.uniform3f(U("u_look"),0,0,0); gl.uniform1f(U("u_fold"),0);
gl.uniform2fv(U("u_trail"),new Float32Array(12));
gl.uniform2f(U("u_res"),CELL*dpr,CELL*dpr);
gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0,0,0,0);
const T0=performance.now(); let stop=false; setTimeout(()=>{window.__frozen=true;},2500); window.__stop=()=>{stop=true};
(function loop(){
  if(!stop) requestAnimationFrame(loop);
  const t=(performance.now()-T0)/1000;
  gl.uniform1f(U("u_t"),t);
  gl.enable(gl.SCISSOR_TEST); gl.disable(gl.SCISSOR_TEST); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.SCISSOR_TEST);
  for(let r=0;r<NR;r++) for(let c=0;c<NC;c++){
    const el=DATA.els[r], col=DATA.cols[c];
    const x=c*CELL*dpr, y=(NR-1-r)*CELL*dpr, sz=CELL*dpr;
    gl.viewport(x,y,sz,sz); gl.scissor(x,y,sz,sz); gl.uniform2f(U("u_off"),x,y);
    gl.uniform3fv(U("u_c1"),hex2rgb(el.c[0])); gl.uniform3fv(U("u_c2"),hex2rgb(el.c[1])); gl.uniform3fv(U("u_c3"),hex2rgb(el.c[2]));
    gl.uniform1f(U("u_form"),el.form); gl.uniform1f(U("u_orb"),col.orb||0);
    gl.uniform1f(U("u_warm"),col.warm||0); gl.uniform1f(U("u_sink"),col.sink||0);
    gl.uniform1f(U("u_lum"),col.lum==null?1:col.lum);
    gl.uniform3f(U("u_wt"),col.w[0],col.w[1],col.w[2]);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
})();
</script>`;
writeFileSync(resolve(APPDIR,"public/holo-field.html"), HTML);
console.log("생성: app/public/holo-field.html");
