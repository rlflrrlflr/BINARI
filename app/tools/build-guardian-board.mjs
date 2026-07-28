#!/usr/bin/env node
/* 수호신 디자인 버전 보드 생성기
 *
 * 목적: "버전별로 수호신 디자인이 어떻게 바뀌었는지" 를 한 화면에서 본다.
 *   축1 오행(화·수·목·금·토) = 형태
 *   축2 모드 A/B/C          = A 평상시 · B 터치(명상) · C 판결 반응
 *   축3 버전                = 2D 1세대(v15~v17) → 2D 2세대(v28~v31) → WebGL(v31~현재)
 *
 * 렌더 코드는 손으로 베끼지 않고 원본에서 그대로 뽑아 쓴다(드리프트 방지):
 *   - GL_VERT / GL_FRAG           ← app/src/App.jsx
 *   - place() (Canvas2D 형태 함수) ← 09_구버전/*.jsx, 03_비주얼프로토타입/*.jsx, app/src/App.jsx
 *
 * 출력: app/public/guardian-board.html (자립형 — 배포 시 /guardian-board.html)
 * 실행: node app/tools/build-guardian-board.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP = readFileSync(join(ROOT, "app/src/App.jsx"), "utf8");

/* ── 원본에서 그대로 뽑기 ───────────────────────────────────────── */
function sliceConst(src, name) {
  const head = `const ${name} = \``;
  const i = src.indexOf(head);
  if (i < 0) throw new Error(`${name} 를 못 찾음 — App.jsx 구조가 바뀌었다`);
  const s = i + head.length;
  const e = src.indexOf("`;", s);
  if (e < 0) throw new Error(`${name} 의 끝을 못 찾음`);
  const body = src.slice(s, e);
  if (body.includes("${")) throw new Error(`${name} 에 템플릿 보간이 있다 — 그대로 옮길 수 없음`);
  return body;
}
function slicePlace(src) {
  const i = src.indexOf("const place = (p) => {");
  if (i < 0) throw new Error("place() 를 못 찾음");
  const e = src.indexOf("\n    };", i);
  if (e < 0) throw new Error("place() 의 끝을 못 찾음");
  return src.slice(i, e + "\n    };".length).replace(/^\s*const place = \(p\) => \{/, "").replace(/\};\s*$/, "");
}

const GL_VERT = sliceConst(APP, "GL_VERT");
const GL_FRAG = sliceConst(APP, "GL_FRAG");

/* 2D 형태 계보 — 파일에서 place() 본문을 뽑아 같은 소스는 한 세대로 합친다 */
const TWO_D_FILES = [
  ["v15", "09_구버전/비나리_비주얼프로토타입_MVP_v15.jsx"],
  ["v16", "09_구버전/비나리_비주얼프로토타입_MVP_v16.jsx"],
  ["v17", "09_구버전/비나리_비주얼프로토타입_MVP_v17.jsx"],
  ["v28", "09_구버전/비나리_비주얼프로토타입_MVP_v28.jsx"],
  ["v29", "09_구버전/비나리_비주얼프로토타입_MVP_v29.jsx"],
  ["v30", "09_구버전/비나리_비주얼프로토타입_MVP_v30.jsx"],
  ["v31", "03_비주얼프로토타입/비나리_비주얼프로토타입_MVP_v31.jsx"],
  ["현재(2D 폴백)", "app/src/App.jsx"],
];
const gens = [];
for (const [ver, rel] of TWO_D_FILES) {
  const body = slicePlace(readFileSync(join(ROOT, rel), "utf8"));
  const hit = gens.find(g => g.body === body);
  if (hit) hit.versions.push(ver);
  else gens.push({ body, versions: [ver] });
}

/* ── 세대 라벨(코드에서 읽어낸 사실 + 변경이력의 '왜') ───────────── */
const GEN_META = [
  {
    title: "2D 1세대",
    note: "오행 5형태의 원형. 팔 수(라이프패스) 반영은 목·금뿐 — 화는 기둥 하나, 수는 판 하나, 토는 그냥 구.",
    detail: "v17에서 입자를 1,150~1,600 → 3,200~4,200으로 올리고 유속장 + 잔상(destination-out)을 도입. '제자리 진동 = 죽은 먼지' 지적의 첫 응답.",
  },
  {
    title: "2D 2세대",
    note: "v27에서 팔 수를 5형태 전부에 배선 — 불꽃 혀·물결 층·흙 봉우리 개수가 갈린다. 금은 v18에서 '폭발 → 경계 안에서 맴도는 벼려진 빛'으로 교체.",
    detail: "v28에서 납음=움직임 결, 촐킨=코어 문양, 나크샤트라=강조색, 대운=아우라가 붙어 같은 오행도 사람마다 갈라짐. 현재도 WebGL 실패 시 이 코드로 폴백한다.",
  },
];

