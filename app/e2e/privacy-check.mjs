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
  /* 잡으려던 건 "없는 절차를 안내하는 것"이지 "몇 번 안내하는가"가 아니다.
     횟수를 못 박으면 안내를 한 곳 더 붙일 때마다 검사가 운다(2026-08-15 실제로 울었다). */
  ck("처리방침이 실제 자리를 가리킨다", (pv.match(/사용 통계 수집을 끌래/g) || []).length >= 2,
     `${(pv.match(/사용 통계 수집을 끌래/g) || []).length}곳`);
  ck("처리방침이 '전송 중단'이라고 정확히 적는다", /전송 자체가 중단/.test(pv));
}

/* ── A-3. 계측으로 나가는 자유 서술은 **반드시 anon() 을 거친다** ──
   2026-08-14 엔 "본문을 아예 안 보낸다"가 규칙이었다. 2026-08-15 창업자 지시
   "질문과 답변은 다 남기자. 다만 개인 식별 불가능하게 해"로 규칙이 바뀌었다.
   그래서 검사도 **금지에서 경유 강제로** 바꾼다 — 본문이 나가는 건 되고, 문을 안 거치는 건 안 된다.
   ⚠ track() 안만 본다. setRecords 는 로컬 판결록이라 원문을 들고 있어야 정상이다 —
      파일 전체를 보면 그걸 잡아 헛울음이 난다. **나가는 것과 남는 것은 다르다.** */
{
  const trk = [...src.matchAll(/track\("(question_asked|verdict_shown|detail_shown|letter_written)"[\s\S]{0,1800}?\}\)*;/g)].map((x) => x[0]).join("\n");
  ck("계측 호출을 찾았다(검사가 안 낡았다)", !!trk && /question_asked/.test(trk) && /letter_written/.test(trk));
  ck("질문이 anon 을 거쳐 나간다", /q_anon: anon\(q, birth\.name\)/.test(trk));
  ck("질문 원문 그대로는 안 나간다", !/[{,]\s*q: q[,\s}]/.test(trk));
  ck("판결문이 anon 을 거쳐 나간다", /v_anon: anon\(r1\.verdict/.test(trk));
  ck("판결문 원문 그대로는 안 나간다", !/verdict: r1\.verdict/.test(trk));
  ck("정령 멘트·곁들이는 줄이 anon 을 거친다", /sub_anon: anon\(r2\?\.subline/.test(trk) && /fun_anon: anon\(r2\?\.funLine/.test(trk));
  ck("뒷면 원문 그대로는 안 나간다", !/subline: r2\?\.subline/.test(trk) && !/funline: r2\?\.funLine/.test(trk));
  ck("축별 판단근거가 anon 을 거친다", /const reasonTextMap = \(reasons, name\) => axisMap\(reasons, \(r\) => anon\(r\.text, name\)\)/.test(src));
  ck("서신 본문이 anon 을 거친다", /anon\(c\.body, birth\.name\)/.test(trk));
  ck("길이 지표는 그대로 남는다(가명본 길이 ≠ 원문 길이)", /vlen:/.test(trk) && /sublen:/.test(trk) && /reasons_len:/.test(trk));
  /* 코드가 보내게 됐으면 문서도 따라와야 한다 — 과소 기재는 코드·문서 충돌이자 고지 위반이다 */
  const pv2 = readFileSync(new URL("../public/privacy.html", import.meta.url), "utf8");
  ck("처리방침이 '판결 결과 전체 수집'을 더 안 적는다", !/AI가 생성한 판결 결과 전체/.test(pv2));
  ck("처리방침이 '본문은 전송하지 않는다'는 옛 문장을 안 남긴다", !/본문은 전송하지 않고 글자 수만/.test(pv2));
  ck("처리방침이 무엇을 지우는지 열거한다",
     /주민등록번호/.test(pv2) && /카드·계좌번호/.test(pv2) && /제3자의 이름/.test(pv2));
  ck("처리방침이 '맥락으로 특정될 수 있음'을 숨기지 않는다", /맥락만으로 사람이 좁혀질/.test(pv2));
  ck("처리방침이 공유 링크 실명 제거를 고지한다", /이름은 링크에 담기지 않습니다/.test(pv2));
  ck("처리방침 수집 항목표에 각인 선택 입력이 있다", /혼인 여부, 자녀 유무/.test(pv2));

  /* ── 초대 링크 §5-2 (2026-08-26) ────────────────────────────────────────────
     **저장을 붙이기 전에** 처리방침을 먼저 고쳤다. 화면엔 "서버에 저장하지 않습니다"가 떠 있었고,
     저장을 붙이는 순간 그게 거짓이 된다. 이 리포엔 v127.7 전례가 있다 —
     약속을 먼저 쓰고 코드가 안 따라간 사고. 이번은 반대 방향이고 결과는 같다.
     ⚠ 문장만 고치면 다음 세션이 되돌린다. 그래서 **여기서 문 채운다.** */
  ck("§5-2 초대 링크 절이 있다", /5-2\. 초대 링크/.test(pv2));
  ck("§5-1(판결 공유)은 그대로다 — 그건 지금도 참이다",
     /이 링크는 <strong>판결 내용을 주소 안에 직접 담아<\/strong> 전달하며, <strong>저희 서버에 저장하지 않습니다\.<\/strong>/.test(pv2));
  ck("§5-2 가 저장하는 것을 밝힌다(파생값)", /관계 계산용 파생값/.test(pv2));
  ck("§5-2 가 저장하지 않는 것을 밝힌다(생년월일 원값)",
     /<strong>생년월일·태어난 시각의 원래 값<\/strong>, 질문, 판결문/.test(pv2));
  ck("§5-2 가 보관 기간과 그 강제 수단을 밝힌다",
     /30일 후 자동 삭제/.test(pv2) && /저장소 자체의 만료 기능으로 강제/.test(pv2));
  ck("§5-2 가 제3자 제공에 별도 동의를 밝힌다",
     /별도 동의를 받습니다/.test(pv2) && /보낸 이에게는 아무것도 전달되지 않습니다/.test(pv2));
  ck("§5-2 가 받은 이의 명식은 안 간다고 못 박는다", /어느 경우에도 보낸 이에게 가지 않습니다/.test(pv2));
  ck("§5-2 가 취소 권리를 밝힌다", /취소<\/strong>할 수 있고, 취소하면 <strong>즉시 삭제/.test(pv2));
  /* 정직한 고지 1 — 방향점검 2026-08-26 이 새로 잡은 것: "사이 값은 역산이 안 된다"는
     **제3자에게만 참**이다. 상대는 자기 값을 알므로 미지수가 하나가 되어 풀 수 있다.
     숨기지 않고 보이게 내보내는 게 헌장 기준(유저가 무엇이 나가는지 보고 있는가)이다. */
  ck("§5-2 가 역산 가능성을 숨기지 않는다",
     /그 값들로 생년월일을 되짚을 수는 있습니다/.test(pv2) && /유일한 사람<\/strong>이 됩니다/.test(pv2));
  ck("§5-2 가 한 번만 응답되고 만료됨을 밝힌다", /한 번만 응답되고 만료<\/strong>/.test(pv2));
  /* §보안 「저장 최소화」는 이제 예외를 안고 있다 — 단서 없이 두면 그 줄이 거짓이 된다 */
  ck("§보안 저장 최소화 줄에 초대 단서가 붙어 있다",
     /단 초대를 보낸 경우에 한해, 관계 계산에 필요한 파생값만 30일간 보관합니다/.test(pv2));
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
  /* 2026-08-17 — **이름은 받는다**(창업자 결정). 그래서 이 검사가 지키는 것도 바뀐다:
     "안 받는다"가 아니라 ①연락처는 여전히 안 받고 ②받은 이름은 **기기 밖으로 안 나간다**를 밝히는가. */
  ck("처리방침이 연락처 미수집을 밝힌다", /연락처는 받지 않습니다/.test(pv3));
  ck("처리방침이 곁 이름의 저장·전송 범위를 밝힌다",
     /상대방을 부를 이름/.test(pv3) && /서버·분석 도구·AI 어느 쪽으로도 전송되지 않습니다/.test(pv3));
  ck("처리방침이 이름 대신 자리표를 보낸다는 것을 밝힌다", /자리표만 보내고/.test(pv3));
  ck("처리방침이 기기 저장·미전송을 밝힌다", /서버나 분석 도구로 전송되지 않으며/.test(pv3));
  ck("처리방침이 삭제 방법을 밝힌다", /처음부터 다시」를 누르면\n함께 삭제됩니다|처음부터 다시」를 누르면/.test(pv3));
}

/* ── 가명처리 anon() ─────────────────────────────────────────────────────
   창업자 지시(2026-08-15) "질문과 답변은 다 남기자. 다만 개인 식별 불가능하게 해"로
   질문·판결문·판단근거·서신 본문이 계측에 실린다. 그 문이 anon() 하나뿐이라 여기서 못 박는다.
   ⚠ 이 검사는 "완전 익명화"를 주장하지 않는다 — 맥락 특정은 규칙으로 못 잡는다(설계상 인정).
      여기서 보는 건 **기계적으로 잡히는 식별자는 하나도 안 새는가**와
      **멀쩡한 말을 망가뜨리지 않는가** 둘이다. */
{
  const pick = (re, what) => { const m = src.match(re); if (!m) { console.log(`FAIL — App.jsx 에서 ${what} 못 찾음`); process.exit(1); } return m[0]; };
  const anon = new Function(`${pick(/const stripName = \(t, name\) => \{[\s\S]*?\n\};/, "stripName")}
${pick(/const ANON_MAX = \d+;/, "ANON_MAX")}
${pick(/const NOT_NAME = new Set\(\[[\s\S]*?\]\);/, "NOT_NAME")}
${pick(/function anon\(t, name\) \{[\s\S]*?\n\}/, "anon")}
return anon;`)();

  // ① 기계로 잡히는 식별자는 하나도 남으면 안 된다
  const LEAK = [
    ["연락 줘 kim.dev@gmail.com 로", "gmail.com", "이메일"],
    ["010-1234-5678 로 연락할까", "1234-5678", "휴대폰"],
    ["02)555-1234 말고", "555-1234", "지역번호"],
    ["https://open.kakao.com/o/abc123 이 링크", "kakao.com", "링크"],
    ["www.instagram.com/xyz 봤어", "instagram", "www 링크"],
    ["900101-1234567 이 번호가", "900101", "주민번호"],
    ["카드 5432 1234 8765 4321 로 긁었는데", "8765", "카드번호"],
    ["110-234-567890 으로 보내라는데", "234-567", "계좌"],
    ["@some_handle 이 사람이", "some_handle", "SNS 계정"],
    ["1993년 7월 21일생인데", "1993", "생년월일"],
    ["1993.07.21 에 태어난", "1993", "점 구분 날짜"],
  ];
  for (const [q, leak, what] of LEAK) {
    const o = anon(q, "");
    ck(`${what}가 안 남는다`, !o.includes(leak), o.slice(0, 46));
  }

  // ② 본인 이름 — 이미 stripName 이 맡지만 anon 을 거쳐도 살아 있어야 한다
  ck("본인 이름이 anon 을 거쳐도 지워진다", !anon("지원아, 그 사람한테 연락할까?", "지원").includes("지원"));

  // ③ 호칭이 붙은 남의 이름
  ck("이름+씨 가 가려진다", !anon("민준씨가 어제 그랬는데", "").includes("민준"));
  ck("성+직함에서 성만 가려지고 직함은 남는다", (() => {
    const o = anon("박부장이 회식 가자는데", "");
    return !o.includes("박부장") && o.includes("부장");
  })(), anon("박부장이 회식 가자는데", ""));

  // ④ 멀쩡한 말을 망가뜨리지 않는다 — 여기가 깨지면 데이터가 쓰레기가 된다
  const KEEP = [["선생님한테 물어볼까", "선생님"], ["사장님이 화났어", "사장님"],
    ["부모님께 말씀드릴까", "부모님"], ["고객님이 컴플레인을", "고객님"],
    ["우리 팀장이 그러는데", "우리 팀장"], ["어머님 생신인데", "어머님"],
    ["형님이랑 상의했어", "형님"], ["작가님 답장이 없어", "작가님"]];
  for (const [q, keep] of KEEP) ck(`"${keep}"는 그대로 둔다`, anon(q, "").includes(keep), anon(q, ""));

  // ⑤ 지운 자리에 표시를 남긴다 — 통째로 비우면 나중에 못 읽는다
  ck("지운 자리에 자리표가 남는다", anon("메일 a@b.co 로 줘", "").includes("[메일]"));

  // ⑥ 길이 상한 — 길수록 특정 위험이 올라간다
  ck("상한을 넘으면 자른다", anon("가".repeat(900), "").length <= 601);

  // ⑦ 빈 값·null 에서 안 터진다(계측이 판결을 죽이면 안 된다)
  ck("빈 값에서 안 터진다", anon("", "") === "" && anon(null, null) === "" && anon(undefined, "") === "");

  // ⑧ 처리방침이 이 수집을 실제로 고지하는가 — 코드만 바꾸고 고지를 안 고치면 그게 위반이다
  const pv4 = readFileSync(new URL("../public/privacy.html", import.meta.url), "utf8");
  ck("처리방침이 질문·답변 본문 수집을 고지한다", /가명처리/.test(pv4) && /질문 원문/.test(pv4));
  ck("처리방침에 '질문 원문을 전송하지 않는다'는 옛 문장이 남아 있지 않다",
     !/질문 원문[^。.]{0,40}전송하지 않습니다/.test(pv4.replace(/<[^>]+>/g, "")));
}

/* ── B-3. 공유 링크 고지 ────────────────────────────────────────────────
   처리방침 전문에 '공유/SNS/share' 언급이 0건이었다. 실명은 A-2 로 걷어냈지만
   **질문 원문은 여전히 링크에 실려 나간다** — 그걸 안 적으면 유저는 모르고 보낸다.
   ⚠ 문구는 **코드를 읽고** 써야 한다. 앞서 코드를 안 보고 쓴 초안은 3줄 중 2줄이 사실과 달랐고
      둘 다 우리에게 유리한 방향이었다. 그래서 검사도 payload 와 문서를 **맞대어** 본다. */
{
  const pv = readFileSync(new URL("../public/privacy.html", import.meta.url), "utf8");
  ck("처리방침에 공유 링크 절이 있다", /공유 링크와 이미지 카드에 담기는 정보/.test(pv));
  /* v130 — 각인·궁합 카드가 생겼으니 고지도 같이 커져야 한다. 그림이 늘 때 고지가 0으로 멈추는 게
     A-4-c 가 잡은 그 추세였다(여섯 판 연속 각인은 넓어지고 고지는 0). */
  ck("처리방침이 각인 카드에 담기는 것을 적는다", /각인 이미지 카드/.test(pv) &&
     /생년월일·태어난 시각·이름·건강 관련 서술·짝에 대한 서술·직장 서술은 그림에 들어가지 않습니다/.test(pv));
  ck("처리방침이 궁합 카드의 제3자 원칙을 적는다", /궁합 이미지 카드/.test(pv) &&
     /상대방에 대한 값은 그림에 싣지 않습니다/.test(pv));
  ck("처리방침이 '왜 개수를 제한하는가'를 밝힌다",
     /주기가 다른 나머지값/.test(pv) && /그림 자체를 만들지 않습니다/.test(pv));
  ck("공유 링크가 질문 원문을 싣는다고 적는다", /질문 원문<\/strong>, 판결 방향|질문 원문<\/strong>/.test(pv) && /담깁니다/.test(pv));
  ck("암호화가 아니라고 밝힌다", /암호화되어 있지 않습니다/.test(pv));
  ck("링크가 남는 곳도 읽는다고 밝힌다", /메신저 대화방|브라우저 기록/.test(pv));
  ck("회수 불가를 밝힌다", /회수하는 기능은 제공하지 않습니다/.test(pv));
  ck("이름이 안 실린다고 밝힌다", /담기지 않습니다[\s\S]{0,120}이름 또는 별명/.test(pv));
  ck("부적 이미지에 질문 원문이 없다고 밝힌다", /질문 원문과 이름은 그림에 들어가지 않습니다/.test(pv));
  /* 문서와 코드가 어긋나면 문서가 거짓말이 된다 — payload 필드를 실제로 맞대어 본다 */
  const pay = (src.match(/const payload = \{[^\n]*\}/) || [""])[0];
  /* ⚠ `hx: { n: hexInfo.name }` 은 **괘 이름**이다. "n: 이 있으면 실패"로 걸면 그걸 잡는다(실측).
     막아야 하는 건 **사람 이름이 실리는 것**이므로 값 쪽을 본다. */
  ck("payload 에 이름 필드가 없다", !!pay && !/\bn:\s*(_nm|birth\.name|name\b)/.test(pay),
     pay ? (pay.match(/\bn:\s*[^,}]*/) || ["n 없음"])[0] : "payload 를 못 찾음");
  ck("payload 가 질문 원문을 싣는 게 맞다(문서와 일치)", /\{ q,/.test(pay));
  /* stripName(본인 이름) 위에 gyeotMaskNames(곁 자리표 → 가림말)가 한 겹 더 붙는다.
     곁은 **이 앱을 쓴 적도 동의한 적도 없는 제3자**라, 그 이름이 남의 화면으로 가면 안 된다. */
  ck("판결문·보조문장은 이름을 지운 뒤 싣는다",
     /v: gyeotMaskNames\(stripName\(/.test(pay) && /s: gyeotMaskNames\(stripName\(/.test(pay));
}

/* ── C-1·C-2. 결제가 없는데 판매처럼 보이는 표시 / 이행 못 할 약속 ────────
   ⚠ 주석은 걷어내고 본다 — 규칙의 '왜'를 코드 옆에 적으면 그 주석이 스스로를 잡는다. */
{
  const view = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ck("C-1 결제 전엔 청약철회 배제 고지를 안 건다", !/환불되지 않아|청약\s*철회/.test(view));
  ck("C-1 서신도 시험 발행으로 표시한다", /아홉 하늘 서신[\s\S]{0,160}시험 발행/.test(view));   // v134.3 상품명
  ck("C-1 값을 안 받는다고 적는다", /지금은 시험 발행이라 값을 받지 않아/.test(view));
  ck("C-2 번호로 복원해 준다는 약속이 없다", !/번호를 대고 다시 받으면|번호 <b>\{letterNo[\s\S]{0,80}다시 받을 수 있어/.test(view));
  ck("C-2 기기 밖에선 못 되살린다고 밝힌다", /우리도 되살릴 수 없어/.test(view));
  ck("C-2 대신 실제로 듣는 대책을 준다(파일 저장)", /서신 간직하기 — 파일로/.test(view));
}

/* ── D-1·D-3. 문서가 코드를 따라왔는가 ──────────────────────────────────
   D-1: 온보딩에서 MBTI를 안 묻게 된 지 열네 판이 지났는데 처리방침은 계속 수집 항목으로 적고 있었다.
   D-3: 서신 클릭은 **가격을 보고** 누른 것이고 각인·궁합 클릭은 가격이 안 보인 채 누른 것이었다 —
        나란히 놓고 값을 정할 수 없는 두 숫자였다. 분모(노출 이벤트)도 한쪽에만 있었다. */
{
  const pv = readFileSync(new URL("../public/privacy.html", import.meta.url), "utf8");
  /* 변경 안내(회색 각주)에는 "MBTI를 삭제했습니다"라고 적혀 있어야 하므로 각주는 빼고 본문만 본다 */
  const pvBody = pv.replace(/<span style="color:#777[\s\S]*?<\/span>/g, "");
  ck("D-1 처리방침 본문에 MBTI 수집 기재가 없다", !/MBTI/.test(pvBody),
     (pvBody.match(/.{0,24}MBTI.{0,24}/) || ["본문 깨끗"])[0]);
  ck("D-1 뺐다는 사실은 각주로 남긴다", /MBTI를 삭제했습니다/.test(pv));
  ck("D-1 계측 속성에서도 MBTI를 뺐다", !/mbti: mbti/.test(src));
  /* v128.1: MBTI 저장값을 얼굴 시드로 쓰던 것도 그만뒀다. 네 축(퍼짐·명멸·정연함·속도)을
     명식(십성·달 위상·일간)에서 뽑기 때문에 저장해 둔 코드가 필요 없다.
     보는 것은 **저장값에 기대지 않는가** — 폴백이 되살아나면 옛 유저만 다른 규칙을 타게 된다. */
  ck("D-1 질감을 명식에서 뽑는다(저장값 미사용)",
     /texture\(saju, zo, num, moon\)/.test(src) && !/mem\?\.tex|mbti \|\| texture\(/.test(src));
  ck("D-3 각인 버튼이 값을 보여준다", /각인 — 네가 어떻게 만들어졌는지 · \{IMPRINT_PRICE/.test(src));
  ck("D-3 궁합 버튼이 값을 보여준다", /궁합 — 그 사람과 너 · \{MATCH_PRICE/.test(src));
  ck("D-3 세 상품 모두 노출 이벤트가 있다",
     /imprint_offer_shown/.test(src) && /match_offer_shown/.test(src) && /letter_price_shown/.test(src));
  ck("D-3 노출은 방문당 1회로 묶는다(분모가 안 부푼다)", /trackVisitOnce\("imprint_offer_shown"/.test(src));
}

const pass = R.filter(Boolean).length;
console.log(`\n=== 개인정보·법정고지: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
