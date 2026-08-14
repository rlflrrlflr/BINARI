const SUR={read:"강",st:9};
const GIL=new Set([1,3,5,6,7,8,11,13,15,16,17,18,21,23,24,25,29,31,32,33,35,37,39,41,45,47,48,52,57,61,63,65,67,68,81]);
const SANG={목:"화",화:"토",토:"금",금:"수",수:"목"};
const HAE={ㄱ:"목",ㅋ:"목",ㄴ:"화",ㄷ:"화",ㄹ:"화",ㅌ:"화",ㅁ:"토",ㅂ:"토",ㅍ:"토",ㅅ:"금",ㅈ:"금",ㅊ:"금",ㅇ:"수",ㅎ:"수"};
const UNH={ㄱ:"목",ㅋ:"목",ㄴ:"화",ㄷ:"화",ㄹ:"화",ㅌ:"화",ㅁ:"수",ㅂ:"수",ㅍ:"수",ㅅ:"금",ㅈ:"금",ㅊ:"금",ㅇ:"토",ㅎ:"토"};
const CHO=["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const DBL={ㄲ:"ㄱ",ㄸ:"ㄷ",ㅃ:"ㅂ",ㅆ:"ㅅ",ㅉ:"ㅈ"};
const cho=k=>{const c=CHO[Math.floor((k.charCodeAt(0)-0xAC00)/588)];return DBL[c]||c;};
const chain=e=>{let ok=0,t=0;for(let i=0;i<e.length-1;i++){t++;if(SANG[e[i]]===e[i+1]||e[i]===e[i+1])ok++;}return{ok,t};};

const D={
 태:[["泰",9,"수","클 태"],["兌",7,"금","기쁠·못 태"],["珆",10,"금","옥무늬 태"]],
 리:[["理",12,"금","다스릴 리"],["浬",11,"수","해리 리"],["利",7,"금","이로울 리"]],
 라:[["羅",19,"목","벌일 라"]],
 노:[["瑙",14,"금","마노 노"],["潞",17,"수","강이름 로"]],
 다:[["茶",12,"목","차 다"]],
 오:[["澳",16,"수","물굽이 오"],["珸",12,"금","옥돌 오"]],
 온:[["瑥",15,"금","사람이름 온"],["溫",13,"수","따뜻할 온"]],
 린:[["潾",16,"수","맑을 린"],["璘",17,"금","옥빛 린"]],
 안:[["安",6,"토","편안 안"],["岸",8,"토","언덕 안"]],
 하:[["河",9,"수","물 하"],["賀",12,"금","하례할 하"]],
 찬:[["璨",18,"금","옥빛 찬"],["澯",17,"수","맑을 찬"]],
 후:[["珝",11,"금","옥이름 후"]],
 민:[["珉",10,"금","옥돌 민"],["潣",16,"수","물흐를 민"]],
 진:[["珍",10,"금","보배 진"],["鎭",18,"금","진압할 진"],["津",9,"수","나루 진"],["瑨",15,"금","옥돌 진"]],
 윤:[["鈗",12,"금","창 윤"],["玧",9,"금","붉은구슬 윤"],["潤",16,"수","윤택할 윤"]],
 재:[["渽",13,"수","맑을 재"]],
 한:[["韓",17,"금","나라 한"],["漢",15,"수","한수 한"]],
 준:[["濬",18,"수","깊을 준"],["浚",11,"수","깊을 준"]],
 주:[["珠",11,"금","구슬 주"],["澍",15,"수","단비 주"]],
 아:[["我",7,"금","나 아"],["雅",12,"화","우아할 아"]],
 이:[["珥",11,"금","귀고리 이"],["伊",6,"화","저 이"]],
 호:[["皓",12,"금","밝을 호"],["澔",16,"수","넓을 호"]],
};
const NAMES=("태오 태린 태온 태하 태찬 태후 태민 태진 태윤 태재 태주 태한 태준 태이 태호 "+
 "리오 리온 리안 리하 리찬 리후 리민 리진 리윤 리재 리주 리한 리린 "+
 "노아 노진 노윤 노하 다온 다인 다찬 라온 라준 라이 "+
 "도린").split(/\s+/);
// 로마자 · 국제 통용성 메모
const ROM={태오:"Tae-o / Theo",리오:"Ri-o / Leo·Rio",태린:"Tae-rin",태온:"Tae-on",리온:"Ri-on / Leon",
 리안:"Ri-an / Lian·Ian",노아:"No-a / Noah",태하:"Tae-ha",태찬:"Tae-chan",라온:"Ra-on / Raon",다온:"Da-on / Daon"};
function best(n){
  const [r1,r2]=[n[0],n[1]];const L1=D[r1]||[],L2=D[r2]||[];let bst=null;
  for(const [c1,a,e1,m1] of L1) for(const [c2,b,e2,m2] of L2){
    const els=[e1,e2]; if(!els.includes("금")) continue;
    const s=SUR.st, S1=35*els.filter(e=>e==="금"||e==="수").length/2;
    const reads=[SUR.read,r1,r2];
    const ph=M=>{const e=reads.map(x=>M[cho(x)]);const{ok,t}=chain(e);return{p:12.5*ok/t,ok,s:e.join("-")};};
    const H=ph(HAE),U=ph(UNH),S2=H.p+U.p;
    const four={원:a+b,형:s+a,이:s+b,정:s+a+b};const nz=v=>v>81?v-80:v;
    const gil=Object.values(four).filter(v=>GIL.has(nz(v))).length,S3=20*gil/4;
    const yy=[s,a,b].map(v=>v%2?"양":"음"),S4=yy.every(v=>v===yy[0])?0:10;
    const EL5=["수","목","목","화","화","토","토","금","금","수"];
    const tri=[s,s+a,a+b].map(v=>EL5[v%10]),T=chain(tri),S5=10*T.ok/T.t;
    const tot=Math.round(S1+S2+S3+S4+S5);
    const r={tot,name:"강"+n,hj:c1+c2,mean:m1+"·"+m2,S1,S2:+S2.toFixed(1),S3,S4,S5,gil,Hok:H.ok,Uok:U.ok,yy:yy.join(""),tri:tri.join("-"),st:[s,a,b],four,jaw:els.join("+")};
    if(!bst||r.tot>bst.tot)bst=r;
  }
  return bst;
}
const seen=new Set();
for(const r of NAMES.filter(x=>{if(seen.has(x))return 0;seen.add(x);return 1;}).map(best).filter(Boolean).sort((a,b)=>b.tot-a.tot))
 console.log(String(r.tot).padStart(3),r.name,r.hj,`(${r.mean})`,(ROM[r.name.slice(1)]||"").padEnd(18),
  `획${r.st.join("-")} | 자원${r.S1}[${r.jaw}] 발음${r.S2}(해${r.Hok}/2 운${r.Uok}/2) 수리${r.S3}(${r.gil}/4) 음양${r.S4}${r.yy} 삼원${r.S5}${r.tri} | 사격${JSON.stringify(r.four)}`);