/* ── 오행 ───────────────────────────────────────────────────────── */
const ELEMENTS = [
  { key: "화", form: 0, colors: ["#e04d2a", "#ffb36b"], acc: "#ffd9a0",
    now: "꼬여 오르는 리본 기둥 — 가닥이 비틀리며 위로 솟는다(fdir ↑, 기울기 0.42rad).",
    hist: "1세대: 아래→위 솟는 기둥 하나 · v27: 팔 수만큼 불꽃 혀로 분화 · v31(GL): 꼬임(촐킨)을 가진 리본 기둥으로 재작성." },
  { key: "수", form: 1, colors: ["#2a6bd4", "#7fd4ff"], acc: "#bfe8ff",
    now: "흐르는 물결 층 — 층마다 방향이 갈리며 좌우로 흐른다(fdir →, 기울기 0.9rad로 가장 눕는다).",
    hist: "1세대: 좌우 물결 판 하나 · v27: 팔 수 = 층 수 · v31(GL): 층마다 흐름 방향이 반대로 갈림." },
  { key: "목", form: 2, colors: ["#2ab06b", "#a8f0c0"], acc: "#d6ffe6",
    now: "뻗어 오르는 가지 흐름 — 갈래마다 위로 자라며 옆으로 퍼진다.",
    hist: "1세대부터 팔 수 = 갈래 수(가장 변화가 적은 형태) · v31(GL): 가지 안에서 입자가 계속 흘러 올라가는 흐름으로." },
  { key: "금", form: 3, colors: ["#8fb0e6", "#e8f2ff"], acc: "#ffffff",
    now: "흘러내리는 용융 금속 — 가닥이 굽이쳐 아래로 수렴, step 광택 반짝임(fdir ↓).",
    hist: "1세대: 방사형 빛살(폭발) · v18: containment — 경계 안에서 맴도는 '벼려진 빛' · v22: 무채색 수렴을 막으려 강철빛 재벼림 · v31(GL): 궤도 빛줄기(은하 원반) · v36: 원반은 방향성 흐름의 수혜가 없어 '안 살아있다' → 용융 금속으로 교체." },
  { key: "토", form: 4, colors: ["#c98f3d", "#ffe9ad"], acc: "#fff3cc",
    now: "중심 없는 난류 융기 — 화면면 소용돌이가 가산되는 유일한 형태.",
    hist: "1세대: 조밀한 구 · v27: 팔 수 = 봉우리 수(부푼 덩어리) · v31(GL): 구심점을 버리고 난류 융기로." },
];

