// 만세력 정밀 계산 검증 — 실행: cd app && node e2e/mansae-test.mjs
// App.jsx를 esbuild로 변환해 순수 함수(calcSaju 등)를 직접 임포트한다.
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
execSync("npx esbuild src/App.jsx --format=esm --jsx=automatic --outfile=.mansae-test.tmp.mjs", { cwd: appDir });
const { calcSaju, sunLongitude, equationOfTime, cityLon, moonLongitude, tzolkin, lunar2solar, solar2lunar, daeun } = await import(join(appDir, ".mansae-test.tmp.mjs"));

const results = [];
const check = (name, pass, note = "") => { results.push(pass); console.log(`${pass ? "PASS" : "FAIL"} — ${name}${note ? " · " + note : ""}`); };

// 1. 일주 불변 검증 (기존 검증값)
check("일주 1984-02-02 = 병인", calcSaju(1984, 2, 2, 12, 0, false).pillars.일 === "병인");
check("일주 2000-01-01 = 무오", calcSaju(2000, 1, 1, 12, 0, false).pillars.일 === "무오");

// 2. 입춘 경계 — 2000년 입춘은 2/4 20:32 KST 무렵. 같은 날이라도 시각으로 갈려야 한다(근사표는 불가능했던 판정)
const before = calcSaju(2000, 2, 4, 10, 0, false);
const after = calcSaju(2000, 2, 4, 23, 0, false);
check("입춘 당일 오전 = 전년 기묘년·축월", before.pillars.년 === "기묘", before.pillars.년 + "·" + before.pillars.월);
check("입춘 당일 밤 = 경진년·인월", after.pillars.년 === "경진" && after.pillars.월.endsWith("인"), after.pillars.년 + "·" + after.pillars.월);

// 3. 월중(경계에서 먼 날) 월지 — 전통 월지 배정과 일치해야 함
const MID = [[1, 15, "축"], [2, 15, "인"], [3, 15, "묘"], [4, 15, "진"], [5, 15, "사"], [6, 15, "오"],
  [7, 15, "미"], [8, 15, "신"], [9, 15, "유"], [10, 15, "술"], [11, 15, "해"], [12, 15, "자"]];
let midOk = 0;
for (const [m, d, ji] of MID) if (calcSaju(1993, m, d, 12, 0, false).pillars.월.endsWith(ji)) midOk++;
check("월중 12개월 월지 전통 배정 일치", midOk === 12, `${midOk}/12`);

// 4. 균시차 크기 — 11월 초 +16분대, 2월 중순 -14분대(널리 알려진 극값)
const jdNov = 2451851.0; // 2000-11-02 12:00 UT 근방
const jdFeb = 2451587.0; // 2000-02-12 12:00 UT 근방
const eNov = equationOfTime(jdNov), eFeb = equationOfTime(jdFeb);
check("균시차 11월 초 ≈ +16분", eNov > 15 && eNov < 17.5, eNov.toFixed(2) + "분");
check("균시차 2월 중순 ≈ -14분", eFeb < -13 && eFeb > -15.5, eFeb.toFixed(2) + "분");

// 5. 태양황경 기준점 — 춘분(3/20 무렵) 0° 근방
const lamEquinox = sunLongitude(2451623.816); // 2000-03-20 07:35 UT(춘분)
check("춘분 황경 ≈ 0°", lamEquinox < 0.5 || lamEquinox > 359.5, lamEquinox.toFixed(3) + "°");

// 6. 도시 경도 매핑
check("도시 매핑: 부산 129.08 / 미입력 서울", cityLon("부산 해운대") === 129.08 && cityLon("") === 126.978);

// 7. 진태양시 시주 경도 차이 — 같은 시각도 도시가 다르면 시주가 갈릴 수 있다(부산이 서울보다 +8.4분)
const seoul = calcSaju(1993, 7, 15, 15, 25, false, cityLon("서울"));
const busan = calcSaju(1993, 7, 15, 15, 25, false, cityLon("부산"));
check("시주 계산 정상(서울·부산 모두 산출)", !!seoul.pillars.시 && !!busan.pillars.시, `서울 ${seoul.pillars.시} / 부산 ${busan.pillars.시}`);

// 8. 달 황경 — 식(蝕)은 태양-달 정렬의 절대 검증: 2000-01-21 04:44 UT 개기월식(충), 2000-02-05 13:03 UT 신월(합)
const diff180 = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const oppo = diff180(moonLongitude(2451564.697), sunLongitude(2451564.697) + 180);
const conj = diff180(moonLongitude(2451580.044), sunLongitude(2451580.044));
check("달 황경: 월식 때 태양+180° 정렬", oppo < 1.5, oppo.toFixed(2) + "° 오차");
check("달 황경: 신월 때 태양과 합", conj < 1.5, conj.toFixed(2) + "° 오차");

// 9. 마야 촐킨 — 공표된 앵커: 2000-01-01(JDN 2451545) = 11 이크
const tz = tzolkin(2451545);
check("촐킨: 2000-01-01 = 11 이크(바람)", tz.tone === 11 && tz.sign.includes("이크"), `${tz.tone} ${tz.sign}`);

