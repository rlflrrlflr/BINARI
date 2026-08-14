/* 여러 하늘 엔진 검사 — app/src/lib/sky.js
   ★ 이 파일이 지키는 것은 하나다: **App.jsx 의 사주 천문 계산과 sky.js 의 천문 계산이 갈리지 않는가.**
   두 벌을 둔 이유는 사주 쪽이 이미 만세력 28건 대조를 통과했고 거기를 건드리면 그 검증이 흔들리기 때문이다.
   합치지 않기로 했으면, **갈리는 순간 우는 검사**가 반드시 있어야 한다. 없으면 조용히 어긋난다.
   실행: node app/e2e/sky-check.mjs */
import { readFileSync } from "node:fs";
import * as S from "../src/lib/sky.js";

const R = []; const ck = (n, p, g = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${g ? " · " + g : ""}`); };

/* App.jsx 의 천문 함수를 실행 가능한 형태로 뽑아 온다.
   정규식으로 함수 본문을 떼어 new Function 으로 만든다 — App.jsx 를 import 하면 React 가 딸려 와서 못 쓴다. */
const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
function lift(names) {
  const parts = [];
  for (const n of names) {
    const m = src.match(new RegExp(`^(?:const ${n} = \\([^)]*\\) => \\{[\\s\\S]*?\\n\\};|function ${n}\\([\\s\\S]*?\\n\\})`, "m"));
    if (!m) throw new Error(`App.jsx 에서 ${n} 을 못 찾음 — 이름이 바뀌었으면 이 검사를 고쳐야 한다`);
    parts.push(m[0]);
  }
  return new Function(`${parts.join("\n")}\nreturn {${names.join(",")}};`)();
}
const A = lift(["jdn", "sunLongitude", "moonLongitude"]);

/* ── 1. 두 벌이 같은 값을 내는가 ── */
let worstSun = 0, worstMoon = 0, jdnOk = true;
for (let i = 0; i < 240; i++) {
  const y = 1950 + i % 90, m = 1 + i % 12, d = 1 + i % 28;
  if (A.jdn(y, m, d) !== S.jdn(y, m, d)) jdnOk = false;
  const jd = S.jdFromKST(y, m, d, 3 + i % 20, (i * 7) % 60);
  worstSun = Math.max(worstSun, Math.abs(A.sunLongitude(jd) - S.sunLongitude(jd)));
  worstMoon = Math.max(worstMoon, Math.abs(A.moonLongitude(jd) - S.moonLongitude(jd)));
}
ck("율리우스일 — 두 벌이 240일 전부 일치", jdnOk);
ck("태양 황경 — 두 벌 차이 0", worstSun < 1e-9, `최대 ${worstSun.toExponential(1)}도`);
ck("달 황경 — 두 벌 차이 0", worstMoon < 1e-9, `최대 ${worstMoon.toExponential(1)}도`);

/* ── 2. 물리로 자체 검증(05_실험 verify-sky 와 같은 성질) ── */
const SEOUL = { lat: 37.5665, lon: 126.978 };
const ang = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
let worstAsc = 0;
for (const [y, m, d, h, mi] of [[2026, 3, 20, 6, 36], [2026, 6, 21, 5, 11], [2026, 9, 23, 6, 29], [2026, 12, 22, 7, 43]]) {
  const jd = S.jdFromKST(y, m, d, h, mi);
  worstAsc = Math.max(worstAsc, ang(S.ascendant(jd, SEOUL.lat, SEOUL.lon), S.sunLongitude(jd)));
}
ck("상승궁 — 일출 순간에 태양과 겹친다(오차 <8도)", worstAsc < 8, `최대 ${worstAsc.toFixed(1)}도`);
const seen = new Set();
const j0 = S.jdFromKST(2000, 1, 1, 0, 0);
for (let i = 0; i < 48; i++) seen.add(S.signOf(S.ascendant(j0 + i / 48, SEOUL.lat, SEOUL.lon)));
ck("상승궁 — 하루에 열두 자리를 다 지난다", seen.size === 12, `${seen.size}자리`);

/* ── 3. 시간축 셋이 다 살아 있는가 — 각인의 「지금·앞으로」가 여기 얹혀 있다 ── */
const jdT = S.jdFromKST(2000, 1, 1, 9, 0), ascT = S.ascendant(jdT, SEOUL.lat, SEOUL.lon);
ck("서양 — 열두 해가 열두 하우스를 다 돈다",
   new Set([...Array(12)].map((_, i) => S.profection(ascT, i).house)).size === 12);
const vd = S.vimshottari(jdT, 2000, 9);
ck("인도 — 아홉 시기 합이 120년", S.DASHA_TOTAL === 120);
ck("인도 — 구간이 안 끊긴다", vd.periods.every((p, i) => i === 0 || Math.abs(p.from - vd.periods[i - 1].to) < 0.05));
ck("인도 — 달자리가 판독기와 일치", vd.nakshatra === S.nakshatra(jdT, 2000), `${vd.nakshatra}`);
const se = S.seun(4, 2026, 6);
ck("동아시아 — 세운 여섯 해가 나온다", se.length === 6 && se[0].ganji === "丙午", se[0].ganji);
const wo = S.wolun(4, 2, 2026);
ck("동아시아 — 열두 달이 절기로 갈린다", wo.length === 12 && wo[0].ganji[1] === "寅", wo[0].ganji);

/* ── 4. 궁합 ── */
const ak = S.ashtakuta(jdT, 2000, S.jdFromKST(1995, 6, 15, 21, 30), 1995);
ck("궁합 — 총점 0~36 · 여덟 항목", ak.total >= 0 && ak.total <= 36 && Object.keys(ak.detail).length === 8, `${ak.total}/36`);

const pass = R.filter(Boolean).length;
console.log(`\n=== 여러 하늘 엔진: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