/* ── 모드 A/B/C ─────────────────────────────────────────────────── */
const MODES = [
  { key: "A", title: "A · 평상시", sub: "대기 · 질문 화면",
    what: "터치 없음(u_touchAmt 0). 오행 형태 그대로 호흡(9초 비대칭)·부유·차등 공전.",
    hist: [
      ["v31", "WebGL 전환 — GPU 입자 2.7만~3.4만, 정점 셰이더가 위치를 시간 함수로 계산"],
      ["v32", "3D 원근 투사 — 얇은 부피 + 형태별 기울기(납작함 해소)"],
      ["v33", "내부 난류 churn — 강체로 굳어 '두둥실 떠다님' 해소"],
      ["v35", "등방성 노이즈 → 코히런트 컬노이즈(지직거림 → 결이 뭉쳐 흐름)"],
      ["v42", "캔버스 110vw/57vh로 확대 + 셰이더 스케일 0.48 — 수호신 크기는 유지, 주변 어둠 2배"],
      ["v64", "알알이 위계 — 13% 별 / 87% 먼지, 성간 먼지 헤일로 16%, 노출 예산(F_AL)로 백화 해소"],
      ["v67", "기본 렌더러를 GL 계열로 고정(사용자가 기억·선호한 모션)"],
      ["v93", "겉결 — sim 엔진의 소프트 헤일로 패스를 GL에 도입(3패스 → 4패스)"],
      ["v94", "심장박동(럽-덥 ~54bpm) 추가"],
      ["v95", "박동을 A에서 제거 — A는 호흡만, 박동은 B로 이관"],
    ] },
  { key: "B", title: "B · 터치(명상)", sub: "누르고 끌 때",
    what: "손끝으로 입자가 파도처럼 모여(u_touchAmt) 중심에서 바깥으로 발산. 끌면 궤적 링버퍼 10점이 와류를 만든다.",
    hist: [
      ["v44", "터치 인터랙션 신설 — 만지면 그 지점으로 모이며 밝아짐"],
      ["v61", "터치 = 형태 완전 해체 → 점 붕괴 + 유입 모션 + 궤적 트레일"],
      ["v63", "나선 은하 소용돌이 정련 — 3갈래 나선팔 + 코어 구멍 메움"],
      ["v66", "명상 모드 대개편 — 은하 무드·알알이 재집결·궤적 와류·띠 정령"],
      ["v67", "나선 문양 회전 → 중앙 발광 방사 발산"],
      ["v70", "큰 방사 → 작은 불씨 코어 + 시계방향 불꽃 스파크"],
      ["v72", "방사 더 좁게 + 궤적 족적 링버퍼(파파파박 스파크)"],
      ["v73", "도착한 뒤에야 방사 시작 + 족적 빠른 추적"],
      ["v80", "'홀림' — 심장박동 코어 + 탑돌이 행렬 + 여운"],
      ["v81", "'귀의의 물레' 백지 재설계(4관점 패널 우승안)"],
      ["v82~v83", "코어를 입자구름으로 확대(손가락에 안 가림) + 드래그 중 손끝 블랙홀 제거"],
      ["v84~v92", "응축 → 시계방향 재설계, 이후 v73/v77/v79/v80 사이를 오가며 되돌림 — 최종 채택은 GL(v67 계열) 모션"],
      ["v95", "박동을 중심 → 바깥으로 번지는 파동으로(위상 지연 bph)"],
      ["v96", "파면이 시간을 두고 밀려나감(u_hold 1.35s) + 경계 불명확(rvar·lobe)"],
      ["v97", "퍼지는 범위 절반 — 최대 반경 0.505 → 0.252"],
    ] },
  { key: "C", title: "C · 판결 반응", sub: "판결이 뜰 때 · 카드 정독 중",
    what: "GO=솟구쳐 펼치며 밝아짐 / STOP=수축·어두워짐 / HOLD=잔잔한 맥동. 카드가 뜨면 사실상 정지(restRef), 화면에 따라 해체(투명·확대)된다.",
    hist: [
      ["v23", "의식 중 요동 — 효가 낙착할 때마다 흔들림, 6효째 클라이맥스"],
      ["v28", "판결 방향에 수호신이 연기 — GO/STOP/HOLD 3종 반응(1.8초 엔벨로프)"],
      ["v29", "판결 대기·정독 중 프레임 솎기(~21fps) — 메인스레드 양보"],
      ["v30", "카드가 뜨면 사실상 정지(restRef 0/46/300ms) — 정독 중 스크롤·클릭 회복"],
      ["v71", "질문 화면의 dissolved(투명+블러+residue)를 폐기하고 A모드 유지로 복원 — 질문 상태에서 수호신이 사라지던 버그"],
    ] },
];