// 10. 납음오행 — 1990(경오년) = 노방토
check("납음: 경오년 = 노방토(길가의 흙)", (calcSaju(1990, 7, 15, 12, 0, false).nayin || "").includes("노방토"));

// 11. 음력→양력 변환 (v25) — 공표된 설날: 음력 정월 초하루 = 양력 설날
const ny2000 = lunar2solar(2000, 1, 1, false);
check("음력 2000.1.1 = 양력 2000.2.5(설날)", ny2000 && ny2000.y === 2000 && ny2000.m === 2 && ny2000.d === 5, ny2000 && `${ny2000.y}.${ny2000.m}.${ny2000.d}`);
const ny1993 = lunar2solar(1993, 1, 1, false);
check("음력 1993.1.1 = 양력 1993.1.23(설날)", ny1993 && ny1993.y === 1993 && ny1993.m === 1 && ny1993.d === 23, ny1993 && `${ny1993.y}.${ny1993.m}.${ny1993.d}`);

// 12. 왕복 검증 — 양력→음력→양력 원복 (경계·평범한 날 섞어)
let rtOk = 0;
const rtDates = [[2000, 2, 5], [1993, 1, 23], [1988, 8, 15], [1975, 3, 3], [2010, 12, 31], [1990, 6, 1]];
for (const [y, m, d] of rtDates) {
  const lb = solar2lunar(y, m, d);
  const back = lb && lunar2solar(lb.ly, lb.lm, lb.ld, lb.isLeap);
  if (back && back.y === y && back.m === m && back.d === d) rtOk++;
}
check("음↔양 왕복 원복 6/6", rtOk === 6, `${rtOk}/6`);

// 13. 윤달 구분 — 1993년은 윤3월(LUNAR[1993] leap=3)이 존재하고, 평3월과 다른 날이어야 한다
const m3 = lunar2solar(1993, 3, 1, false), lm3 = lunar2solar(1993, 3, 1, true);
check("음력 1993 윤3월 존재·평3월과 상이", m3 && lm3 && !(m3.m === lm3.m && m3.d === lm3.d), m3 && lm3 ? `평${m3.m}.${m3.d} vs 윤${lm3.m}.${lm3.d}` : "null");

// 14. 간절기 오판 방지 — 음력 설날생(음력 1993.1.1)을 양력으로 정규화하면 계해년(1992 사주년)이 아닌 임신년 경계를 정확히 탄다
//     음력 1993.1.1 = 양력 1993.1.23 → 입춘(2/4) 전이므로 사주년은 임신년(1992)
const sinSaju = calcSaju(ny1993.y, ny1993.m, ny1993.d, 12, 0, false);
check("설날생 사주년: 음력정월=양력1.23=입춘전=임신년", sinSaju.pillars.년 === "임신", sinSaju.pillars.년);

// 15. 대운(v25) — 방향 규칙: 1990=경오년(경=stem6=양). 양년 남=순행, 양년 여=역행
const lon = cityLon("서울");
const duM = daeun(1990, 6, 15, 12, 0, false, lon, true, 2026);
const duF = daeun(1990, 6, 15, 12, 0, false, lon, false, 2026);
check("대운 방향: 양년(경오) 남=순행", duM.dir === "순행", duM.dir);
check("대운 방향: 양년(경오) 여=역행", duF.dir === "역행", duF.dir);
check("대운수 1~10 범위", duM.num >= 1 && duM.num <= 10, `${duM.num}세 시작`);

// 16. 대운 pre 상태 — 대운수 나이 이전이면 아직 첫 대운 전
const duBaby = daeun(1990, 6, 15, 12, 0, false, lon, true, 1992); // 세는 3세 < 대운수 7 → pre
check("대운: 대운수 이전이면 pre=true", duBaby.pre === true, `3세 < 대운수 ${duM.num}`);

// 17. 첫 대운 간지 = 월주 ±1 (순행은 다음 간지) — 정의적 검증
const gi = ["갑","을","병","정","무","기","경","신","임","계"], ji = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
const mp90 = calcSaju(1990, 6, 15, 12, 0, false).pillars.월;
let mpi = -1; for (let i = 0; i < 60; i++) if (gi[i % 10] + ji[i % 12] === mp90) mpi = i;
const expectFwd = gi[(mpi + 1) % 60 % 10] + ji[(mpi + 1) % 60 % 12];
const duFirst = daeun(1990, 6, 15, 12, 0, false, lon, true, 1990 + duM.num); // 대운수 나이 → 첫 대운
check("순행 첫 대운 = 월주 다음 간지", duFirst.pre === false && duFirst.ganji === expectFwd, `${duFirst.ganji} (월주 ${mp90} → 기대 ${expectFwd})`);

execSync("rm -f .mansae-test.tmp.mjs", { cwd: appDir });
const fails = results.filter(r => !r).length;
console.log(`\n=== 만세력 검증: ${results.length - fails}/${results.length} PASS ===`);
if (fails) process.exit(1);
