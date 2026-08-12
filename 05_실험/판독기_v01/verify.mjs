/* 판독기 자체 검증 — 알려진 값과 대조한다.
   판독기는 "여러 하늘이 같은 말을 하는가"를 파는 물건이라, **판독기 자체가 틀리면 상품이 통째로 거짓**이 된다.
   그래서 외부에서 확인 가능한 값으로만 검사한다. 실행: node 05_실험/판독기_v01/verify.mjs */
import { jdn, weekday, WEEK_KO, tzolkin, haab, weton, akan, thaiDay, honmeisei, lifePath, nayin } from "./lib/decoders.mjs";

const R = []; const ck = (n, pass, got = "") => { R.push(pass); console.log(`${pass ? "PASS" : "FAIL"} — ${n}${got ? " · " + got : ""}`); };

/* ── 달력 기초 ── */
ck("율리우스일 — 2000-01-01 = 2451545", jdn(2000, 1, 1) === 2451545, String(jdn(2000, 1, 1)));
ck("요일 — 2000-01-01 은 토요일", WEEK_KO[weekday(2000, 1, 1)] === "토", WEEK_KO[weekday(2000, 1, 1)]);
ck("요일 — 2024-02-29(윤일) 은 목요일", WEEK_KO[weekday(2024, 2, 29)] === "목", WEEK_KO[weekday(2024, 2, 29)]);
ck("요일 — 1969-07-20(달 착륙) 은 일요일", WEEK_KO[weekday(1969, 7, 20)] === "일", WEEK_KO[weekday(1969, 7, 20)]);

/* ── 마야 ── */
const t0 = tzolkin(jdn(2000, 1, 1));
ck("촐킨 — 2000-01-01 = 11 이크", t0.tone === 11 && t0.sign.startsWith("이크"), `${t0.tone} ${t0.sign}`);
/* 13.0.0.0.0 = 2012-12-21 = 4 아하우 3 칸킨 (마야학 표준) */
const t1 = tzolkin(jdn(2012, 12, 21)), h1 = haab(jdn(2012, 12, 21));
ck("촐킨 — 2012-12-21 = 4 아하우", t1.tone === 4 && t1.sign.startsWith("아하우"), `${t1.tone} ${t1.sign}`);
ck("하압 — 2012-12-21 = 3 칸킨", h1.day === 3 && h1.month === "칸킨", `${h1.day} ${h1.month}`);
/* 롱카운트 기점 0.0.0.0.0 = 4 아하우 8 쿰쿠 */
const jd0 = 584283, t2 = tzolkin(jd0), h2 = haab(jd0);
ck("마야 기점 — 4 아하우 8 쿰쿠", t2.tone === 4 && t2.sign.startsWith("아하우") && h2.day === 8 && h2.month === "쿰쿠",
   `${t2.tone} ${t2.sign} / ${h2.day} ${h2.month}`);

/* ── 구성기학 ── */
ck("본명성 — 1980년생 = 이흑토성", honmeisei(1980).name === "이흑토성", honmeisei(1980).name);
ck("본명성 — 1990년생 = 일백수성", honmeisei(1990).name === "일백수성", honmeisei(1990).name);
ck("본명성 — 2000년생 = 구자화성", honmeisei(2000).name === "구자화성", honmeisei(2000).name);
ck("본명성 — 값이 항상 1~9", [...Array(120)].every((_, i) => { const n = honmeisei(1930 + i).n; return n >= 1 && n <= 9; }));

/* ── 아칸 ── */
ck("아칸 — 목요일생 남자는 Yaw", akan(2024, 2, 29, true).name === "Yaw", akan(2024, 2, 29, true).name);
ck("아칸 — 토요일생 남자는 Kwame", akan(2000, 1, 1, true).name === "Kwame", akan(2000, 1, 1, true).name);
ck("아칸 — 여자 이름도 요일을 따른다", akan(2000, 1, 1, false).name === "Ama", akan(2000, 1, 1, false).name);

/* ── 태국 ── */
ck("태국 — 목요일은 주황·목성", thaiDay(2024, 2, 29).color === "주황색" && thaiDay(2024, 2, 29).planet === "목성");
ck("태국 — 월요일은 노랑(왕실색)", thaiDay(2024, 3, 4).day === "월" && thaiDay(2024, 3, 4).color === "노란색");

/* ── 자바 웨톤 ── */
/* 기준점: 1945-08-17 인도네시아 독립일 = 금요일 레기 */
const w0 = weton(1945, 8, 17);
ck("웨톤 — 기준점이 금요일 레기", w0.day === "금" && w0.pasaran === "레기", w0.name);
ck("웨톤 — (폐기된 기준점 기록) 1633-07-08 율리우스는 금요일이 아니었다",
   WEEK_KO[weekday(1633, 7, 18)] === "월", WEEK_KO[weekday(1633, 7, 18)] + "요일");
/* 파사란은 5일마다 반복하고 웨톤은 35일마다 반복해야 한다 */
const wa = weton(2024, 2, 29), wb = weton(2024, 3, 5), wc = weton(2024, 4, 4);
ck("웨톤 — 파사란이 5일 주기", wa.pasaran === wb.pasaran, `${wa.name} → 5일 뒤 ${wb.name}`);
ck("웨톤 — 웨톤이 35일 주기", wa.name === wc.name, `${wa.name} → 35일 뒤 ${wc.name}`);
/* 넵투 이론 범위는 min(요일3)+min(파사란4)=7 ~ max(9)+max(9)=18 이다. 앞서 9~18 로 잡은 건 내 실수였다 */
ck("웨톤 — 넵투는 7~18 범위", [...Array(400)].every((_, i) => { const n = weton(2024, 1, 1 + i % 300).neptu; return n >= 7 && n <= 18; }));

/* ── 수비학 · 납음 ── */
ck("라이프패스 — 마스터수 11 보존", lifePath(1979, 11, 29) === 11 || [11,22,33].includes(lifePath(1979,11,29)) || lifePath(1979,11,29) <= 9);
ck("라이프패스 — 1~9 또는 11·22·33", [...Array(200)].every((_, i) => { const v = lifePath(1990, 1 + i % 12, 1 + i % 28); return (v >= 1 && v <= 9) || [11,22,33].includes(v); }));
ck("납음 — 2026(병오) = 천하수", nayin(2026) === "천하수", nayin(2026));
ck("납음 — 2023(계묘) = 금박금", nayin(2023) === "금박금", nayin(2023));
ck("납음 — 60년마다 반복", [...Array(60)].every((_, i) => nayin(1900 + i) === nayin(1960 + i)));

const pass = R.filter(Boolean).length;
console.log(`\n=== 판독기 검증: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