/* ── 전체 타임라인(변경이력.md · 커밋 로그에서 추림) ─────────────── */
const TIMELINE = [
  ["v15~v17", "2026-07-10", "2D", "Canvas2D 유속장 리라이트 — 입자 3~4배 증량, 잔상, 오행 형태 스프링 복원"],
  ["v18", "2026-07-15", "2D", "금 containment(폭발 → 존재) · 코어 백색 포화 제거"],
  ["v22", "2026-07-16", "2D", "금 강철빛 재벼림(무채색 수렴 차단) · 촐킨/납음/나크샤트라 지표 신설"],
  ["v23", "2026-07-17", "2D", "팔 수 3~7 상한 + 금 리드암 비대칭(문양 → 존재) · 의식 중 요동"],
  ["v27", "2026-07-20", "2D", "팔 수를 5형태 전부에 · E/I=크기 · T/F=입자 질감 · 정령 위성 제거"],
  ["v28", "2026-07-20", "2D", "납음=결 · 촐킨=코어 문양 · 나크샤트라=강조색 · 대운=아우라 + 판결 반응 3종"],
  ["v31", "2026-07-21", "GL", "WebGL 전환 — 무구심점 5형태(화 리본기둥/수 물결층/목 가지흐름/금 궤도빛줄기/토 난류융기)"],
  ["v32", "2026-07-21", "GL", "3D 원근 투사 — 공간감"],
  ["v33·v35", "2026-07-21", "GL", "내부 난류 → 코히런트 컬노이즈(살아있음)"],
  ["v36", "2026-07-21", "GL", "금: 은하 원반 → 흘러내리는 용융 금속"],
  ["v42", "2026-07-22", "GL", "캔버스 확대 + 셰이더 스케일 축소 — '통에 갇힌 느낌' 해소"],
  ["v44", "2026-07-22", "GL", "터치 인터랙션 신설(B 모드의 시작)"],
  ["v61~v66", "2026-07-23~24", "GL", "터치 = 해체·점 붕괴 → 나선 은하 → 명상 모드 대개편(알알이·궤적 와류·띠 정령)"],
  ["v67~v73", "2026-07-24", "GL/sim", "B = 중앙 발광 방사 · 상태보존 FBO 엔진(sim) · 정령 위스프 제거 · 족적 스파크"],
  ["v80~v83", "2026-07-25", "sim", "'홀림' → '귀의의 물레' 백지 재설계 → 코어 입자구름화 · 손끝 블랙홀 제거"],
  ["v84~v92", "2026-07-25~26", "sim", "응축→시계방향 재설계와 롤백의 반복 — 결국 GL(v67 계열) 모션으로 회귀"],
  ["v93", "2026-07-26", "GL", "A 겉결 — sim의 소프트 헤일로 패스를 GL에 이식"],
  ["v94~v97", "2026-07-26", "GL", "심장박동 → A에서 제거·B는 파동으로 → 파면 확장·경계 불명확 → 범위 절반"],
];

/* ── HTML ───────────────────────────────────────────────────────── */
const DATA = {
  elements: ELEMENTS,
  modes: MODES.map(m => ({ key: m.key, title: m.title, sub: m.sub, what: m.what, hist: m.hist })),
  gens: gens.map((g, i) => ({ versions: g.versions, ...(GEN_META[i] || { title: `2D ${i + 1}세대`, note: "", detail: "" }) })),
  timeline: TIMELINE,
};

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex" />
<title>비나리 수호신 — 오행 × 모드 × 버전 보드</title>
<style>
:root{--bg:#07070c;--fg:#ece7dc;--dim:#8d8878;--gold:#f5d98b;--line:#1e1e2a}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(120% 90% at 50% 0%,#11111c,#05050a 70%);color:var(--fg);
  font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif;
  word-break:keep-all;line-height:1.65}
