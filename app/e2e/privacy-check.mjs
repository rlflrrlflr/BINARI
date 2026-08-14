/* 개인정보·법정고지 A항 검사 — 전략 세션 작업지시(2026-08-14) A-1~A-5
   이 다섯은 **여섯 판(v119~v124) 동안 고쳐지지 않은 채 라이브에 있었다.**
   각인이 여섯 판 연속 넓어지는 동안 고지 줄 수는 0에서 한 번도 안 올라갔다 — 개별 실수가 아니라 추세였다.
   그래서 사람의 기억이 아니라 검사로 못 박는다.

   여기서는 **로직**을 본다(stripName 의 경계). 정적 존재 검사는 health-check 5-i,
   화면 렌더 검사는 e2e/report-check.mjs 가 맡는다.
   실행: node app/e2e/privacy-check.mjs */
import { readFileSync } from "node:fs";

const R = []; const ck = (n, p, g = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${g ? " · " + g : ""}`); };

/* App.jsx 에서 stripName 만 떼어 온다 — import 하면 React 가 딸려 온다(sky-check 와 같은 방식) */
const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const m = src.match(/const stripName = \(t, name\) => \{[\s\S]*?\n\};/);
if (!m) { console.log("FAIL — App.jsx 에서 stripName 을 못 찾음(이름이 바뀌었으면 이 검사를 고쳐야 한다)"); process.exit(1); }
const stripName = new Function(`${m[0]}\nreturn stripName;`)();

/* ── A-2. 공유 링크에 실명이 안 실린다 ────────────────────────────────────
   설계 헌장: "공유 링크·이미지 — 실명은 절대 싣지 않는다."
   `?v=` 는 base64 인코딩만 거친 평문이라 링크가 남는 곳은 전부 읽는다.
   ⚠ payload 의 n 필드만 지우면 부족하다 — SYS 프롬프트가 판결문 안에서 이름을 부르게 하고 있어
      실명이 verdict/subline **본문 문자열**에 실린다. */
const CASES = [
  ["지원아, 오늘은 보내지 마.", "지원", "호격 아"],
  ["보내지 마. 지원아.", "지원", "문장 끝 호격"],
  ["지원, 오늘은 보내지 마.", "지원", "첫머리 호명"],
  ["민준님, 그건 아니야.", "민준", "님"],
  ["서연 씨한테 먼저 연락해.", "서연", "씨 + 조사"],
  ["하늘아 오늘은 하늘이 흐려.", "하늘", "흔한 명사와 겹치는 이름"],
  ["오늘은 지원 아끼지 말고 다 써.", "지원", "이름이 아니라 명사"],
  ["이름 없이 나온 판결이야.", "지원", "이름 없음"],
];
let leak = 0;
for (const [t, n, label] of CASES) {
  const o = stripName(t, n);
  const bad = o.includes(n);
  if (bad) leak++;
  ck(`실명이 안 남는다 — ${label}`, !bad, bad ? `"${o}"` : "");
}
ck("여덟 경우 전부 누출 0", leak === 0, `${leak}건`);

/* 지우고 남은 부스러기가 화면에 나가면 안 된다 — "보내지 마. ." 가 실제로 나왔다 */
ck("지운 자리에 부스러기가 안 남는다",
   !/\s[.,、]|^[.,、]|[.!?…]\s*[.,、]/.test(stripName("보내지 마. 지원아.", "지원")),
   `"${stripName("보내지 마. 지원아.", "지원")}"`);
ck("이름이 없으면 원문 그대로", stripName("이름 없이 나온 판결이야.", "지원") === "이름 없이 나온 판결이야.");
ck("한 글자 이름은 손대지 않는다(오탐이 너무 커진다)",
   stripName("이 판결은 김이 맞다고 해.", "김") === "이 판결은 김이 맞다고 해.");
ck("빈 입력에 안 죽는다", stripName("", "지원") === "" && stripName("아무 말", "") === "아무 말");

/* ── A-2. payload·수신화면 코드에 실명 경로가 없다 ── */
ck("공유 payload 에 n 필드가 없다", !/n: \(birth\.name/.test(src));
ck("구링크의 n 은 폐기한다", /delete o\.n;/.test(src));
ck("수신 화면에 실명 폴백이 없다", !/sharedIn\.n \?/.test(src));

/* ── A-1. 처리방침이 안내한 거부 수단이 실재한다 ──
   문서가 "해제하면 수집이 중단됩니다"라고 두 번 안내하는데 v122 에서 체크박스가 사라졌고,
   PROFILE_KEYS 가 빈 집합이라 손으로 키를 바꿔도 아무것도 안 막혔다.
   ⚠ 속성 제거가 아니라 **전송 중단**이어야 한다 — 속성만 지우면 여전히 이벤트는 나간다. */
ck("거부 키가 있다", /const OPTOUT_KEY = "binari\.analytics_optout\.v1"/.test(src));
ck("거부하면 track 이 조기 반환한다(전송 자체를 멈춘다)", /if \(_optout\) return;/.test(src));
ck("거부 시 대기 큐도 버린다", /_q\.length = 0/.test(src));
ck("거부 UI 가 화면에 있다", /사용 통계 수집을 끌래/.test(src));
/* 문서가 가리키는 자리와 실제 자리가 같아야 한다 — v122 는 체크박스를 지우면서 문서를 안 고쳐
   "온보딩의 분석 동의를 해제하라"는 존재하지 않는 절차를 두 곳에서 안내하고 있었다. */
{
  const pv = readFileSync(new URL("../public/privacy.html", import.meta.url), "utf8");
  ck("처리방침이 없는 절차를 안내하지 않는다", !/온보딩의 분석 동의를 해제/.test(pv));
  ck("처리방침이 실제 자리를 가리킨다", (pv.match(/사용 통계 수집을 끌래/g) || []).length === 2,
     `${(pv.match(/사용 통계 수집을 끌래/g) || []).length}/2곳`);
  ck("처리방침이 '전송 중단'이라고 정확히 적는다", /전송 자체가 중단/.test(pv));
}

/* ── A-3. 계측에 원문이 안 나간다 ──
   ⚠ track() 안만 본다. setRecords 는 로컬 판결록이라 원문을 들고 있어야 정상이다 —
      파일 전체를 보면 그걸 잡아 헛울음이 난다. **나가는 것과 남는 것은 다르다.** */
{
  const trk = [...src.matchAll(/track\("(verdict_shown|detail_shown)"[\s\S]{0,1600}?\}\)*;/g)].map((x) => x[0]).join("\n");
  ck("계측 호출을 찾았다(검사가 안 낡았다)", !!trk);
  ck("앞면 원문을 안 보낸다", !/verdict: r1\.verdict/.test(trk) && /vlen:/.test(trk));
  ck("뒷면 원문을 안 보낸다", !/subline: r2\?\.subline/.test(trk) && !/funline: r2\?\.funLine/.test(trk));
  ck("근거는 축별 길이만 보낸다", /axisMap\(reasons, \(r\) => String\(r\.text \|\| ""\)\.length\)/.test(src));
  /* 코드가 안 보내게 됐으면 문서도 따라와야 한다 — 과대 기재도 코드·문서 충돌이다 */
  const pv2 = readFileSync(new URL("../public/privacy.html", import.meta.url), "utf8");
  ck("처리방침이 '판결 결과 전체 수집'을 더 안 적는다", !/AI가 생성한 판결 결과 전체/.test(pv2));
  ck("처리방침이 '글자 수만'이라고 정확히 적는다", /글자 수만<\/strong> 기록합니다/.test(pv2));
  ck("처리방침이 공유 링크 실명 제거를 고지한다", /이름은 링크에 담기지 않습니다/.test(pv2));
  ck("처리방침 수집 항목표에 각인 선택 입력이 있다", /혼인 여부, 자녀 유무/.test(pv2));
}

/* ── A-4. 각인·궁합에 고지가 있다 ──
   각인은 LLM 을 안 타므로 판결의 S3 가드레일을 **구조적으로 통과하지 않는다.**
   ⚠ 고지는 **문서 하단 고정 블록**이어야 한다 — 절마다 붙이면 다음 판에서 또 빠진다.
   ⚠ 클래스 이름은 컨테이너(.imp)와 겹치면 안 된다. 처음에 `ainote imp` 로 붙였다가
      `.imp` 셀렉터가 둘을 잡아 회귀가 빨개졌다(v111 의 .decl→.dcl 과 같은 사고). */
ck("각인·궁합 고지가 둘 다 있다", (src.match(/className="ainote docnote"/g) || []).length === 2,
   `${(src.match(/className="ainote docnote"/g) || []).length}/2`);
ck("고지 클래스가 컨테이너와 안 겹친다", !/className="ainote imp"/.test(src));
ck("의료 조언이 아니라고 적는다", /의료·법률·재무 조언이 아니야/.test(src) && /병원에 가는 게 먼저/.test(src));
{
  const imp = readFileSync(new URL("../src/lib/imprint.js", import.meta.url), "utf8");
  ck("나이를 특정해 발병을 단정하지 않는다", !/크게 앓을 수 있어/.test(imp),
     (imp.match(/.{0,16}크게 앓을 수 있어.{0,16}/) || [""])[0]);
  ck("건강 각주가 근거의 급을 밝힌다", /이건 의료 판단이 아니다/.test(imp) && /검증한 적이 없다/.test(imp));
}

/* ── A-5. 공유 수신 화면·부적 이미지에 AI 표시가 있다 ──
   수신 화면은 뷰포트를 덮어 아래 깔린 온보딩 고지가 **물리적으로 안 보인다.**
   링크로 처음 들어온 사람에게는 거기가 비나리의 첫 화면이다.
   이미지는 앱 밖으로 나가 혼자 돌아다니므로 그림 안에 넣지 않으면 표시가 사라진다. */
ck("부적 이미지에 AI 표시를 그린다", /AI가 생성한 내용 · 재미로 보는 참고용/.test(src));
{
  const seg = src.slice(src.indexOf("sharedcta"), src.indexOf("sharedcta") + 700);
  ck("공유 수신 화면에 AI 표시가 있다", /ainote/.test(seg));
}

/* ── A-6. 남의 생년월일이 리셋에 지워지는가 ──────────────────────────────
   v125 가 궁합을 붙이면서 **제3자의 생년월일**이 앱에 들어왔다. 지금까지 다룬 값과 등급이 다르다 —
   **그 사람은 이 앱을 쓴 적도, 동의한 적도 없다.**
   그런데 저장 키가 밑줄이라 `clearMemory` 에도 내보내기 스윕에도 안 걸렸다.
   ⚠ 재발 검사는 **저장 호출 패턴으로 좁혀야 한다** — `binari_bujeok` 은 다운로드 파일명,
      `__binari_t` 는 가용성 프로브라 "binari_ 로 시작하면 실패"로 걸면 매번 오탐한다. */
{
  const under = [...src.matchAll(/(?:localStorage|store)\.(?:get|set|remove)Item\("(binari_[A-Za-z0-9_]*)"/g)].map((m) => m[1]);
  ck("규칙 밖(밑줄) 저장 키가 없다", under.length === 0, [...new Set(under)].join(",") || "0개");
  ck("파일명·프로브는 오탐하지 않는다(검사가 좁다)",
     /binari_bujeok/.test(src) && !under.includes("binari_bujeok"), "파일명은 저장 키가 아니다");
  ck("각인·궁합 키가 binari. 접두다",
     /const IMPRINT_EXTRA_KEY = "binari\./.test(src) && /const MATCH_LAST_KEY = "binari\./.test(src));
  ck("구키를 한 번 옮기고 지운다", /migrateUnderscoreKeys/.test(src) && /localStorage\.removeItem\(oldK\)/.test(src));
  const cm = (src.match(/function clearMemory\(\)[\s\S]{0,900}?\n\}/) || [""])[0];
  ck("리셋이 binari. 전량을 쓴다", /localStorage\.key\(i\)/.test(cm) && /indexOf\("binari\."\) === 0/.test(cm));
  ck("리셋이 팀 플래그는 남긴다(계측 오염 방지)", /k !== INTERNAL_KEY/.test(cm));
  ck("리셋이 분석 신원도 끊는다", /_ph\?\.reset\?\.\(\)/.test(cm));
  /* 처리방침 — 본인 정보만 적힌 표에 남의 정보가 조용히 추가돼 있었다 */
  const pv3 = readFileSync(new URL("../public/privacy.html", import.meta.url), "utf8");
  ck("처리방침 표에 상대방 생년월일이 있다", /상대방의 생년월일/.test(pv3));
  ck("처리방침이 상대 이름·연락처 미수집을 밝힌다", /이름·연락처는 받지 않습니다/.test(pv3));
  ck("처리방침이 기기 저장·미전송을 밝힌다", /서버나 분석 도구로 전송되지 않으며/.test(pv3));
  ck("처리방침이 삭제 방법을 밝힌다", /처음부터 다시」를 누르면\n함께 삭제됩니다|처음부터 다시」를 누르면/.test(pv3));
}

const pass = R.filter(Boolean).length;
console.log(`\n=== 개인정보·법정고지: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
