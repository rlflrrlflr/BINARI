/* 흐름(세운·월운) 검증. 실행: node 05_실험/판독기_v01/verify-flow.mjs */
import { seun, wolun, monthBoundaries, sipseong, favor, SS_FLOW, GANH, JIH } from "./lib/flow.mjs";
const R = []; const ck = (n, p, g = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${g ? " · " + g : ""}`); };

/* 세운 */
const s26 = seun(8, 2026, 6);            // 일간 壬(8)
ck("세운 — 2026년은 병오", s26[0].ganji === "丙午", s26[0].ganji);
ck("세운 — 2023년은 계묘", seun(8, 2023, 1)[0].ganji === "癸卯", seun(8, 2023, 1)[0].ganji);
ck("세운 — 60년마다 같은 간지", seun(8, 1966, 1)[0].ganji === seun(8, 2026, 1)[0].ganji);
ck("세운 — 십성이 열 가지 안에 든다", s26.every(x => SS_FLOW[x.ganSS] && SS_FLOW[x.jiSS]));
ck("세운 — 壬일간에게 2026 병오는 편재/정재", s26[0].ganSS === "편재" && s26[0].jiSS === "정재",
   `${s26[0].ganSS}/${s26[0].jiSS}`);

/* 월운 · 절기 경계 */
const bs = monthBoundaries(2026);
ck("절기 — 열두 달 경계를 모두 찾는다", bs.length === 12, `${bs.length}개`);
ck("절기 — 경계가 시간순으로 정렬된다", bs.every((b, i) => i === 0 || b.jd > bs[i-1].jd));
ck("절기 — 이웃 경계 간격이 29~32일", bs.every((b, i) => i === 0 || (b.jd - bs[i-1].jd > 28.5 && b.jd - bs[i-1].jd < 32.5)));
const w = wolun(8, 2, 2026);             // 일간 壬 · 년간 丙(2)
ck("월운 — 열두 달", w.length === 12);
ck("월운 — 인월(첫 달)의 지지가 寅", w[0].ganji[1] === "寅", w[0].ganji);
ck("월운 — 미월(6번째)의 지지가 未", w[5].ganji[1] === "未", w[5].ganji);
/* 8월 상순은 아직 미월이어야 한다(입추가 8/7 이므로) */
const mi = w.find(x => x.mn === 6);
ck("월운 — 미월이 7월 상순에 시작해 8월 초에 끝난다", mi.start.startsWith("2026-07"), mi.start);
ck("월운 — 신월(7번째)은 8월에 시작", w[6].start.startsWith("2026-08"), w[6].start);
/* 년간에서 월간이 나오는 규칙: 병년의 인월은 경인 */
ck("월운 — 병년의 인월 월간은 庚", w[0].ganji[0] === "庚", w[0].ganji);

/* 순역 점수 */
ck("순역 — 용신만 있으면 최대 +3", favor(["금","수"], ["금","수"], ["화","토"]) === 3);
ck("순역 — 기신만 있으면 최소 -3", favor(["화","토"], ["금","수"], ["화","토"]) === -3);
ck("순역 — 지지 가중이 두 배", favor(["화","수"], ["금","수"], ["화","토"]) === 1);
ck("순역 — 항상 -3~+3", [...Array(100)].every((_, i) => { const e = [["금","수","화","토","목"][i%5], ["금","수","화","토","목"][(i*3)%5]];
  const v = favor(e, ["금","수"], ["화","토"]); return v >= -3 && v <= 3; }));

console.log("\n── 예시 명식(일간 壬 · 용신 금수) 앞으로 여섯 해 ──");
for (const x of s26) console.log(`  ${x.year} ${x.ganji}  ${x.ganSS}/${x.jiSS}  순역 ${favor(x.el,["금","수"],["화","토"]) >= 0 ? "+" : ""}${favor(x.el,["금","수"],["화","토"])}`);
console.log("\n── 2026년 열두 달 ──");
for (const m of w) console.log(`  ${m.start} ${m.ganji} ${m.ganSS}/${m.jiSS} 순역 ${favor(m.el,["금","수"],["화","토"]) >= 0 ? "+" : ""}${favor(m.el,["금","수"],["화","토"])}`);

const pass = R.filter(Boolean).length;
console.log(`\n=== 흐름 검증: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