.wrap{max-width:1180px;margin:0 auto;padding:40px 20px 90px}
h1{font-size:26px;margin:0 0 6px;letter-spacing:-.02em}
h2{font-size:19px;margin:56px 0 6px;color:var(--gold);letter-spacing:-.01em}
.lead{color:var(--dim);font-size:14px;margin:0 0 8px}
.note{color:var(--dim);font-size:12.5px;margin:0 0 18px}
code{font-size:12px;color:#b9c6e0;background:#12121c;padding:1px 5px;border-radius:4px}

/* 섹션 1 — WebGL 그리드 */
.glwrap{position:relative;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#04040a}
#gl{display:block;width:100%;height:auto}
.overlay{position:absolute;inset:0;display:grid;pointer-events:none}
.cell{border-right:1px solid rgba(255,255,255,.045);border-bottom:1px solid rgba(255,255,255,.045);
  position:relative;padding:8px 10px}
.cell:nth-child(3n){border-right:0}
.cell .tag{font-size:11px;color:var(--dim);letter-spacing:.02em}
.cell .el{position:absolute;left:10px;bottom:8px;font-size:22px;color:rgba(245,217,139,.5);font-weight:600}
.colhead{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin:0 0 8px}
.colhead div{padding:0 4px}
.colhead b{display:block;font-size:14px;color:var(--gold)}
.colhead span{font-size:12px;color:var(--dim)}
.rowlegend{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:16px}
.rowlegend div{border-top:1px solid var(--line);padding-top:10px}
.rowlegend b{font-size:15px}
.rowlegend p{font-size:12px;color:var(--dim);margin:4px 0 0}

/* 섹션 2 — 2D 계보 */
.gen{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:14px}
.gencard{border:1px solid var(--line);border-radius:14px;padding:16px;background:#0a0a12}
.gencard h3{margin:0 0 2px;font-size:15px}
.gencard .vers{font-size:12px;color:var(--gold);margin-bottom:8px}
.gencard p{font-size:12.5px;color:var(--dim);margin:0 0 10px}
.strip{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.strip figure{margin:0;text-align:center}
.strip canvas{width:100%;aspect-ratio:1;background:#05050b;border-radius:8px;display:block}
.strip figcaption{font-size:11px;color:var(--dim);margin-top:4px}

/* 모드 이력 */
.modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:14px}
.modecard{border:1px solid var(--line);border-radius:14px;padding:16px;background:#0a0a12}
.modecard h3{margin:0 0 4px;font-size:15px;color:var(--gold)}
.modecard>p{font-size:12.5px;color:var(--dim);margin:0 0 10px}
.modecard ol{margin:0;padding-left:0;list-style:none}
.modecard li{display:grid;grid-template-columns:64px 1fr;gap:8px;font-size:12.5px;padding:4px 0;border-top:1px solid #14141e}
.modecard li b{color:#cfd6e6;font-weight:600}

/* 타임라인 */
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--dim);font-weight:500;font-size:12px}
td:nth-child(1){color:var(--gold);white-space:nowrap;font-weight:600}
td:nth-child(2),td:nth-child(3){color:var(--dim);white-space:nowrap}
.fallback{display:none;padding:24px;color:var(--dim);font-size:13px}
</style>
</head>
<body>
<div class="wrap">
  <h1>수호신 디자인 버전 보드</h1>
  <p class="lead">오행(형태) × 모드 A/B/C(상태) × 버전(계보). 아래 그리드는 <b>현재 코드로 실제 렌더링</b>되며, 셰이더와 2D 형태 함수는 <code>app/src/App.jsx</code>·구버전 파일에서 그대로 추출해 쓴다.</p>
  <p class="note">B 열은 화면 중앙을 계속 누르고 있는 상태를, C 열은 판결 반응(GO → HOLD → STOP → 해체)을 반복 재생한다. 실제 앱에서는 손끝 위치와 판결 방향에 따라 달라진다.</p>

  <h2>1. 현재 버전(v97) — 오행 5 × 모드 3</h2>
  <div class="colhead" id="colhead"></div>
  <div class="glwrap">
    <canvas id="gl"></canvas>
    <div class="overlay" id="overlay"></div>
    <div class="fallback" id="fallback">이 브라우저에서 WebGL을 못 씁니다 — 아래 2D 계보 섹션은 그대로 보입니다.</div>
  </div>
  <div class="rowlegend" id="rowlegend"></div>

  <h2>2. 형태의 계보 — 2D 세대별(오행 5)</h2>
  <p class="note">WebGL 이전의 Canvas2D 형태 함수를 구버전 파일에서 뽑아 나란히 돌린다. 같은 코드인 버전은 한 세대로 묶었다(코드가 안 바뀐 구간은 형태도 안 바뀌었다는 뜻).</p>
  <div class="gen" id="gen"></div>

  <h2>3. 모드별 변경 이력</h2>
  <div class="modes" id="modes"></div>

  <h2>4. 전체 타임라인</h2>
  <table>
    <thead><tr><th>버전</th><th>날짜</th><th>엔진</th><th>무엇이 바뀌었나</th></tr></thead>
    <tbody id="tl"></tbody>
  </table>
  <p class="note" style="margin-top:20px">생성: <code>node app/tools/build-guardian-board.mjs</code> · 근거: <code>app/src/App.jsx</code>, <code>09_구버전/</code>, <code>변경이력.md</code>, 커밋 로그</p>
</div>

<script>
const DATA = ${JSON.stringify(DATA)};
const GL_VERT = ${JSON.stringify(GL_VERT)};
const GL_FRAG = ${JSON.stringify(GL_FRAG)};
const PLACES = ${JSON.stringify(gens.map(g => g.body))};

const T0 = performance.now();
const hex2rgb = h => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
const srnd = (seed) => { let h = seed >>> 0; return () => ((h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32); };

/* ── 헤더·범례 ───────────────────────────────────────────────── */
document.getElementById("colhead").innerHTML = DATA.modes
  .map(m => \`<div><b>\${m.title}</b><span>\${m.sub}</span></div>\`).join("");
document.getElementById("rowlegend").innerHTML = DATA.elements
  .map(e => \`<div><b>\${e.key}</b><p>\${e.now}</p></div>\`).join("");
document.getElementById("modes").innerHTML = DATA.modes.map(m => \`
  <div class="modecard"><h3>\${m.title}</h3><p>\${m.what}</p><ol>\${
    m.hist.map(([v, s]) => \`<li><b>\${v}</b><span>\${s}</span></li>\`).join("")
  }</ol></div>\`).join("");
document.getElementById("tl").innerHTML = DATA.timeline
  .map(r => \`<tr><td>\${r[0]}</td><td>\${r[1]}</td><td>\${r[2]}</td><td>\${r[3]}</td></tr>\`).join("");

/* ── 섹션 1: WebGL 5×3 — 컨텍스트 하나에 viewport 로 15칸 ────────── */
const CELL = 236, COLS = 3, ROWS = DATA.elements.length;
const overlay = document.getElementById("overlay");
overlay.style.gridTemplateColumns = \`repeat(\${COLS},1fr)\`;
overlay.style.gridTemplateRows = \`repeat(\${ROWS},1fr)\`;
overlay.innerHTML = DATA.elements.flatMap(e => DATA.modes.map(m =>
  \`<div class="cell"><span class="tag\${m.key === "C" ? " cphase" : ""}">\${e.key} · \${m.key}</span><span class="el">\${e.key}</span></div>\`)).join("");
/* C 열은 판결 반응을 순환 재생하므로 지금 어느 국면인지 글자로 알려준다 */
const cTags = [...document.querySelectorAll(".cphase")];
const C_PHASES = [[2,"요동(의식)"],[4,"GO — 솟구쳐 펼침"],[6,"HOLD — 잔잔한 맥동"],[8,"STOP — 수축·어두워짐"],[10.5,"해체(dissolved)"],[12,"복원"]];
setInterval(() => {
  const c = ((performance.now() - T0) / 1000) % 12;
  const name = (C_PHASES.find(([end]) => c < end) || C_PHASES[0])[1];
  cTags.forEach((el, i) => el.textContent = DATA.elements[i].key + " · C — " + name);
}, 200);

function initGL() {
  const cv = document.getElementById("gl");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.aspectRatio = (COLS * CELL) + " / " + (ROWS * CELL);
  cv.width = COLS * CELL * dpr; cv.height = ROWS * CELL * dpr;
  const gl = cv.getContext("webgl", { alpha: false, antialias: false, depth: false });
  if (!gl) { document.getElementById("fallback").style.display = "block"; return; }
  const mk = (ty, s) => { const sh = gl.createShader(ty); gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const prog = gl.createProgram();
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, GL_VERT));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, GL_FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const n = 9000, r0 = new Float32Array(n * 4), r1 = new Float32Array(n * 4), rnd = srnd(20260728);
  for (let i = 0; i < n * 4; i++) { r0[i] = rnd(); r1[i] = rnd(); }
  const buf = (name, arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0); };
  buf("a_r0", r0); buf("a_r1", r1);

  const L = {};
  ["u_hold","u_beat","u_t","u_form","u_R","u_arms","u_strands","u_twist","u_speed","u_chaos","u_nayF","u_nayA",
   "u_expand","u_agi","u_k","u_ps","u_lum","u_twk","u_psMul","u_focal","u_touch","u_touchVel","u_touchAmt",
   "u_breath","u_trailLive","u_zodiac","u_c1","u_c2","u_acc","u_wispCol","u_bright","u_alpha"]
    .forEach(k => L[k] = gl.getUniformLocation(prog, k));
  L.u_trail = gl.getUniformLocation(prog, "u_trail[0]");

  /* 앱과 같은 고정값(같은 사람이라고 가정 — 오행·모드만 갈리게) */
  gl.uniform1f(L.u_R, 0.8); gl.uniform1f(L.u_arms, 5); gl.uniform1f(L.u_strands, 5);
  gl.uniform1f(L.u_twist, 2.1); gl.uniform1f(L.u_speed, 0.30); gl.uniform1f(L.u_chaos, 0.9);
  gl.uniform1f(L.u_focal, 0.55); gl.uniform1f(L.u_nayF, 0.58); gl.uniform1f(L.u_nayA, 0.45);
  gl.uniform1f(L.u_lum, 0.92); gl.uniform1f(L.u_twk, 1); gl.uniform1f(L.u_beat, 3);
  gl.uniform1f(L.u_k, 1); gl.uniform1f(L.u_zodiac, 4);
  gl.uniform2f(L.u_touchVel, 0, 0);
  const trail = new Float32Array(40);
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(0.016, 0.016, 0.031, 1);

  const F_AL = { "화":0.36, "수":0.31, "목":0.32, "금":0.29, "토":0.26 };
  const F_PS = { "금":0.82, "토":0.9 };
  const born = T0;

  function drawCell(el, mode, t, px, py) {
    const w = CELL * dpr;
    gl.viewport(px, py, w, w);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(px, py, w, w);
    const c1 = hex2rgb(el.colors[0]), c2 = hex2rgb(el.colors[1]);
    gl.uniform3fv(L.u_c1, c1); gl.uniform3fv(L.u_c2, c2); gl.uniform3fv(L.u_acc, hex2rgb(el.acc));
    gl.uniform3fv(L.u_wispCol, [0.5 + c1[0] * 0.28, 0.55 + c1[1] * 0.26, 0.66 + c1[2] * 0.2]);
    gl.uniform1f(L.u_form, el.form);
    gl.uniform1f(L.u_ps, 1.8 * dpr * (F_PS[el.key] || 1));
    const bph = (born + t * 1000) * Math.PI * 2 / 9000;
    gl.uniform1f(L.u_breath, Math.sin(bph - 0.35 * Math.sin(bph)));

    let touchAmt = 0, hold = 0, expand = 0, bright = 1, agi = 0, alphaK = 1, trailLive = 0, tx = 0, ty = 0;
    if (mode === "B") {
      /* 화면 중앙 언저리를 계속 누르고 원을 그리며 끄는 상태를 재현 */
      const rr = 0.16, a = t * 0.55;
      tx = Math.cos(a) * rr; ty = Math.sin(a) * rr * 0.8;
      touchAmt = Math.min(1.15, t * 0.7);
      hold = Math.min(2.4, t);
      trailLive = 1;
      for (let i = 0; i < 10; i++) {
        const la = a - i * 0.16;
        trail.set([Math.cos(la) * rr, Math.sin(la) * rr * 0.8, i * 0.09, 0.5], i * 4);
      }
      gl.uniform4fv(L.u_trail, trail);
    } else if (mode === "C") {
      /* 판결 반응 루프: 요동 → GO → HOLD → STOP → 해체 → 복원 (12초) */
      const c = t % 12;
      if (c < 2) { agi = 1; }
      else if (c < 4)  { const e = env(c - 2); expand =  e * 0.50; bright = 1 + e * 0.50; }
      else if (c < 6)  { const e = env(c - 4); expand =  e * 0.10 * Math.sin((c - 4) * 5); bright = 1 - e * 0.12; }
      else if (c < 8)  { const e = env(c - 6); expand = -e * 0.45; bright = 1 - e * 0.55; }
      else if (c < 10.5) { const d = (c - 8) / 2.5; expand = d * 0.7; alphaK = 1 - d; }   /* dissolved(해체) */
      else { const d = (c - 10.5) / 1.5; expand = 0.7 * (1 - d); alphaK = d; }
      gl.uniform4fv(L.u_trail, new Float32Array(40));
    } else {
      gl.uniform4fv(L.u_trail, new Float32Array(40));
    }
    gl.uniform2f(L.u_touch, tx, ty);
    gl.uniform1f(L.u_touchAmt, touchAmt); gl.uniform1f(L.u_hold, hold);
    gl.uniform1f(L.u_trailLive, trailLive);
    gl.uniform1f(L.u_expand, expand); gl.uniform1f(L.u_bright, bright); gl.uniform1f(L.u_agi, agi);

    const A = (F_AL[el.key] || 0.31) * alphaK;
    gl.uniform1f(L.u_t, t);
    gl.uniform1f(L.u_psMul, 3.6); gl.uniform1f(L.u_alpha, 0.05 * A); gl.drawArrays(gl.POINTS, 0, n);
    gl.uniform1f(L.u_psMul, 1.8); gl.uniform1f(L.u_alpha, 0.22 * A); gl.drawArrays(gl.POINTS, 0, n);
    gl.uniform1f(L.u_psMul, 1);   gl.uniform1f(L.u_alpha, 0.72 * A); gl.drawArrays(gl.POINTS, 0, n);
    gl.uniform1f(L.u_t, t - 0.22); gl.uniform1f(L.u_alpha, 0.30 * A); gl.drawArrays(gl.POINTS, 0, n);
  }
  const env = (r) => Math.max(0, 1 - r / 1.7) * Math.min(1, r / 0.18);

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(cv);
  const loop = () => {
    requestAnimationFrame(loop);
    if (!visible) return;
    const t = (performance.now() - born) / 1000;
    gl.disable(gl.SCISSOR_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      /* WebGL 원점은 좌하단 — 행 순서를 뒤집어 HTML 그리드와 맞춘다 */
      drawCell(DATA.elements[r], DATA.modes[c].key, t, c * CELL * dpr, (ROWS - 1 - r) * CELL * dpr);
    }
  };
  loop();
}
try { initGL(); } catch (e) { document.getElementById("fallback").style.display = "block"; console.error(e); }

/* ── 섹션 2: 2D 세대별 — 원본 place() 를 그대로 돌린다 ───────────── */
const genHost = document.getElementById("gen");
genHost.innerHTML = DATA.gens.map((g, gi) => \`
  <div class="gencard">
    <h3>\${g.title}</h3>
    <div class="vers">\${g.versions.join(" · ")}</div>
    <p>\${g.note}<br><span style="opacity:.75">\${g.detail}</span></p>
    <div class="strip">\${DATA.elements.map(e =>
      \`<figure><canvas data-gen="\${gi}" data-el="\${e.key}"></canvas><figcaption>\${e.key}</figcaption></figure>\`
    ).join("")}</div>
  </div>\`).join("");

const placeFns = PLACES.map(body =>
  new Function("p", "t", "R", "cx", "cy", "arms", "form", body));

document.querySelectorAll(".strip canvas").forEach(cv => {
  const gi = +cv.dataset.gen, key = cv.dataset.el;
  const el = DATA.elements.find(e => e.key === key);
  const S = 150, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = S * dpr; cv.height = S * dpr;
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
  const R = S * 0.30, cx = S / 2, cy = S / 2, arms = 5, N = 900, rnd = srnd(4242 + gi);
  const ps = Array.from({ length: N }, () => {
    const arm = Math.floor(rnd() * arms);
    return { u: rnd(), v: rnd(), o: arm + rnd() * 0.6, s: rnd(), arm,
             ph: rnd() * Math.PI * 2, acc: rnd() < 0.24 };
  });
  const place = placeFns[gi];
  let t = 0, on = true;
  new IntersectionObserver(es => { on = es[0].isIntersecting; }, { threshold: 0 }).observe(cv);
  const draw = () => {
    requestAnimationFrame(draw);
    if (!on) return;
    t += 0.012;
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1; ctx.fillStyle = "rgba(0,0,0,.13)"; ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = "lighter";
    for (const p of ps) {
      const [x, y, depth] = place(p, t, R, cx, cy, arms, el.key);
      ctx.globalAlpha = Math.max(0, Math.min(1, depth)) * (0.28 + p.s * 0.42);
      ctx.fillStyle = p.acc ? el.acc : (p.o % 3 < 1 ? el.colors[1] : el.colors[0]);
      const r = 0.8 + p.s * 1.1;
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
  };
  draw();
});
</script>
</body>
</html>
`;

const OUT = join(ROOT, "app/public/guardian-board.html");
writeFileSync(OUT, html);
console.log(`생성: ${OUT}`);
console.log(`  2D 세대 ${gens.length}개 — ${gens.map(g => g.versions.join("/")).join(" | ")}`);
console.log(`  셰이더: GL_VERT ${GL_VERT.length}자 · GL_FRAG ${GL_FRAG.length}자`);
