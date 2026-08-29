/* 오늘의 상태 — **두 체계가 섞여 있고, 모든 줄이 「그래서 오늘 뭘」에 답하는가.**
   실행: node e2e/mood-check.mjs (브라우저 불필요)

   왜 있나: 2026-08-28 창업자 지적 둘이 이 파일의 이유다.
     ① *"오늘의 상태는 왜 사주 베이스로 했어?"* → 재 보니 **반복 주기가 정확히 10일**이었다.
        한 달에 세 번 같은 문장을 본다. 그리고 CLAUDE.md 가 방어자산으로 적은 「11개 체계」가
        **매일 보는 한 줄에서는 하나**였다 — 그 자리에서는 우리도 만세력 단일 엔진이다.
     ② *"혼자 파고들게 돼 = 뭘…? 이해가 안 돼"* → 맞다. 속마음에 이름을 붙인 것이지
        오늘 뭘 하라는 말이 아니다. 이 리포는 같은 교정을 곁 역할표에서 이미 했다
        (match.js ROLE, 2026-08-15 규칙 3 「좋은 말이 아니라 쓸모」).
   ⚠ 문구는 사람이 고치는 것이라 **검사가 문장을 심사할 수는 없다.** 대신 **되살아나면 안 되는
     모양**을 문다 — 체계가 하나로 줄었는가, 줄이 「그래서 뭘」에 안 답하는 모양으로 돌아갔는가. */
import { readFileSync } from "node:fs";
const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const grab = (head) => {
  const i = src.indexOf(head);
  if (i < 0) throw new Error(`${head} 를 못 찾음 — 이름이 바뀌었는지 확인하세요`);
  let d = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) {
    if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error(`${head} 가 안 닫힘`);
};
const M = new Function(`${grab("const MOOD = {")}\n${grab("const TARA = {")}\nreturn { MOOD, TARA };`)();
const lines = [...Object.values(M.MOOD).map((x) => x.l), ...Object.values(M.TARA).map((x) => x[0])];

/* ── ① 체계가 둘이다 ─────────────────────────────────────────────────────── */
ck("① 십성 열 가지가 다 있다", Object.keys(M.MOOD).length === 10, `${Object.keys(M.MOOD).length}종`);
ck("① 타라 아홉 가지가 다 있다", Object.keys(M.TARA).length === 9, `${Object.keys(M.TARA).length}종`);
const fn = grab("function todayMood(");
ck("① 사주 축이 산다(일진 십성)", /sipseong\(saju\.idx\.dG, td\.idx\.dG\)/.test(fn));
ck("① 인도 축이 산다(타라)", /TARA\[/.test(fn) && /% 27 \+ 1\) % 9/.test(fn));
/* ⚠ 나크샤트라를 새 경로로 계산하면 같은 사람의 값이 화면마다 갈린다(납음에서 실제로 겪은 사고) */
/* ⚠ **주석을 걷고 본다.** 이 리포에서 소스를 grep 하는 검사가 자기 주석에 걸린 게 이번이 여섯 번째다
   (`same ? 1 : 1` · \bidx\b · 5-g 의 (O) 예문 · invite-check 의 match.js · 그리고 여기 sidIdx).
   원인은 늘 같다 — **주석이 금칙 문자열을 인용한다.** 인용을 막는 게 아니라 검사가 주석을 걷는 게 답이다. */
