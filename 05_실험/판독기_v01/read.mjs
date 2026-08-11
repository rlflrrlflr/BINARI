/* 한 사람의 각인을 판독기 전부에 걸어 본다. 개인정보는 인자로만 받는다(파일에 박지 않는다).
   실행: node 05_실험/판독기_v01/read.mjs 2026 8 6 10 51 M */
import * as D from "./lib/decoders.mjs";
const [y, m, d, h, mi, sex] = process.argv.slice(2);
if (!y) { console.log("사용법: node read.mjs <년> <월> <일> <시> <분> <M|F>"); process.exit(1); }
const Y=+y, M=+m, Dd=+d, H=+h, MI=+mi, male = (sex||"M").toUpperCase()==="M";
const jd = D.jdFromKST(Y, M, Dd, H, MI), J = D.jdn(Y, M, Dd);
const rows = [
  ["동아시아 · 납음",      D.nayin(Y) + " — 육십갑자의 소리 기운"],
  ["일본 · 구성기학",      D.honmeisei(Y).name + ` (${D.honmeisei(Y).n})`],
  ["서양 · 태양자리",      D.sunSign(jd)],
  ["서양 · 달자리",        D.moonSign(jd)],
  ["서양 · 달의 모양",     `${D.moonPhase(Y,M,Dd).name} (삭 이후 ${D.moonPhase(Y,M,Dd).age}일)`],
  ["인도 · 나크샤트라",    D.nakshatra(jd, Y) + " — 달이 머문 27자리 중"],
  ["마야 · 촐킨",          `${D.tzolkin(J).tone} ${D.tzolkin(J).sign}`],
  ["마야 · 하압",          `${D.haab(J).day} ${D.haab(J).month}`],
  ["자바 · 웨톤",          `${D.weton(Y,M,Dd).name} · 넵투 ${D.weton(Y,M,Dd).neptu}`],
  ["가나 · 아칸 이름",     `${D.akan(Y,M,Dd,male).name} — ${D.akan(Y,M,Dd,male).trait}`],
  ["태국 · 요일",          `${D.thaiDay(Y,M,Dd).color} · ${D.thaiDay(Y,M,Dd).planet} · ${D.thaiDay(Y,M,Dd).buddha}`],
  ["수비학 · 라이프패스",  String(D.lifePath(Y,M,Dd))],
];
console.log(`\n${Y}-${M}-${Dd} ${H}:${String(MI).padStart(2,"0")} · ${male?"남":"여"} · ${D.WEEK_KO[D.weekday(Y,M,Dd)]}요일\n`);
for (const [k,v] of rows) console.log(`  ${k.padEnd(18," ")} ${v}`);
