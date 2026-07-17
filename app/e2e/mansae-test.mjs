// 만세력 정밀 계산 검증 — 실행: cd app && node e2e/mansae-test.mjs
// App.jsx를 esbuild로 변환해 순수 함수(calcSaju 등)를 직접 임포트한다.
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
execSync("npx esbuild src/App.jsx --format=esm --jsx=automatic --outfile=.mansae-test.tmp.mjs", { cwd: appDir });
const { calcSaju, sunLongitude, equationOfTime, cityLon, moonLongitude, tzolkin } = await import(join(appDir, ".mansae-test.tmp.mjs"));

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

execSync("rm -f .mansae-test.tmp.mjs", { cwd: appDir });
const fails = results.filter(r => !r).length;
console.log(`\n=== 만세력 검증: ${results.length - fails}/${results.length} PASS ===`);
if (fails) process.exit(1);
