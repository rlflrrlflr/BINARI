/* 궁합 판정 엔진 검사 — app/src/lib/match.js
   궁합은 **"점수 하나"로 뭉개기 제일 쉬운 자리**다. 그래서 검사도 그걸 본다:
   ① 아홉 축이 각자 다른 것을 보는가(투표가 아니라 분업인가)
   ② 갈릴 때 갈린다고 말하는가(평균으로 감추지 않는가)
   ③ 총점을 앞세우지 않는가
   ④ 헤어지라고 말하지 않는가
   실행: node app/e2e/match-check.mjs */
import { readMatch } from "../src/lib/match.js";

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

const pass = R.filter(Boolean).length;
console.log(`\n=== 궁합 엔진: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
