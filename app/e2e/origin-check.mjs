// /api/judge 출처 허용 규칙 검증 — 실행: node e2e/origin-check.mjs
// 여기가 틀리면 판결 요청이 403이 되어 앱이 통째로 죽는다(유저 눈엔 "판결이 닿지 못했어"만 보인다).
// 자체 도메인을 붙이는 날 가장 먼저 돌려볼 것.
import { isAllowedOrigin } from "../api/judge.js";

const results = [];
const check = (name, pass, note = "") => { results.push({ name, pass }); console.log(`${pass ? "PASS" : "FAIL"} — ${name}${note ? " · " + note : ""}`); };
const ok = (name, origin, env) => check(name, isAllowedOrigin(origin, env) === true, origin);
const no = (name, origin, env) => check(name, isAllowedOrigin(origin, env) === false, origin);

/* 환경변수 미설정 = 지금 운영 상태. 이 블록이 깨지면 배포 즉시 장애다. */
ok("운영 도메인 허용", "https://binari-sepia.vercel.app", undefined);
ok("로컬 dev 허용", "http://localhost:5173", undefined);
ok("로컬 preview 허용", "http://localhost:4173", undefined);
no("빈 Origin 거절", "", undefined);
no("남의 사이트 거절", "https://evil.example.com", undefined);
no("유사 도메인 거절", "https://binari-sepia.vercel.app.evil.com", undefined);
no("http 로 낮춘 운영 도메인 거절", "http://binari-sepia.vercel.app", undefined);

/* 프리뷰 배포 — 내부 테스트를 프리뷰 URL로 돌리려면 열려 있어야 한다.
   끝의 `binari`는 Vercel 팀 슬러그라 외부인이 같은 형태를 만들 수 없다. */
ok("브랜치 별칭 허용", "https://binari-git-main-binari.vercel.app", undefined);
ok("프리뷰 해시 URL 허용", "https://binari-jhw8hw2b1-binari.vercel.app", undefined);
no("남의 vercel.app 거절", "https://evil-project.vercel.app", undefined);
no("팀 슬러그 위조 거절", "https://binari.vercel.app.evil.com", undefined);

/* ALLOWED_ORIGIN 다중 값 — 자체 도메인 전환 시 쓰는 경로 */
const MULTI = "https://binari.life,https://binari-sepia.vercel.app,http://localhost:4173";
ok("다중값: 새 도메인", "https://binari.life", MULTI);
ok("다중값: 기존 도메인 동시 허용", "https://binari-sepia.vercel.app", MULTI);
ok("다중값: 로컬 동시 허용", "http://localhost:4173", MULTI);
no("다중값: 목록에 없으면 거절", "https://binari.today", MULTI);

/* 사람이 흔히 내는 오타 — 끝 슬래시·공백·대문자 */
ok("끝 슬래시 오타 흡수", "https://binari.life", "https://binari.life/");
ok("공백 오타 흡수", "https://binari.life", " https://binari.life , https://x.com ");
ok("대문자 오타 흡수", "https://binari.life", "https://BINARI.life");

/* 단일 값(예전 방식)도 그대로 동작해야 한다 */
ok("단일값 하위호환", "https://binari.life", "https://binari.life");
no("단일값 설정 시 기본목록은 대체됨", "https://binari-sepia.vercel.app", "https://binari.life");

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
