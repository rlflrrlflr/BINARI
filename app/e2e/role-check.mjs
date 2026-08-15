/* 역할 10종 — 화법 규칙과 **방향**을 못 박는다. 실행: node e2e/role-check.mjs (앱 기동 불필요)
 *
 * 왜 있나
 *   ① **방향이 조용히 뒤집힐 수 있다.** `작업지시_역할과초대_2026-08-15.md` §B 초안 표는
 *      받는 사람 시점으로 쓰였는데 행 이름은 안 뒤집혀 있었다 — 그대로 옮겼으면 비대칭 8종이
 *      전부 반대 관계를 설명했을 것이고, **화면은 멀쩡해 보인다.** 사람이 읽어야만 틀린 걸 안다.
 *   ② 창업자 화법 규칙 3(좋은 말이 아니라 쓸모)은 문구를 조금만 손보면 조용히 깨진다.
 *
 * 검사하는 것
 *   - 10종이 전부 있고 이름이 「…자리」로 끝난다(사람 규정 금지 · 자리 지칭)
 *   - 등급·점수 어휘가 없다(창업자 규칙 1·2)
 *   - **방향** — 인성이 "받쳐 준다", 식상이 "내가 준다", 재성이 "내가 쥔다", 관성이 "눌린다" 쪽인지
 *     오행 생극으로 직접 계산해 대조한다. 문구가 아니라 **십성↔생극 대응**을 본다
 *   - 뒤집기 분포가 균등하다(쏠리면 "또 같은 역할"이 된다)
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const { sipseong: ssOf, GAN, GAN_EL } = await import(resolve(HERE, "../src/lib/sky.js"));
const SRC = readFileSync(resolve(HERE, "../src/lib/match.js"), "utf8");

const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

/* ── ROLE 표를 소스에서 뽑는다(앱을 안 띄우고 문구만 본다) ───────────────── */
const body = SRC.slice(SRC.indexOf("const ROLE = {"), SRC.indexOf("}[ss] ||"));
const rows = {};
for (const m of body.matchAll(/^\s{6}(\S+?):\s*\["([^"]+)",\s*"([\s\S]*?)"\],$/gm)) rows[m[1]] = [m[2], m[3]];
const TEN = ["비견", "겁재", "식신", "상관", "정재", "편재", "정관", "편관", "정인", "편인"];

ck("① 10종이 전부 있다", TEN.every((k) => rows[k]), `${Object.keys(rows).length}종`);
ck("① 이름이 전부 「…자리」로 끝난다", TEN.every((k) => rows[k] && rows[k][0].endsWith("자리")),
   TEN.filter((k) => rows[k] && !rows[k][0].endsWith("자리")).join(",") || "전부 통과");
/* 시금석 — 이 한 줄이 규칙 3 전체를 대표한다(창업자 예시가 그대로 들어온 자리) */
ck("① 시금석 — 편관 = 긴장을 못 풀게 하는 자리", rows["편관"] && rows["편관"][0] === "긴장을 못 풀게 하는 자리",
   rows["편관"] && rows["편관"][0]);

const BAN = ["점수", "등급", "총점", "퍼센트", "%", "궁합도", "최고", "최악", "안 맞는", "맞지 않는", "잘 맞는 편"];
const hit = [];
TEN.forEach((k) => rows[k] && BAN.forEach((w) => { if (rows[k].join(" ").includes(w)) hit.push(`${k}:${w}`); }));
ck("② 등급·점수 어휘가 없다", hit.length === 0, hit.join(", ") || "깨끗");
ck("② 사람을 규정하는 말이 없다(‘~한 사람이야’로 끝맺지 않는다)",
   TEN.every((k) => rows[k] && !/은\/는 .*사람이야\.?$/.test(rows[k][1])));

/* ── 방향 — 십성이 실제로 어느 쪽 생극인지 계산해 문구와 대조 ───────────── */
const SANG = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const GEUK = { 목: "토", 화: "금", 토: "수", 금: "목", 수: "화" };
const dirOf = (ss) => {
  for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) {
    if (ssOf(a, b) !== ss) continue;
    const ea = GAN_EL[a], eb = GAN_EL[b];
    if (ea === eb) return "같음";
    if (SANG[eb] === ea) return "상대가 나를 생";
    if (SANG[ea] === eb) return "내가 상대를 생";
    if (GEUK[eb] === ea) return "상대가 나를 극";
    if (GEUK[ea] === eb) return "내가 상대를 극";
  }
  return "?";
};
/* 각 십성이 있어야 할 방향 — 명리 정의 그대로다. 여기가 틀리면 문구 전체가 반대가 된다. */
const WANT = {
  정인: "상대가 나를 생", 편인: "상대가 나를 생",
  식신: "내가 상대를 생", 상관: "내가 상대를 생",
  정재: "내가 상대를 극", 편재: "내가 상대를 극",
  정관: "상대가 나를 극", 편관: "상대가 나를 극",
  비견: "같음", 겁재: "같음",
};
Object.entries(WANT).forEach(([k, want]) => ck(`③ 방향 — ${k} 는 “${want}”`, dirOf(k) === want, dirOf(k)));

/* 문구가 그 방향과 같은 말을 하는가 — 주어가 누구인지로 본다 */
const SUBJ = {
  정인: /이 사람이 (뒤를 받쳐|받쳐)/, 편인: /이 사람이 봐/,
  식신: /이 사람이 실물로 만들어/, 상관: /네 방식에 딴지/,
  정재: /네 손에 있을 때/, 편재: /둘이 붙으면/,
  정관: /이 사람이 선을 그으면/, 편관: /이 사람 앞에서 네가/,
  비견: /같은 눈높이/, 겁재: /붙으면 속도가/,
};
Object.entries(SUBJ).forEach(([k, re]) =>
  ck(`③ 문구가 방향과 같은 말을 한다 — ${k}`, !!(rows[k] && re.test(rows[k].join(" ")))));

/* ── 뒤집기 분포 — 쏠리면 "또 같은 역할"이 된다 ────────────────────────── */
const cnt = {};
for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) { const r = ssOf(b, a); cnt[r] = (cnt[r] || 0) + 1; }
const vals = TEN.map((k) => cnt[k] || 0);
ck("④ 뒤집기 10종이 균등하다", Math.min(...vals) === Math.max(...vals) && vals.length === 10,
   `최소 ${Math.min(...vals)} · 최대 ${Math.max(...vals)} / 100`);

const pass = R.filter(Boolean).length;
console.log(`\n=== 역할 문구: ${pass}/${R.length} ${pass === R.length ? "PASS" : "FAIL"} ===`);
process.exit(pass === R.length ? 0 : 1);
