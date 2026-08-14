/* 각인 판정 엔진 검사 — app/src/lib/imprint.js
   이 엔진은 **표를 조회할 뿐 지어내지 않는다**가 전부다. 그래서 검사도 그걸 본다:
   ① 자리가 빠짐없이 차는가 ② 기법 용어가 새지 않는가 ③ 근거 없는 문장이 없는가
   ④ 입력이 달라지면 답도 달라지는가(모두에게 같은 말을 하면 그건 운세가 아니라 덕담이다)
   실행: node app/e2e/imprint-check.mjs */
import { readFileSync } from "node:fs";
import { readImprint } from "../src/lib/imprint.js";

const R = []; const ck = (n, p, g = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${g ? " · " + g : ""}`); };

/* 가상 명식 — 실제 인물의 값을 쓰지 않는다(CLAUDE.md §운영 규칙) */
const LADDER = (s) => [...Array(8)].map((_, i) => ({ startAge: s + i * 10, endAge: s + 9 + i * 10, ganji: ["병진", "을묘", "갑인", "계축", "임자", "신해", "경술", "기유"][i], el: ["토", "목", "목", "토", "수", "수", "토", "금"][i] }));
const A = { saju: { idx: { yG: 9, yJ: 3, mG: 3, mJ: 5, dG: 4, dJ: 0, hG: 8, hJ: 10 }, counts: { 목: 1, 화: 2, 토: 2, 금: 0, 수: 3 } },
  ladder: LADDER(8), birth: { y: 2000, m: 5, d: 30, h: 20, min: 46 }, sex: "M", now: new Date(2026, 7, 12) };
const B = { saju: { idx: { yG: 6, yJ: 6, mG: 0, mJ: 2, dG: 1, dJ: 7, hG: 5, hJ: 9 }, counts: { 목: 3, 화: 2, 토: 2, 금: 1, 수: 0 } },
  ladder: LADDER(3), birth: { y: 1995, m: 2, d: 11, h: 6, min: 20 }, sex: "F", now: new Date(2026, 7, 12) };

const a = readImprint(A), b = readImprint(B);
ck("각인이 나온다", !!a && !!b);

/* ── ① 자리가 빠짐없이 찬다 ── */
ck("겉·속·막힌 자리 셋이 다 있다", !!(a.core.surface?.w && a.core.inner?.w && a.core.block?.t));
/* 「생김새」는 겉모습만 — 몸·얼굴·목소리 셋. 건강은 아래 4단이 맡는다(중복 제거) */
ck("생김새가 세 항목", a.body.length === 3, a.body.map((x) => x[0]).join("/"));
/* v122: 방향·직업·취향·섞이는 결이 더해져 열넷이 됐다(창업자 요청 뎁스) */
ck("짝이 열넷 이상", a.mate?.length >= 14, `${a.mate?.length}개`);
ck("뒤집히는 조건 셋", a.trig.length === 3);
ck("여든 해가 여덟 구간", a.bands.length === 8, `${a.bands.length}개`);
ck("열두 달이 갈린다", a.when.hardMonths.length + a.when.softMonths.length > 0,
   `무거움 ${a.when.hardMonths.join(",")} / 순함 ${a.when.softMonths.join(",")}`);

/* ── ② 여든 해가 통짜로 같으면 간지 판정이 깨진 것이다(v1 에서 실제로 그랬다) ── */
const titles = new Set(a.bands.map((x) => x.title));
ck("여든 해가 구간마다 다르다(간지 판정 생존)", titles.size >= 5, `${titles.size}종`);
ck("여든 해에 인도 시기가 얹힌다", a.bands.every((x) => x.dashaKo), a.bands[0].dashaKo);

/* ── ③ 기법 용어가 화면 문자열로 새지 않는가 ── */
const shown = JSON.stringify({ core: a.core, body: a.body, mate: a.mate, trig: a.trig.map((t) => [t.t, t.w]), job: a.job, bands: a.bands.map((x) => [x.title, x.event]) });
const BANNED = ["십성", "일간", "일지", "대운", "세운", "용신", "신강", "신약", "명식", "신살", "지장간", "배우자궁",
  "비견", "겁재", "식신", "정재", "편재", "정관", "편관", "정인", "편인", "하우스", "프로펙션", "다샤", "나크샤트라", "상승궁"];
const leak = BANNED.filter((w) => shown.includes(w));
ck("기법 용어가 본문에 안 나온다", leak.length === 0, leak.join(",") || "깨끗");

/* ── ④ 각주 — 모든 문장에 근거가 붙는가 ── */
ck("각주가 스무 개 이상", a.notes.length >= 20, `${a.notes.length}개`);
ck("몸·짝의 각주 번호가 전부 실재한다",
   [...a.body, ...a.mate].every(([, , n]) => Number.isInteger(n) && n >= 1 && n <= a.notes.length));
ck("각주에는 기법 이름을 적는다(검증용이므로)", a.notes.join(" ").includes("일간"), "");
ck("추정값은 추정이라고 적는다", a.notes.some((t) => t.includes("추정")));

/* ── ⑤ 입력이 다르면 답도 다르다 — 아무에게나 맞는 말이면 상품이 아니다 ── */
const diff = (x, y) => JSON.stringify(x) !== JSON.stringify(y);
ck("다른 사람에게 다른 겉", diff(a.core.surface, b.core.surface), `${a.core.surface.w} / ${b.core.surface.w}`);
ck("다른 사람에게 다른 막힌 자리", a.core.blockKey !== b.core.blockKey, `${a.core.blockKey} / ${b.core.blockKey}`);
ck("다른 사람에게 다른 몸", diff(a.body.map((x) => x[1]), b.body.map((x) => x[1])));
ck("다른 사람에게 다른 짝", diff(a.mate.map((x) => x[1]), b.mate.map((x) => x[1])));

/* ── ⑥ 없는 정보는 비운다 ── */
const noSex = readImprint({ ...A, sex: null });
ck("성별이 없으면 짝 자리를 비운다", noSex.mate === null);
const noHour = readImprint({ ...A, saju: { ...A.saju, idx: { ...A.saju.idx, hG: null, hJ: null } } });
ck("시(時)가 없으면 그렇다고 표시한다", noHour.noHour === true);
ck("대운이 없어도 안 죽는다", !!readImprint({ ...A, ladder: [] }));
ck("간지를 못 읽는 구간은 버린다(조용히 틀린 값을 안 낸다)",
   readImprint({ ...A, ladder: [{ startAge: 8, endAge: 17, ganji: "??", el: "토" }] }).bands.length === 0);

/* ── ⑦ 짝의 시기는 셈들의 합의여야 한다 ── */
/* 흩어져 있는데 평균을 내서 한 숫자로 내놓으면 합의가 아니라 눈속임이다.
   겹칠 때만 "겹친다"고 말하고, 갈리면 갈린다고, 하나뿐이면 하나뿐이라고 적어야 한다. */
for (const [nm, r] of [["A", a], ["B", b]]) {
  const line = r.mate.find((x) => x[0] === "언제 만나나")[1];
  const note = r.notes[r.mate.find((x) => x[0] === "언제 만나나")[2] - 1];
  const agree = /두 셈이 .*겹친다/.test(line);
  const spread = +(note.match(/폭 (\d+)년/) || [0, 99])[1];
  ck(`${nm} — 겹친다고 말할 때만 실제로 좁다`, agree ? spread <= 8 : true, `${line.replace(/<[^>]+>/g, "")} (폭 ${spread}년)`);
  ck(`${nm} — 후보가 하나면 하나라고 말한다`, /후보가 <b>하나<\/b>/.test(note) === /셈이 <b>하나뿐<\/b>/.test(line));
  ck(`${nm} — 짝 나이가 스물둘 이상`, +(line.match(/(\d+)세/) || [0, 99])[1] >= 22);
}

/* ── ⑧ 짝의 시기가 상수로 굳지 않는가 ──
   v115 는 서양 축으로 프로펙션 7하우스를 썼는데, 그건 나이 % 12 == 6 이라 **누구나 6·18·30·42세**다.
   개인차 0인 격자를 증언으로 세고 최종 답까지 거기에 스냅시킨 결과, 200명 중 148명이 '30세'로 나왔다.
   이 검사는 그 붕괴를 다시 잡는다 — 사람이 달라지면 답도 갈려야 한다. */
{
  const LAD = (s) => [...Array(8)].map((_, i) => ({ startAge: s + i * 10, endAge: s + 9 + i * 10,
    ganji: ["병진", "을묘", "갑인", "계축", "임자", "신해", "경술", "기유"][i], el: ["토", "목", "목", "토", "수", "수", "토", "금"][i] }));
  const ages = {};
  for (let i = 0; i < 120; i++) {
    const r = readImprint({ saju: { idx: { yG: i % 10, yJ: i % 12, mG: (i * 3) % 10, mJ: (i * 5) % 12, dG: (i * 7) % 10, dJ: (i * 11) % 12, hG: (i * 2) % 10, hJ: (i * 4) % 12 },
      counts: { 목: i % 4, 화: (i + 1) % 4, 토: (i + 2) % 4, 금: (i + 3) % 4, 수: (i + 1) % 3 } },
      ladder: LAD(3 + i % 7), birth: { y: 1970 + i % 40, m: 1 + i % 12, d: 1 + i % 28, h: i % 24, min: 0 },
      sex: i % 2 ? "M" : "F", now: new Date(2026, 7, 14) });
    if (!r?.mate) continue;
    const v = (r.mate.find((x) => x[0] === "언제 만나나")[1].match(/(\d+)세/) || [0, "-"])[1];
    ages[v] = (ages[v] || 0) + 1;
  }
  const tot = Object.values(ages).reduce((x, y) => x + y, 0);
  const top = Object.entries(ages).sort((x, y) => y[1] - x[1])[0];
  ck("짝의 시기가 한 나이로 쏠리지 않는다(상수화 방지)", top[1] / tot < 0.5, `최다 ${top[0]}세 ${top[1]}/${tot} · 분포 ${JSON.stringify(ages)}`);
}

/* ── ⑨ 몸: 한 축만 보지 않는가 ──
   실사용 제보(2026-08-14): 목 0개라 "간·눈"이라 적었는데 실제는 폐렴·충수염·당뇨(금·토).
   불급만 보고 태과·피극을 안 봐서 생긴 오답이다. 축이 여럿일 땐 여럿이라고 적어야 한다. */
ck("몸의 축을 여러 개 센다", Array.isArray(a.health?.axes) && a.health.axes.length >= 1, `A ${a.health.axes.map((x) => `${x.el}(${x.k})`).join(" ")}`);
ck("태과가 3개 이상이면 축에 잡힌다", (() => {
  const heavy = readImprint({ ...A, saju: { ...A.saju, counts: { 목: 0, 화: 1, 토: 4, 금: 2, 수: 1 } } });
  return heavy.health.els.includes("토");
})(), "토 4개 → 태과 축");
ck("축이 갈리면 한 곳으로 못 박지 않는다", (() => {
  const r = readImprint({ ...A, saju: { ...A.saju, counts: { 목: 0, 화: 1, 토: 4, 금: 2, 수: 1 } } });
  const line = r.domains.find((d) => d.k === "몸").steps[0][1];
  return r.health.agree ? true : /한 곳이 아니야/.test(line);
})());
ck("약한 자리를 되묻는 문항이 축마다 있다",
  a.checks.filter((c) => /말썽인가/.test(c[0])).length === a.health.els.length);

/* ── ⑩ 키 — 예측도 안 하고 입력도 안 받는다 ──
   v115 는 명식에서 cm 를 뽑았고(지어낸 표), v116 은 받아서 되읊었다("179는 7cm 큰 쪽이라 눈에 띈다").
   둘 다 틀렸다. 뺄셈은 해석이 아니다. 키는 이 문서가 다루는 값이 아니다. */
{
  const all = JSON.stringify([readImprint(A), readImprint({ ...A, married: true, metAge: 27 })]);
  ck("키를 아예 다루지 않는다", !/\d+\s*cm/.test(all) && !readImprint(A).body.some((x) => x[0] === "키"));
}

/* ── ⑪ 기혼자에게 배우자 외모·집안·벌이를 예언하지 않는다 ── */
{
  const wed = readImprint({ ...A, married: true, metAge: 27 });
  const keys = wed.mate.map((x) => x[0]);
  ck("기혼이면 짝 자리가 관계 해석으로 바뀐다", wed.mateMode === "wed", keys.join("/"));
  ck("기혼에게 배우자 외모·집안·벌이를 안 쓴다", !keys.some((k) => ["인상", "키·체형", "집안", "벌이"].includes(k)));
  ck("기혼에게 '언제 만나나'를 예언하지 않는다", !keys.includes("언제 만나나"));
  ck("만난 나이를 주면 그 시기를 해석한다", keys.includes("만난 때") && wed.mate.find((x) => x[0] === "만난 때")[1].includes("27세"));
  ck("미혼이면 예측 모드 그대로", readImprint({ ...A, married: false }).mateMode === "pre");
}

/* ── ⑫ 톤 — 신은 사전을 읽지 않는다 ──
   창업자 판정(2026-08-14): "너무 전문성 없어 보이고 바보 같아. 신도 아닌 거 같아."
   원인 하나는 **한 문단 안에서 말투가 두 번 바뀌는 것**이었다 —
   감싸는 문장은 "-야"체인데 표에서 꺼낸 문장이 "-다"체(사전체)였다.
   이 검사는 화면에 나가는 문장이 사전체로 끝나는 걸 잡는다. */
{
  const SENT = (r) => [
    r.core.surface.d, r.core.inner.d, r.core.block.s, r.core.block.w, r.core.block.fix,
    ...r.body.map((x) => x[1]), ...(r.mate || []).map((x) => x[1]),
    ...r.trig.map((t) => t.w), ...r.domains.flatMap((d) => d.steps.map((st) => st[1])),
    ...r.bands.map((x) => x.event), ...r.checks.map((c) => c[1]), r.job.grew, r.job.ex,
  ].map((t) => String(t).replace(/<[^>]+>/g, "").trim());
  /* 사전체 종결 — "-ㄴ다/-는다/-이다/-한다/-된다" 로 끝나는 문장 */
  const DRY = /(?:[는ㄴ]다|이다|았다|었다|린다|난다|긴다|온다|간다|본다|한다|된다|든다|넣다|없다|있다|같다|많다|낫다|크다|넓다|깊다)[.!?]?$/;
  const bad = [];
  for (const r of [readImprint(A), readImprint(B), readImprint({ ...A, married: true, kids: true, metAge: 27 })])
    for (const t of SENT(r)) for (const one of t.split(/(?<=[.!?])\s+/)) if (one && DRY.test(one.trim())) bad.push(one.trim());
  ck("화면 문장이 사전체로 끝나지 않는다", bad.length === 0, bad.slice(0, 4).join(" / ") || "전부 신의 말투");
}

/* ── ⑬ 유년 구간에 어른의 사건을 쓰지 않는다 ──
   실제 판결문에 "5~14세: 월급이 오르거나 집·차처럼 이름이 올라가는 물건이 생긴다"가 나왔고,
   같은 뿌리로 스물다섯 살 유저에게 "돈이 도는 구간은 5~14세로 이미 지나갔어"라고 적었다. */
{
  const early = readImprint({ ...A, ladder: [...Array(8)].map((_, i) => ({ startAge: 5 + i * 10, endAge: 14 + i * 10,
    ganji: ["병진", "을묘", "갑인", "계축", "임자", "신해", "경술", "기유"][i], el: ["토", "목", "목", "토", "수", "수", "토", "금"][i] })),
    birth: { y: 2001, m: 5, d: 30, h: 20, min: 46 } });
  const kid = early.bands.filter((b) => b.to < 18);
  ck("유년 구간에 어른의 사건이 안 붙는다", kid.every((b) => !/월급|승진|계약|이직|투자|부업|동업/.test(b.event)),
    kid.map((b) => `${b.from}~${b.to}: ${b.event.slice(0, 14)}`).join(" | ") || "유년 구간 없음");
  const money = early.domains.find((d) => d.k === "돈").steps[3][1];
  ck("돈의 앞날을 유년 구간으로 결론짓지 않는다", !/1[0-7]세로 이미 지나갔|~1[0-7]세</.test(money), money.replace(/<[^>]+>/g, "").slice(0, 46));
  ck("서른다섯 칸에 '어머니와 집이 세상의 전부' 를 안 붙인다",
    early.bands.filter((b) => b.from >= 18).every((b) => !/어머니와 집이 세상의 전부/.test(b.dashaKo || "")));
}

/* ── ⑭ 같은 문장이 여러 자리에서 반복되지 않는다 ──
   판결문에서 "지금 열 해(25~34세)는 다른 쪽에 쏠려 있어."가 다섯 자리에 그대로 나왔다.
   같은 문장이 다섯 번 나오면 읽는 사람은 이게 조립품이라는 걸 즉시 안다. */
{
  const now = readImprint({ ...A, married: true, kids: true }).domains.map((d) => d.steps[2][1].replace(/<[^>]+>/g, "").trim());
  const cnt = {};
  for (const t of now) cnt[t] = (cnt[t] || 0) + 1;
  const worst = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0];
  ck("「지금」 칸이 자리마다 다른 말을 한다", worst[1] <= 2, `최다 반복 ${worst[1]}회 — "${worst[0].slice(0, 30)}"`);
}

/* ── ⑮ 확인 문항이 순수 텍스트로 그려진다 — 태그를 넣으면 화면에 <b> 가 찍힌다 ── */
ck("확인 문항에 HTML 태그가 없다", a.checks.every(([q, w]) => !/[<>]/.test(q + w)),
   a.checks.filter(([q, w]) => /[<>]/.test(q + w)).map((c) => c[1]).join(" / ") || "깨끗");
ck("확인 문항 개수와 실제 축 개수가 맞는다",
   a.checks.filter((c) => /말썽인가/.test(c[0])).length === a.health.els.length);


/* ── ⑯ 아홉 하늘이 **분업**하는가, 그리고 사주를 실제로 흔드는가 ──
   v118 은 아홉에게 같은 질문을 던져 다섯 낱말(=오행)에 투표시켰다. 두 가지가 망가졌다:
   ① 오행 어휘로 환원돼 결국 사주로 읽혔고 ② 세어 놓고 그 결과로 아무것도 안 했다.
   창업자 판정: "그냥 사주인데 굳이 쟤네 왜 붙였지 싶어."
   이 검사는 **각자 다른 질문을 맡는가**와 **결과가 본문을 실제로 바꾸는가**를 지킨다. */
{
  ck("아홉 하늘이 전부 답한다", a.sky9.length >= 9, `${a.sky9.length}개`);
  const asks = a.sky9.map((x) => x.ask);
  ck("아홉이 서로 다른 질문을 맡는다(투표가 아니다)", new Set(asks).size === asks.length, `${new Set(asks).size}/${asks.length}종`);
  ck("사주에 없는 축을 실제로 채운다",
    ["인생의 무게", "어느 쪽으로", "얼마나 무거운가", "시작에 강한가"].every((k) => asks.some((q) => q.includes(k))),
    asks.join(" / "));
  ck("답마다 근거 각주가 붙는다", a.sky9.every((x) => Number.isInteger(x.n) && x.n >= 1 && x.n <= a.notes.length));
  /* 아홉 전부가 셋 중 하나로 자기 급을 밝혀야 한다 — 계산 그대로 / 변환이 없다 / 해석이 섞인다.
     급을 안 밝히면 지어낸 것과 옮긴 것이 같은 목소리로 나간다. */
  const grade = (x) => ["계산 그대로", "변환이 없다", "해석이 섞인다"].filter((g) => a.notes[x.n - 1].includes(g));
  ck("아홉 전부가 근거의 급을 밝힌다", a.sky9.every((x) => grade(x).length === 1),
    a.sky9.filter((x) => grade(x).length !== 1).map((x) => x.from).join(",") || "전부 밝힘");
  ck("해석이 섞인 곳이 있고, 그렇다고 적혀 있다", a.sky9.filter((x) => grade(x)[0] === "해석이 섞인다").length >= 2);
  ck("옮김 없이 그대로 쓴 곳도 있다", a.sky9.filter((x) => grade(x)[0] !== "해석이 섞인다").length >= 4);
  /* 결과가 본문을 실제로 바꾸는가 — 여든 해 지도에 표식이 얹혀야 한다 */
  const marked = a.bands.filter((x) => x.doubleTurn || x.dashaOnly).length;
  ck("아홉 하늘이 여든 해 지도를 실제로 바꾼다", a.bands.every((x) => "doubleTurn" in x && "dashaOnly" in x) && marked >= 1,
    `표식 붙은 구간 ${marked}개`);
}

/* ── ⑯-b 사주와 어긋나는 곳을 따로 말하는가 ──
   창업자 요청: "기존 사주와 다르게 해석되는 부분도 알려줘." 이게 아홉을 붙인 이유 그 자체다.
   ⚠ 억지로 만들면 더 나쁘다 — 어긋남이 없으면 없다고 써야 한다. */
{
  ck("어긋나는 곳을 따로 모은다", Array.isArray(a.clash) && a.clash.length >= 1, `${a.clash.length}개 — ${a.clash.map((c) => c.t).join(", ")}`);
  ck("어긋남마다 근거가 붙는다", a.clash.every((c) => Number.isInteger(c.n) && c.n >= 1 && c.n <= a.notes.length));
  ck("'사주에 아예 없는 것'은 항상 있다", a.clash.some((c) => c.t.includes("아예 없는")));
  /* 겉과 속이 같은 사람에게는 '겉과 속' 어긋남을 쓰지 않는다 — 없는 걸 지어내지 않는다 */
  const same = readImprint({ ...A, saju: { ...A.saju, idx: { ...A.saju.idx, dG: 2 } } });
  const hasSplit = (r) => r.clash.some((c) => c.t === "겉과 속");
  ck("겉과 속이 같으면 그 어긋남을 안 쓴다", hasSplit(a) === a.core.split && hasSplit(same) === same.core.split);
  /* 사람이 바뀌면 어긋남도 바뀌어야 한다 */
  const LAD = (s2) => [...Array(8)].map((_, i) => ({ startAge: s2 + i * 10, endAge: s2 + 9 + i * 10,
    ganji: ["병진", "을묘", "갑인", "계축", "임자", "신해", "경술", "기유"][i], el: ["토", "목", "목", "토", "수", "수", "토", "금"][i] }));
  const kinds = new Set(), vals = new Set();
  for (let i = 0; i < 60; i++) {
    const r = readImprint({ saju: { idx: { yG: i % 10, yJ: i % 12, mG: (i * 3) % 10, mJ: (i * 5) % 12, dG: (i * 7) % 10, dJ: (i * 11) % 12, hG: (i * 2) % 10, hJ: (i * 4) % 12 },
      counts: { 목: i % 4, 화: (i + 1) % 4, 토: (i + 2) % 4, 금: (i + 3) % 4, 수: (i + 1) % 3 } },
      ladder: LAD(3 + i % 7), birth: { y: 1970 + i % 40, m: 1 + i % 12, d: 1 + i % 28, h: i % 24, min: 0 },
      sex: i % 2 ? "M" : "F", now: new Date(2026, 7, 14) });
    kinds.add(r.clash.map((c) => c.t).join("|"));
    vals.add(r.sky9.map((x) => x.val).join("|"));
  }
  ck("사람이 바뀌면 아홉 하늘의 값도 바뀐다", vals.size >= 50, `60명 중 ${vals.size}종`);
  ck("사람이 바뀌면 어긋나는 항목도 바뀐다", kinds.size >= 4, `${kinds.size}종`);
}

/* ── ⑰ 은유가 비문이 되지 않는가 ──
   "네게는 같이 갈 사람이 얇아" — 사람은 얇을 수 없다. 제목용 낱말을 본문 문장에 그대로 끼워
   조립했기 때문이다. 본문은 **뜻이 바로 서는 완결 문장(plain)** 을 쓴다. */
{
  const line = a.domains.find((d) => d.k === "말").steps[0][1].replace(/<[^>]+>/g, "");
  ck("가장 약한 자리를 비문 없이 말한다", !/사람이 얇|문이 얇|손이 얇|틀이 얇/.test(line), line.slice(0, 40));
  /* 제목은 짧은 낱말(비유 아님), 본문은 서술어로 끝나는 완결 문장이어야 한다 */
  ck("제목은 한 낱말, 본문은 완결 문장", a.core.block.t.length <= 5 && /[내아어해여져]$/.test(a.core.block.plain),
    `${a.core.block.t} / ${a.core.block.plain}`);
}

/* ── ⑱ 겉모습과 건강을 두 번 쓰지 않는가 ── */
ck("「생김새」에 건강 항목이 없다(4단이 맡는다)", !a.body.some((x) => /약한 곳|과한 곳/.test(x[0])),
   a.body.map((x) => x[0]).join("/"));

/* ── ⑲ 태어난 곳이 실제로 답을 바꾸는가 ──
   v117 까지 App.jsx 가 **경도만 넘기고 위도는 서울로 고정**이었다. 상승궁은 위도로 갈리므로
   제주에서 태어난 사람과 서울에서 태어난 사람이 같은 값을 받고 있었다 —
   태어난 곳을 물어 놓고 절반만 쓴 셈이다.
   ⚠ 자리 이름(사수자리 등)으로 검사하면 안 된다. 위도 차 4도는 상승궁을 2~3도 움직이는데
      자리 폭은 30도라 대개 같은 자리에 머문다. **각도가 실제로 달라지는지**를 봐야 한다. */
{
  const asc = (lat, lon, h) => readImprint({ ...A, lat, lon, birth: { ...A.birth, h } })._raw.ascDeg;
  const gaps = [...Array(24)].map((_, h) => Math.abs(asc(37.566, 126.978, h) - asc(33.499, 126.53, h)));
  const moved = gaps.filter((g) => g > 0.5).length;
  ck("태어난 곳(위도)이 상승궁을 실제로 움직인다", moved >= 20, `24시각 중 ${moved}개에서 이동 · 최대 ${Math.max(...gaps).toFixed(1)}도`);
  ck("같은 곳이면 값도 같다", Math.abs(asc(37.566, 126.978, 9) - asc(37.566, 126.978, 9)) < 1e-9);
}

/* ── ⑳ 빙빙 돌리지 않는가 ──
   창업자 판정(2026-08-14): "직관적인 말도 빙빙 둘러서 무슨 그릇이 어떻니 저떻니 그래?
   신의 컨셉은 말을 모호하게 하란 게 아니고 **말투나 비주얼**을 말한 거야."
   맞다. 모호한 건 신비가 아니라 회피다. 상담실도 철학관도 단정적으로 말한다.
   이 검사는 은유가 서술어 자리로 돌아오는 걸 잡는다. */
{
  const SHOWN = (r) => [
    r.core.surface.d, r.core.inner.d, r.core.block.s, r.core.block.w, r.core.block.plain, r.core.block.fix,
    ...r.body.map((x) => x[1]), ...(r.mate || []).map((x) => x[1]), ...r.trig.map((t) => t.w),
    ...r.domains.flatMap((d) => [d.t, ...d.steps.map((st) => st[1])]),
    ...r.bands.map((x) => `${x.title} ${x.event}`), ...r.sky9.map((x) => `${x.ask} ${x.say}`),
    ...r.clash.map((c) => c.w), r.job.job, r.job.ex,
  ].map((t) => String(t).replace(/<[^>]+>/g, ""));
  /* 화면 문장에서 금지 — 뜻이 안 서는 은유와 내부 셈 노출 */
  const VAGUE = [
    [/그릇이(야|다)|그릇이라|큰 그릇|받는 그릇/, "그릇"],
    [/쥘 팔 힘|팔 힘/, "팔 힘"],
    [/자리가 \d+개|\d+개로 두꺼|맡은 자리가/, "자리가 N개(유저는 많고 적음을 모른다)"],
    [/네 결이|결이 바뀌어|그 결의/, "결"],
    [/그 문이|문이 열리|문이 닫혀/, "문"],
    [/기운이 흐르|기운이 도는/, "기운이 흐른다"],
  ];
  const hits = [];
  for (const r of [readImprint(A), readImprint(B), readImprint({ ...A, married: true, kids: true, metAge: 27 }),
    readImprint({ ...A, saju: { ...A.saju, counts: { 목: 0, 화: 1, 토: 4, 금: 2, 수: 1 } } })])
    for (const t of SHOWN(r)) for (const [re, label] of VAGUE) if (re.test(t)) hits.push(`${label}: ${t.slice(0, 34)}`);
  ck("화면 문장이 은유로 도망가지 않는다", hits.length === 0, [...new Set(hits)].slice(0, 3).join(" | ") || "깨끗");

  /* 단정적으로 말하는가 — 아홉 자리의 「새겨질 때」가 전부 진술문이어야 한다 */
  const first = readImprint({ ...A, married: true, kids: true }).domains.map((d) => d.steps[0][1].replace(/<[^>]+>/g, ""));
  ck("아홉 자리가 전부 단정으로 시작한다", first.every((t) => t.length >= 25 && !/일 수도|아마|~듯|것 같아/.test(t)),
    first.filter((t) => t.length < 25 || /일 수도|아마|~듯|것 같아/.test(t)).join(" | ") || "전부 단정");
  /* 그리고 실제로 뭘 하라고 말하는가 — 상담은 진단만 하지 않는다 */
  ck("가장 약한 자리에는 할 일이 붙는다", /해|써|만들어|적어|받아|짜/.test(readImprint(A).core.block.fix));
}

/* ── ㉑ 각인은 LLM 을 쓰지 않는다 ──
   창업자 물음: "도대체 어떤 프롬프트가 들어갔길래…" → 프롬프트가 아니다. 전부 이 파일의 표다.
   그래서 문장이 이상하면 프롬프트를 고칠 게 아니라 **표를 고쳐야 한다.** 이 검사가 그 사실을 못 박는다. */
{
  const src = readFileSync(new URL("../src/lib/imprint.js", import.meta.url), "utf8");
  ck("각인 엔진에 API 호출이 없다(문장은 전부 표다)", !/fetch\(|\/api\//.test(src));
}

/* ── ㉒ 어긋남이 문서 전체로 퍼지는가 ──
   창업자 지적(2026-08-14): "처음에 사주에서 못 읽는 부분을 말해주는 건 신기한데,
   그게 밑에까지는 영향이 안 가는 거 같네." 맞다 — 어긋남을 한 절에 모아 두기만 했다.
   자리마다 그 영역을 서양이 어떻게 보는지 붙어야 한다. */
{
  ck("아홉 자리 전부에 서양의 시선이 붙는다", a.domains.every((d) => d.west && d.west.w && d.west.n),
    `${a.domains.filter((d) => d.west).length}/${a.domains.length}`);
  ck("서양 시선에도 근거 각주가 붙는다", a.domains.every((d) => d.west.n >= 1 && d.west.n <= a.notes.length));
  /* 전부 같은 말이면 붙인 의미가 없다 — 겹치는 자리와 조용한 자리가 갈려야 한다 */
  const kinds = new Set(a.domains.map((d) => d.west.w));
  ck("자리마다 같은 말만 하지 않는다", kinds.size >= 2, `${kinds.size}종`);
  const LAD2 = (s2) => [...Array(8)].map((_, i) => ({ startAge: s2 + i * 10, endAge: s2 + 9 + i * 10,
    ganji: ["병진", "을묘", "갑인", "계축", "임자", "신해", "경술", "기유"][i], el: ["토", "목", "목", "토", "수", "수", "토", "금"][i] }));
  let overlap = 0;
  for (let i = 0; i < 40; i++) {
    const r = readImprint({ saju: A.saju, ladder: LAD2(3 + i % 7),
      birth: { y: 1980 + i, m: 1 + i % 12, d: 1 + i % 28, h: i % 24, min: 0 }, sex: "M", now: new Date(2026, 7, 14) });
    if (r.domains.some((d) => /두 셈이 겹쳐/.test(d.west.w))) overlap++;
  }
  ck("겹치는 자리가 사람마다 옮겨 다닌다", overlap >= 5 && overlap <= 38, `40명 중 ${overlap}명에게 겹침`);
}

/* ── ㉓ 돈의 여정 — 언제·얼마나·뭘 해서 ──
   창업자 요청: "돈을 벌면 언제 얼마나 뭘 해서, 그걸 벌기까지의 여정 그래프."
   ⚠ **금액은 안 쓴다.** 명리에 원 단위 표준이 없다 — 키(cm)를 뺀 것과 같은 이유다.
      "얼마나"는 남과의 비교가 아니라 네 여든 해 안에서의 높낮이로 답한다. */
{
  ck("돈의 여정이 구간마다 나온다", a.money.path.length === a.bands.length && a.money.path.every((x) => typeof x.v === "number"));
  ck("구간마다 '뭘 해서 버나'가 붙는다", a.money.path.every((x) => x.how && x.how.length >= 6));
  ck("유년 구간은 버는 구간으로 안 센다", a.money.path.filter((x) => x.young).every((x) => /버는 나이가 아니야/.test(x.how)));
  ck("절정·바닥이 성인 구간에서만 잡힌다", (!a.money.peak || !a.money.peak.young) && (!a.money.trough || !a.money.trough.young),
    a.money.peak ? `절정 ${a.money.peak.from}~${a.money.peak.to}` : "절정 없음");
  /* "원"은 "월급"·"고정"에 안 걸리지만 "원 단위"(각주의 설명)에는 걸린다 — 본문만 본다 */
  const moneyBody = JSON.stringify(a.money.path);
  ck("금액을 지어내지 않는다", !/\d+\s*(원|만원|억|천만)/.test(moneyBody), moneyBody.slice(0, 40));
  /* 사람이 바뀌면 곡선도 바뀌어야 한다 */
  const shapes = new Set();
  for (let i = 0; i < 40; i++) {
    const r = readImprint({ ...A, ladder: [...Array(8)].map((_, k) => ({ startAge: 3 + i % 7 + k * 10, endAge: 12 + i % 7 + k * 10,
      ganji: ["병진", "을묘", "갑인", "계축", "임자", "신해", "경술", "기유"][(k + i) % 8], el: "토" })) });
    shapes.add(r.money.path.map((x) => x.v).join(","));
  }
  ck("돈 곡선이 사람마다 다르다", shapes.size >= 6, `40명 중 ${shapes.size}종`);
}

/* ── ㉔ 짝의 뎁스 — 요청한 항목이 실제로 있는가 ──
   "연인을 만나면 언제 어느 방향 뭐하는 사람 생김새 성격 취향 연봉 집안 궁합 자녀 결혼" */
{
  const pre = readImprint({ ...A, married: false }), keys = pre.mate.map((x) => x[0]);
  for (const need of ["인상", "어느 쪽에서 오나", "뭐하는 사람", "취향", "성격", "집안", "벌이", "언제 만나나", "둘이 섞이는 결"])
    ck(`짝 — ${need}`, keys.includes(need), keys.includes(need) ? "" : keys.join("/"));
  ck("방위는 십이지 배당 그대로다(변환 없음)",
    /변환이 없다/.test(pre.notes[pre.mate.find((x) => x[0] === "어느 쪽에서 오나")[2] - 1]));
  ck("연봉을 숫자로 지어내지 않는다", !/\d+\s*(만원|억|천만)/.test(JSON.stringify(pre.mate)));
  /* 기혼자에게는 외모·집안·벌이 대신 관계 해석 — 단 '섞이는 결'은 양쪽 다 준다 */
  const wed = readImprint({ ...A, married: true });
  ck("기혼에게도 둘이 섞이는 결은 준다", wed.mate.some((x) => x[0] === "둘이 섞이는 결"));
  ck("기혼에게 여전히 외모·직업 예언은 안 한다", !wed.mate.some((x) => ["인상", "뭐하는 사람", "취향"].includes(x[0])));
  ck("나침반이 두 방향을 낸다", !!(a.compass.self && a.compass.mate), `${a.compass.self?.dir} / ${a.compass.mate?.dir}`);
}

/* ── ㉕ 생김새의 근거를 밝히는가 ──
   창업자 물음: "생김새는 어디 근거가 있는 거야?" → 오행 체상론이다. 다만 축소판이고 검증된 적이 없다.
   그걸 각주에 **그대로 적어야** 한다. 안 적으면 계산값과 같은 급으로 읽힌다. */
{
  const face = a.body.find((x) => x[0] === "얼굴");
  const note = a.notes[face[2] - 1];
  ck("생김새 각주가 유파 이름을 밝힌다", /오행 체상론/.test(note));
  ck("생김새 각주가 축소판임을 밝힌다", /축소판|일간과 최다 오행 둘만/.test(note));
  ck("생김새 각주가 미검증임을 밝힌다", /검증한 적이 없|검증되지 않은/.test(note));
  ck("몸·목소리 각주도 미검증을 밝힌다",
    [a.body.find((x) => x[0] === "몸"), a.body.find((x) => x[0] === "목소리")].every((x) => /검증되지 않은/.test(a.notes[x[2] - 1])));
}

const pass = R.filter(Boolean).length;
console.log(`\n=== 각인 엔진: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
