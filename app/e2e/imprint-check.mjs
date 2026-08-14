/* 각인 판정 엔진 검사 — app/src/lib/imprint.js
   이 엔진은 **표를 조회할 뿐 지어내지 않는다**가 전부다. 그래서 검사도 그걸 본다:
   ① 자리가 빠짐없이 차는가 ② 기법 용어가 새지 않는가 ③ 근거 없는 문장이 없는가
   ④ 입력이 달라지면 답도 달라지는가(모두에게 같은 말을 하면 그건 운세가 아니라 덕담이다)
   실행: node app/e2e/imprint-check.mjs */
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
/* 키를 안 받으면 그 줄이 통째로 빠진다(§⑤) — 그래서 기본은 넷, 키를 주면 다섯이다 */
ck("몸이 네 항목 이상", a.body.length >= 4, `${a.body.length}개`);
ck("키를 주면 한 줄 늘어난다", readImprint({ ...A, heightCm: 178 }).body.length === a.body.length + 1);
ck("짝이 열 항목", a.mate?.length === 10, `${a.mate?.length}개`);
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
  const line = r.body.find((x) => x[0] === "평생 약한 곳")[1];
  return r.health.agree ? true : /한 곳이 아니야/.test(line);
})());
ck("약한 자리를 되묻는 문항이 축마다 있다",
  a.checks.filter((c) => /말썽인가/.test(c[0])).length === a.health.els.length);

/* ── ⑩ 키 — 맞히지 않는다. 받으면 해석하고, 없으면 아예 안 쓴다 ── */
{
  const noH2 = readImprint(A), withH = readImprint({ ...A, heightCm: 178 });
  ck("키를 안 주면 키 얘기를 안 한다", !noH2.body.some((x) => x[0] === "키") && !JSON.stringify(noH2.body).includes("cm"));
  ck("키를 주면 그 값을 그대로 쓴다", withH.body.some((x) => x[0] === "키" && x[1].includes("178cm")));
  ck("키를 명식에서 뽑지 않는다(각주가 그렇게 밝힌다)",
    withH.notes.some((t) => t.includes("키를 명식에서 뽑지 않았다")));
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

const pass = R.filter(Boolean).length;
console.log(`\n=== 각인 엔진: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
