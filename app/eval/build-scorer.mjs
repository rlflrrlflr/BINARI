// verdicts.json → 블라인드 채점 페이지(scorer.html). 페르소나·오행·자동플래그는 숨김(블라인드).
// 사용: node eval/build-scorer.mjs  (→ eval/scorer.html)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(readFileSync(join(HERE, "verdicts.json"), "utf8"));
// 채점에 필요한 최소 필드만(블라인드): 질문·모드·방향·판결·한줄·정령. 내부 id는 매핑 복원용으로만 보관.
const data = items.map((it, i) => ({
  i, q: it.question, mode: it.mode, dir: it.dir, v: it.verdict,
  sub: it.subline || "", fun: it.funLine || "",
  _k: `${it.persona}|${it.qid}`, // 결과 복원용(채점 중엔 안 보임)
}));

const DATA = JSON.stringify(data);
const html = `<title>비나리 판결 블라인드 채점</title>
<style>
:root{--bg:#0a0812;--bg2:#141021;--panel:#181228;--ink:#e8dff5;--ink2:#b9acce;--ink3:#8a7f9c;
--line:rgba(245,217,139,.16);--gold:#f5d98b;--gold2:#c98f3d;--go:#4dcf9a;--stop:#e0655f;--hold:#8b9be0;
--sans:'Pretendard','Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif;--serif:'Nanum Myeongjo','Noto Serif KR',serif}
*{box-sizing:border-box}
.wrap{max-width:600px;margin:0 auto;padding:28px 18px 120px;color:var(--ink);font-family:var(--sans);line-height:1.65;
background:radial-gradient(120% 70% at 50% -5%,#1a1330,var(--bg2) 46%,var(--bg) 82%);min-height:100vh}
.top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.title{font-family:var(--serif);font-size:17px;color:#fff;font-weight:700}
.count{font-size:12px;color:var(--ink3);font-variant-numeric:tabular-nums}
.bar{height:4px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;margin:8px 0 22px}
.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));transition:width .3s}
.instr{font-size:12.5px;color:var(--ink3);margin:0 0 18px;line-height:1.6}
.card{background:linear-gradient(165deg,#1b1430,var(--panel));border:1px solid var(--line);border-radius:18px;padding:24px 22px;position:relative}
.mode{font-size:10.5px;letter-spacing:.16em;color:var(--gold2);text-transform:uppercase;font-weight:700}
.q{font-size:15px;color:var(--ink2);margin:8px 0 18px;line-height:1.55}
.q::before{content:'“'}.q::after{content:'”'}
.dir{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.1em;padding:3px 10px;border-radius:99px;margin-bottom:12px}
.dir.GO{color:#0a2f22;background:var(--go)}.dir.STOP{color:#2f0f0e;background:var(--stop)}.dir.HOLD{color:#12183a;background:var(--hold)}
.v{font-family:var(--serif);font-size:23px;line-height:1.5;color:#fff;font-weight:700;margin:0;text-wrap:balance}
.more{margin-top:18px;border:none;background:none;color:var(--gold2);font-size:12.5px;cursor:pointer;font-family:inherit;text-decoration:underline dotted;padding:0}
.detail{margin-top:14px;padding-top:14px;border-top:1px solid var(--line);display:none}
.detail.on{display:block}
.detail .lab{font-size:10px;letter-spacing:.14em;color:var(--ink3);text-transform:uppercase;margin:0 0 3px}
.detail .sub{font-size:14px;color:var(--ink);font-style:italic;margin:0 0 12px;line-height:1.55}
.detail .fun{font-size:12.5px;color:var(--ink2);margin:0}
.rate{margin:22px 0 6px}
.rlab{font-size:12.5px;color:var(--ink2);margin-bottom:10px}
.rlab b{color:var(--gold)}
.stars{display:flex;gap:8px}
.star{flex:1;padding:14px 0;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--ink2);
font-size:17px;font-weight:800;cursor:pointer;font-family:inherit;transition:all .12s}
.star:hover{border-color:var(--gold2)}
.star.on{background:linear-gradient(180deg,var(--gold),var(--gold2));color:#241a08;border-color:transparent}
.scale{display:flex;justify-content:space-between;font-size:10px;color:var(--ink3);margin-top:6px}
.note{width:100%;margin-top:14px;background:rgba(10,8,18,.6);border:1px solid var(--line);border-radius:12px;color:var(--ink);
padding:10px 12px;font-size:13px;font-family:inherit;resize:none;line-height:1.5}
.note::placeholder{color:var(--ink3)}
.nav{display:flex;gap:10px;margin-top:20px}
.nav button{flex:1;padding:13px;border-radius:99px;font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;border:1px solid var(--line);background:transparent;color:var(--ink2)}
.nav .next{background:linear-gradient(180deg,var(--gold),var(--gold2));color:#241a08;border:none}
.nav button:disabled{opacity:.4;cursor:default}
.done{text-align:center;padding:30px 10px}
.done h2{font-family:var(--serif);color:var(--gold);font-size:20px}
.export{width:100%;height:120px;margin-top:14px;font-family:ui-monospace,monospace;font-size:11px;background:#0a0812;color:var(--ink2);border:1px solid var(--line);border-radius:10px;padding:10px}
.btnrow{display:flex;gap:10px;margin-top:12px}
.btnrow button{flex:1;padding:12px;border-radius:99px;border:1px solid var(--line);background:transparent;color:var(--gold);font-family:inherit;font-weight:700;cursor:pointer}
.hint{font-size:11px;color:var(--ink3);margin-top:10px;line-height:1.6}
</style>
<div class="wrap" id="app"></div>
<script>
const DATA=${DATA};
const KEY='binari_scores_v1';
let scores=JSON.parse(localStorage.getItem(KEY)||'{}');
// 셔플(고정 시드로 재현): 페르소나 뭉침 방지
let order=DATA.map(d=>d.i); for(let i=order.length-1;i>0;i--){const j=(i*7+3)%(i+1);[order[i],order[j]]=[order[j],order[i]];}
let pos=0, showDetail=false;
const app=document.getElementById('app');
function cur(){return DATA[order[pos]];}
function render(){
  const done=Object.keys(scores).length;
  if(pos>=order.length){return renderDone();}
  const d=cur(); const sc=scores[d._k];
  app.innerHTML=\`
    <div class="top"><span class="title">판결 블라인드 채점</span><span class="count">\${done}/\${DATA.length}</span></div>
    <div class="bar"><i style="width:\${done/DATA.length*100}%"></i></div>
    <p class="instr">이 <b>판결 한 문장</b>이 얼마나 <b>단호하고, 이 고민에 맞고, '오 소름' 하게 꽂히나</b>를 1~5로. 누가 물었는지·어떻게 만들어졌는지는 안 보여줘 — 순수하게 판결만 봐.</p>
    <div class="card">
      <span class="mode">\${d.mode==='ritual'?'동전 의식':'가볍게'}</span>
      <p class="q">\${esc(d.q)}</p>
      <span class="dir \${d.dir}">\${d.dir}</span>
      <p class="v">\${esc(d.v)}</p>
      <button class="more" onclick="tgl()">\${showDetail?'근거 접기':'수호신의 한 줄·정령 보기'}</button>
      <div class="detail \${showDetail?'on':''}">
        <p class="lab">수호신의 한 줄</p><p class="sub">\${esc(d.sub)||'—'}</p>
        <p class="lab">정령</p><p class="fun">\${esc(d.fun)||'—'}</p>
      </div>
      <div class="rate">
        <p class="rlab">이 판결, <b>몇 점?</b></p>
        <div class="stars">\${[1,2,3,4,5].map(n=>\`<button class="star \${sc&&sc.r===n?'on':''}" onclick="setR(\${n})">\${n}</button>\`).join('')}</div>
        <div class="scale"><span>1 · 김샘/헛발</span><span>3 · 무난</span><span>5 · 소름</span></div>
      </div>
      <textarea class="note" rows="2" placeholder="한 줄 메모(선택) — 왜 이 점수인지, 뭐가 걸리는지" oninput="setN(this.value)">\${sc&&sc.n?esc(sc.n):''}</textarea>
    </div>
    <div class="nav">
      <button onclick="go(-1)" \${pos===0?'disabled':''}>← 이전</button>
      <button class="next" onclick="go(1)">\${sc?'다음 →':'건너뛰기 →'}</button>
    </div>
    <p class="hint">진행은 자동 저장돼(이 브라우저). 다 하면 결과를 복사해서 강석우에게 보내면 돼.</p>\`;
}
function renderDone(){
  const out=DATA.map(d=>({key:d._k,q:d.q,dir:d.dir,v:d.v,r:(scores[d._k]||{}).r||null,n:(scores[d._k]||{}).n||''}));
  const avg=(out.filter(o=>o.r).reduce((s,o)=>s+o.r,0)/(out.filter(o=>o.r).length||1)).toFixed(2);
  app.innerHTML=\`<div class="done"><h2>채점 끝 — 평균 \${avg} / 5</h2>
    <p class="instr">아래 결과를 복사해서 보내줘. (평점 없는 항목은 null)</p>
    <textarea class="export" readonly onclick="this.select()">\${esc(JSON.stringify(out))}</textarea>
    <div class="btnrow"><button onclick="copyOut()">결과 복사</button><button onclick="pos=0;render()">처음부터 다시 보기</button></div>
    <p class="hint">평균 3 이하거나 '김샘'이 절반 이상이면 — 그게 가장 정직한 신호(모델 피벗 검토). 4 이상이면 리텐션으로.</p></div>\`;
  window._out=out;
}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function setR(n){const d=cur();scores[d._k]={...(scores[d._k]||{}),r:n};save();setTimeout(()=>go(1),180)}
function setN(v){const d=cur();scores[d._k]={...(scores[d._k]||{}),n:v};save()}
function tgl(){showDetail=!showDetail;render()}
function go(dir){pos+=dir;if(pos<0)pos=0;showDetail=false;render()}
function save(){localStorage.setItem(KEY,JSON.stringify(scores));render()}
function copyOut(){const t=JSON.stringify(window._out);navigator.clipboard&&navigator.clipboard.writeText(t);}
render();
</script>`;
writeFileSync(join(HERE, "scorer.html"), html);
console.log(`OK — scorer.html (${data.length}건 임베드)`);