const fnCode = fn.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
ck("① 나크샤트라를 새로 계산하지 않는다 — 있는 문(moonPlacements)을 쓴다",
   /moonPlacements\(/.test(fnCode) && !/nakIdxOf|sidIdx/.test(fnCode));
ck("① 달 위상은 글자가 아니라 밝기로만 든다", /lum: m\.lum \* \(0\.94/.test(fn));

/* ── ② 주기 — 십성만으로는 10일이었다 ──────────────────────────────────── */
ck("② 십성은 일간만 보므로 10종이다(그래서 혼자서는 10일 주기)",
   new Set(Object.values(M.MOOD).map((x) => x.l)).size === 10);
ck("② 타라를 곱하면 90가지가 된다", Object.keys(M.MOOD).length * Object.keys(M.TARA).length === 90);

/* ── ③ 문구 — **모든 줄이 「그래서 오늘 뭘」에 답한다** ───────────────────── */
/* 되살아나면 안 되는 모양: 속마음에 이름만 붙이고 끝나는 줄.
   창업자가 지적한 원문이 정확히 그 모양이었다 — "혼자 파고들게 돼"(그래서 뭘?). */
ck("③ 지적받은 원문이 그대로 남아 있지 않다",
   !lines.includes("혼자 파고들게 돼") && !lines.includes("계산이 잘 서") && !lines.includes("말이 잘 나와"));
/* ⚠ **처음엔 행동 동사 목록으로 쟀다가 검사 쪽을 고쳤다.** 목록은 늘 모자라고(볼/미루/내일로가
   다 빠졌다) 넓히면 아무거나 통과한다. 잡으려는 건 어휘가 아니라 **구조**다 —
   창업자가 지적한 줄들은 전부 **한 마디**로 끝난다("혼자 파고들게 돼" · "계산이 잘 서").
   고친 줄들은 전부 **두 마디**다: 상태 + 그래서 뭘. 그 이음매를 문다. */
const TWO = /—|면 |고 |도 되는|보다 /;
const oneClause = lines.filter((l) => !TWO.test(l) || l.length < 12);
ck("③ 모든 줄이 두 마디다 — 상태만 말하고 끝나지 않는다", oneClause.length === 0, oneClause.join(" / ") || "0건");
/* 음성 확인을 검사 안에 심는다 — 지적받은 원문 넷을 넣으면 반드시 걸려야 한다.
   안 걸리면 위 규칙이 느슨해진 것이고, 그때 조용히 옛 문구가 돌아온다. */
const OLD = ["혼자 파고들게 돼", "계산이 잘 서", "말이 잘 나와", "쉽게 안 흔들려"];
ck("③ (음성) 지적받은 옛 문구 넷이 이 규칙에 전부 걸린다",
   OLD.every((l) => !TWO.test(l) || l.length < 12), OLD.filter((l) => TWO.test(l) && l.length >= 12).join(",") || "4/4 걸림");
/* 이 앱은 화면에 **용어를 안 낸다**(설계 헌장). 십성 이름·타라 원어·길흉 용어 전부 본문 금지 —
   근거 줄(axis·name)에는 일상어와 자리 이름만 쓴다. */
const JARGON = /십성|비견|겁재|식신|상관|정재|편재|정관|편관|정인|편인|나크샤트라|아쉬타쿠타|길하|흉하|길일|흉일|대길|삼재/;
const jarg = lines.filter((l) => JARGON.test(l));
ck("③ 본문에 용어가 안 샌다", jarg.length === 0, jarg.join(" / ") || "0건");
/* ⚠ **근거 줄도 화면이다.** 첫 판에 본문만 막고 근거 줄에 산스크리트를 그대로 내보냈다
   ("달은 삼파트자리"). 「자리」를 붙여도 뜻이 하나도 안 전해진다 — 이름 칸까지 같이 문다. */
const SANS = /자나|삼파트|비파트|크셰마|프라티야크|사다나|나이다나|미트라|파라마/;
const names = [...Object.values(M.TARA).map((x) => x[1]), ...Object.values(M.MOOD).map((x) => x.axis)];
const sans = names.filter((n) => SANS.test(n));
ck("③ 근거 줄에 원어가 안 샌다", sans.length === 0, sans.join(" / ") || "0건");
ck("③ 근거 줄 어휘가 「…자리」로 통일돼 있다(곁 역할표와 같은 계열)",
   names.every((n) => /자리$/.test(n)), names.filter((n) => !/자리$/.test(n)).join(",") || "전부 자리");
/* 길이 — 한 줄로 읽혀야 한다. 너무 길면 그건 문장이 아니라 문단이다 */
const long = lines.filter((l) => l.length > 42);
ck("③ 한 줄로 읽히는 길이다(42자 이하)", long.length === 0, long.map((l) => `${l.length}자`).join(",") || "0건");
ck("③ 빈 줄이 없다", lines.every((l) => l && l.trim().length > 6));

/* ── ④ 판결에는 안 들어간다 (설계 헌장 §판결문 형식 보존) ──────────────── */
const sys = (src.match(/const SYS = `[\s\S]*?`;/) || [""])[0];
ck("④ 오늘의 상태가 판결 프롬프트에 안 실린다",
   !/오늘의 상태|todayMood|MOOD\[/.test(sys) && !/mood\./.test(src.slice(src.indexOf("const profile ="), src.indexOf("const profile =") + 1400)));

const pass = R.filter(Boolean).length;
console.log(`\n=== 오늘의 상태: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
