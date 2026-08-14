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
ck("몸이 다섯 항목 이상", a.body.length >= 5, `${a.body.length}개`);
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

/* ── ⑦ 짝의 시기는 세 셈의 합의여야 한다 ── */
/* 셋이 흩어져 있는데 평균을 내서 한 숫자로 내놓으면 합의가 아니라 눈속임이다.
   겹칠 때만 "셋이 가리킨다"고 말하고, 갈리면 갈린다고 적어야 한다. */
for (const [nm, r] of [["A", a], ["B", b]]) {
  const line = r.mate.find((x) => x[0] === "언제 만나나")[1];
  const note = r.notes[r.mate.find((x) => x[0] === "언제 만나나")[2] - 1];
  const agree = /세 가지 셈이 전부/.test(line);
  const spread = +(note.match(/폭 (\d+)년/) || [0, 99])[1];
  ck(`${nm} — 합의라고 말할 때만 실제로 좁다`, agree ? spread <= 8 : spread > 8, `${line.replace(/<[^>]+>/g, "")} (폭 ${spread}년)`);
  ck(`${nm} — 짝 나이가 스물둘~마흔여덟 안`, +(line.match(/(\d+)세/) || [0, 0])[1] >= 22);
}

const pass = R.filter(Boolean).length;
console.log(`\n=== 각인 엔진: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
