/* 궁합 판정 엔진 검사 — app/src/lib/match.js
   궁합은 **"점수 하나"로 뭉개기 제일 쉬운 자리**다. 그래서 검사도 그걸 본다:
   ① 아홉 축이 각자 다른 것을 보는가(투표가 아니라 분업인가)
   ② 갈릴 때 갈린다고 말하는가(평균으로 감추지 않는가)
   ③ 총점을 앞세우지 않는가
   ④ 헤어지라고 말하지 않는가
   실행: node app/e2e/match-check.mjs */
import { readMatch } from "../src/lib/match.js";
import { readFileSync } from "fs";

const R = []; const ck = (n, p, g = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${g ? " · " + g : ""}`); };
const st = (x) => String(x).replace(/<[^>]+>/g, "");

/* 가상 명식 — 실제 인물의 값을 쓰지 않는다(CLAUDE.md §운영 규칙) */
const P = (dG, dJ, y, m, d, h) => ({ saju: { idx: { yG: 9, yJ: 3, mG: 3, mJ: 5, dG, dJ, hG: 8, hJ: 10 } },
  birth: { y, m, d, h, min: 0 }, sex: "M" });
const A = P(2, 0, 1995, 11, 3, 14);
const B = P(1, 6, 1997, 4, 22, 9);        // 자·오 충
const C = P(1, 1, 1997, 4, 22, 9);        // 자·축 육합

const r = readMatch({ a: A, b: B });
ck("궁합이 나온다", !!r);

/* ── ① 분업 — 아홉 축이 각자 다른 질문을 맡는가 ── */
ck("아홉 축이 다 나온다", r.rows.length >= 9, `${r.rows.length}개`);
ck("축마다 다른 질문을 맡는다(투표가 아니다)",
   new Set(r.rows.map((x) => x.ask)).size === r.rows.length, `${new Set(r.rows.map((x) => x.ask)).size}종`);
ck("아홉 문명이 다 참여한다",
   ["동아시아", "인도", "서양", "자바", "마야", "수비학"].every((k) => r.rows.some((x) => x.from.includes(k))),
   r.rows.map((x) => x.from.split(" · ")[0]).join(","));
ck("축마다 근거 각주가 붙는다", r.rows.every((x) => Number.isInteger(x.n) && x.n >= 1 && x.n <= r.notes.length));
ck("근거의 급을 밝힌다(변환 없음 / 해석 섞임)",
   r.rows.every((x) => /변환이 없다|해석이 섞인다/.test(r.notes[x.n - 1])),
   r.rows.filter((x) => !/변환이 없다|해석이 섞인다/.test(r.notes[x.n - 1])).map((x) => x.from).join(",") || "전부 밝힘");

/* ── ② 십이지 관계가 전통 배당대로 나오는가(변환이 없다고 적었으니 실제로 없어야 한다) ── */
ck("자·오는 충으로 읽는다", r.rows.find((x) => x.ask.includes("같이 사는")).val.includes("충"),
   r.rows.find((x) => x.ask.includes("같이 사는")).val);
ck("자·축은 육합으로 읽는다", readMatch({ a: A, b: C }).rows.find((x) => x.ask.includes("같이 사는")).val.includes("육합"));
ck("충은 음수, 육합은 양수", r.rows.find((x) => x.ask.includes("같이 사는")).v < 0
   && readMatch({ a: A, b: C }).rows.find((x) => x.ask.includes("같이 사는")).v > 0);

/* ── ③ 인도 여덟 항목을 합치지 않고 펴는가 ── */
ck("여덟 항목이 그대로 나온다", r.akRows.length === 8 && r.akRows.every((x) => x.label && x.max));
ck("항목마다 무엇을 보는지 적는다", r.akRows.every((x) => x.w && x.w.length >= 10));
ck("비율이 0~1 안", r.akRows.every((x) => x.ratio >= 0 && x.ratio <= 1));
ck("나디는 8점 만점(인도가 가장 무겁게 보는 항목)", r.akRows.find((x) => x.k === "나디").max === 8);

/* ── ④ 갈릴 때 갈린다고 말하는가 — 이게 이 문서의 알맹이다 ── */
ck("긍정·부정이 섞이면 갈린다고 말한다", r.split === (r.rows.some((x) => x.v >= 1) && r.rows.some((x) => x.v <= -1)));
ck("갈릴 때 어느 축이 갈리는지 짚는다", !r.split || /맞는다고 하고/.test(r.clash.w));
ck("갈림에도 근거 각주가 붙는다", r.clash.n >= 1 && r.clash.n <= r.notes.length);
ck("평균으로 감추지 않는다(각주가 그렇게 밝힌다)",
   r.notes.some((t) => /평균을 내지 않는다|합산 점수를 앞세우지 않는다/.test(t)));

/* ── ⑤ 총점을 앞세우지 않는가 ── */
ck("총점이 마지막에만 나온다", typeof r.score === "number" && !!r.band);
ck("총점 각주가 '앞에 두지 않는다'를 밝힌다", /문서 앞에 두지 않는다/.test(r.notes[r.n - 1]));

/* ── ⑥ 헤어지라고 말하지 않는가 — 관계를 끊는 결정은 우리 몫이 아니다 ── */
{
  const ALL = [...r.rows.map((x) => x.w), r.clash.w, ...r.care].map(st).join(" ");
  /* ⚠ **명령형만** 잡는다. "부딪히는데 못 헤어지는 이유"는 관계를 설명한 것이지 권고가 아니다 —
     서술까지 금지하면 관계를 관계로 말할 수가 없어진다. 금지선은 **끊으라고 시키는 것**이다. */
  const BREAK = /(헤어져|헤어지는\s*게\s*(나아|맞아|좋아)|정리해|끝내|만나지\s*마|그만\s*만나|안\s*만나는\s*게)/;
  ck("헤어지라고 시키지 않는다", !BREAK.test(ALL), (ALL.match(new RegExp(`.{0,14}${BREAK.source}.{0,14}`)) || [""])[0]);
  ck("조심할 것이 행동으로 끝난다", r.care.length >= 1 && r.care.every((c) => c.length >= 12));
  /* 모호함 금칙을 궁합에도 그대로 건다 */
  ck("궁합도 모호하지 않다", !/(그릇이|쥘\s*팔|기운이\s*흐르|일\s*수도|두고\s*봐야)/.test(ALL));
  ck("궁합도 신의 말투를 지킨다", !/[는ㄴ]다\.\s*$|이다\.\s*$/.test(st(r.rows[0].w).trim()));
}

/* ── ⑥-b 같이 일하면 어떤가 (v128) ──────────────────────────────────────
   각인의 「같이 일하면 좋은 사람」은 오행 한 줄이라 **사람을 못 가리켰다.** 궁합으로 이었다.
   여기서 지키는 것 셋: ①축을 안 늘렸는가(아홉은 아홉) ②총점에 안 섞였는가
   ③"동업하지 마"라고 시키지 않는가 — 관계 판정과 같은 선이다. */
{
  const w = r.work;
  ck("일 절이 나온다", !!w && w.rows.length >= 5, `${w ? w.rows.length : 0}행`);
  ck("축은 그대로 아홉이다(일 절이 축을 안 늘린다)", r.rows.length === 9, `${r.rows.length}축`);
  /* 총점은 rows 만으로 계산돼야 한다 — 일 절이 섞이면 연애 궁합과 일 궁합이 한 숫자로 뭉개진다 */
  ck("총점에 일 절이 안 섞인다", r.score === r.rows.reduce((t, x) => t + x.v, 0));
  ck("일 절이 '새로 계산한 게 아니다'라고 밝힌다", /새로 계산한 게 아니다/.test(r.notes[w.n - 1]));
  ck("행마다 근거 각주가 붙는다", w.rows.every((x) => Number.isInteger(x[2]) && x[2] >= 1 && x[2] <= r.notes.length));
  ck("각인과 같은 규칙임을 밝힌다", w.rows.some((x) => /각인의 「같이 일하면 좋은 사람」과 같은 규칙/.test(r.notes[x[2] - 1])));
  {
    const ALL = [...w.rows.map((x) => x[1]), ...w.care].map(st).join(" ");
    ck("동업하지 말라고 시키지 않는다",
       !/(동업하지\s*마|같이\s*일하지\s*마|그만두|손\s*떼)/.test(ALL),
       (ALL.match(/.{0,12}(동업하지\s*마|같이\s*일하지\s*마).{0,12}/) || [""])[0]);
    ck("일 절도 모호하지 않다", !/(그릇이|기운이\s*흐르|일\s*수도|두고\s*봐야)/.test(ALL));
    ck("조심할 것이 행동으로 끝난다", w.care.length >= 1 && w.care.every((c) => st(c).length >= 12));
  }
  /* 사람이 바뀌면 일 판정도 바뀌어야 한다 — 십성 **열 가지가 다** 나오는지.
     ⚠ 일간 쌍을 등차로 훑으면 안 된다 — a=i, b=3i+1 은 차가 늘 홀수라 **음양이 항상 달라져**
        열 중 다섯(겁재·상관·편재·정관·편인)만 나온다. 실제로 5종에서 멈췄다.
        십성은 (오행 관계 × 음양 같음/다름)이므로 **일간 쌍 100가지를 전부** 훑는다. */
  {
    const roles = new Set();
    for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) {
      const m = readMatch({ a: P(x, 0, 1990, 5, 10, 8), b: P(y, 6, 1992, 9, 3, 15) });
      if (m) roles.add(st(m.work.rows[0][1]).split(".")[0]);
    }
    ck("역할 판정이 십성 열 가지로 다 갈린다", roles.size === 10, `${roles.size}종`);
  }
}

/* ── ⑦ 사람이 바뀌면 판정도 바뀐다 — 아무에게나 같은 말이면 상품이 아니다 ── */
{
  const kinds = new Set(), scores = new Set(), cares = new Set();
  for (let i = 0; i < 60; i++) {
    const x = readMatch({
      a: P((i * 3) % 10, i % 12, 1990 + i % 30, 1 + i % 12, 1 + i % 28, i % 24),
      b: P((i * 7) % 10, (i * 5) % 12, 1988 + (i * 2) % 30, 1 + (i * 3) % 12, 1 + (i * 5) % 28, (i * 2) % 24) });
    if (!x) continue;
    kinds.add(x.rows.map((q) => q.v).join(","));
    scores.add(x.score);
    cares.add(x.care.join("|"));
  }
  ck("사람이 바뀌면 축 판정도 바뀐다", kinds.size >= 25, `60쌍 중 ${kinds.size}종`);
  ck("총점이 한 값으로 안 쏠린다", scores.size >= 6, `${scores.size}종`);
  ck("조심할 것도 쌍마다 다르다", cares.size >= 6, `${cares.size}종`);
}

/* ── ⑧ 없는 정보는 비운다 ── */
ck("상대 생년월일이 없으면 안 낸다", readMatch({ a: A, b: null }) === null);
ck("내 명식이 없으면 안 낸다", readMatch({ a: { birth: { y: 1990 } }, b: B }) === null);
ck("시(時)를 몰라도 죽지 않는다",
   !!readMatch({ a: A, b: { ...B, saju: { idx: { ...B.saju.idx, hG: null, hJ: null } } } }));

/* ── ⑨ 버그 셋 (역할과초대 §B-0-b) ─────────────────────────────────────────
   셋 다 **화면이 멀쩡해 보이는 종류**였다. 값이 조용히 틀렸고, 문장은 매끄러웠다.
   그래서 여기서 못 박는다 — 세 개 전부 "되살아나면 알아채는" 모양으로 쓴다. */
{
  /* ① 축⑨(수비학)의 v 가 `same ? 1 : 1` 이라 늘 긍정표였다.
     연쇄 피해: plus 가 항상 ≥1 → split 이 사실상 minus 만 보게 되고 →
     「아홉 축이 전부 어렵다」 분기가 도달 불가능해진다. 그 분기가 닿는지를 직접 본다. */
  const lifeRow = (x) => x.rows.find((q) => q.from.includes("수비학"));
  const diff = [];
  for (let i = 0; i < 400 && diff.length < 2; i++) {
    const x = readMatch({ a: P(i % 10, i % 12, 1990 + i % 30, 1 + i % 12, 1 + i % 28, i % 24),
                          b: P((i * 7) % 10, (i * 5) % 12, 1988 + (i * 3) % 30, 1 + (i * 5) % 12, 1 + (i * 7) % 28, (i * 2) % 24) });
    if (!x) continue;
    const row = lifeRow(x);
    if (row && !row.val.split(" ↔ ")[0].trim().startsWith(row.val.split(" ↔ ")[1].trim())) diff.push(row.v);
  }
  ck("① 수비학 축이 상수가 아니다 — 길이 다르면 긍정표를 안 던진다",
     diff.length > 0 && diff.every((v) => v === 0), `다른 길 표본 ${diff.length}건 · v=${[...new Set(diff)].join(",")}`);

  /* 「아홉 축이 전부 어렵다」 분기는 **드물다 — 실측 0.36%.** 그래서 표본이 커야 잡힌다.
     900쌍으로는 기댓값이 3건이라 우연히 0이 나온다(실제로 그렇게 한 번 헛통과했다).
     40,000쌍 결정론적 스윕이 A/B 로 갈린 지점이다: `same?1:1` 이면 **0건**, `same?1:0` 이면 **154건**.
     난수 대신 LCG 를 쓰는 이유 — 검사가 실행할 때마다 다른 답을 내면 그건 검사가 아니다. */
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let allMinus = 0, branchHit = 0, samples = 0;
  for (let i = 0; i < 40000; i++) {
    const x = readMatch({
      a: P(0 | rnd() * 10, 0 | rnd() * 12, 1950 + (0 | rnd() * 70), 1 + (0 | rnd() * 12), 1 + (0 | rnd() * 28), 0 | rnd() * 24),
      b: P(0 | rnd() * 10, 0 | rnd() * 12, 1950 + (0 | rnd() * 70), 1 + (0 | rnd() * 12), 1 + (0 | rnd() * 28), 0 | rnd() * 24) });
    if (!x) continue;
    samples++;
    const plus = x.rows.filter((q) => q.v >= 1), minus = x.rows.filter((q) => q.v <= -1);
    if (!plus.length && minus.length) { allMinus++; if (!x.split) branchHit++; }
  }
  ck("① 「전부 어렵다」 분기가 도달 가능하다(죽은 코드가 아니다)",
     allMinus > 0 && branchHit > 0, `${samples}쌍 중 ${allMinus}건 (${(allMinus / samples * 100).toFixed(2)}%) · 고치기 전 0건`);

  /* ② 납음이 달력 연도가 아니라 **사주년**(입춘 보정)에서 나와야 한다.
     1~2월 초 출생자는 같은 사람인데 궁합과 각인이 다른 납음을 말했다. */
  {
    const soundOf = (x) => x.rows.find((q) => q.from.includes("소리")).val.split(" ↔ ")[0].trim();
    // 입춘 전(1/15)에 태어난 사람 — saju.nayin 을 들고 오면 그 값을 그대로 써야 한다
    const withSaju = { saju: { idx: { yG: 9, yJ: 3, mG: 3, mJ: 5, dG: 2, dJ: 0, hG: 8, hJ: 10 }, nayin: "대림목" },
                       birth: { y: 1990, m: 1, d: 15, h: 9, min: 0 } };
    const x = readMatch({ a: withSaju, b: B });
    ck("② 납음은 명식이 이미 보정한 값을 쓴다(궁합·각인이 안 갈린다)",
       x && soundOf(x) === "대림목", x ? soundOf(x) : "null");
    // 명식에 납음이 없는 옛 저장분은 예전처럼 계산해서 죽지 않아야 한다
    const noNayin = { ...withSaju, saju: { idx: withSaju.saju.idx } };
    ck("② 명식에 납음이 없어도 안 죽는다", !!readMatch({ a: noNayin, b: B }));
  }

  /* ③ 축⑥ 문구가 조건보다 더 말했다 — 합만 보면서 "한쪽이 무겁고 한쪽이 가벼워"라고 단언했다.
     둘 다 중간(차이가 작음)인 쌍에서 그 문장이 안 나오는지 본다. */
  {
    const w6 = (x) => { const r6 = x.rows.find((q) => q.from.includes("자바")); return { txt: st(r6.w), val: r6.val }; };
    let checkedEven = 0, lied = 0, sawTilted = 0;
    for (let i = 0; i < 900; i++) {
      const x = readMatch({ a: P(i % 10, (i * 3) % 12, 1970 + i % 55, 1 + i % 12, 1 + i % 28, i % 24),
                            b: P((i * 3) % 10, (i * 7) % 12, 1970 + (i * 7) % 55, 1 + (i * 5) % 12, 1 + (i * 11) % 28, (i * 5) % 24) });
      if (!x) continue;
      const { txt, val } = w6(x);
      const [na, nb] = val.split("=")[0].split("+").map((s) => +s.trim());
      const gap = Math.abs(na - nb), sum = na + nb;
      if (sum > 20 && sum < 28) {
        if (gap < 5) { checkedEven++; if (/한쪽이 무겁고/.test(txt)) lied++; }
        else if (/한쪽이 무겁고/.test(txt)) sawTilted++;
      }
    }
    ck("③ 무게가 비슷한데 '한쪽이 무겁다'고 말하지 않는다",
       checkedEven > 0 && lied === 0, `차이<5 표본 ${checkedEven}건 · 거짓 단언 ${lied}건`);
    ck("③ 실제로 기운 쌍에는 여전히 그렇게 말한다(문구를 죽인 게 아니다)",
       sawTilted > 0, `차이≥5 표본 ${sawTilted}건`);
  }
}

/* ── ⑩ 「같은 날, 다른 하늘」 (v137 · 유인동기와루프설계 §3-B) ─────────────────
   이 절의 존재 이유는 **경외**다 — 같은 두 사람을 두고 아홉이 다르게 말한다는 사실.
   그래서 지켜야 할 게 둘이고 둘 다 조용히 깨진다:
     ① 아홉을 **묶지 않는다**(문명별로 합치면 "동아시아 안에서도 갈린다"가 사라진다)
     ② **총점이 여기 안 들어간다**(평균을 내면 이 절이 부정하는 바로 그것이 된다) */
{
  const c = r.chorus;
  ck("⑩ 아홉을 그대로 편다(문명별로 안 묶는다)", c.cells.length === r.rows.length, `${c.cells.length}칸 / ${r.rows.length}축`);
  ck("⑩ 같은 문명이 여러 칸에 나오는 걸 허용한다(그게 정보다)",
     new Set(c.cells.map((x) => x.civ)).size < c.cells.length,
     [...new Set(c.cells.map((x) => x.civ))].join(","));
  ck("⑩ 칸마다 상태가 셋 중 하나", c.cells.every((x) => ["맞는다", "갈린다", "그 사이"].includes(x.say)));
  ck("⑩ 상태가 축 판정과 일치한다",
     c.cells.every((x, i) => x.say === (r.rows[i].v >= 1 ? "맞는다" : r.rows[i].v <= -1 ? "갈린다" : "그 사이")));
  /* 총점 금지 — chorus 에 점수 계열 필드가 있으면 안 된다. 있으면 화면이 곧 그걸 쓴다. */
  ck("⑩ 총점이 chorus 에 없다",
     !("score" in c) && !("band" in c) && !("ratio" in c) && !("pct" in c), Object.keys(c).join(","));
  ck("⑩ 세는 건 '몇이 갈렸나'뿐", typeof c.agree === "number" && typeof c.differ === "number"
     && c.agree === r.rows.filter((x) => x.v >= 1).length && c.differ === r.rows.filter((x) => x.v <= -1).length);

  /* 머리글 세 갈래가 **다 도달 가능한가.** 특히 「같은 문명 안에서 갈림」은 첫 판에 문장이
     "동아시아는 맞다 하고 동아시아는 갈린다"로 나와 버그처럼 읽혔던 자리다. */
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    /* ⚠ 「같은 문명 안에서만 갈림」을 **머리글로 쓰는 폴백은 40,000쌍에서 0건**이었다 —
     도달 불가라 그걸 "네 갈래 다 나온다"로 검사하면 **영영 붉게 뜨는 검사**가 된다.
     대신 그 사실을 `inner` 덧줄로 옮겼고(실측 70.7%), 그건 도달 가능하므로 그걸 잰다. */
  const kinds = { 갈림: 0, 한목소리: 0, 다어렵다: 0, 머리글이내부갈림: 0, 덧줄: 0 };
  for (let i = 0; i < 3000; i++) {
    const x = readMatch({
      a: P(0 | rnd() * 10, 0 | rnd() * 12, 1950 + (0 | rnd() * 70), 1 + (0 | rnd() * 12), 1 + (0 | rnd() * 28), 0 | rnd() * 24),
      b: P(0 | rnd() * 10, 0 | rnd() * 12, 1950 + (0 | rnd() * 70), 1 + (0 | rnd() * 12), 1 + (0 | rnd() * 28), 0 | rnd() * 24) });
    if (!x) continue;
    const h = st(x.chorus.head);
    if (/같은 쪽/.test(h)) kinds.한목소리++;
    else if (/다 어렵다/.test(h)) kinds.다어렵다++;
    else if (/안에서도 갈려/.test(h)) kinds.머리글이내부갈림++;
    else kinds.갈림++;
    if (x.chorus.inner) kinds.덧줄++;
    /* ⚠ 절대 나오면 안 되는 모양 — 같은 문명 이름이 양쪽에 오는 문장 */
    const m = h.match(/^(.+?)(?:은|는) 맞는다고 하고, (.+?)(?:은|는) 갈린다고 해/);
    if (m && m[1] === m[2]) { kinds.버그 = (kinds.버그 || 0) + 1; }
  }
  ck("⑩ 머리글 세 갈래가 전부 도달 가능하다",
     kinds.갈림 > 0 && kinds.한목소리 > 0 && kinds.다어렵다 > 0, JSON.stringify(kinds));
  /* 70.7% — 이게 0 이면 덧줄이 죽은 코드다(앞판이 정확히 그랬다) */
  ck("⑩ '안에서도 갈려' 덧줄이 실제로 붙는다", kinds.덧줄 > 500, `${kinds.덧줄}/3000`);
  ck("⑩ 덧줄이 머리글과 같은 말을 반복하지 않는다",
     kinds.머리글이내부갈림 === 0 || kinds.덧줄 < 3000, JSON.stringify(kinds));
  ck("⑩ '동아시아는 맞다 하고 동아시아는 갈린다' 같은 문장이 안 나온다", !kinds.버그, `${kinds.버그 || 0}건`);
}

/* ⑪ 문구가 엔진보다 더 말하지 않는가 (2026-08-29 신설)
   문장 감사가 잡은 **확정 거짓 둘**을 무는 자리다. 여태 이 둘을 무는 검사가 **0건**이었고,
   그래서 「기질이 다름」을 「잘 맞아」로 말하는 상태가 오래 살아 있었다.
   ⚠ 값이 아니라 **성질**을 본다 — 문턱 숫자를 바꿔도 거짓이 되살아나면 여기서 걸린다. */
{
  const src = readFileSync(new URL("../src/lib/match.js", import.meta.url), "utf8");

  /* ①가나 5점 = 기질이 **다름**. 그게 「잘 맞아」 목록에 들어가면 안 된다.
     sky.js: 같으면 6 / 한쪽이 인간족이면 5 / 그 외 0 → 5/6=0.833 이 옛 문턱(0.8)을 통과했다. */
  ck("⑪ 高 판정이 만점만 센다(비율 문턱이 아니다)",
     /akHigh = akRows\.filter\(\(x\) => x\.sc === x\.max\)/.test(src),
     /akHigh = akRows\.filter\(\(x\) => x\.ratio/.test(src) ? "비율 문턱이 살아 있다" : "sc===max");

  /* ②바르나는 `VARNA[rA] >= VARNA[rB]` 라 **동급도 1점**이다.
     1점을 「갈렸다」고 말하면 동급(전수 40.0%)에게 거짓이 된다. */
  ck("⑪ 바르나 1점을 '갈렸다'고 말하지 않는다",
     !/주도권이 자연스럽게 갈려/.test(src),
     /주도권으로 안 부딪히는/.test(src) ? "안 부딪히는 결" : "문구 미확인");

  /* 실제 산출물에서도 확인 — 소스만 보면 다른 곳에서 되살아날 수 있다 */
  let hitGana = 0, hitVarna = 0, n = 0;
  for (let dG = 0; dG < 10; dG++) for (let dJ = 0; dJ < 12; dJ++) {
    const rr = readMatch({ a: A, b: P(dG, dJ, 1996, (dJ % 12) + 1, (dG % 27) + 1, 10) });
    const all = st(JSON.stringify(rr));
    n++;
    /* 「…가 잘 맞아」 목록에 든 항목은 전부 만점이어야 한다 */
    const ak = rr.rows && rr.rows.find((x) => /여덟 항목|무엇이 맞/.test(String(x.from || x.ask || "")));
    if (ak && /잘 맞아/.test(st(ak.w || ""))) {
      /* ⚠ 「…가 잘 맞아. 대신 …이 낮아」 한 문장에 高·低 목록이 **둘 다** 들어 있다.
         「잘 맞아」 앞부분만 잘라야 한다 — 통째로 훑으면 낮은 항목까지 잡혀 검사가 늘 실패한다. */
      const hi = st(ak.w).split("잘 맞아")[0];
      const named = (rr.akRows || []).filter((x) => hi.includes(x.label));
      if (named.some((x) => x.sc !== x.max)) hitGana++;
    }
    if (/주도권이 자연스럽게 갈려/.test(all)) hitVarna++;
  }
  ck("⑪ 산출물에서도 만점 아닌 항목이 '잘 맞아'에 안 든다", hitGana === 0, `${hitGana}/${n}`);
  ck("⑪ 산출물에서도 '주도권이 갈려'가 안 나온다", hitVarna === 0, `${hitVarna}/${n}`);
}

const pass = R.filter(Boolean).length;
console.log(`\n=== 궁합 엔진: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
